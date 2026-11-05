import { z } from 'zod';
import {
  ContentBundleSchema,
  OfficeLevelSchema,
  FamilyClassSchema,
  MemoryTypeSchema,
  QualificationSchema,
  STAT_KEYS,
  TRAIT_KEYS,
  type ContentBundle,
} from './content.js';

export * from './content.js';

/* ------------------------------------------------------------------ *
 * Version registry. Every persisted artefact records these.
 * Bump rules are documented in docs/ARCHITECTURE.md §Versioning.
 * ------------------------------------------------------------------ */
export const SCHEMA_VERSION = 8;
export const ENGINE_VERSION = '0.8.0';
export const RULES_VERSION = '0.8.0';
export const CONTENT_VERSION = '0.8.0';

/* ------------------------------ primitives ------------------------- */
export const IdSchema = z.string().min(1).max(128);
export type Id = z.infer<typeof IdSchema>;

/** Gregorian date. The simulation clock always sits on the birth day-of-month (clamped to month length). */
export const SimDateSchema = z.object({
  year: z.number().int().min(1900).max(3000),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
});
export type SimDate = z.infer<typeof SimDateSchema>;

/** sfc32 state: four unsigned 32-bit integers. */
export const RngStateSchema = z.tuple([
  z.number().int().min(0).max(0xffffffff),
  z.number().int().min(0).max(0xffffffff),
  z.number().int().min(0).max(0xffffffff),
  z.number().int().min(0).max(0xffffffff),
]);
export type RngState = z.infer<typeof RngStateSchema>;

const Stat = z.number().int().min(0).max(100);
export const StatsSchema = z.object({
  health: Stat,
  happiness: Stat,
  intelligence: Stat,
  appearance: Stat,
  energy: Stat,
  /** Higher = more stressed. */
  stress: Stat,
  charisma: Stat,
  fitness: Stat,
});
export type Stats = z.infer<typeof StatsSchema>;

export const TraitsSchema = z.object({
  resilience: Stat,
  impulsivity: Stat,
  selfControl: Stat,
  ambition: Stat,
  empathy: Stat,
  curiosity: Stat,
  discipline: Stat,
  riskTolerance: Stat,
  adaptability: Stat,
});
export type Traits = z.infer<typeof TraitsSchema>;
export { STAT_KEYS, TRAIT_KEYS };

/** Hidden biological predispositions: small, never deterministic. */
export const PredispositionsSchema = z.object({
  /** Higher = lower mortality (±20% at the extremes). */
  longevity: Stat,
  /** Higher = health declines more slowly with age and stress. */
  robustness: Stat,
});
export type Predispositions = z.infer<typeof PredispositionsSchema>;

/** Learned abilities that grow with experience. */
export const SkillsSchema = z.object({ social: Stat, technical: Stat, creative: Stat, physical: Stat });
export type Skills = z.infer<typeof SkillsSchema>;

/* ------------------------------ simulation state machine ----------- */
export const SimulationStatusSchema = z.enum([
  'IDLE',
  'RUNNING',
  'PAUSED_EVENT',
  'RESOLVING',
  'COMPLETED',
  'ERROR',
]);
export type SimulationStatus = z.infer<typeof SimulationStatusSchema>;

/* ------------------------------ GameState -------------------------- */
const RelStat = z.number().int().min(0).max(100);
export const RelDimsSchema = z.object({
  affection: RelStat,
  trust: RelStat,
  respect: RelStat,
  attraction: RelStat,
  familiarity: RelStat,
  conflict: RelStat,
  commitment: RelStat,
});
export type RelDims = z.infer<typeof RelDimsSchema>;

export const MemorySchema = z.object({
  year: z.number().int(),
  type: MemoryTypeSchema,
  otherId: IdSchema,
  valence: z.union([z.literal(1), z.literal(-1)]),
  weight: z.number().int().min(1).max(3),
});
export type Memory = z.infer<typeof MemorySchema>;

/** A persistent non-player character: own traits, parents, and a bounded memory of what happened to them. */
export const NpcSchema = z.object({
  id: IdSchema,
  givenName: z.string(),
  familyName: z.string(),
  birthYear: z.number().int(),
  deathYear: z.number().int().nullable(),
  traits: TraitsSchema,
  predispositions: PredispositionsSchema,
  talents: z.array(z.string()).max(5),
  class: FamilyClassSchema,
  countryCode: z.string().length(2),
  /** Biological parents (0–2). The genealogy graph must stay acyclic. */
  parentIds: z.array(IdSchema).max(2),
  memories: z.array(MemorySchema).max(12),
});
export type Npc = z.infer<typeof NpcSchema>;

/** Directed feelings of `from` towards `to`. The two directions are stored separately, so they can differ. */
export const RelationshipSchema = z.object({
  from: IdSchema,
  to: IdSchema,
  bond: z.enum(['family', 'friend', 'romantic', 'ex']),
  dims: RelDimsSchema,
});
export type Relationship = z.infer<typeof RelationshipSchema>;

export const UnionSchema = z.object({
  id: IdSchema,
  members: z.tuple([IdSchema, IdSchema]),
  status: z.enum(['dating', 'married', 'ended']),
  startYear: z.number().int(),
  endYear: z.number().int().nullable(),
});
export type Union = z.infer<typeof UnionSchema>;

export const StorySchema = z.object({
  stage: z.number().int().min(1),
  since: z.number().int(),
  subjectId: z.string().nullable(),
});
export type Story = z.infer<typeof StorySchema>;

export const ChronicleEntrySchema = z.object({
  generation: z.number().int().min(1),
  personId: IdSchema,
  name: z.string(),
  birthYear: z.number().int(),
  deathYear: z.number().int(),
  cause: z.string(),
  currency: z.string().length(3),
  netWorth: z.number().int(),
  minorUnits: z.union([z.literal(1), z.literal(100)]).default(100),
  qualifications: z.array(QualificationSchema),
  lastProfession: z.string().nullable(),
  children: z.number().int().min(0),
  /** Informational: whether this life was played with GOD MODE. */
  godMode: z.boolean().default(false),
});
export type ChronicleEntry = z.infer<typeof ChronicleEntrySchema>;

export const EducationSchema = z.object({
  stage: z.enum(['none', 'primary', 'secondary', 'choice', 'university', 'vocational', 'postgraduate', 'finished']),
  /** Which postgraduate degree is being pursued while the stage is `postgraduate`. */
  postgraduate: z.enum(['master', 'doctorate']).nullable(),
  yearsInStage: z.number().int().min(0),
  /** Running academic performance 0–100. */
  performance: Stat,
  qualifications: z.array(QualificationSchema),
  scholarship: z.boolean(),
});
export type Education = z.infer<typeof EducationSchema>;

export const JobSchema = z.object({
  professionId: z.string(),
  level: z.number().int().min(1),
  yearsInRole: z.number().int().min(0),
  /** Annual gross salary in local minor units. */
  salary: z.number().int().min(0),
  specialization: z.string().nullable(),
});
export type Job = z.infer<typeof JobSchema>;

/**
 * Macro conditions for the current year, produced by the World Engine (the only source of rates).
 * Every figure is in basis points per year.
 */
export const EconomySchema = z.object({
  inflationBp: z.number().int(),
  growthBp: z.number().int(),
  /** Policy/lending base rate. */
  rateBp: z.number().int().min(0),
  stockReturnBp: z.number().int(),
  housingBp: z.number().int(),
});
export type Economy = z.infer<typeof EconomySchema>;

/** One country in the persistent world: aggregate population (level C) plus its own economy, politics and environment. */
export const CountryStateSchema = z.object({
  code: z.string().length(2),
  /** Total inhabitants. Individually simulated people (protagonist, NPCs) are `tracked`; the rest is aggregate. */
  population: z.number().int().positive(),
  tracked: z.number().int().min(0),
  priceIndex: z.number().int().positive(),
  economy: EconomySchema,
  environment: z.object({ emissions: z.number().int().min(0), stress: z.number().int().min(0).max(100) }),
  politics: z.object({
    governingParty: z.string(),
    approvalBp: z.number().int().min(0).max(10_000),
    lastElection: z.number().int(),
    termYears: z.number().int().min(1).max(8),
    /** Multiplier on income tax (bp, 0 = unchanged). */
    taxAdjustBp: z.number().int().min(-3000).max(3000),
    /** Welfare generosity (bp of the baseline safety net). */
    welfareBp: z.number().int().min(0).max(8000),
    /** Public debt as bp of GDP. */
    debtBp: z.number().int().min(0).max(40_000),
  }),
});
export type CountryState = z.infer<typeof CountryStateSchema>;

export const WorldEventSchema = z.object({
  year: z.number().int(),
  countryCode: z.string().nullable(),
  kind: z.enum(['ELECTION', 'RECESSION', 'BOOM', 'DISASTER', 'POLICY', 'MIGRATION_WAVE', 'FISCAL_CRISIS']),
  detail: z.string(),
});
export type WorldEvent = z.infer<typeof WorldEventSchema>;

export const LegalCaseSchema = z.object({
  offense: z.enum(['offence', 'accusation']),
  severity: z.number().int().min(1).max(3),
  stage: z.enum(['investigation', 'charged', 'trial', 'imprisoned']),
  evidence: z.number().int().min(0).max(100),
  sinceYear: z.number().int(),
  lawyer: z.boolean(),
  plea: z.boolean(),
  /** Year the sentence ends (only while imprisoned). */
  releaseYear: z.number().int().nullable(),
});
export type LegalCase = z.infer<typeof LegalCaseSchema>;

/** Civic life: politics, justice, fame, residence and citizenship. */
export const SocietySchema = z.object({
  party: z.string().nullable(),
  office: OfficeLevelSchema.nullable(),
  officeSince: z.number().int().nullable(),
  /** An offence not (yet) known to the authorities. */
  hiddenOffence: z.object({ severity: z.number().int().min(1).max(3), year: z.number().int(), evidence: z.number().int().min(0).max(100) }).nullable(),
  legal: LegalCaseSchema.nullable(),
  /** True after any conviction (an accusation or an acquittal never sets it). */
  record: z.boolean(),
  fame: z.object({
    notoriety: Stat,
    credibility: Stat,
    influence: Stat,
    reputation: Stat,
  }),
  citizenships: z.array(z.string().length(2)).min(1),
  residence: z.object({ countryCode: z.string().length(2), status: z.enum(['citizen', 'resident', 'visa']), since: z.number().int(), visaUntil: z.number().int().nullable() }),
  /** Whether each qualification held is recognised in the current country. */
  unrecognized: z.array(QualificationSchema),
});
export type Society = z.infer<typeof SocietySchema>;

export const PropertySchema = z.object({
  id: IdSchema,
  purchaseYear: z.number().int(),
  purchasePrice: z.number().int().positive(),
  /** Current market value (revalued every January from the housing index). */
  value: z.number().int().min(0),
  loan: z.number().int().min(0),
  paymentMonthly: z.number().int().min(0),
  rateBp: z.number().int().min(0),
  /** Consecutive months the household had to borrow to keep up. */
  missed: z.number().int().min(0),
});
export type Property = z.infer<typeof PropertySchema>;

/** A company with its OWN double-entry ledger; owners are never liable beyond their stake. */
export const BusinessSchema = z.object({
  id: IdSchema,
  name: z.string(),
  sector: z.string(),
  foundedYear: z.number().int(),
  /** The protagonist or an NPC (after inheritance across generations). */
  ownerId: IdSchema,
  ownerSharePct: z.number().int().min(1).max(100),
  employees: z.number().int().min(0),
  /** This year's idiosyncratic demand shock in basis points (new competitor, lost client…), drawn each January. */
  demandShockBp: z.number().int(),
  status: z.enum(['active', 'closed']),
  closedReason: z.enum(['sold', 'bankrupt', 'dissolved']).nullable(),
  /** Signed balances like the personal ledger; the sum is always zero. */
  accounts: z.record(z.string(), z.number().int()),
  thisYear: z.object({ revenue: z.number().int(), costs: z.number().int(), tax: z.number().int(), interest: z.number().int() }),
  lastYear: z.object({ revenue: z.number().int(), costs: z.number().int(), tax: z.number().int(), interest: z.number().int() }).nullable(),
});
export type Business = z.infer<typeof BusinessSchema>;

export const YearTotalsSchema = z.object({
  income: z.number().int(),
  tax: z.number().int(),
  living: z.number().int(),
  interest: z.number().int(),
  other: z.number().int(),
});
export type YearTotals = z.infer<typeof YearTotalsSchema>;

/**
 * Double-entry balances in local minor units. Signed: assets/expenses positive, liabilities/income/equity
 * negative, so the sum of ALL accounts is always exactly zero (checked by validateState).
 */
export const FinanceSchema = z.object({
  currency: z.string().length(3),
  /** Internal minor units per major unit of the currency (100, or 1 for high-nominal currencies). */
  minorUnits: z.union([z.literal(1), z.literal(100)]),
  accounts: z.record(z.string(), z.number().int()),
  thisYear: YearTotalsSchema,
  lastYear: YearTotalsSchema.nullable(),
  /** Net investment gains realised this year (taxed at the next birthday; losses are not carried forward). */
  gainsThisYear: z.number().int(),
});
export type Finance = z.infer<typeof FinanceSchema>;

export const PendingDecisionSchema = z.object({
  eventId: z.string(),
  instanceId: IdSchema,
  /** Profession ids offered, for `dynamicOffers: 'jobs'` events. */
  offers: z.array(z.string()),
  /** NPC the event is about (already stored in `npcs`). */
  actorId: z.string().nullable(),
});
export type PendingDecision = z.infer<typeof PendingDecisionSchema>;

export const GodLogEntrySchema = z.object({
  revision: z.number().int().min(0),
  year: z.number().int(),
  action: z.enum(['ENABLED', 'DISABLED', 'EDITED']),
  targetId: z.string().nullable(),
  targetName: z.string().nullable(),
  changes: z.array(z.object({ path: z.string(), from: z.string(), to: z.string() })),
});
export type GodLogEntry = z.infer<typeof GodLogEntrySchema>;

/**
 * Fixed when the life is created and never changed afterwards (UI Redesign v3.0, T71). Not editable from
 * settings, from game actions, or by importing or migrating a save.
 */
export const LifeConfigSchema = z.object({
  godModeEnabled: z.boolean(),
  /** How the value came to be: chosen at creation, or derived when an older save was migrated (T72). */
  godModeOrigin: z.enum(['chosen', 'migrated-from-usage', 'migrated-no-usage']),
});
export type LifeConfig = z.infer<typeof LifeConfigSchema>;

/** Birth years a new life can start from: the contemporary era the datasets describe (decision 1). */
export const SUPPORTED_BIRTH_YEARS = { min: 1990, max: 2100 } as const;

/** What GOD MODE did in this life (informational). Whether it is on lives in `config.godModeEnabled`. */
export const GodModeSchema = z.object({
  edits: z.number().int().min(0),
  log: z.array(GodLogEntrySchema).max(200),
});
export type GodMode = z.infer<typeof GodModeSchema>;

/**
 * What GOD MODE may change: names, visible stats, personality traits, predispositions, talents and skills.
 * The object is STRICT: anything else (money, career, degrees, laws, world, future events, genealogy,
 * history, relationships) is rejected, not ignored.
 */
export const GodPatchSchema = z
  .object({
    givenName: z.string().trim().min(1).max(64),
    familyName: z.string().trim().min(1).max(64),
    stats: StatsSchema.partial().strict(),
    traits: TraitsSchema.partial().strict(),
    predispositions: PredispositionsSchema.partial().strict(),
    talents: z.array(z.string().min(1)).max(5),
    skills: SkillsSchema.partial().strict(),
  })
  .partial()
  .strict();
export type GodPatch = z.infer<typeof GodPatchSchema>;

export const PersonSchema = z.object({
  id: IdSchema,
  givenName: z.string().min(1).max(64),
  familyName: z.string().min(1).max(64),
  birth: SimDateSchema,
  stats: StatsSchema,
  traits: TraitsSchema,
  predispositions: PredispositionsSchema,
  talents: z.array(z.string()).max(5),
  skills: SkillsSchema,
  parentIds: z.array(IdSchema).max(2),
  /** Null while alive. */
  death: z.object({ date: SimDateSchema, cause: z.string() }).nullable(),
});
export type Person = z.infer<typeof PersonSchema>;

export const GameStateSchema = z.object({
  schemaVersion: z.number().int().positive(),
  id: IdSchema,
  /** Incremented by exactly 1 per accepted, state-changing command. */
  revision: z.number().int().min(0),
  seed: z.string().min(1),
  rng: RngStateSchema,
  rulesVersion: z.string(),
  contentVersion: z.string(),
  dynasty: z.object({ id: IdSchema, generation: z.number().int().min(1), chronicle: z.array(ChronicleEntrySchema) }),
  world: z.object({
    /** Start of the very first generation of this world. */
    originDate: SimDateSchema,
    /** Birth date of the current protagonist. */
    startDate: SimDateSchema,
    currentDate: SimDateSchema,
    /** Price level ×10000, compounded each January by the World Engine's inflation. */
    priceIndex: z.number().int().positive(),
    /** Mirror of the protagonist's country economy (kept in sync by the World Engine). */
    economy: EconomySchema,
    countries: z.record(z.string(), CountryStateSchema),
    history: z.array(WorldEventSchema).max(80),
  }),
  simulation: z.object({
    status: SimulationStatusSchema,
    /** Months already processed in the in-flight year (0 when no year is in flight). */
    monthsDone: z.number().int().min(0).max(12),
    pending: PendingDecisionSchema.nullable(),
  }),
  location: z.object({ countryCode: z.string().length(2), city: z.string() }),
  protagonist: PersonSchema,
  /** Household class the protagonist is born into; guardian is set while a minor has no living parent. */
  family: z.object({ class: FamilyClassSchema, guardianId: z.string().nullable() }),
  npcs: z.record(z.string(), NpcSchema),
  /** Key `${from}>${to}`. Only relationships involving the protagonist are tracked. */
  relationships: z.record(z.string(), RelationshipSchema),
  unions: z.record(z.string(), UnionSchema),
  stories: z.record(z.string(), StorySchema),
  society: SocietySchema,
  properties: z.record(z.string(), PropertySchema),
  businesses: z.record(z.string(), BusinessSchema),
  education: EducationSchema,
  career: z.object({ job: JobSchema.nullable(), retired: z.boolean(), pension: z.number().int().min(0) }),
  finance: FinanceSchema,
  /** Event bookkeeping: last year fired and total count per event id, plus story flags. */
  eventLog: z.record(z.string(), z.object({ lastYear: z.number().int(), count: z.number().int() })),
  flags: z.record(z.string(), z.literal(true)),
  /** GOD MODE: a switch and an informational log of edits (it never disables achievements or goals). */
  /** Fixed at creation: see LifeConfigSchema. */
  config: LifeConfigSchema,
  godMode: GodModeSchema,
  /** Unlocked achievements (id → year). Shared by normal play and GOD MODE; they only ever grow. */
  achievements: z.record(z.string(), z.number().int()),
  /** Idempotency guard: id of the last accepted command. */
  lastCommandId: z.string().nullable(),
});
export type GameState = z.infer<typeof GameStateSchema>;

/* ------------------------------ commands --------------------------- */
const CommandBase = {
  /** Client-generated; re-sending the same id is a no-op (idempotent). */
  commandId: IdSchema,
  /** Optimistic concurrency: must equal state.revision. */
  expectedRevision: z.number().int().min(0),
};

export const EngineCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ADVANCE_YEAR'), ...CommandBase }),
  z.object({ type: z.literal('RESOLVE_EVENT'), ...CommandBase, choiceId: z.string().min(1) }),
  z.object({ type: z.literal('GOD_TOGGLE'), ...CommandBase, enabled: z.boolean() }),
  z.object({ type: z.literal('GOD_EDIT'), ...CommandBase, targetId: IdSchema, patch: GodPatchSchema }),
]);
export type EngineCommand = z.infer<typeof EngineCommandSchema>;

/* ------------------------------ domain events ---------------------- */
const EventBase = {
  /** Stable: `${gameId}:${revision}:${sequence}` */
  id: IdSchema,
  revision: z.number().int().min(0),
  sequence: z.number().int().min(0),
  at: SimDateSchema,
};
const ev = <T extends string, P extends z.ZodRawShape>(type: T, payload: P) =>
  z.object({ ...EventBase, type: z.literal(type), payload: z.object(payload) });

export const DomainEventSchema = z.discriminatedUnion('type', [
  ev('LIFE_CREATED', { personId: IdSchema, seed: z.string(), countryCode: z.string() }),
  ev('MONTH_ADVANCED', { from: SimDateSchema, to: SimDateSchema }),
  ev('BIRTHDAY', { personId: IdSchema, age: z.number().int().min(0) }),
  ev('YEAR_COMPLETED', { personId: IdSchema, age: z.number().int().min(0) }),
  ev('EVENT_TRIGGERED', { eventId: z.string(), instanceId: IdSchema }),
  ev('EVENT_RESOLVED', {
    eventId: z.string(),
    choiceId: z.string(),
    outcomeId: z.string(),
    actorName: z.string().nullable(),
  }),
  ev('SOCIAL', {
    change: z.enum([
      'FRIEND_MADE',
      'FRIEND_FADED',
      'ROMANCE_STARTED',
      'MARRIED',
      'SEPARATED',
      'CHILD_BORN',
      'RELATIVE_BORN',
      'GUARDIAN_ASSIGNED',
      'STORY_STARTED',
      'STORY_ENDED',
    ]),
    otherName: z.string().nullable(),
    detail: z.string().nullable(),
  }),
  ev('EDUCATION_CHANGED', {
    change: z.enum(['ENROLLED', 'GRADUATED', 'DROPPED_OUT', 'FINISHED']),
    stage: z.string(),
    qualification: QualificationSchema.nullable(),
  }),
  ev('JOB_CHANGED', {
    change: z.enum(['HIRED', 'PROMOTED', 'RAISE', 'LOST', 'RETIRED', 'SPECIALIZED']),
    professionId: z.string().nullable(),
    salary: z.number().int(),
  }),
  ev('ASSET_CHANGED', {
    change: z.enum([
      'INVESTED',
      'DIVESTED',
      'HOME_BOUGHT',
      'HOME_SOLD',
      'HOME_FORECLOSED',
      'BUSINESS_FOUNDED',
      'BUSINESS_EXPANDED',
      'BUSINESS_SOLD',
      'BUSINESS_BANKRUPT',
      'BUSINESS_INHERITED',
    ]),
    label: z.string().nullable(),
    amount: z.number().int(),
  }),
  ev('GOD', { action: z.enum(['ENABLED', 'DISABLED', 'EDITED']), targetId: z.string().nullable(), targetName: z.string().nullable(), changes: z.number().int().min(0) }),
  ev('ACHIEVEMENT', { id: z.string() }),
  ev('WORLD', { kind: WorldEventSchema.shape.kind, countryCode: z.string().nullable(), detail: z.string() }),
  ev('SOCIETY', {
    change: z.enum([
      'JOINED_PARTY',
      'LEFT_PARTY',
      'ELECTED',
      'RE_ELECTED',
      'OFFICE_LOST',
      'RESIGNED',
      'POLICY_PASSED',
      'OFFENCE_COMMITTED',
      'INVESTIGATION_OPENED',
      'CASE_DROPPED',
      'CHARGED',
      'ACQUITTED',
      'CONVICTED',
      'RELEASED',
      'MOVED',
      'VISA_EXPIRED',
      'RESIDENCY_GRANTED',
      'CITIZENSHIP_GRANTED',
      'QUALIFICATION_RECOGNISED',
    ]),
    detail: z.string().nullable(),
  }),
  ev('FAMILY_DEATH', { memberId: IdSchema, relation: z.string(), inheritance: z.number().int() }),
  ev('FINANCE_YEAR', {
    income: z.number().int(),
    tax: z.number().int(),
    living: z.number().int(),
    interest: z.number().int(),
    other: z.number().int(),
    cash: z.number().int(),
    debt: z.number().int(),
  }),
  ev('DEATH', { personId: IdSchema, age: z.number().int().min(0), cause: z.string() }),
]);
export type DomainEvent = z.infer<typeof DomainEventSchema>;

/* ------------------------------ checkpoint ------------------------- */
export const SimulationCheckpointSchema = z.object({
  id: IdSchema,
  gameId: IdSchema,
  revision: z.number().int().min(0),
  at: SimDateSchema,
  reason: z.enum(['LIFE_CREATED', 'YEAR_COMPLETED', 'EVENT_PAUSE', 'LIFE_ENDED', 'MANUAL']),
  stateChecksum: z.string(),
});
export type SimulationCheckpoint = z.infer<typeof SimulationCheckpointSchema>;

/* ------------------------------ engine result ---------------------- */
export const EngineErrorCodeSchema = z.enum([
  'INVALID_COMMAND',
  'STALE_REVISION',
  'INVALID_TRANSITION',
  'INVARIANT_VIOLATION',
  'INCOMPATIBLE_VERSION',
  'UNKNOWN_CONTENT',
]);
export type EngineErrorCode = z.infer<typeof EngineErrorCodeSchema>;

export type EngineResult =
  | {
      ok: true;
      state: GameState;
      events: DomainEvent[];
      checkpoint: SimulationCheckpoint | null;
      /** True when the command id was already applied; state is returned unchanged. */
      duplicate: boolean;
    }
  | { ok: false; error: { code: EngineErrorCode; message: string } };

/* ------------------------------ simulation context ----------------- */
export interface SimulationContext {
  rulesVersion: string;
  contentVersion: string;
  /** Data-driven rules content; the engine never loads content itself. */
  content: ContentBundle;
}

/* ------------------------------ content manifest ------------------- */
export const ProvenanceSchema = z.enum(['real-documented', 'estimated-model', 'fictional']);
export type Provenance = z.infer<typeof ProvenanceSchema>;

export const ContentManifestSchema = z.object({
  id: IdSchema,
  contentVersion: z.string(),
  schemaVersion: z.number().int().positive(),
  packages: z.array(
    z.object({
      id: IdSchema,
      kind: z.enum(['geography', 'professions', 'events', 'institutions', 'education', 'laws', 'i18n', 'names', 'economy']),
      /** Attribution/licence shown to players when the data requires it. */
      licence: z.string().nullable().default(null),
      version: z.string(),
      provenance: ProvenanceSchema,
      /** Documented source or model description; never invented. Null only for fictional content. */
      source: z.string().nullable(),
      entryCount: z.number().int().min(0),
    }),
  ),
});
export type ContentManifest = z.infer<typeof ContentManifestSchema>;
export { ContentBundleSchema };

/* ------------------------------ save slot -------------------------- */
export const SaveSlotSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(128),
  schemaVersion: z.number().int().positive(),
  engineVersion: z.string(),
  contentVersion: z.string(),
  seed: z.string(),
  rng: RngStateSchema,
  revision: z.number().int().min(0),
  simulationStatus: SimulationStatusSchema,
  dynasty: z.object({ id: IdSchema, generation: z.number().int().min(1) }),
  createdAt: z.string(),
  updatedAt: z.string(),
  checksum: z.string(),
  state: GameStateSchema,
});
export type SaveSlot = z.infer<typeof SaveSlotSchema>;

import { z } from 'zod';

export const STAT_KEYS = [
  'health',
  'happiness',
  'intelligence',
  'appearance',
  'energy',
  'stress',
  'charisma',
  'fitness',
] as const;
export const StatKeySchema = z.enum(STAT_KEYS);
export type StatKey = z.infer<typeof StatKeySchema>;

export const TRAIT_KEYS = [
  'resilience',
  'impulsivity',
  'selfControl',
  'ambition',
  'empathy',
  'curiosity',
  'discipline',
  'riskTolerance',
  'adaptability',
] as const;
export const TraitKeySchema = z.enum(TRAIT_KEYS);
export type TraitKey = z.infer<typeof TraitKeySchema>;

export const QualificationSchema = z.enum(['primary', 'secondary', 'vocational', 'bachelor', 'master', 'doctorate']);
export type Qualification = z.infer<typeof QualificationSchema>;

export const FamilyClassSchema = z.enum(['low', 'lower_middle', 'middle', 'upper_middle', 'high']);
export type FamilyClass = z.infer<typeof FamilyClassSchema>;

const ContentId = z.string().regex(/^[a-z0-9_.]+$/);

export const REL_DIMS = ['affection', 'trust', 'respect', 'attraction', 'familiarity', 'conflict', 'commitment'] as const;
export const RelDimSchema = z.enum(REL_DIMS);
export type RelDim = z.infer<typeof RelDimSchema>;

export const MemoryTypeSchema = z.enum([
  'help',
  'gift',
  'betrayal',
  'argument',
  'celebration',
  'loss',
  'birth',
  'wedding',
  'breakup',
  'support',
  'neglect',
]);
export type MemoryType = z.infer<typeof MemoryTypeSchema>;

/** Who an event is about. `new_*` actors are generated when the event fires. */
export const ActorKindSchema = z.enum(['none', 'new_peer', 'new_adult', 'friend', 'partner', 'parent', 'sibling', 'child']);
export type ActorKind = z.infer<typeof ActorKindSchema>;

export const SKILL_KEYS = ['social', 'technical', 'creative', 'physical'] as const;
export const SkillKeySchema = z.enum(SKILL_KEYS);
export type SkillKey = z.infer<typeof SkillKeySchema>;

/** A natural talent: it tilts odds a little (never decides outcomes). */
export const TalentDefSchema = z.object({
  id: ContentId,
  title: z.string(),
  /** Career archetypes in which this talent makes promotion likelier. */
  archetypes: z.array(ContentId),
  /** Study comes more easily (bonus to yearly academic performance). */
  academic: z.boolean(),
});
export type TalentDef = z.infer<typeof TalentDefSchema>;

/* ------------------------------ geography -------------------------- */
export const CountryDefSchema = z.object({
  /** ISO 3166-1 alpha-2. */
  code: z.string().length(2),
  name: z.string(),
  /** ISO 4217. */
  currency: z.string().length(3),
  /** Model value: local currency units per 1 EUR (balancing aid, NOT an official rate). */
  fxPerEur: z.number().positive(),
  /** Model value: wage level relative to a reference economy of 1.0. */
  wageFactor: z.number().positive(),
  cities: z.array(z.string()).min(1),
  /** ISO 3166-1 alpha-3 (GeoNames). */
  iso3: z.string().length(3),
  /** Continent code (GeoNames). */
  continent: z.string().length(2),
  capital: z.string(),
  languages: z.array(z.string()),
  neighbours: z.array(z.string().length(2)),
  geonameId: z.number().int().min(0),
  /** Internal money unit: 100 = cents (default), 1 = whole currency units for high-nominal currencies. */
  minorUnits: z.union([z.literal(1), z.literal(100)]),
  /** Coarse income tier assigned by the model (NOT an official classification). */
  tier: z.enum(['high', 'upper', 'lower', 'low']),
  /** Qualification-recognition bloc: same bloc = full recognition. */
  bloc: ContentId,
  /** Rounded order-of-magnitude population (model value, not a census). */
  population: z.number().int().positive(),
  birthRateBp: z.number().int().min(0).max(1000),
  deathRateBp: z.number().int().min(0).max(1000),
  /** Institutions (model values, 0–100). */
  courtStrictness: z.number().int().min(0).max(100),
  corruption: z.number().int().min(0).max(100),
  migrationOpenness: z.number().int().min(0).max(100),
  dualCitizenship: z.boolean(),
  /** Relative emissions intensity (model value, 50–200). */
  emissionsIndex: z.number().int().min(10).max(300),
});
export type CountryDef = z.infer<typeof CountryDefSchema>;

/* ------------------------------ professions ------------------------ */
/**
 * A reusable career archetype: the ladder shape, promotion odds and what skill drives them.
 * Professions only name an archetype, so hundreds of jobs share a handful of engines (M5 scales this up).
 */
export const ArchetypeDefSchema = z.object({
  id: ContentId,
  title: z.string(),
  /** Job titles per level, lowest first; the last level is the cap (raises continue, titles do not). */
  levelTitles: z.array(z.string()).min(2),
  /** Base yearly promotion chance in basis points. */
  promotionBp: z.number().int().min(0).max(5000),
  /** Salary increase per promotion, percent. */
  raisePct: z.number().int().min(1).max(100),
  /** What makes promotion likelier: a stat and/or a hidden trait (above 50 helps). */
  skill: z.object({ stat: StatKeySchema.optional(), trait: TraitKeySchema.optional() }),
  /** The career ends at this age (e.g. professional sport); otherwise the national retirement age applies. */
  maxAge: z.number().int().min(25).max(80).optional(),
  /** Yearly swing of pay in percent (± ), for volatile careers such as sport and the performing arts. */
  volatilityPct: z.number().int().min(0).max(80).default(0),
});
export type ArchetypeDef = z.infer<typeof ArchetypeDefSchema>;

export const SpecializationSchema = z.object({
  id: ContentId,
  title: z.string(),
  /** Salary multiplier in percent applied when the specialization is chosen (e.g. 115 = +15%). */
  salaryPct: z.number().int().min(50).max(300),
});
export type Specialization = z.infer<typeof SpecializationSchema>;

export const ProfessionDefSchema = z.object({
  id: ContentId,
  sector: ContentId,
  archetype: ContentId,
  specializations: z.array(SpecializationSchema).default([]),
  title: z.string(),
  minAge: z.number().int().min(14),
  /** Any one of these qualifications is enough; empty = no requirement. */
  requires: z.array(QualificationSchema),
  /** Entry annual salary in EUR cents for the reference economy (model value). */
  salaryRef: z.number().int().positive(),
  jobStress: z.number().int().min(0).max(100),
});
export type ProfessionDef = z.infer<typeof ProfessionDefSchema>;

/** A real populated place from the GeoNames catalogue (stable GeoNames id). */
export const LocationDefSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  countryCode: z.string().length(2),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  population: z.number().int().positive(),
  /** IANA time zone. */
  timezone: z.string().min(1),
});
export type LocationDef = z.infer<typeof LocationDefSchema>;

/** Fictional political parties; every country draws its governing party from these. */
export const PartyDefSchema = z.object({
  id: ContentId,
  name: z.string(),
  /** Policy lean: shifts the national income-tax multiplier (bp), welfare generosity (bp) and green investment (bp). */
  taxAdjustBp: z.number().int().min(-1500).max(1500),
  welfareBp: z.number().int().min(0).max(5000),
  greenBp: z.number().int().min(0).max(1000),
});
export type PartyDef = z.infer<typeof PartyDefSchema>;

export const OFFICE_LEVELS = ['councillor', 'deputy', 'minister'] as const;
export const OfficeLevelSchema = z.enum(OFFICE_LEVELS);
export type OfficeLevel = z.infer<typeof OfficeLevelSchema>;

/* ------------------------------ businesses & tax ------------------- */
export const BusinessSectorSchema = z.object({
  id: ContentId,
  title: z.string(),
  /** Annual revenue per employee, EUR cents in the reference economy (model value). */
  revPerEmpRef: z.number().int().positive(),
  wagePerEmpRef: z.number().int().positive(),
  /** Fixed yearly overhead (rent, licences…). */
  overheadRef: z.number().int().min(0),
  startupRef: z.number().int().positive(),
  /** Monthly revenue noise in basis points (±). */
  volatilityBp: z.number().int().min(0).max(5000),
});
export type BusinessSector = z.infer<typeof BusinessSectorSchema>;

const TaxPeriodSchema = z.object({
  /** Applies from this calendar year until the next period starts. */
  fromYear: z.number().int(),
  /** Marginal brackets on annual income; `upToRef` is in reference EUR cents and null for the top bracket. */
  brackets: z.array(z.object({ upToRef: z.number().int().positive().nullable(), rateBp: z.number().int().min(0).max(9000) })).min(1),
  capitalGainsBp: z.number().int().min(0).max(9000),
  dividendBp: z.number().int().min(0).max(9000),
  corporateBp: z.number().int().min(0).max(9000),
  propertyTaxBp: z.number().int().min(0).max(1000),
});
export const TaxRuleSetSchema = z.object({
  id: ContentId,
  /** Territories this rule set covers (ISO codes). */
  countries: z.array(z.string().length(2)).min(1),
  version: z.string(),
  periods: z.array(TaxPeriodSchema).min(1),
});
export type TaxRuleSet = z.infer<typeof TaxRuleSetSchema>;
export type TaxPeriod = z.infer<typeof TaxPeriodSchema>;

/* ------------------------------ events ----------------------------- */
export const EffectSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('stat'), stat: StatKeySchema, delta: z.number().int() }),
  z.object({ type: z.literal('trait'), trait: TraitKeySchema, delta: z.number().int() }),
  /** Reference-economy EUR cents (negative = cost); scaled to the local cost level. */
  z.object({ type: z.literal('money'), ref: z.number().int() }),
  z.object({ type: z.literal('performance'), delta: z.number().int() }),
  z.object({ type: z.literal('enroll'), path: z.enum(['university', 'vocational', 'work', 'master', 'doctorate']) }),
  /** Takes the profession carried by the chosen `accept:<id>` choice. */
  z.object({ type: z.literal('takeJob') }),
  z.object({ type: z.literal('loseJob') }),
  z.object({ type: z.literal('raise'), pct: z.number().int().min(1).max(100) }),
  z.object({ type: z.literal('deathRisk'), p: z.number().min(0).max(1) }),
  z.object({ type: z.literal('flag'), key: ContentId }),
  /** Moves the actor's feelings towards the protagonist by `delta`; the protagonist's side moves by 60%. */
  z.object({ type: z.literal('relationship'), dim: RelDimSchema, delta: z.number().int() }),
  /** Both parties remember this; it colours later behaviour and relationship drift. */
  z.object({ type: z.literal('memory'), memory: MemoryTypeSchema, valence: z.union([z.literal(1), z.literal(-1)]), weight: z.number().int().min(1).max(3) }),
  z.object({ type: z.literal('befriend') }),
  z.object({ type: z.literal('startRomance') }),
  z.object({ type: z.literal('marry') }),
  z.object({ type: z.literal('separate') }),
  z.object({ type: z.literal('child') }),
  /** Takes the specialization carried by the chosen `spec:<id>` choice. */
  z.object({ type: z.literal('specialize') }),
  z.object({ type: z.literal('fame'), dim: z.enum(['notoriety', 'credibility', 'influence', 'reputation']), delta: z.number().int() }),
  /** Joins the party carried by the chosen `party:<id>` choice. */
  z.object({ type: z.literal('joinParty') }),
  z.object({ type: z.literal('leaveParty') }),
  /** Wins a seat (an election outcome decided by the outcome odds). */
  z.object({ type: z.literal('office'), level: OfficeLevelSchema }),
  z.object({ type: z.literal('resign') }),
  /** An office-holder's vote changes the country's policy. */
  z.object({ type: z.literal('policy'), kind: z.enum(['cut_taxes', 'raise_welfare', 'green', 'austerity']) }),
  /** An (abstract) illicit act: it may or may not ever be discovered. */
  z.object({ type: z.literal('offence'), severity: z.number().int().min(1).max(3) }),
  /** A false or baseless accusation: the case exists, guilt does not. */
  z.object({ type: z.literal('accused'), evidence: z.number().int().min(0).max(100) }),
  z.object({ type: z.literal('legalAction'), action: z.enum(['lawyer', 'plea', 'self']) }),
  /** Moves to the country carried by the chosen `move:<code>` choice. */
  z.object({ type: z.literal('migrate') }),
  z.object({ type: z.literal('residency') }),
  z.object({ type: z.literal('naturalize') }),
  z.object({ type: z.literal('recognize') }),
  z.object({ type: z.literal('returnHome') }),
  z.object({ type: z.literal('startBusiness'), sector: ContentId }),
  z.object({ type: z.literal('expandBusiness') }),
  z.object({ type: z.literal('sellBusiness') }),
  /** Moves this share of free cash (percent) into the investment portfolio. */
  z.object({ type: z.literal('investSavings'), pct: z.number().int().min(1).max(100) }),
  z.object({ type: z.literal('sellInvestments') }),
  z.object({ type: z.literal('buyHome') }),
  z.object({ type: z.literal('sellHome') }),
  z.object({ type: z.literal('story'), id: ContentId, stage: z.number().int().min(1) }),
  z.object({ type: z.literal('endStory'), id: ContentId }),
]);
export type Effect = z.infer<typeof EffectSchema>;

export const OutcomeSchema = z.object({
  id: ContentId,
  weight: z.number().positive(),
  /** Shifts the weight by perPoint × (stat − 50); lets traits/stats tilt odds without guaranteeing them. */
  statBias: z.object({ stat: StatKeySchema, perPoint: z.number() }).optional(),
  /** Same idea driven by the actor's feelings (actor → protagonist) or the actor's own traits: NPCs decide for themselves. */
  relBias: z.object({ dim: RelDimSchema, perPoint: z.number() }).optional(),
  actorTraitBias: z.object({ trait: TraitKeySchema, perPoint: z.number() }).optional(),
  effects: z.array(EffectSchema),
  text: z.string(),
});
export type Outcome = z.infer<typeof OutcomeSchema>;

export const ChoiceSchema = z.object({
  id: ContentId,
  label: z.string(),
  outcomes: z.array(OutcomeSchema).min(1),
});
export type Choice = z.infer<typeof ChoiceSchema>;

export const EventRequirementsSchema = z.object({
  employed: z.boolean().optional(),
  studying: z.boolean().optional(),
  parentAlive: z.boolean().optional(),
  stages: z.array(z.enum(['none', 'primary', 'secondary', 'choice', 'university', 'vocational', 'postgraduate', 'finished'])).optional(),
  minYearsInRole: z.number().int().optional(),
  notFlag: ContentId.optional(),
  /** Protagonist currently has a romantic partner (dating or married). */
  partner: z.boolean().optional(),
  /** Partner relationship must be of this status. */
  partnerStatus: z.enum(['dating', 'married']).optional(),
  /** Minimum years the current union has lasted. */
  minUnionYears: z.number().int().optional(),
  /** Protagonist has at most this many children. */
  maxChildren: z.number().int().optional(),
  story: z.object({ id: ContentId, stage: z.number().int() }).optional(),
  notStory: ContentId.optional(),
  /** Free cash must be at least this much (reference EUR cents, scaled to the local cost level). */
  minCashRef: z.number().int().optional(),
  /** Protagonist owns an active business. */
  business: z.boolean().optional(),
  /** Protagonist holds investments. */
  investments: z.boolean().optional(),
  /** Protagonist owns a home. */
  property: z.boolean().optional(),
  /** Holds / lacks a qualification (a higher degree counts for the lower ones). */
  hasQualification: QualificationSchema.optional(),
  lacksQualification: QualificationSchema.optional(),
  /** The current job belongs to this career archetype. */
  archetype: ContentId.optional(),
  /** Job level at least. */
  minLevel: z.number().int().optional(),
  partyMember: z.boolean().optional(),
  inOffice: z.boolean().optional(),
  /** An election took place in the protagonist's country this year. */
  electionYear: z.boolean().optional(),
  legalStage: z.enum(['investigation', 'charged', 'trial', 'imprisoned']).optional(),
  /** Convicted of something at some point. */
  record: z.boolean().optional(),
  /** Minimum notoriety. */
  minNotoriety: z.number().int().optional(),
  /** Living abroad on a visa. */
  onVisa: z.boolean().optional(),
  /** Years of legal residence in the current country at least. */
  minResidentYears: z.number().int().optional(),
  /** Some qualification is not recognised in the current country. */
  unrecognized: z.boolean().optional(),
  /** Not in prison. Events default to requiring this; justice events set it explicitly. */
  free: z.boolean().optional(),
  /** Employed in a profession that offers specializations, and has not chosen one yet. */
  specializable: z.boolean().optional(),
});

export const EventDefSchema = z.object({
  id: ContentId,
  version: z.number().int().positive(),
  category: z.enum(['childhood', 'education', 'health', 'career', 'family', 'finance', 'social', 'justice', 'politics', 'world', 'sport', 'arts', 'science', 'medicine']),
  title: z.string(),
  body: z.string(),
  minAge: z.number().int().min(0),
  maxAge: z.number().int().max(120),
  requires: EventRequirementsSchema.default({}),
  /** `birthday` events fire in the birthday month when eligible; `random` ones roll each month. */
  trigger: z.enum(['random', 'birthday']),
  weight: z.number().positive(),
  cooldownYears: z.number().int().min(0),
  maxTimes: z.number().int().min(1),
  /** `jobs`: choices are generated from eligible professions (plus a decline choice). */
  dynamicOffers: z.enum(['jobs', 'specializations', 'parties', 'countries']).optional(),
  /** Who the event involves; `{actor}` in texts is replaced by that person's name. */
  actor: ActorKindSchema.default('none'),
  choices: z.array(ChoiceSchema),
});
export type EventDef = z.infer<typeof EventDefSchema>;

/* ------------------------------ bundle ----------------------------- */
export const ContentBundleSchema = z.object({
  contentVersion: z.string(),
  countries: z.array(CountryDefSchema),
  archetypes: z.array(ArchetypeDefSchema),
  talents: z.array(TalentDefSchema),
  professions: z.array(ProfessionDefSchema),
  parties: z.array(PartyDefSchema),
  businessSectors: z.array(BusinessSectorSchema),
  taxRules: z.array(TaxRuleSetSchema),
  events: z.array(EventDefSchema),
  givenNames: z.array(z.string()),
  familyNames: z.array(z.string()),
});
export type ContentBundle = z.infer<typeof ContentBundleSchema>;

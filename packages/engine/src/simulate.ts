import {
  EngineCommandSchema,
  GameStateSchema,
  SCHEMA_VERSION,
  SUPPORTED_BIRTH_YEARS,
  type DomainEvent,
  type EngineCommand,
  type EngineErrorCode,
  type EngineResult,
  type FamilyClass,
  type GameState,
  type GodPatch,
  type SimDate,
  type SimulationCheckpoint,
  type SimulationContext,
  type Stats,
  type Traits,
} from '@project-life/schemas';
import { addMonth, isValidDate } from './calendar.js';
import { checksum, stateChecksum } from './canonical.js';
import { updateAchievements } from './achievements.js';
import { monthlyAssets } from './assets.js';
import { GOD_LOCKED_MESSAGE, applyCreationPatch, applyGodPatch, planGodEdit, pushGodLog } from './god.js';
import { monthlyBusinesses } from './business.js';
import { maybeTriggerEvent, resolvePending } from './events.js';
import { monthlyFinance, emptyTotals } from './finance.js';
import { ageInYears, invariantIssues, validateState } from './invariants.js';
import { birthday, die, worldTurn } from './lifecycle.js';
import { canTransition } from './machine.js';
import { monthlyDeathChance } from './mortality.js';
import { Rng } from './rng.js';
import { createNpc, drawPredispositions, drawTalents, drawTraits, link } from './npc.js';
import { clamp100, emit, makeRun, type Run } from './run.js';
import { defaultSociety } from './society.js';
import { createWorldCountries, syncLocal, trackPerson } from './world.js';

const fail = (code: EngineErrorCode, message: string): EngineResult => ({
  ok: false,
  error: { code, message },
});

export interface CreateGameParams {
  seed: string;
  givenName: string;
  familyName: string;
  /** Birth date = world start. */
  startDate: SimDate;
  /** Null/undefined = random country (Random Life). */
  countryCode?: string | null;
  city?: string | null;
  /**
   * GOD MODE is chosen here and nowhere else: it is stored in `config` and never changes (T71). Defaults to off.
   */
  godModeEnabled?: boolean;
  /** Character customisation made on the creation screen; only valid with GOD MODE, applied as part of the creation. */
  initialGodPatch?: GodPatch;
}

const CLASS_WEIGHTS: [FamilyClass, number][] = [
  ['low', 20],
  ['lower_middle', 30],
  ['middle', 30],
  ['upper_middle', 15],
  ['high', 5],
];

/** Bigger countries are likelier birthplaces, in proportion to their (documented) population. */
function weightedByPopulation<T extends { population: number }>(rng: Rng, items: readonly T[]): T {
  let roll = rng.float() * items.reduce((s, c) => s + c.population, 0);
  for (const c of items) {
    roll -= c.population;
    if (roll < 0) return c;
  }
  return items[items.length - 1] as T;
}

/** City lists are ordered by population; early entries are much likelier. */
export function pickCity(rng: Rng, cities: readonly string[]): string {
  const x = rng.float();
  return cities[Math.min(cities.length - 1, Math.floor(x * x * cities.length))] as string;
}

function weighted<T>(rng: Rng, items: readonly [T, number][]): T {
  let roll = rng.float() * items.reduce((s, [, w]) => s + w, 0);
  for (const [item, w] of items) {
    roll -= w;
    if (roll < 0) return item;
  }
  return (items[items.length - 1] as [T, number])[0];
}

export function drawStats(rng: Rng): Stats {
  const draw = (mean: number, spread: number): number => clamp100(mean + rng.bell() * spread);
  return {
    health: draw(70, 12),
    happiness: draw(70, 12),
    intelligence: draw(50, 15),
    appearance: draw(50, 15),
    energy: draw(70, 12),
    stress: draw(20, 8),
    charisma: draw(50, 15),
    fitness: draw(50, 15),
  };
}

export function pickClass(rng: Rng): FamilyClass {
  return weighted(rng, CLASS_WEIGHTS);
}

/**
 * Random Life. Newborn stats: health/happiness/energy 70±12, others 50±15, stress 20±8;
 * hidden traits 50±18; family class drawn 20/30/30/15/5 independent of country, name or any protected trait.
 */
export function createGame(params: CreateGameParams, ctx: SimulationContext): EngineResult {
  const given = params.givenName.trim();
  const family = params.familyName.trim();
  if (!params.seed.trim()) return fail('INVALID_COMMAND', 'seed is required');
  if (!given || !family) return fail('INVALID_COMMAND', 'name and surname are required');
  if (!isValidDate(params.startDate)) return fail('INVALID_COMMAND', 'invalid start date');
  if (params.startDate.year < SUPPORTED_BIRTH_YEARS.min || params.startDate.year > SUPPORTED_BIRTH_YEARS.max) {
    return fail('INVALID_COMMAND', `birth year must be between ${SUPPORTED_BIRTH_YEARS.min} and ${SUPPORTED_BIRTH_YEARS.max}`);
  }
  if (params.initialGodPatch && !params.godModeEnabled) return fail('INVALID_COMMAND', 'a character customisation requires GOD MODE, which was not chosen');
  const { countries, givenNames } = ctx.content;
  if (countries.length === 0 || givenNames.length === 0) return fail('UNKNOWN_CONTENT', 'content bundle is empty');

  const rng = Rng.fromSeed(params.seed);
  // Random Life: the birth country follows the real population shares (documented data).
  const country = params.countryCode ? countries.find((c) => c.code === params.countryCode) : weightedByPopulation(rng, countries);
  if (!country) return fail('UNKNOWN_CONTENT', `unknown country ${params.countryCode}`);
  const city = params.city && country.cities.includes(params.city) ? params.city : pickCity(rng, country.cities);

  const worldCountries = createWorldCountries(ctx.content, rng, params.startDate.year);
  const stats = drawStats(rng);
  const traits: Traits = drawTraits(rng);
  const predispositions = drawPredispositions(rng);
  const talents = drawTalents(rng, ctx.content);
  const familyClass = pickClass(rng);

  const id = `life-${checksum(`${params.seed}|${given}|${family}`)}`;
  const y = params.startDate.year;
  const personId = `${id}:p0`;
  const state: GameState = {
    schemaVersion: SCHEMA_VERSION,
    id,
    revision: 0,
    seed: params.seed,
    rng: rng.state(),
    rulesVersion: ctx.rulesVersion,
    contentVersion: ctx.contentVersion,
    dynasty: { id: `dyn-${checksum(`${params.seed}|${family}`)}`, generation: 1, chronicle: [] },
    world: { originDate: params.startDate, startDate: params.startDate, currentDate: params.startDate, priceIndex: 10_000, economy: (worldCountries[country.code] as (typeof worldCountries)[string]).economy, countries: worldCountries, history: [] },
    simulation: { status: 'IDLE', monthsDone: 0, pending: null },
    location: { countryCode: country.code, city },
    protagonist: { id: personId, givenName: given, familyName: family, birth: params.startDate, stats, traits, predispositions, talents, skills: { social: 10, technical: 10, creative: 10, physical: 10 }, parentIds: [], death: null },
    family: { class: familyClass, guardianId: null },
    npcs: {},
    relationships: {},
    unions: {},
    stories: {},
    society: defaultSociety(country.code, params.startDate.year),
    properties: {},
    businesses: {},
    education: { stage: 'none', postgraduate: null, yearsInStage: 0, performance: 50, qualifications: [], scholarship: false },
    career: { job: null, retired: false, pension: 0 },
    finance: { currency: country.currency, minorUnits: country.minorUnits, accounts: {}, thisYear: emptyTotals(), lastYear: null, gainsThisYear: 0 },
    eventLog: {},
    flags: {},
    config: { godModeEnabled: params.godModeEnabled === true, godModeOrigin: 'chosen' },
    godMode: { edits: 0, log: [] },
    achievements: {},
    lastCommandId: null,
  };

  // Household: two parents (married), 0–3 older siblings; everyone is a persistent NPC with their own traits.
  syncLocal(state);
  trackPerson(state, country.code, true); // the newborn protagonist is the first individually simulated person
  const run = makeRun(state, ctx, country, rng, 0);
  const mother = createNpc(run, { familyName: family, birthYear: y - rng.int(24, 38), class: familyClass, countryCode: country.code });
  const father = createNpc(run, { familyName: family, birthYear: y - rng.int(24, 45), class: familyClass, countryCode: country.code });
  state.protagonist.parentIds = [mother.id, father.id];
  state.unions[`${id}:u0`] = { id: `${id}:u0`, members: [mother.id, father.id], status: 'married', startYear: y - rng.int(1, 15), endYear: null };
  link(run, personId, mother.id, 'family');
  link(run, personId, father.id, 'family');
  const siblings = weighted(rng, [[0, 35], [1, 40], [2, 20], [3, 5]]);
  const earliest = Math.max(mother.birthYear, father.birthYear) + 16; // parents must be old enough
  for (let i = 0; i < siblings; i++) {
    const sibBirth = Math.max(y - rng.int(1, 10), earliest);
    if (sibBirth > y - 1) continue;
    const sib = createNpc(run, {
      familyName: family,
      birthYear: sibBirth,
      parentIds: [mother.id, father.id],
      class: familyClass,
      countryCode: country.code,
      traits: drawTraits(rng, [mother.traits, father.traits]),
      predispositions: drawPredispositions(rng, [mother.predispositions, father.predispositions]),
      talents: drawTalents(rng, ctx.content, [mother.talents, father.talents]),
    });
    link(run, personId, sib.id, 'family');
  }
  state.rng = rng.state();

  let customisation: ReturnType<typeof applyCreationPatch> | null = null;
  if (params.initialGodPatch) {
    customisation = applyCreationPatch(state, params.initialGodPatch, ctx.content);
    if (!customisation.ok) return fail('INVALID_COMMAND', customisation.message);
  }

  const issues = validateState(state);
  if (issues.length) return fail('INVARIANT_VIOLATION', issues.join('; '));
  const events: DomainEvent[] = [
    {
      id: `${id}:0:0`,
      revision: 0,
      sequence: 0,
      type: 'LIFE_CREATED',
      at: params.startDate,
      payload: { personId, seed: params.seed, countryCode: country.code },
    },
  ];
  if (customisation?.ok && customisation.changes.length > 0) {
    events.push({ id: `${id}:0:1`, revision: 0, sequence: 1, type: 'GOD', at: params.startDate, payload: { action: 'EDITED', targetId: personId, targetName: customisation.name, changes: customisation.changes.length } });
  }
  return { ok: true, state, events, checkpoint: makeCheckpoint(state, 'LIFE_CREATED'), duplicate: false };
}

function makeCheckpoint(state: GameState, reason: SimulationCheckpoint['reason']): SimulationCheckpoint {
  return {
    id: `${state.id}:cp:${state.revision}`,
    gameId: state.id,
    revision: state.revision,
    at: state.world.currentDate,
    reason,
    stateChecksum: stateChecksum(state),
  };
}

/**
 * Pure transition: NextState = Simulate(CurrentState, Command, Context).
 * The RNG state lives inside GameState, so it is part of the input and output.
 * Never mutates its inputs; on error returns the failure and the caller keeps the old state.
 */
export function simulate(stateInput: GameState, commandInput: unknown, ctx: SimulationContext): EngineResult {
  const command = EngineCommandSchema.safeParse(commandInput);
  if (!command.success) return fail('INVALID_COMMAND', command.error.issues.map((i) => i.message).join('; '));
  const cmd = command.data;

  const stateParsed = GameStateSchema.safeParse(stateInput);
  if (!stateParsed.success) return fail('INVARIANT_VIOLATION', 'state failed schema validation');
  const state = stateParsed.data;

  if (state.rulesVersion !== ctx.rulesVersion) {
    return fail('INCOMPATIBLE_VERSION', `state rules ${state.rulesVersion} != engine rules ${ctx.rulesVersion}`);
  }
  const issues = invariantIssues(state); // the schema was just parsed; only the cross-field rules remain
  if (issues.length) return fail('INVARIANT_VIOLATION', issues.join('; '));

  if (state.lastCommandId === cmd.commandId) {
    return { ok: true, state, events: [], checkpoint: null, duplicate: true };
  }
  if (cmd.expectedRevision !== state.revision) {
    return fail('STALE_REVISION', `expected ${cmd.expectedRevision}, state is at ${state.revision}`);
  }
  // GOD MODE commands only touch character data, never the clock, the world or the random stream.
  if (cmd.type === 'GOD_TOGGLE' || cmd.type === 'GOD_EDIT') return godCommand(state, cmd, ctx);
  if (state.protagonist.death) return fail('INVALID_TRANSITION', 'the life has ended');

  const country = ctx.content.countries.find((c) => c.code === state.location.countryCode);
  if (!country) return fail('UNKNOWN_CONTENT', `unknown country ${state.location.countryCode}`);

  const draft = structuredClone(state);
  const rng = new Rng(draft.rng);
  const run: Run = { s: draft, rng, ctx, country, events: [], rev: state.revision + 1, died: false, paused: false };

  switch (cmd.type) {
    case 'ADVANCE_YEAR':
      if (!canTransition(draft.simulation.status, 'RUNNING')) {
        return fail('INVALID_TRANSITION', `cannot advance from ${draft.simulation.status}`);
      }
      draft.simulation.status = 'RUNNING';
      draft.simulation.monthsDone = 0;
      break;
    case 'RESOLVE_EVENT':
      if (draft.simulation.status !== 'PAUSED_EVENT' || !canTransition('PAUSED_EVENT', 'RESOLVING')) {
        return fail('INVALID_TRANSITION', 'no event is waiting for a decision');
      }
      draft.simulation.status = 'RESOLVING';
      if (!resolvePending(run, cmd.choiceId)) return fail('INVALID_COMMAND', `unknown choice ${cmd.choiceId}`);
      if (!run.died) draft.simulation.status = 'RUNNING';
      break;
  }

  runMonths(run);
  updateAchievements(run);

  draft.rng = rng.state();
  draft.revision = run.rev;
  draft.lastCommandId = cmd.commandId;
  const post = validateState(draft);
  if (post.length) return fail('INVARIANT_VIOLATION', post.join('; '));

  const reason = run.died ? 'LIFE_ENDED' : run.paused ? 'EVENT_PAUSE' : 'YEAR_COMPLETED';
  return { ok: true, state: draft, events: run.events, checkpoint: makeCheckpoint(draft, reason), duplicate: false };
}

function godCommand(state: GameState, cmd: Extract<EngineCommand, { type: 'GOD_TOGGLE' | 'GOD_EDIT' }>, ctx: SimulationContext): EngineResult {
  // GOD_TOGGLE stays in the command schema for compatibility, but the switch no longer exists (T71).
  if (cmd.type === 'GOD_TOGGLE') return fail('INVALID_TRANSITION', GOD_LOCKED_MESSAGE);
  if (!state.config.godModeEnabled) return fail('INVALID_TRANSITION', 'GOD MODE was not chosen when this life was created');
  if (state.simulation.status === 'RUNNING' || state.simulation.status === 'RESOLVING' || state.simulation.status === 'ERROR') {
    return fail('INVALID_TRANSITION', `GOD MODE cannot be used while the simulation is ${state.simulation.status}`);
  }
  const country = ctx.content.countries.find((c) => c.code === state.location.countryCode);
  if (!country) return fail('UNKNOWN_CONTENT', `unknown country ${state.location.countryCode}`);
  const draft = structuredClone(state);
  const rev = state.revision + 1;
  const run = makeRun(draft, ctx, country, new Rng(draft.rng), rev);

  const plan = planGodEdit(draft, cmd.targetId, cmd.patch, ctx.content);
  if (!plan.ok) return fail('INVALID_COMMAND', plan.issues.join('; '));
  if (plan.changes.length === 0) return { ok: true, state, events: [], checkpoint: null, duplicate: true }; // already as requested
  applyGodPatch(draft, cmd.targetId, cmd.patch);
  const who = cmd.targetId === draft.protagonist.id ? draft.protagonist : draft.npcs[cmd.targetId];
  const name = `${who?.givenName ?? ''} ${who?.familyName ?? ''}`.trim();
  draft.godMode.edits += 1;
  pushGodLog(draft, { revision: rev, year: draft.world.currentDate.year, action: 'EDITED', targetId: cmd.targetId, targetName: name, changes: plan.changes });
  emit(run, 'GOD', { action: 'EDITED', targetId: cmd.targetId, targetName: name, changes: plan.changes.length });
  updateAchievements(run);
  draft.revision = rev;
  draft.lastCommandId = cmd.commandId;
  const post = validateState(draft);
  if (post.length) return fail('INVARIANT_VIOLATION', post.join('; '));
  return { ok: true, state: draft, events: run.events, checkpoint: makeCheckpoint(draft, 'MANUAL'), duplicate: false };
}

/** Processes months until the year is done, an event needs a decision, or the protagonist dies. */
function runMonths(run: Run): void {
  const s = run.s;
  while (!run.died && s.simulation.monthsDone < 12) {
    const from = s.world.currentDate;
    const to = addMonth(from, s.protagonist.birth.day);
    s.world.currentDate = to;
    emit(run, 'MONTH_ADVANCED', { from, to });

    if (to.month === 1) worldTurn(run);
    monthlyFinance(run);
    monthlyAssets(run);
    monthlyBusinesses(run);

    const age = ageInYears(s.protagonist.birth, to);
    if (run.rng.float() < monthlyDeathChance(age, s.protagonist.stats.health, s.protagonist.predispositions.longevity)) {
      die(run, age < 15 ? 'illness' : age >= 75 ? 'old_age' : 'illness');
      break;
    }
    const isBirthMonth = to.month === s.protagonist.birth.month;
    if (isBirthMonth) birthday(run);

    s.simulation.monthsDone += 1;
    if (maybeTriggerEvent(run, isBirthMonth)) return;
  }

  if (run.died) {
    s.simulation.status = 'COMPLETED';
    s.simulation.monthsDone = 0;
    return;
  }
  emit(run, 'YEAR_COMPLETED', { personId: s.protagonist.id, age: ageInYears(s.protagonist.birth, s.world.currentDate) });
  s.simulation.status = 'COMPLETED';
  s.simulation.monthsDone = 0;
}

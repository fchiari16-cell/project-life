import { contentBundle } from '@project-life/content';
import {
  CONTENT_VERSION,
  RULES_VERSION,
  type DomainEvent,
  type GameState,
  type SimDate,
  type SimulationContext,
} from '@project-life/schemas';
import { Rng, createGame, pendingChoices, simulate, stateChecksum, type CreateGameParams } from '../src/index';

/** The full global catalogue (252 countries): used by the tests that are about global coverage. */
export const fullCtx: SimulationContext = {
  rulesVersion: RULES_VERSION,
  contentVersion: CONTENT_VERSION,
  content: contentBundle,
};

/**
 * The default test world: the same rules and content, but only 12 countries, so that the many long
 * simulations in the suite stay fast. Global behaviour is covered separately with `fullCtx`.
 */
const CURATED = ['IT', 'ES', 'FR', 'DE', 'GB', 'US', 'BR', 'IN', 'JP', 'NG', 'CN', 'AU'];
export const ctx: SimulationContext = {
  ...fullCtx,
  content: { ...contentBundle, countries: contentBundle.countries.filter((c) => CURATED.includes(c.code)) },
};

/** Sets the economy of the protagonist's country (the world mirror must always equal it). */
export function setEconomy(s: GameState, patch: Partial<GameState['world']['economy']>): void {
  const economy = { ...s.world.economy, ...patch };
  s.world.economy = economy;
  const c = s.world.countries[s.location.countryCode];
  if (c) c.economy = economy;
}

/** Recomputes every country's tracked count after a test edits the NPC list by hand. */
export function retrack(s: GameState): void {
  for (const c of Object.values(s.world.countries)) c.tracked = 0;
  for (const n of Object.values(s.npcs)) if (n.deathYear === null) s.world.countries[n.countryCode]!.tracked += 1;
  if (!s.protagonist.death) s.world.countries[s.location.countryCode]!.tracked += 1;
}

export const START: SimDate = { year: 2025, month: 3, day: 14 };

export function newLife(seed = 'seed-1', extra: Partial<CreateGameParams> = {}): GameState {
  const r = createGame({ seed, givenName: 'Ada', familyName: 'Verdi', startDate: START, ...extra }, ctx);
  if (!r.ok) throw new Error(r.error.message);
  return r.state;
}

export interface PlayResult {
  state: GameState;
  events: DomainEvent[];
  commands: number;
  pauses: number;
}

/** Plays a life to its end (or `maxCommands`) with a seeded random decision policy. */
export function autoPlay(
  initial: GameState,
  policySeed = initial.seed,
  maxCommands = 600,
  prefer: readonly string[] = [],
  context: SimulationContext = ctx,
): PlayResult {
  const policy = Rng.fromSeed(`policy:${policySeed}`);
  let state = initial;
  const events: DomainEvent[] = [];
  let pauses = 0;
  let commands = 0;
  while (!state.protagonist.death && commands < maxCommands) {
    const base = { commandId: `c${commands}`, expectedRevision: state.revision };
    let command;
    if (state.simulation.status === 'PAUSED_EVENT') {
      const choices = pendingChoices(state, context)?.choices ?? [];
      const liked = choices.find((c) => prefer.includes(c.id));
      command = { type: 'RESOLVE_EVENT', ...base, choiceId: (liked ?? policy.pick(choices)).id };
      pauses++;
    } else command = { type: 'ADVANCE_YEAR', ...base };
    const r = simulate(state, command, context);
    if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message} (cmd ${commands}, ${command.type})`);
    state = r.state;
    events.push(...r.events);
    commands++;
  }
  return { state, events, commands, pauses };
}

/** Builds what a schema-v2 save looked like (flat `family.members`, no NPC graph). */
export function legacyV2() {
  const s = newLife('legacy', { countryCode: 'IT' });
  const members = s.protagonist.parentIds.concat(Object.keys(s.npcs).filter((id) => !s.protagonist.parentIds.includes(id))).map((id, i) => {
    const n = s.npcs[id]!;
    return { id, relation: i === 0 ? 'mother' : i === 1 ? 'father' : 'sibling', givenName: n.givenName, familyName: n.familyName, birthYear: n.birthYear, deathYear: n.deathYear };
  });
  const { npcs: _n, relationships: _r, unions: _u, stories: _s, ...rest } = s;
  void _n; void _r; void _u; void _s;
  const state = {
    ...rest,
    schemaVersion: 2,
    rulesVersion: '0.2.0',
    contentVersion: '0.2.0',
    dynasty: { id: s.dynasty.id, generation: 1 },
    world: { startDate: s.world.startDate, currentDate: s.world.currentDate, priceIndex: s.world.priceIndex },
    protagonist: { ...s.protagonist, parentIds: undefined },
    family: { class: s.family.class, members },
  };
  delete (state.protagonist as Record<string, unknown>).parentIds;
  return {
    id: s.id, name: 'Ada Verdi', schemaVersion: 2, engineVersion: '0.2.0', contentVersion: '0.2.0', seed: s.seed, rng: s.rng,
    revision: 0, simulationStatus: 'IDLE', dynasty: { id: s.dynasty.id, generation: 1 }, createdAt: 'x', updatedAt: 'x',
    checksum: stateChecksum(state), state,
  };
}



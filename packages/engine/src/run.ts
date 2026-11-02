import type {
  CountryDef,
  DomainEvent,
  GameState,
  SimulationContext,
  Qualification,
  StatKey,
  TraitKey,
} from '@project-life/schemas';
import type { Rng } from './rng.js';

/** Working context for one command: a draft copy of the state plus everything it emits. */
export interface Run {
  s: GameState;
  rng: Rng;
  ctx: SimulationContext;
  country: CountryDef;
  events: DomainEvent[];
  /** Revision the resulting state will carry. */
  rev: number;
  died: boolean;
  paused: boolean;
}

type PayloadOf<T extends DomainEvent['type']> = Extract<DomainEvent, { type: T }>['payload'];

export function makeRun(s: GameState, ctx: SimulationContext, country: CountryDef, rng: Rng, rev: number): Run {
  return { s, rng, ctx, country, events: [], rev, died: false, paused: false };
}

export function emit<T extends DomainEvent['type']>(run: Run, type: T, payload: PayloadOf<T>): void {
  const sequence = run.events.length;
  run.events.push({
    id: `${run.s.id}:${run.rev}:${sequence}`,
    revision: run.rev,
    sequence,
    at: run.s.world.currentDate,
    type,
    payload,
  } as DomainEvent);
}

export const clamp100 = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

export function addStat(run: Run, stat: StatKey, delta: number): void {
  run.s.protagonist.stats[stat] = clamp100(run.s.protagonist.stats[stat] + delta);
}
export function addTrait(run: Run, trait: TraitKey, delta: number): void {
  run.s.protagonist.traits[trait] = clamp100(run.s.protagonist.traits[trait] + delta);
}

export function currentAge(s: GameState): number {
  const b = s.protagonist.birth;
  const c = s.world.currentDate;
  return Math.floor((c.year * 12 + c.month - (b.year * 12 + b.month)) / 12);
}

export const isStudying = (s: GameState): boolean =>
  s.education.stage === 'primary' ||
  s.education.stage === 'secondary' ||
  s.education.stage === 'university' ||
  s.education.stage === 'vocational' ||
  s.education.stage === 'postgraduate';

/**
 * A higher degree implies the lower ones: a doctorate counts as a master, a master as a bachelor, and any
 * degree as secondary and primary education.
 */
export function expandQualifications(q: readonly Qualification[]): Qualification[] {
  const out = new Set<Qualification>(q);
  if (out.has('doctorate')) out.add('master');
  if (out.has('master')) out.add('bachelor');
  if (out.has('bachelor') || out.has('vocational')) out.add('secondary');
  if (out.has('secondary')) out.add('primary');
  return [...out];
}

/** Qualifications that count in the current country (those not recognised here are left out). */
export const validQualifications = (s: GameState): Qualification[] =>
  expandQualifications(s.education.qualifications).filter((q) => !s.society.unrecognized.includes(q));

export const CLASS_INDEX = { low: 0, lower_middle: 1, middle: 2, upper_middle: 3, high: 4 } as const;

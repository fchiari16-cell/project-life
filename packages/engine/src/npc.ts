import type {
  ContentBundle,
  Predispositions,
  FamilyClass,
  GameState,
  Memory,
  Npc,
  RelDim,
  RelDims,
  Relationship,
  Traits,
} from '@project-life/schemas';
import { TRAIT_KEYS } from '@project-life/schemas';
import type { Rng } from './rng.js';
import { clamp100, type Run } from './run.js';
import { trackPerson } from './world.js';

export const relKey = (from: string, to: string): string => `${from}>${to}`;
export const relOf = (s: GameState, from: string, to: string): Relationship | undefined => s.relationships[relKey(from, to)];

const jitter = (rng: Rng, mean: number, spread: number): number => clamp100(mean + rng.int(-spread, spread));

export function drawTraits(rng: Rng, parents: readonly Traits[] = []): Traits {
  const out = {} as Traits;
  for (const k of TRAIT_KEYS) {
    const own = clamp100(50 + rng.bell() * 18);
    if (parents.length === 0) out[k] = own;
    else {
      const avg = parents.reduce((sum, p) => sum + p[k], 0) / parents.length;
      out[k] = clamp100(0.6 * avg + 0.4 * own); // heredity: predisposition, never destiny
    }
  }
  return out;
}

/** Hidden biological predispositions: partly inherited, never decisive. */
export function drawPredispositions(rng: Rng, parents: readonly Predispositions[] = []): Predispositions {
  const own = (): number => clamp100(50 + rng.bell() * 15);
  const mix = (k: keyof Predispositions): number =>
    parents.length === 0 ? own() : clamp100(0.5 * (parents.reduce((s, p) => s + p[k], 0) / parents.length) + 0.5 * own());
  return { longevity: mix('longevity'), robustness: mix('robustness') };
}

/** Up to two natural talents; having a parent with the talent makes it likelier but never certain. */
export function drawTalents(rng: Rng, content: ContentBundle, parents: readonly (readonly string[])[] = []): string[] {
  const out: string[] = [];
  for (const t of content.talents) {
    const inherited = parents.some((p) => p.includes(t.id));
    if (rng.float() < 0.06 + (inherited ? 0.2 : 0) && out.length < 2) out.push(t.id);
  }
  return out;
}

export function newNpcId(run: Run): string {
  for (;;) {
    const id = `${run.s.id}:n${run.rng.nextU32().toString(36)}`;
    if (!run.s.npcs[id]) return id;
  }
}

export interface NpcSpec {
  predispositions?: Predispositions;
  talents?: string[];
  /** Born this year (adds to the country's population) rather than promoted from the aggregate. */
  newborn?: boolean;
  familyName: string;
  givenName?: string;
  birthYear: number;
  parentIds?: string[];
  class: FamilyClass;
  countryCode: string;
  traits?: Traits;
}

/** Adds a persistent NPC to the state and returns it. */
export function createNpc(run: Run, spec: NpcSpec): Npc {
  const id = newNpcId(run);
  const npc: Npc = {
    id,
    givenName: spec.givenName ?? run.rng.pick(run.ctx.content.givenNames),
    familyName: spec.familyName,
    birthYear: spec.birthYear,
    deathYear: null,
    traits: spec.traits ?? drawTraits(run.rng),
    predispositions: spec.predispositions ?? drawPredispositions(run.rng),
    talents: spec.talents ?? drawTalents(run.rng, run.ctx.content),
    class: spec.class,
    countryCode: spec.countryCode,
    parentIds: spec.parentIds ?? [],
    memories: [],
  };
  run.s.npcs[id] = npc;
  trackPerson(run.s, spec.countryCode, spec.newborn === true);
  return npc;
}

export function baseDims(bond: Relationship['bond'], rng: Rng): RelDims {
  switch (bond) {
    case 'family':
      return { affection: jitter(rng, 55, 15), trust: jitter(rng, 55, 15), respect: jitter(rng, 50, 15), attraction: 0, familiarity: jitter(rng, 70, 10), conflict: jitter(rng, 10, 10), commitment: jitter(rng, 60, 15) };
    case 'friend':
      return { affection: jitter(rng, 50, 10), trust: jitter(rng, 45, 10), respect: jitter(rng, 50, 10), attraction: 0, familiarity: jitter(rng, 30, 10), conflict: jitter(rng, 5, 5), commitment: jitter(rng, 30, 10) };
    case 'romantic':
      return { affection: jitter(rng, 55, 12), trust: jitter(rng, 45, 12), respect: jitter(rng, 50, 12), attraction: jitter(rng, 65, 12), familiarity: jitter(rng, 25, 10), conflict: jitter(rng, 5, 5), commitment: jitter(rng, 40, 12) };
    case 'ex':
      return { affection: jitter(rng, 30, 15), trust: jitter(rng, 25, 15), respect: jitter(rng, 35, 15), attraction: jitter(rng, 20, 15), familiarity: jitter(rng, 50, 10), conflict: jitter(rng, 45, 15), commitment: 0 };
  }
}

/** Creates both directed records; each side draws its own feelings, so the bond starts out asymmetric. */
export function link(run: Run, a: string, b: string, bond: Relationship['bond']): void {
  run.s.relationships[relKey(a, b)] = { from: a, to: b, bond, dims: baseDims(bond, run.rng) };
  run.s.relationships[relKey(b, a)] = { from: b, to: a, bond, dims: baseDims(bond, run.rng) };
}

export function unlink(s: GameState, a: string, b: string): void {
  delete s.relationships[relKey(a, b)];
  delete s.relationships[relKey(b, a)];
}

export function setBond(s: GameState, a: string, b: string, bond: Relationship['bond']): void {
  const x = relOf(s, a, b);
  const y = relOf(s, b, a);
  if (x) x.bond = bond;
  if (y) y.bond = bond;
}

export function nudge(rel: Relationship | undefined, dim: RelDim, delta: number): void {
  if (rel) rel.dims[dim] = clamp100(rel.dims[dim] + delta);
}

export function remember(npc: Npc | undefined, m: Memory): void {
  if (!npc) return;
  npc.memories.push(m);
  if (npc.memories.length > 12) npc.memories.shift();
}

/** Net sentiment of an NPC's recent memories about someone (−/+, weighted). */
export function memoryTone(npc: Npc, otherId: string, sinceYear: number): number {
  return npc.memories
    .filter((m) => m.otherId === otherId && m.year >= sinceYear)
    .reduce((sum, m) => sum + m.valence * m.weight, 0);
}

export const npcAge = (npc: Npc, year: number): number => year - npc.birthYear;
export const fullName = (npc: Npc): string => `${npc.givenName} ${npc.familyName}`;

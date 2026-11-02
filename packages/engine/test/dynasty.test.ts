import { describe, expect, it } from 'vitest';
import type { GameState } from '@project-life/schemas';
import {
  ageInYears,
  canonicalStringify,
  continueDynasty,
  dynastyOptions,
  relationCode,
  simulate,
  validateGenealogy,
  validateState,
} from '../src/index';
import { relKey } from '../src/npc';
import { autoPlay, ctx, newLife, retrack } from './helpers';

const FAMILY_POLICY = ['ask_out', 'propose', 'try', 'talk', 'spend_time', 'befriend', 'help', 'reconcile'];

function next(prev: GameState, seed: string, parentId?: string | null): GameState {
  const r = continueDynasty(prev, { seed, givenName: 'Nova', ...(parentId !== undefined ? { parentId } : {}) }, ctx);
  if (!r.ok) throw new Error(r.error.message);
  return r.state;
}

/** Plays generations until one ends with eligible adult descendants (or gives up). */
function findDynasty(): GameState {
  for (let i = 0; i < 60; i++) {
    const dead = autoPlay(newLife(`dyn-${i}`), `p${i}`, 600, FAMILY_POLICY).state;
    // Require a direct child so tests can reason about grandparent/uncle relations.
    if (dynastyOptions(dead).some((o) => o.lineage === 'descendant' && dead.npcs[o.npcId]!.parentIds.includes(dead.protagonist.id))) return dead;
  }
  throw new Error('no life produced adult descendants');
}

describe('dynasty continuation', () => {
  const dead = findDynasty();

  it('the next protagonist is born at the moment of death, as a descendant, with the family graph carried over', () => {
    const options = dynastyOptions(dead);
    const parent = options.find((o) => o.lineage === 'descendant')!;
    const s = next(dead, 'gen2', parent.npcId);
    expect(validateState(s)).toEqual([]);
    expect(validateGenealogy(s)).toEqual([]);
    expect(s.dynasty).toMatchObject({ id: dead.dynasty.id, generation: 2 });
    expect(s.dynasty.chronicle).toHaveLength(1);
    expect(s.dynasty.chronicle[0]).toMatchObject({ generation: 1, personId: dead.protagonist.id });
    expect(s.world.startDate).toEqual(dead.protagonist.death!.date);
    expect(s.world.originDate).toEqual(dead.world.originDate);
    expect(s.world.priceIndex).toBe(dead.world.priceIndex);
    expect(ageInYears(s.protagonist.birth, s.world.currentDate)).toBe(0);
    expect(s.protagonist.parentIds).toContain(parent.npcId);
    // The deceased is now a grandparent, still in the tree, still dead.
    expect(['grandparent', 'ancestor']).toContain(relationCode(s, dead.protagonist.id));
    expect(s.npcs[dead.protagonist.id]!.deathYear).toBe(dead.protagonist.death!.date.year);
    expect(s.relationships[relKey(s.protagonist.id, parent.npcId)]).toBeDefined();
    // A brand-new life: no job, no money, no history.
    expect(s.career.job).toBeNull();
    expect(s.finance.accounts).toEqual({});
    expect(s.revision).toBe(0);
  });

  it('is deterministic and rejects ineligible requests', () => {
    const parent = dynastyOptions(dead)[0]!;
    expect(canonicalStringify(next(dead, 'same', parent.npcId))).toBe(canonicalStringify(next(dead, 'same', parent.npcId)));
    expect(continueDynasty(dead, { seed: 's', givenName: 'X', parentId: 'nobody' }, ctx).ok).toBe(false);
    const alive = newLife('alive');
    expect(continueDynasty(alive, { seed: 's', givenName: 'X' }, ctx).ok).toBe(false);
  });

  it('heredity is a predisposition: traits correlate with parents but are not copied', () => {
    const parent = dynastyOptions(dead)[0]!;
    const diffs: number[] = [];
    let identical = 0;
    for (let i = 0; i < 25; i++) {
      const s = next(dead, `her-${i}`, parent.npcId);
      const p = s.npcs[parent.npcId]!;
      const q = s.npcs[s.protagonist.parentIds[1]!]!;
      for (const k of Object.keys(s.protagonist.traits) as (keyof typeof p.traits)[]) {
        const avg = (p.traits[k] + q.traits[k]) / 2;
        diffs.push(Math.abs(s.protagonist.traits[k] - avg));
        if (s.protagonist.traits[k] === Math.round(avg)) identical++;
      }
    }
    const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    expect(mean).toBeLessThan(18); // closer to the parents' average than a random 50±18 draw would be
    expect(identical / diffs.length).toBeLessThan(0.2); // yet not a clone
  });

  it('feuds are inherited: relatives of the grudge-holder start with elevated conflict', () => {
    const base = structuredClone(dead);
    // The heir must be a direct child of the deceased so that the injected uncle is a real uncle.
    const parent = dynastyOptions(base).find((o) => base.npcs[o.npcId]!.parentIds.includes(base.protagonist.id));
    expect(parent).toBeDefined();
    if (!parent) return;
    const year = base.protagonist.death!.date.year;
    // Add a living uncle/aunt (another child of the deceased) and make them the subject of a feud.
    base.npcs['feud-uncle'] = {
      id: 'feud-uncle', givenName: 'Ivo', familyName: base.protagonist.familyName, birthYear: year - 30, deathYear: null,
      traits: base.npcs[parent.npcId]!.traits, predispositions: { longevity: 50, robustness: 50 }, talents: [], class: 'middle', countryCode: base.location.countryCode,
      parentIds: [base.protagonist.id], memories: [],
    };
    base.stories.feud_sibling = { stage: 1, since: year - 5, subjectId: 'feud-uncle' };
    retrack(base);
    const s = next(base, 'feud', parent.npcId);
    expect(s.stories.feud_sibling).toBeDefined();
    const uncle = s.relationships[relKey('feud-uncle', s.protagonist.id)];
    expect(uncle).toBeDefined();
    expect(uncle!.dims.conflict).toBeGreaterThanOrEqual(30);
    expect(validateState(s)).toEqual([]);
  });

  it('plays three generations end to end with every invariant intact', () => {
    let state = dead;
    for (let g = 2; g <= 3; g++) {
      state = next(state, `g${g}`);
      expect(state.dynasty.generation).toBe(g);
      state = autoPlay(state, `play-${g}`, 600, FAMILY_POLICY).state;
      expect(state.protagonist.death).not.toBeNull();
      expect(validateState(state)).toEqual([]);
    }
    expect(Object.keys(state.npcs).length).toBeLessThan(250);
    const chain = next(state, 'g4');
    expect(chain.dynasty.chronicle.map((c) => c.generation)).toEqual([1, 2, 3]);
  });

  it('survives running out of heirs: a distant relative becomes the parent', () => {
    const lonely = structuredClone(dead);
    for (const n of Object.values(lonely.npcs)) if (n.deathYear === null && lonely.protagonist.parentIds.indexOf(n.id) < 0) n.deathYear = lonely.protagonist.death!.date.year - 1;
    retrack(lonely);
    const s = next(lonely, 'lonely');
    expect(validateState(s)).toEqual([]);
    expect(s.protagonist.parentIds).toHaveLength(2);
  });

  it('the new life plays normally', () => {
    let s = next(dead, 'playable');
    const r = simulate(s, { type: 'ADVANCE_YEAR', commandId: 'a', expectedRevision: 0 }, ctx);
    expect(r.ok).toBe(true);
    if (r.ok) s = r.state;
    expect(s.revision).toBe(1);
  });
});

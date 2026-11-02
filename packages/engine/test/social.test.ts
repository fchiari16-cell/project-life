import { describe, expect, it } from 'vitest';
import {
  canonicalStringify,
  childrenOf,
  relationCode,
  validateGenealogy,
  validateState,
  wouldCreateCycle,
  type RelationCode,
} from '../src/index';
import { relKey } from '../src/npc';
import { autoPlay, newLife } from './helpers';

const FAMILY_POLICY = ['ask_out', 'propose', 'try', 'talk', 'spend_time', 'befriend', 'help', 'reconcile'];

describe('NPC graph and genealogy', () => {
  it('a new life has a valid household of persistent NPCs with their own traits', () => {
    const s = newLife('household');
    const [m, f] = s.protagonist.parentIds.map((id) => s.npcs[id]!);
    expect(m && f).toBeTruthy();
    expect(validateGenealogy(s)).toEqual([]);
    expect(relationCode(s, m!.id)).toBe('parent');
    for (const n of Object.values(s.npcs)) expect(Object.keys(n.traits)).toHaveLength(9);
    const sib = Object.values(s.npcs).find((n) => relationCode(s, n.id) === 'sibling');
    if (sib) expect(sib.parentIds).toEqual(s.protagonist.parentIds);
  });

  it('relationships are directed and start out asymmetric', () => {
    let asymmetric = 0;
    for (let i = 0; i < 20; i++) {
      const s = newLife(`asym-${i}`);
      const pid = s.protagonist.parentIds[0]!;
      const a = s.relationships[relKey(s.protagonist.id, pid)]!;
      const b = s.relationships[relKey(pid, s.protagonist.id)]!;
      if (canonicalStringify(a.dims) !== canonicalStringify(b.dims)) asymmetric++;
    }
    expect(asymmetric).toBeGreaterThan(15);
  });

  it('refuses impossible family trees: cycles, self-parenthood, too-young parents, unknown parents', () => {
    const s = newLife('cycles');
    const [mother] = s.protagonist.parentIds as [string, string];
    expect(wouldCreateCycle(s, mother, s.protagonist.id)).toBe(true); // my child cannot be my parent
    expect(wouldCreateCycle(s, s.protagonist.id, s.protagonist.id)).toBe(true);
    expect(wouldCreateCycle(s, s.protagonist.id, mother)).toBe(false);

    const loop = structuredClone(s);
    loop.npcs[mother]!.parentIds = [loop.protagonist.id];
    expect(validateGenealogy(loop).join()).toMatch(/own ancestor/);

    const young = structuredClone(s);
    young.npcs[mother]!.birthYear = young.protagonist.birth.year - 5;
    expect(validateGenealogy(young).join()).toMatch(/younger than/);

    const ghost = structuredClone(s);
    ghost.protagonist.parentIds = ['nobody'];
    expect(validateGenealogy(ghost).join()).toMatch(/unknown parent/);
    expect(validateState(ghost).length).toBeGreaterThan(0);
  });
});

describe('autonomy, memory and children over whole lives', () => {
  const lives = Array.from({ length: 40 }, (_, i) => autoPlay(newLife(`social-${i}`), `pol-${i}`, 600, FAMILY_POLICY));

  it('NPCs decide for themselves: the same request is sometimes accepted and sometimes refused', () => {
    const outcomes = lives.flatMap((l) =>
      l.events.flatMap((e) => (e.type === 'EVENT_RESOLVED' && e.payload.eventId === 'romantic_interest' && e.payload.choiceId === 'ask_out' ? [e.payload.outcomeId] : [])),
    );
    console.info(`[social] ask_out outcomes: ${outcomes.filter((o) => o === 'accepted').length} accepted / ${outcomes.filter((o) => o === 'declined').length} declined`);
    expect(outcomes).toContain('accepted');
    expect(outcomes).toContain('declined');
  });

  it('relationships evolve while the player does nothing: friends fade, partners can leave, relatives are born', () => {
    const changes = new Set(lives.flatMap((l) => l.events.flatMap((e) => (e.type === 'SOCIAL' ? [e.payload.change] : []))));
    console.info(`[social] observed changes: ${[...changes].join(', ')}`);
    for (const c of ['FRIEND_MADE', 'ROMANCE_STARTED', 'MARRIED', 'CHILD_BORN', 'RELATIVE_BORN']) expect(changes).toContain(c);
  });

  it('children have valid parents, inherit traits within range, and everything stays consistent', () => {
    let withKids = 0;
    for (const { state } of lives) {
      expect(validateState(state)).toEqual([]);
      const kids = childrenOf(state, state.protagonist.id);
      if (kids.length) withKids++;
      for (const k of kids) {
        expect(k.parentIds).toContain(state.protagonist.id);
        for (const v of Object.values(k.traits)) expect(v).toBeGreaterThanOrEqual(0);
      }
      for (const n of Object.values(state.npcs)) expect(n.memories.length).toBeLessThanOrEqual(12);
    }
    console.info(`[social] ${withKids}/${lives.length} lives had children`);
    expect(withKids).toBeGreaterThan(5);
  });

  it('relation codes cover the family tree', () => {
    const seen = new Set<RelationCode>();
    for (const { state } of lives) for (const n of Object.values(state.npcs)) seen.add(relationCode(state, n.id));
    for (const c of ['parent', 'child', 'sibling', 'spouse'] as const) expect(seen).toContain(c);
  });
});

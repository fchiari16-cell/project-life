import { describe, expect, it } from 'vitest';
import type { Choice, GameState } from '@project-life/schemas';
import { AVAILABILITY_REASONS, actionAvailability, certainCost, continueDynasty, pendingChoices, simulate } from '../src/index';
import { ctx, newLife } from './helpers';

const KNOWN_REASONS = new Set<string>(AVAILABILITY_REASONS);
let n = 0;
const id = (): string => `av${n++}`;

/** Every state a life passes through, from birth to the end, answering decisions with their first choice. */
function lifeStates(start: GameState): GameState[] {
  const states = [start];
  let s = start;
  for (let i = 0; i < 400 && !s.protagonist.death; i++) {
    const view = s.simulation.status === 'PAUSED_EVENT' ? pendingChoices(s, ctx) : null;
    const r = view
      ? simulate(s, { type: 'RESOLVE_EVENT', commandId: id(), expectedRevision: s.revision, choiceId: view.choices[0]!.id }, ctx)
      : simulate(s, { type: 'ADVANCE_YEAR', commandId: id(), expectedRevision: s.revision }, ctx);
    if (!r.ok) throw new Error(r.error.message);
    s = r.state;
    states.push(s);
  }
  return states;
}

describe('action availability is the engine\'s own verdict', () => {
  for (const god of [false, true]) {
    it(`matches what simulate accepts at every point of a whole life (GOD MODE ${god ? 'on' : 'off'})`, () => {
      const states = lifeStates(newLife(`avail-${god}`, { godModeEnabled: god }));
      let sawPending = false;
      let sawDead = false;
      for (const s of states) {
        const adv = actionAvailability(s, 'ADVANCE_YEAR');
        expect(adv.available, `advance @r${s.revision}`).toBe(simulate(s, { type: 'ADVANCE_YEAR', commandId: id(), expectedRevision: s.revision }, ctx).ok);

        const view = s.simulation.status === 'PAUSED_EVENT' ? pendingChoices(s, ctx) : null;
        const res = actionAvailability(s, 'RESOLVE_EVENT');
        const resolved = simulate(s, { type: 'RESOLVE_EVENT', commandId: id(), expectedRevision: s.revision, choiceId: view?.choices[0]?.id ?? 'none' }, ctx);
        expect(res.available, `resolve @r${s.revision}`).toBe(resolved.ok);

        const edit = actionAvailability(s, 'GOD_EDIT', { targetId: s.protagonist.id });
        const edited = simulate(s, { type: 'GOD_EDIT', commandId: id(), expectedRevision: s.revision, targetId: s.protagonist.id, patch: { givenName: `Zed${n}` } }, ctx);
        expect(edit.available, `god edit @r${s.revision}`).toBe(edited.ok);

        for (const a of [adv, res, edit]) {
          expect(a.available ? a.reasons : a.reasons.length > 0 && a.requirements.length > 0, 'unavailable always says why and what is needed').toBeTruthy();
          for (const r of a.reasons) expect(KNOWN_REASONS.has(r), r).toBe(true);
        }
        sawPending ||= adv.reasons.includes('decision_pending');
        sawDead ||= adv.reasons.includes('life_ended');
      }
      expect(sawPending).toBe(true);
      expect(sawDead).toBe(true);
    });
  }

  it('continuing the dynasty is available exactly when the life has ended', () => {
    const states = lifeStates(newLife('avail-dyn'));
    for (const s of states) {
      const a = actionAvailability(s, 'CONTINUE_DYNASTY');
      expect(a.available).toBe(continueDynasty(s, { seed: 'x', givenName: 'Nova' }, ctx).ok);
      if (!a.available) expect(a.reasons).toEqual(['life_not_ended']);
    }
    expect(actionAvailability(states.at(-1)!, 'CONTINUE_DYNASTY').available).toBe(true);
  });

  it('GOD MODE editing explains itself: not chosen, or a target that is gone', () => {
    const off = newLife('avail-off');
    expect(actionAvailability(off, 'GOD_EDIT', { targetId: off.protagonist.id })).toEqual({ available: false, reasons: ['god_mode_not_chosen'], requirements: ['choose_god_mode_at_creation'] });
    const on = newLife('avail-on', { godModeEnabled: true });
    expect(actionAvailability(on, 'GOD_EDIT', { targetId: 'nobody' }).reasons).toEqual(['target_unavailable']);
    expect(actionAvailability(on, 'GOD_EDIT', { targetId: on.protagonist.parentIds[0]! }).available).toBe(true);
  });
});

describe('certain cost of a choice', () => {
  const adult = (): GameState => {
    const s = structuredClone(newLife('cost', { countryCode: 'IT' }));
    s.world.currentDate = { ...s.world.currentDate, year: s.world.currentDate.year + 30 };
    return s;
  };
  const choice = (...costs: (number | null)[]): Choice => ({
    id: 'c',
    label: 'c',
    outcomes: costs.map((c, i) => ({ id: `o${i}`, weight: 1, effects: c === null ? [] : [{ type: 'money' as const, ref: -c }], text: 't' })),
  });

  it('is known only when every possible outcome declares a cost, and is the smallest of them', () => {
    const s = adult();
    const one = certainCost(s, ctx, choice(10_000));
    const two = certainCost(s, ctx, choice(10_000, 40_000));
    expect(one).not.toBeNull();
    expect(one).toBeGreaterThan(0);
    expect(two).toBe(one); // the smallest: the real cost may be higher
    expect(certainCost(s, ctx, choice(10_000, null))).toBeNull(); // one outcome is free: nothing certain
    expect(certainCost(s, ctx, choice(null))).toBeNull();
  });

  it('scales with the local cost level and is nothing for minors (their costs fall on the family)', () => {
    const rich = adult();
    const base = certainCost(rich, ctx, choice(10_000))!;
    const inflated = structuredClone(rich);
    inflated.world.priceIndex = rich.world.priceIndex * 2;
    expect(certainCost(inflated, ctx, choice(10_000))).toBe(base * 2);
    expect(certainCost(newLife('minor'), ctx, choice(10_000))).toBeNull();
  });

  it('never invents a cost for the authored content: whatever it reports is a positive whole amount', () => {
    const s = adult();
    for (const e of ctx.content.events) {
      for (const c of e.choices) {
        const cost = certainCost(s, ctx, c);
        if (cost !== null) {
          expect(Number.isInteger(cost) && cost > 0, `${e.id}/${c.id}`).toBe(true);
          expect(c.outcomes.every((o) => o.effects.some((x) => x.type === 'money' && x.ref < 0))).toBe(true);
        }
      }
    }
  });
});

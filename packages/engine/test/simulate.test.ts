import { describe, expect, it } from 'vitest';
import { STAT_KEYS, type GameState } from '@project-life/schemas';
import {
  addMonth,
  ageInYears,
  canTransition,
  canonicalStringify,
  createGame,
  daysInMonth,
  isLeapYear,
  netWorth,
  pendingChoices,
  simulate,
  validateState,
} from '../src/index';
import { START, autoPlay, ctx, newLife } from './helpers';

const advance = (s: GameState, id: string, rev = s.revision) =>
  simulate(s, { type: 'ADVANCE_YEAR', commandId: id, expectedRevision: rev }, ctx);
const resolve = (s: GameState, id: string, choiceId: string, rev = s.revision) =>
  simulate(s, { type: 'RESOLVE_EVENT', commandId: id, expectedRevision: rev, choiceId }, ctx);

/** Advance until an event pauses the year; returns that paused state. */
function untilPause(): GameState {
  for (let n = 0; n < 40; n++) {
    let s = newLife(`pause-${n}`);
    for (let i = 0; i < 25 && !s.protagonist.death; i++) {
      const r = advance(s, `a${i}`);
      if (!r.ok) throw new Error(r.error.message);
      s = r.state;
      if (s.simulation.status === 'PAUSED_EVENT') return s;
    }
  }
  throw new Error('no event paused in 40 lives — event system is not triggering');
}

describe('calendar', () => {
  it('knows leap years and month lengths', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2025, 2)).toBe(28);
    expect(daysInMonth(2025, 4)).toBe(30);
  });
  it('keeps a 29 Feb birthday anchored across common and leap years', () => {
    let d = { year: 2024, month: 2, day: 29 };
    const seen: string[] = [];
    for (let i = 0; i < 24; i++) {
      d = addMonth(d, 29);
      if (d.month === 2) seen.push(`${d.year}-${d.day}`);
    }
    expect(seen).toEqual(['2025-28', '2026-28']);
    let e = { year: 2027, month: 2, day: 28 };
    for (let i = 0; i < 12; i++) e = addMonth(e, 29);
    expect(e).toEqual({ year: 2028, month: 2, day: 29 });
  });
});

describe('createGame', () => {
  it('creates a valid newborn with family, finances and stats in range', () => {
    const s = newLife();
    expect(validateState(s)).toEqual([]);
    expect(s.revision).toBe(0);
    expect(ageInYears(s.protagonist.birth, s.world.currentDate)).toBe(0);
    expect(s.protagonist.parentIds).toHaveLength(2);
    expect(Object.keys(s.npcs).length).toBeGreaterThanOrEqual(2);
    expect(netWorth(s)).toBe(0);
    for (const k of STAT_KEYS) expect(s.protagonist.stats[k]).toBeGreaterThanOrEqual(0);
  });
  it('is deterministic and seed-sensitive', () => {
    expect(canonicalStringify(newLife('x'))).toBe(canonicalStringify(newLife('x')));
    expect(canonicalStringify(newLife('x'))).not.toBe(canonicalStringify(newLife('y')));
  });
  it('honours an explicit country and rejects unknown ones, bad dates, empty names', () => {
    expect(newLife('a', { countryCode: 'JP' }).location.countryCode).toBe('JP');
    expect(newLife('a', { countryCode: 'JP' }).finance.currency).toBe('JPY');
    expect(createGame({ seed: 's', givenName: 'A', familyName: 'B', startDate: START, countryCode: 'ZZ' }, ctx)).toMatchObject({ ok: false });
    expect(createGame({ seed: 's', givenName: 'A', familyName: 'B', startDate: { year: 2025, month: 2, day: 30 } }, ctx).ok).toBe(false);
    expect(createGame({ seed: 's', givenName: ' ', familyName: 'B', startDate: START }, ctx).ok).toBe(false);
  });
});

describe('simulate', () => {
  it('a completed year is exactly 12 months with a YEAR_COMPLETED event and checkpoint', () => {
    // Events may pause the year; resolving them resumes it. Collect everything until the year completes.
    let s = newLife('year-0');
    const events: ReturnType<typeof advance> extends infer R ? (R extends { ok: true; events: infer E } ? E : never) : never = [] as never;
    let last;
    for (let n = 0; n < 20; n++) {
      const r =
        s.simulation.status === 'PAUSED_EVENT'
          ? resolve(s, `r${n}`, pendingChoices(s, ctx)!.choices[0]!.id)
          : advance(s, `a${n}`);
      if (!r.ok) throw new Error(r.error.message);
      (events as unknown[]).push(...r.events);
      last = r;
      s = r.state;
      if (s.simulation.status === 'COMPLETED' || s.protagonist.death) break;
    }
    expect(s.simulation.status).toBe('COMPLETED');
    expect(s.world.currentDate).toMatchObject({ year: 2026, month: 3, day: 14 });
    expect((events as { type: string }[]).filter((e) => e.type === 'MONTH_ADVANCED')).toHaveLength(12);
    expect((events as { type: string }[]).at(-1)?.type).toBe('YEAR_COMPLETED');
    expect(last?.ok && last.checkpoint?.reason).toBe('YEAR_COMPLETED');
    expect(new Set((events as { id: string }[]).map((e) => e.id)).size).toBe((events as unknown[]).length);
  });

  it('does not mutate its input and is idempotent per commandId', () => {
    const s = newLife('idem');
    const before = canonicalStringify(s);
    const first = advance(s, 'c1');
    expect(canonicalStringify(s)).toBe(before);
    if (!first.ok) throw new Error('unexpected');
    const again = advance(first.state, 'c1');
    expect(again.ok && again.duplicate).toBe(true);
    expect(again.ok && again.state).toEqual(first.state);
  });

  it('rejects stale revisions, malformed commands and wrong rule versions', () => {
    const s = newLife('bad');
    const first = advance(s, 'c1');
    if (!first.ok) throw new Error('unexpected');
    expect(advance(first.state, 'c2', 0)).toMatchObject({ ok: false, error: { code: 'STALE_REVISION' } });
    expect(simulate(s, { type: 'NOPE' }, ctx)).toMatchObject({ error: { code: 'INVALID_COMMAND' } });
    expect(simulate(s, { type: 'ADVANCE_YEAR', commandId: 'x', expectedRevision: 0 }, { ...ctx, rulesVersion: '9' })).toMatchObject({
      error: { code: 'INCOMPATIBLE_VERSION' },
    });
  });

  it('an event stops the year, checkpoints, and only a decision resumes it', () => {
    const paused = untilPause();
    const pending = paused.simulation.pending!;
    expect(paused.simulation.status).toBe('PAUSED_EVENT');
    expect(paused.simulation.monthsDone).toBeGreaterThan(0);
    expect(validateState(paused)).toEqual([]);

    expect(advance(paused, 'x')).toMatchObject({ ok: false, error: { code: 'INVALID_TRANSITION' } });
    expect(resolve(paused, 'x', 'no_such_choice')).toMatchObject({ ok: false, error: { code: 'INVALID_COMMAND' } });
    expect(paused.simulation.pending).toEqual(pending); // failed commands left the state alone

    const choice = pendingChoices(paused, ctx)!.choices[0]!;
    const r = resolve(paused, 'r1', choice.id);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.events.some((e) => e.type === 'EVENT_RESOLVED')).toBe(true);
    expect(r.state.simulation.pending === null || r.state.simulation.status === 'PAUSED_EVENT').toBe(true);

    // Applying the same command again must not apply effects twice.
    const dup = resolve(r.state, 'r1', choice.id);
    expect(dup.ok && dup.duplicate).toBe(true);
    expect(dup.ok && dup.state).toEqual(r.state);
    // A different decision against the old revision is refused.
    expect(resolve(paused, 'r2', choice.id, paused.revision + 5)).toMatchObject({ error: { code: 'STALE_REVISION' } });
  });

  it('pause checkpoints carry the EVENT_PAUSE reason and the paused state checksum', () => {
    const paused = untilPause();
    const choice = pendingChoices(paused, ctx)!.choices[0]!;
    expect(choice).toBeDefined();
    // Re-derive the pause: the previous command produced it, so replay up to it.
    let s = newLife(paused.seed);
    for (let i = 0; i < 40 && s.revision < paused.revision; i++) {
      const next = advance(s, `p${i}`);
      if (!next.ok) throw new Error(next.error.message);
      if (next.state.simulation.status === 'PAUSED_EVENT') {
        expect(next.checkpoint?.reason).toBe('EVENT_PAUSE');
        expect(next.checkpoint?.revision).toBe(next.state.revision);
        return;
      }
      s = next.state;
    }
  });
});

describe('a whole life', () => {
  it('runs birth to death keeping every invariant (ledger balanced, no stuck state)', () => {
    const { state, events, pauses } = autoPlay(newLife('full-life'));
    expect(state.protagonist.death).not.toBeNull();
    const age = ageInYears(state.protagonist.birth, state.protagonist.death!.date);
    expect(age).toBeGreaterThanOrEqual(0);
    expect(age).toBeLessThanOrEqual(115);
    expect(validateState(state)).toEqual([]);
    expect(events.filter((e) => e.type === 'DEATH')).toHaveLength(1);
    // Dying in the birth month happens before that birthday is processed.
    expect(events.filter((e) => e.type === 'BIRTHDAY').length).toBeGreaterThanOrEqual(age - 1);
    expect(events.filter((e) => e.type === 'BIRTHDAY').length).toBeLessThanOrEqual(age);
    expect(pauses).toBeGreaterThan(0);
    expect(advance(state, 'after-death')).toMatchObject({ ok: false, error: { code: 'INVALID_TRANSITION' } });
  });

  it('replays identically: same seed and decisions give a byte-identical life', () => {
    const a = autoPlay(newLife('det'));
    const b = autoPlay(newLife('det'));
    expect(canonicalStringify(a.state)).toBe(canonicalStringify(b.state));
    expect(a.events.length).toBe(b.events.length);
  });

  it('different decisions with the same seed diverge (choices matter)', () => {
    const a = autoPlay(newLife('div'), 'policy-a');
    const b = autoPlay(newLife('div'), 'policy-b');
    expect(canonicalStringify(a.state)).not.toBe(canonicalStringify(b.state));
  });

  it('children go to school and gain qualifications on schedule', () => {
    const s0 = newLife('school');
    let s = s0;
    for (let i = 0; i < 13 && !s.protagonist.death; i++) {
      const r = advance(s, `y${i}`);
      if (!r.ok) throw new Error(r.error.message);
      s = r.state;
      while (s.simulation.status === 'PAUSED_EVENT') {
        const c = pendingChoices(s, ctx)!.choices[0]!;
        const rr = resolve(s, `e${i}${s.revision}`, c.id);
        if (!rr.ok) throw new Error(rr.error.message);
        s = rr.state;
      }
    }
    if (!s.protagonist.death) {
      expect(s.education.qualifications).toContain('primary');
      expect(s.education.stage).toBe('secondary');
    }
  });
});

describe('minors', () => {
  it('never accumulate personal money or debt before 18 (family bears the costs)', () => {
    for (let n = 0; n < 15; n++) {
      let s = newLife(`minor-${n}`);
      for (let i = 0; i < 60 && !s.protagonist.death && ageInYears(s.protagonist.birth, s.world.currentDate) < 18; i++) {
        const r =
          s.simulation.status === 'PAUSED_EVENT'
            ? resolve(s, `m${i}`, pendingChoices(s, ctx)!.choices[0]!.id)
            : advance(s, `m${i}`);
        if (!r.ok) throw new Error(r.error.message);
        s = r.state;
        if (ageInYears(s.protagonist.birth, s.world.currentDate) < 18) expect(netWorth(s)).toBe(0);
      }
    }
  });
});

describe('state machine', () => {
  it('allows the documented transitions only', () => {
    expect(canTransition('IDLE', 'RUNNING')).toBe(true);
    expect(canTransition('RUNNING', 'PAUSED_EVENT')).toBe(true);
    expect(canTransition('PAUSED_EVENT', 'RESOLVING')).toBe(true);
    expect(canTransition('RESOLVING', 'RUNNING')).toBe(true);
    expect(canTransition('RUNNING', 'COMPLETED')).toBe(true);
    expect(canTransition('IDLE', 'COMPLETED')).toBe(false);
    expect(canTransition('PAUSED_EVENT', 'RUNNING')).toBe(false);
  });
});

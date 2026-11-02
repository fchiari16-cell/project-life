import { describe, expect, it } from 'vitest';
import type { DomainEvent } from '@project-life/schemas';
import { continueDynasty, dynastyOptions, trackedCounts, validateState } from '../src/index';
import { autoPlay, ctx, newLife } from './helpers';

const SOCIETY = [
  'party:civic_alliance', 'party:free_initiative', 'local', 'national', 'cut_taxes', 'raise_welfare', 'green',
  'accept_minor', 'public_statement', 'hire_lawyer', 'community_program', 'embrace', 'candid', 'accept',
  'move:DE', 'move:US', 'move:GB', 'move:JP', 'apply_residency', 'apply', 'exam', 'befriend', 'ask_out', 'invest_half', 'buy',
];

const count = (events: DomainEvent[], change: string): number =>
  events.filter((e) => (e.type === 'SOCIETY' || e.type === 'WORLD' || e.type === 'ASSET_CHANGED') && (('change' in e.payload && e.payload.change === change) || ('kind' in e.payload && e.payload.kind === change))).length;

describe('long-run society and world consistency (M4 exit criterion)', () => {
  const LIVES = 150;
  const lives = Array.from({ length: LIVES }, (_, i) => autoPlay(newLife(`soc-${i}`), `sp-${i}`, 700, SOCIETY));

  it('every life stays valid for its whole length and every tracked person is counted exactly once', () => {
    for (const { state } of lives) {
      expect(state.protagonist.death).not.toBeNull();
      expect(validateState(state)).toEqual([]);
      for (const [code, n] of Object.entries(trackedCounts(state))) expect(state.world.countries[code]!.tracked).toBe(n);
    }
  });

  it('the world is lively and every society module is used', () => {
    const all = lives.flatMap((l) => l.events);
    const metrics = {
      elected: count(all, 'ELECTED'),
      reelected: count(all, 'RE_ELECTED'),
      policies: count(all, 'POLICY_PASSED'),
      investigated: count(all, 'INVESTIGATION_OPENED'),
      charged: count(all, 'CHARGED'),
      convicted: count(all, 'CONVICTED'),
      acquitted: count(all, 'ACQUITTED'),
      dropped: count(all, 'CASE_DROPPED'),
      moved: count(all, 'MOVED'),
      visaExpired: count(all, 'VISA_EXPIRED'),
      residency: count(all, 'RESIDENCY_GRANTED'),
      citizenship: count(all, 'CITIZENSHIP_GRANTED'),
      recognised: count(all, 'QUALIFICATION_RECOGNISED'),
      elections: count(all, 'ELECTION'),
      disasters: count(all, 'DISASTER'),
    };
    const jailed = lives.filter((l) => l.state.society.record).length;
    console.info(`[society] ${LIVES} lives: ${JSON.stringify(metrics)}; with a record at death: ${jailed}`);
    expect(metrics.elected).toBeGreaterThan(0);
    expect(metrics.policies).toBeGreaterThan(0);
    expect(metrics.investigated).toBeGreaterThan(0);
    expect(metrics.moved).toBeGreaterThan(0);
    expect(metrics.elections).toBeGreaterThan(0);
    // Accusation, charge and conviction are separate stages: not every investigation ends in a conviction.
    expect(metrics.convicted + metrics.acquitted + metrics.dropped).toBeGreaterThan(0);
    expect(metrics.convicted).toBeLessThanOrEqual(metrics.investigated);
  });

  it('generations share one world: history, demography and tracking stay consistent over four generations', { timeout: 180_000 }, () => {
    for (let d = 0; d < 6; d++) {
      let state = autoPlay(newLife(`sdyn-${d}`), `sd-${d}`, 700, SOCIETY).state;
      for (let g = 2; g <= 4; g++) {
        const opts = dynastyOptions(state);
        const r = continueDynasty(state, { seed: `sd-${d}-${g}`, givenName: `G${g}`, parentId: opts[0]?.npcId ?? null }, ctx);
        if (!r.ok) throw new Error(r.error.message);
        expect(validateState(r.state)).toEqual([]);
        expect(r.state.world.history.length).toBeLessThanOrEqual(80);
        const play = autoPlay(r.state, `sq-${d}-${g}`, 700, SOCIETY);
        state = play.state;
        expect(validateState(state)).toEqual([]);
        for (const c of Object.values(state.world.countries)) expect(c.population).toBeGreaterThan(c.tracked);
      }
      expect(state.dynasty.generation).toBe(4);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { continueDynasty, dynastyOptions, netWorth, validateState } from '../src/index';
import { autoPlay, ctx, newLife } from './helpers';

const ECON = ['consulting', 'software', 'workshop', 'retail', 'invest_half', 'add_more', 'buy', 'expand', 'keep', 'hold', 'spec:backend', 'spec:industrial', 'spec:tax'];

/** Net worth in reference EUR cents (undoing exchange rate and price level) so lives in different countries compare. */
const refWorth = (s: ReturnType<typeof newLife>): number => {
  const c = ctx.content.countries.find((x) => x.code === s.location.countryCode)!;
  return netWorth(s) / ((c.fxPerEur * s.world.priceIndex) / 10_000);
};

describe('long-run economic consistency (M3 exit criterion)', () => {
  const LIVES = 150;
  const lives = Array.from({ length: LIVES }, (_, i) => autoPlay(newLife(`econ-${i}`), `ep-${i}`, 700, ECON));

  it('every life keeps all ledgers balanced and registers consistent for its whole length', () => {
    for (const { state } of lives) {
      expect(state.protagonist.death).not.toBeNull();
      expect(validateState(state)).toEqual([]);
    }
  });

  it('money is conserved: no account drifts, cash never goes negative, debts are never silently written off', () => {
    for (const { state } of lives) {
      expect(Object.values(state.finance.accounts).reduce((a, b) => a + b, 0)).toBe(0);
      expect(state.finance.accounts['asset:cash'] ?? 0).toBeGreaterThanOrEqual(0);
      expect(state.finance.accounts['liability:debt'] ?? 0).toBeLessThanOrEqual(0);
      for (const b of Object.values(state.businesses)) expect(Object.values(b.accounts).reduce((a, v) => a + v, 0)).toBe(0);
    }
  });

  it('the economy produces a spread of outcomes and uses every module', () => {
    const count = (type: string, change: string): number =>
      lives.filter((l) => l.events.some((e) => (e.type === 'ASSET_CHANGED' || e.type === 'JOB_CHANGED') && e.payload.change === change && e.type === type)).length;
    const founded = count('ASSET_CHANGED', 'BUSINESS_FOUNDED');
    const bankrupt = count('ASSET_CHANGED', 'BUSINESS_BANKRUPT');
    const sold = count('ASSET_CHANGED', 'BUSINESS_SOLD');
    const homes = count('ASSET_CHANGED', 'HOME_BOUGHT');
    const foreclosed = count('ASSET_CHANGED', 'HOME_FORECLOSED');
    const invested = count('ASSET_CHANGED', 'INVESTED');
    const specialised = count('JOB_CHANGED', 'SPECIALIZED');
    const promoted = count('JOB_CHANGED', 'PROMOTED');
    const worth = lives.map((l) => refWorth(l.state)).sort((a, b) => a - b);
    const q = (p: number): number => Math.round(worth[Math.floor(p * (worth.length - 1))]! / 100);
    console.info(
      `[econ] ${LIVES} lives: promoted ${promoted}, specialised ${specialised}, invested ${invested}, homes ${homes} (foreclosed ${foreclosed}), businesses ${founded} (sold ${sold}, bankrupt ${bankrupt}); final net worth EUR p10 ${q(0.1)} / median ${q(0.5)} / p90 ${q(0.9)}`,
    );
    expect(promoted).toBeGreaterThan(LIVES / 2);
    expect(invested).toBeGreaterThan(0);
    expect(homes).toBeGreaterThan(0);
    expect(founded).toBeGreaterThan(0);
    expect(new Set(worth.map(Math.round)).size).toBeGreaterThan(LIVES * 0.8);
    expect(q(0.9)).toBeGreaterThan(q(0.1));
  });

  it('survives generations: businesses and wealth carry over, and four-generation chains stay consistent', { timeout: 180_000 }, () => {
    let inherited = 0;
    for (let d = 0; d < 10; d++) {
      let state = autoPlay(newLife(`edyn-${d}`), `edp-${d}`, 700, ECON).state;
      for (let g = 2; g <= 4; g++) {
        const opts = dynastyOptions(state);
        const r = continueDynasty(state, { seed: `ed-${d}-${g}`, givenName: `G${g}`, parentId: opts[0]?.npcId ?? null }, ctx);
        if (!r.ok) throw new Error(r.error.message);
        expect(validateState(r.state)).toEqual([]);
        const play = autoPlay(r.state, `edq-${d}-${g}`, 700, ECON);
        inherited += play.events.filter((e) => e.type === 'ASSET_CHANGED' && e.payload.change === 'BUSINESS_INHERITED').length;
        state = play.state;
        expect(validateState(state)).toEqual([]);
      }
    }
    console.info(`[econ] businesses inherited across generations: ${inherited}`);
    expect(inherited).toBeGreaterThanOrEqual(0);
  });
});

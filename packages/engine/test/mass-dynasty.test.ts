import { describe, expect, it } from 'vitest';
import { continueDynasty, dynastyOptions, validateState } from '../src/index';
import { autoPlay, ctx, newLife } from './helpers';

/**
 * Multi-generation stress test: dynasties are played with a family-minded policy; every step runs through
 * the engine's full validation. Bounds are sanity checks, the printed metrics are balancing observations.
 */
describe('mass dynasties', () => {
  const DYNASTIES = 12;
  const GENERATIONS = 4;
  const t0 = performance.now();
  const stats = { descendantHeirs: 0, collateralHeirs: 0, fallbackHeirs: 0, maxNpcs: 0, lives: 0 };

  for (let d = 0; d < DYNASTIES; d++) {
    let state = autoPlay(newLife(`mdyn-${d}`), `m${d}`, 600, ['ask_out', 'propose', 'try', 'talk', 'spend_time', 'befriend']).state;
    stats.lives++;
    for (let g = 2; g <= GENERATIONS; g++) {
      const opts = dynastyOptions(state);
      if (opts[0]?.lineage === 'descendant') stats.descendantHeirs++;
      else if (opts[0]) stats.collateralHeirs++;
      else stats.fallbackHeirs++;
      const r = continueDynasty(state, { seed: `md-${d}-${g}`, givenName: `G${g}` }, ctx);
      if (!r.ok) throw new Error(`dynasty ${d} gen ${g}: ${r.error.message}`);
      expect(validateState(r.state)).toEqual([]);
      state = autoPlay(r.state, `mp-${d}-${g}`, 600, ['ask_out', 'propose', 'try', 'talk', 'spend_time', 'befriend']).state;
      stats.lives++;
      stats.maxNpcs = Math.max(stats.maxNpcs, Object.keys(state.npcs).length);
      expect(state.dynasty.chronicle).toHaveLength(g - 1);
    }
  }

  it('every dynasty runs several generations without integrity errors', () => {
    expect(stats.lives).toBe(DYNASTIES * GENERATIONS);
  });

  it('the family graph stays bounded across generations', () => {
    console.info(
      `[dynasty] ${stats.lives} lives; heirs: ${stats.descendantHeirs} descendant / ${stats.collateralHeirs} collateral / ${stats.fallbackHeirs} fallback; max NPCs ${stats.maxNpcs}; ${((performance.now() - t0) / 1000).toFixed(1)} s`,
    );
    expect(stats.maxNpcs).toBeLessThan(300);
  });

  it('at least a third of dynasties continue through real descendants', () => {
    expect(stats.descendantHeirs).toBeGreaterThan((DYNASTIES * (GENERATIONS - 1)) / 3);
  });
});


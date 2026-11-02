import { describe, expect, it } from 'vitest';
import { createGame, ageInYears, netWorth, validateState } from '../src/index';
import type { GameState } from '@project-life/schemas';
import { autoPlay, fullCtx, newLife, START } from './helpers';

/**
 * Release-candidate balance report. Runs a few hundred complete lives (reduced world) and a set in the full
 * 252-country world, prints the distributions and asserts they stay inside sanity bands. The bands are
 * wide on purpose: they catch a broken model, they do not claim the numbers match real statistics.
 */
const pct = (n: number, d: number): number => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10);
const quantile = (xs: number[], q: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0;
};
const gini = (xs: number[]): number => {
  const v = xs.map((x) => Math.max(0, x)).sort((a, b) => a - b);
  const n = v.length;
  const sum = v.reduce((a, b) => a + b, 0);
  if (sum === 0) return 0;
  let acc = 0;
  v.forEach((x, i) => (acc += (i + 1) * x));
  return (2 * acc) / (n * sum) - (n + 1) / n;
};

function summarize(label: string, states: { state: GameState; events: { type: string; payload: unknown }[] }[]): {
  mean: number;
  p5: number;
  p95: number;
  infant: number;
  gini: number;
} {
  const ages = states.map(({ state: s }) => ageInYears(s.protagonist.birth, s.protagonist.death!.date));
  const worths = states.map(({ state: s }) => netWorth(s) / s.finance.minorUnits);
  const adults = states.filter(({ state: s }) => ageInYears(s.protagonist.birth, s.protagonist.death!.date) >= 30);
  const hired = adults.filter(({ events }) => events.some((e) => e.type === 'JOB_CHANGED' && (e.payload as { change: string }).change === 'HIRED'));
  const mean = ages.reduce((a, b) => a + b, 0) / ages.length;
  const out = { mean, p5: quantile(ages, 0.05), p95: quantile(ages, 0.95), infant: pct(ages.filter((a) => a < 5).length, ages.length), gini: gini(worths) };
  const ach = states.reduce((n, { state: s }) => n + Object.keys(s.achievements).length, 0) / states.length;
  const centenarians = pct(ages.filter((a) => a >= 100).length, ages.length);
  console.info(
    `[release:${label}] lives ${states.length} · age mean ${mean.toFixed(1)} p5 ${out.p5} p95 ${out.p95} · <5y ${out.infant}% · ≥100y ${centenarians}% · ` +
      `ever hired ${pct(hired.length, adults.length)}% · wealth gini ${out.gini.toFixed(2)} · achievements/life ${ach.toFixed(1)}`,
  );
  return out;
}

describe('release candidate: balance over many complete lives', () => {
  it('reduced world, 150 lives: plausible demography, wealth and progress, no integrity errors', () => {
    const runs = Array.from({ length: 150 }, (_, i) => autoPlay(newLife(`rc-${i}`), `p${i}`));
    for (const r of runs) {
      expect(r.state.protagonist.death).not.toBeNull();
      expect(validateState(r.state)).toEqual([]);
    }
    const s = summarize('reduced', runs);
    expect(s.mean).toBeGreaterThan(62);
    expect(s.mean).toBeLessThan(88);
    expect(s.infant).toBeLessThan(6);
    expect(s.gini).toBeGreaterThan(0.2); // not an equal world…
    expect(s.gini).toBeLessThan(0.95); // …and not one person owning everything
    const centenarians = runs.filter((r) => ageInYears(r.state.protagonist.birth, r.state.protagonist.death!.date) >= 100).length;
    expect(centenarians / runs.length).toBeLessThan(0.05);
  }, 300_000);

  it('full 252-country world, 30 lives from different countries: same sanity bands, no integrity errors', () => {
    const runs = Array.from({ length: 30 }, (_, i) => {
      const r = createGame({ seed: `rcg-${i}`, givenName: 'Ada', familyName: 'Verdi', startDate: START }, fullCtx);
      if (!r.ok) throw new Error(r.error.message);
      return autoPlay(r.state, `g${i}`, 600, undefined, fullCtx);
    });
    const countries = new Set(runs.map((r) => r.state.location.countryCode));
    const s = summarize('global', runs);
    expect(countries.size).toBeGreaterThan(8);
    expect(s.mean).toBeGreaterThan(55);
    expect(s.mean).toBeLessThan(90);
    for (const r of runs) expect(validateState(r.state)).toEqual([]);
  }, 300_000);
});

describe('release candidate: performance budget (full 252-country world)', () => {
  it('a year costs well under the budget and the saved state stays small', () => {
    const created = createGame({ seed: 'perf', givenName: 'Ada', familyName: 'Verdi', startDate: START }, fullCtx);
    if (!created.ok) throw new Error(created.error.message);
    const t0 = performance.now();
    const run = autoPlay(created.state, 'perf', 600, undefined, fullCtx);
    const perCommand = (performance.now() - t0) / run.commands;
    const kb = JSON.stringify(run.state).length / 1024;
    console.info(`[release:perf] ${perCommand.toFixed(1)} ms/command (incl. validation), state ${kb.toFixed(0)} KB, ${run.commands} commands`);
    expect(perCommand).toBeLessThan(50); // a button press must feel instant even on a slow phone (≈5–10× slower than this machine)
    expect(kb).toBeLessThan(400);
  }, 120_000);
});

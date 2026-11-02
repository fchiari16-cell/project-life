import { describe, expect, it } from 'vitest';
import { ageInYears, netWorth } from '../src/index';
import { autoPlay, newLife } from './helpers';

/**
 * Massive simulation: thousands of decisions across hundreds of lives. Any invariant violation makes
 * `simulate` return an error, which `autoPlay` turns into a thrown failure. The metric bounds are
 * deliberately wide sanity checks for the M1 model — they are balancing observations, not targets.
 */
describe('mass simulation', () => {
  const LIVES = 300;
  const results = Array.from({ length: LIVES }, (_, i) => {
    const t0 = performance.now();
    const r = autoPlay(newLife(`mass-${i}`));
    return { r, ms: performance.now() - t0 };
  });

  it('every life ends without integrity errors', () => {
    for (const { r } of results) expect(r.state.protagonist.death).not.toBeNull();
  });

  it('life expectancy and infant mortality are plausible', () => {
    const ages = results.map(({ r }) => ageInYears(r.state.protagonist.birth, r.state.protagonist.death!.date));
    const mean = ages.reduce((a, b) => a + b, 0) / ages.length;
    const under18 = ages.filter((a) => a < 18).length / ages.length;
    console.info(`[metrics] mean age at death ${mean.toFixed(1)}, share <18 ${(under18 * 100).toFixed(1)}%`);
    expect(mean).toBeGreaterThan(60);
    expect(mean).toBeLessThan(92);
    expect(under18).toBeLessThan(0.12);
  });

  it('education and careers progress for adults', () => {
    const adults = results.filter(({ r }) => ageInYears(r.state.protagonist.birth, r.state.protagonist.death!.date) >= 30);
    const withSecondary = adults.filter(({ r }) => r.state.education.qualifications.includes('secondary')).length / adults.length;
    const hired = adults.filter(({ r }) => r.events.some((e) => e.type === 'JOB_CHANGED' && e.payload.change === 'HIRED')).length / adults.length;
    const bachelor = adults.filter(({ r }) => r.state.education.qualifications.includes('bachelor')).length / adults.length;
    console.info(`[metrics] adults ${adults.length}: secondary ${(withSecondary * 100).toFixed(0)}%, ever hired ${(hired * 100).toFixed(0)}%, bachelor ${(bachelor * 100).toFixed(0)}%`);
    expect(withSecondary).toBeGreaterThan(0.5);
    expect(hired).toBeGreaterThan(0.5);
    expect(bachelor).toBeGreaterThan(0.02);
  });

  it('wealth is spread out rather than degenerate, and money stays integral', () => {
    const worths = results.map(({ r }) => netWorth(r.state));
    expect(worths.every(Number.isInteger)).toBe(true);
    expect(new Set(worths).size).toBeGreaterThan(LIVES / 2);
  });

  it('keeps per-year simulation fast', () => {
    const totalYears = results.reduce((n, { r }) => n + r.commands, 0);
    const totalMs = results.reduce((n, { ms }) => n + ms, 0);
    console.info(`[perf] ${(totalMs / totalYears).toFixed(2)} ms per command (incl. full-state validation), ${totalYears} commands`);
    expect(totalMs / totalYears).toBeLessThan(25);
  });
});

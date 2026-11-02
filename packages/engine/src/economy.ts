import type { Economy, TaxPeriod } from '@project-life/schemas';
import type { Rng } from './rng.js';
import type { Run } from './run.js';

/**
 * World Engine (M3 scope): the single source of macro rates. Inflation, growth, lending rate, stock and
 * housing returns are drawn once a year from a mean-reverting model; every financial module reads them
 * from `state.world.economy` and never invents rates of its own. Country-level economies arrive in M4.
 */
export const initialEconomy = (): Economy => ({ inflationBp: 250, growthBp: 150, rateBp: 400, stockReturnBp: 500, housingBp: 250 });

const clampInt = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, Math.round(n)));

export function nextEconomy(prev: Economy, rng: Rng): Economy {
  const inflationBp = clampInt(prev.inflationBp * 0.8 + 250 * 0.2 + rng.int(-60, 60), 0, 900);
  const growthBp = clampInt(prev.growthBp * 0.6 + 150 * 0.4 + rng.int(-200, 200), -800, 600);
  const rateBp = clampInt(inflationBp + 100 + growthBp * 0.3, 0, 1500);
  const stockReturnBp = clampInt(500 + growthBp * 2 + rng.int(-1500, 1500), -4000, 4000);
  const housingBp = clampInt(inflationBp * 0.8 + growthBp * 0.5 + rng.int(-250, 250), -1500, 1500);
  return { inflationBp, growthBp, rateBp, stockReturnBp, housingBp };
}

/* ------------------------------ taxation --------------------------- */
const FLAT_FALLBACK: TaxPeriod = {
  fromYear: 0,
  brackets: [{ upToRef: null, rateBp: 2500 }],
  capitalGainsBp: 2000,
  dividendBp: 2000,
  corporateBp: 2400,
  propertyTaxBp: 50,
};

/** The tax period in force for a territory and year: rule sets are versioned by country and effective year. */
export function taxPeriodFor(run: Pick<Run, 'ctx' | 's'>): TaxPeriod {
  const year = run.s.world.currentDate.year;
  const set = run.ctx.content.taxRules.find((r) => r.countries.includes(run.s.location.countryCode));
  if (!set) return FLAT_FALLBACK;
  const sorted = [...set.periods].sort((a, b) => a.fromYear - b.fromYear);
  let chosen = sorted[0] as TaxPeriod;
  for (const p of sorted) if (p.fromYear <= year) chosen = p;
  return chosen;
}

/** Progressive tax on an annual income; bracket limits scale with the local wage level and prices. */
export function incomeTaxAnnual(period: TaxPeriod, annualIncome: number, scale: number): number {
  let tax = 0;
  let lower = 0;
  for (const b of period.brackets) {
    const upper = b.upToRef === null ? Number.POSITIVE_INFINITY : Math.round(b.upToRef * scale);
    if (annualIncome > lower) tax += (Math.min(annualIncome, upper) - lower) * (b.rateBp / 10_000);
    if (annualIncome <= upper) break;
    lower = upper;
  }
  return Math.round(tax);
}

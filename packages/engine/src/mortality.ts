/**
 * Annual mortality (M1 model): small background hazard plus a Gompertz term, q(age) = 0.00004·1.0942^age.
 * Computed by repeated multiplication (no Math.exp/pow) so results are bit-identical on every JS engine.
 * Tuned only to give a plausible shape; real life tables arrive with the geography/demography work (M4/M5).
 */
const GROWTH = 1.0941742837052104; // e^0.09
const MAX_AGE = 115;

export function annualMortality(age: number): number {
  if (age >= MAX_AGE) return 1;
  let gompertz = 0.00004;
  for (let i = 0; i < age; i++) gompertz *= GROWTH;
  const background = age === 0 ? 0.004 : 0.0003;
  return Math.min(0.9, background + gompertz);
}

/** Health 50 is neutral; low health raises monthly risk up to 3×, high health lowers it to 0.4×. */
export function healthMultiplier(health: number): number {
  return Math.max(0.4, Math.min(3, 1 + (50 - health) / 40));
}

/** Longevity 50 is neutral; 0 raises mortality by 20%, 100 lowers it by 20%. */
export const longevityFactor = (longevity: number): number => 1 - (longevity - 50) / 250;

export function monthlyDeathChance(age: number, health: number, longevity = 50): number {
  if (age >= MAX_AGE) return 1;
  return Math.min(0.5, (annualMortality(age) * healthMultiplier(health) * longevityFactor(longevity)) / 12);
}

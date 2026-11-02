import type { CountryState, ContentBundle, Economy, GameState, WorldEvent } from '@project-life/schemas';
import { initialEconomy, nextEconomy } from './economy.js';
import type { Rng } from './rng.js';
import { addStat, emit, type Run } from './run.js';

const clampInt = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, Math.round(n)));

/* ------------------------------ creation --------------------------- */
export function createWorldCountries(content: ContentBundle, rng: Rng, startYear: number): Record<string, CountryState> {
  return extendWorldCountries({}, content, rng, startYear);
}

/** Adds a state for every catalogue country that the world does not have yet (used on creation and on migration). */
export function extendWorldCountries(existing: Record<string, CountryState>, content: ContentBundle, rng: Rng, startYear: number): Record<string, CountryState> {
  const out: Record<string, CountryState> = { ...existing };
  for (const c of [...content.countries].sort((a, b) => (a.code < b.code ? -1 : 1))) {
    if (out[c.code]) continue;
    const party = rng.pick(content.parties);
    const base = initialEconomy();
    out[c.code] = {
      code: c.code,
      population: c.population,
      tracked: 0,
      priceIndex: 10_000,
      economy: { ...base, inflationBp: clampInt(base.inflationBp + rng.int(-80, 80), 0, 900), growthBp: clampInt(base.growthBp + rng.int(-100, 100), -800, 600) },
      environment: { emissions: c.emissionsIndex * 10, stress: clampInt(c.emissionsIndex / 5 + rng.int(0, 10), 0, 100) },
      politics: {
        governingParty: party.id,
        approvalBp: 5000,
        lastElection: startYear - rng.int(0, 3),
        termYears: rng.int(4, 5),
        taxAdjustBp: party.taxAdjustBp,
        welfareBp: party.welfareBp,
        debtBp: 6000 + rng.int(-2000, 4000),
      },
    };
  }
  return out;
}

export const localCountry = (s: GameState): CountryState => s.world.countries[s.location.countryCode] as CountryState;

/** The protagonist-facing mirrors (price level, economy) always follow the current country. */
export function syncLocal(s: GameState): void {
  const c = localCountry(s);
  s.world.economy = c.economy;
  s.world.priceIndex = c.priceIndex;
}

/* ------------------------------ population bookkeeping ------------------ */
/** A person becomes individually simulated (promotion from the aggregate). A newborn also adds to the total. */
export function trackPerson(s: GameState, code: string, newborn: boolean): void {
  const c = s.world.countries[code];
  if (!c) return;
  c.tracked += 1;
  if (newborn) c.population += 1;
}
/** A tracked person dies: they leave both the individual and the total population. */
export function trackDeath(s: GameState, code: string): void {
  const c = s.world.countries[code];
  if (!c) return;
  c.tracked = Math.max(0, c.tracked - 1);
  c.population = Math.max(c.tracked + 1, c.population - 1);
}
/** A tracked person fades back into the aggregate (demotion): the total does not change. */
export function untrackPerson(s: GameState, code: string): void {
  const c = s.world.countries[code];
  if (c) c.tracked = Math.max(0, c.tracked - 1);
}

/** Living individually-simulated people per country, computed from scratch (for invariants and migrations). */
export function trackedCounts(s: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const n of Object.values(s.npcs)) if (n.deathYear === null) out[n.countryCode] = (out[n.countryCode] ?? 0) + 1;
  if (!s.protagonist.death) out[s.location.countryCode] = (out[s.location.countryCode] ?? 0) + 1;
  return out;
}

/* ------------------------------ yearly world turn ------------------ */
const push = (s: GameState, e: WorldEvent): void => {
  const c = e.countryCode ? s.world.countries[e.countryCode] : undefined;
  // With hundreds of countries only your own and the biggest ones make the world chronicle.
  if (c && e.countryCode !== s.location.countryCode && c.population < 20_000_000) return;
  s.world.history.push(e);
  if (s.world.history.length > 80) s.world.history.splice(0, s.world.history.length - 80);
};

/**
 * January: every country draws its year. Economies follow a shared global cycle plus local noise;
 * politics (approval, elections, fiscal stress), environment (emissions, disasters) and demography
 * (births, deaths, migration flows that sum to zero) update; the protagonist's country is mirrored into `world.economy`.
 */
export function worldYear(run: Run): { births: Record<string, number>; deaths: Record<string, number>; flow: Record<string, number> } {
  const s = run.s;
  const year = s.world.currentDate.year;
  const rng = run.rng;
  const { content } = run.ctx;
  const codes = Object.keys(s.world.countries).sort();
  const globalGrowth = rng.int(-250, 250);
  const globalStock = rng.int(-1500, 1500);
  const attraction: Record<string, number> = {};
  const births: Record<string, number> = {};
  const deaths: Record<string, number> = {};

  for (const code of codes) {
    const c = s.world.countries[code] as CountryState;
    const def = content.countries.find((x) => x.code === code);
    if (!def) continue;
    const local = nextEconomy(c.economy, rng);
    const economy: Economy = {
      ...local,
      growthBp: clampInt(local.growthBp + globalGrowth * 0.8, -800, 600),
      stockReturnBp: clampInt(local.stockReturnBp * 0.5 + (500 + globalGrowth * 2 + globalStock) * 0.5, -4000, 4000),
    };
    // Environment: emissions follow output; stress follows emissions intensity and green policy.
    const party = content.parties.find((p) => p.id === c.politics.governingParty);
    c.environment.emissions = Math.max(0, Math.round(c.environment.emissions * (1 + economy.growthBp * 0.3 / 10_000)));
    c.environment.stress = clampInt(c.environment.stress + (def.emissionsIndex - 80) / 30 + economy.growthBp / 300 - (party?.greenBp ?? 0) / 600 - 1.5, 0, 100);
    if (rng.float() < 0.02 + (c.environment.stress / 100) * 0.08) {
      economy.growthBp = clampInt(economy.growthBp - 300, -800, 600);
      push(s, { year, countryCode: code, kind: 'DISASTER', detail: 'climate' });
      if (code === s.location.countryCode) {
        emit(run, 'WORLD', { kind: 'DISASTER', countryCode: code, detail: 'climate' });
        addStat(run, 'stress', 4);
        addStat(run, 'health', -2);
      }
      c.environment.stress = clampInt(c.environment.stress - 2, 0, 100);
    }
    c.economy = economy;
    c.priceIndex = Math.round((c.priceIndex * (10_000 + economy.inflationBp)) / 10_000);

    // Politics: approval follows the economy; debt follows the budget; elections reset the government.
    const pol = c.politics;
    pol.approvalBp = clampInt(pol.approvalBp + (economy.growthBp - 150) * 0.5 - (economy.inflationBp - 250) * 0.3 + rng.int(-500, 500) - (pol.debtBp > 10_000 ? 200 : 0), 0, 10_000);
    const balance = economy.growthBp * 0.5 - pol.welfareBp * 0.05 + pol.taxAdjustBp * 0.1;
    pol.debtBp = clampInt(pol.debtBp - balance * 0.5, 0, 40_000);
    if (pol.debtBp > 15_000) {
      pol.taxAdjustBp = clampInt(pol.taxAdjustBp + 300, -3000, 3000);
      pol.welfareBp = clampInt(pol.welfareBp - 500, 0, 8000);
      pol.approvalBp = clampInt(pol.approvalBp - 1000, 0, 10_000);
      pol.debtBp = 12_000;
      push(s, { year, countryCode: code, kind: 'FISCAL_CRISIS', detail: 'austerity' });
      if (code === s.location.countryCode) emit(run, 'WORLD', { kind: 'FISCAL_CRISIS', countryCode: code, detail: 'austerity' });
    }
    if (year - pol.lastElection >= pol.termYears) {
      pol.lastElection = year;
      const incumbentWins = pol.approvalBp >= 5000 + rng.int(-1500, 1500);
      if (!incumbentWins) {
        const others = content.parties.filter((p) => p.id !== pol.governingParty);
        const next = rng.pick(others);
        pol.governingParty = next.id;
        pol.taxAdjustBp = next.taxAdjustBp;
        pol.welfareBp = next.welfareBp;
        pol.approvalBp = 5500;
      }
      push(s, { year, countryCode: code, kind: 'ELECTION', detail: pol.governingParty });
      if (code === s.location.countryCode) emit(run, 'WORLD', { kind: 'ELECTION', countryCode: code, detail: pol.governingParty });
    }
    if (economy.growthBp <= -300) {
      push(s, { year, countryCode: code, kind: 'RECESSION', detail: String(economy.growthBp) });
      if (code === s.location.countryCode) emit(run, 'WORLD', { kind: 'RECESSION', countryCode: code, detail: String(economy.growthBp) });
    } else if (economy.growthBp >= 450) {
      push(s, { year, countryCode: code, kind: 'BOOM', detail: String(economy.growthBp) });
      if (code === s.location.countryCode) emit(run, 'WORLD', { kind: 'BOOM', countryCode: code, detail: String(economy.growthBp) });
    }

    // Demography acts on the aggregate (non-tracked) population only; tracked people live their own lives.
    const aggregate = Math.max(0, c.population - c.tracked);
    const fertility = def.birthRateBp * (1 + (economy.growthBp - 150) / 10_000 * 2);
    births[code] = Math.round((aggregate * fertility) / 10_000);
    deaths[code] = Math.round((aggregate * def.deathRateBp) / 10_000);
    attraction[code] = economy.growthBp - economy.inflationBp * 0.5 - c.environment.stress * 3 + (def.migrationOpenness - 40) * 2;
  }

  // Migration flows between countries: proportional to attractiveness differences, then forced to sum to zero.
  // The mean is weighted by population, so that the flows cancel out almost exactly (people move, they do not appear).
  let weightSum = 0;
  let weighted = 0;
  for (const code of codes) {
    const c = s.world.countries[code] as CountryState;
    const w = Math.max(0, c.population - c.tracked);
    weightSum += w;
    weighted += w * (attraction[code] ?? 0);
  }
  const meanAttraction = weightSum > 0 ? weighted / weightSum : 0;
  const flow: Record<string, number> = {};
  let total = 0;
  for (const code of codes) {
    const c = s.world.countries[code] as CountryState;
    const aggregate = Math.max(0, c.population - c.tracked);
    // No country gains or loses more than 1% of its aggregate population to migration in a year.
    const f = Math.max(-aggregate / 100, Math.min(aggregate / 100, Math.round((aggregate * ((attraction[code] ?? 0) - meanAttraction)) / 2_000_000)));
    flow[code] = f;
    total += f;
  }
  // Whatever rounding and clamping left over goes to the biggest country, where it is a negligible share.
  const biggestCountry = [...codes].sort((a, b) => (s.world.countries[b] as CountryState).population - (s.world.countries[a] as CountryState).population)[0];
  if (biggestCountry) flow[biggestCountry] = (flow[biggestCountry] ?? 0) - total;
  for (const code of codes) {
    const c = s.world.countries[code] as CountryState;
    c.population = Math.max(c.tracked + 1, c.population + (births[code] ?? 0) - (deaths[code] ?? 0) + (flow[code] ?? 0));
  }
  const biggest = [...codes].sort((a, b) => Math.abs(flow[b] ?? 0) - Math.abs(flow[a] ?? 0))[0];
  if (biggest && Math.abs(flow[biggest] ?? 0) > 20_000) push(s, { year, countryCode: biggest, kind: 'MIGRATION_WAVE', detail: String(flow[biggest]) });

  syncLocal(s);
  return { births, deaths, flow };
}

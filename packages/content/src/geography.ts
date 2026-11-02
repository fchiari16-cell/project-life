import type { CountryDef, LocationDef, PartyDef } from '@project-life/schemas';
import countriesJson from '../data/countries.json';

/**
 * Geography catalogue.
 *
 * DOCUMENTED (GeoNames, CC BY 4.0 — see data/SOURCES.md): ISO codes, names, capitals, areas, populations,
 * continents, currency codes, languages, neighbours, and the places in locations.json.
 *
 * MODEL (estimated, NOT official): income tier, wage factor, indicative exchange rate, birth/death rates,
 * institution scores, emissions index, qualification-recognition blocs. They exist to balance the simulation.
 */
interface RawCountry {
  code: string;
  iso3: string;
  name: string;
  capital: string;
  area: number;
  population: number;
  continent: string;
  currency: string;
  languages: string[];
  neighbours: string[];
  geonameId: number;
  cities: string[];
}
const raw = countriesJson as RawCountry[];

/* ------------------------------ income tiers (model) --------------- */
const codes = (s: string): string[] => s.split(' ');
const HIGH = codes('AD AE AT AU AW BB BE BH BM BN BS CA CH CL CW CY CZ DE DK EE ES FI FO FR GB GI GL GR GU HK HR HU IE IL IM IS IT JE JP KR KW KY LI LT LU LV MC MO MT NC NL NO NZ OM PA PF PL PR PT QA SA SE SG SI SK SM SX TT TW US UY VG VI BL MF');
const UPPER = codes('AG AL AM AR AS AZ BA BG BR BW BY BZ CN CO CR CU DM DO DZ EC FJ GA GD GE GQ GT ID IQ IR JM JO KZ LB LC LY MD ME MH MK MU MV MX MY NA NR PE PW PY RO RS RU SC SR TH TM TO TR TV VC VE XK ZA');
const LOW = codes('AF BF BI CF CD ER ET GM GN GW KP LR MG ML MW MZ NE RW SD SL SO SS SY TD TG UG YE');
const tierOf = (code: string): CountryDef['tier'] => (HIGH.includes(code) ? 'high' : UPPER.includes(code) ? 'upper' : LOW.includes(code) ? 'low' : 'lower');

const TIER = {
  high: { wage: 1, fxDefault: 1, birth: 90, death: 100, court: 65, corruption: 25, emissions: 90 },
  upper: { wage: 0.5, fxDefault: 8, birth: 150, death: 70, court: 50, corruption: 50, emissions: 100 },
  lower: { wage: 0.3, fxDefault: 60, birth: 220, death: 70, court: 45, corruption: 60, emissions: 60 },
  low: { wage: 0.15, fxDefault: 400, birth: 350, death: 80, court: 40, corruption: 70, emissions: 30 },
} as const;

/* ------------------------------ exchange rates (model, orders of magnitude) -- */
const FX: Record<string, number> = {
  EUR: 1, USD: 1.1, GBP: 0.85, JPY: 160, CNY: 7.8, INR: 90, BRL: 5.5, RUB: 95, CAD: 1.5, AUD: 1.65, NZD: 1.8, CHF: 0.95,
  SEK: 11.5, NOK: 11.8, DKK: 7.46, PLN: 4.3, CZK: 25, HUF: 390, RON: 4.97, BGN: 1.96, TRY: 35, ZAR: 20, MXN: 19, ARS: 1000,
  CLP: 1000, COP: 4400, PEN: 4.1, KRW: 1450, IDR: 17000, THB: 38, VND: 27000, PHP: 62, MYR: 4.8, SGD: 1.45, HKD: 8.6, TWD: 35,
  PKR: 300, BDT: 130, LKR: 330, NPR: 145, EGP: 55, NGN: 1600, KES: 140, GHS: 17, MAD: 11, DZD: 150, TND: 3.4, SAR: 4.1,
  AED: 4, QAR: 4, KWD: 0.34, ILS: 4, IQD: 1450, UAH: 44, KZT: 540, UZS: 14000, GEL: 3, AMD: 430, AZN: 1.85, ETB: 130,
  TZS: 2900, UGX: 4100, XOF: 656, XAF: 656, ISK: 150, HRK: 1, UYU: 44, BOB: 7.6, PYG: 8200, DOP: 66, CRC: 560, GTQ: 8.5,
  JOD: 0.78, OMR: 0.42, BHD: 0.41, MMK: 2300, KHR: 4500, LAK: 24000, MNT: 3700, MZN: 70, ZMW: 28, AOA: 950,
};

/* ------------------------------ explicit overrides (curated model values) ---- */
interface Override {
  wage?: number;
  fx?: number;
  birth?: number;
  death?: number;
  court?: number;
  corruption?: number;
  openness?: number;
  emissions?: number;
}
const OVERRIDES: Record<string, Override> = {
  IT: { wage: 0.8, birth: 72, death: 110, court: 55, corruption: 45, openness: 45, emissions: 80 },
  ES: { wage: 0.75, birth: 70, death: 95, court: 55, corruption: 40, openness: 50, emissions: 75 },
  FR: { wage: 1, birth: 100, death: 100, court: 60, corruption: 30, openness: 50, emissions: 70 },
  DE: { wage: 1.15, birth: 85, death: 120, court: 70, corruption: 20, openness: 60, emissions: 90 },
  GB: { wage: 1.1, birth: 105, death: 100, court: 65, corruption: 25, openness: 45, emissions: 75 },
  US: { wage: 1.4, birth: 120, death: 95, court: 75, corruption: 35, openness: 40, emissions: 150 },
  BR: { wage: 0.45, birth: 130, death: 65, court: 45, corruption: 60, openness: 40, emissions: 90 },
  IN: { wage: 0.35, birth: 165, death: 75, court: 50, corruption: 55, openness: 25, emissions: 110 },
  JP: { wage: 0.9, birth: 65, death: 125, court: 70, corruption: 20, openness: 20, emissions: 100 },
  NG: { wage: 0.3, birth: 360, death: 120, court: 40, corruption: 70, openness: 35, emissions: 60 },
  CN: { wage: 0.55, birth: 70, death: 80, court: 60, corruption: 45, openness: 15, emissions: 180 },
  RU: { wage: 0.5, birth: 90, death: 130, court: 50, corruption: 60, openness: 25, emissions: 140 },
  CH: { wage: 1.4, openness: 45 }, NO: { wage: 1.3 }, LU: { wage: 1.4 }, SG: { wage: 1.2 }, AU: { wage: 1.15, emissions: 140 },
  CA: { wage: 1.1, emissions: 130 }, KR: { wage: 0.9 }, SE: { wage: 1.1 }, DK: { wage: 1.2 }, NL: { wage: 1.15 }, BE: { wage: 1.1 },
  AT: { wage: 1.1 }, FI: { wage: 1.05 }, IE: { wage: 1.2 }, NZ: { wage: 0.95 }, SA: { wage: 0.9, emissions: 160 }, AE: { wage: 1.0, emissions: 150 },
};

/** Countries that, in the model, do not allow dual citizenship (a coarse general-knowledge list, not legal advice). */
const NO_DUAL = new Set(codes('CN IN JP SG AE SA KW QA BH OM ID MY KZ UA NP MC AT'));

/** Stable per-country jitter in [-1, 1], so model values differ between similar countries without randomness. */
function jitter(code: string, salt: number): number {
  let h = salt;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return (h % 201) / 100 - 1;
}

const EU = new Set(codes('AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE'));
const ANGLO = new Set(codes('GB US CA AU NZ'));
const blocOf = (code: string, continent: string): string => (EU.has(code) ? 'eu' : ANGLO.has(code) ? 'anglo' : continent.toLowerCase());

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, Math.round(n)));

function build(c: RawCountry): CountryDef {
  const tier = tierOf(c.code);
  const base = TIER[tier];
  const o = OVERRIDES[c.code] ?? {};
  const cities = c.cities.length > 0 ? c.cities : [c.capital || c.name];
  return {
    code: c.code,
    iso3: c.iso3,
    name: c.name,
    capital: c.capital,
    continent: c.continent,
    languages: c.languages,
    neighbours: c.neighbours,
    geonameId: c.geonameId,
    tier,
    currency: c.currency && c.currency.length === 3 ? c.currency : 'USD',
    fxPerEur: o.fx ?? FX[c.currency] ?? base.fxDefault,
    minorUnits: (o.fx ?? FX[c.currency] ?? base.fxDefault) > 200 ? 1 : 100,
    wageFactor: o.wage ?? Math.round(base.wage * (1 + jitter(c.code, 1) * 0.15) * 100) / 100,
    cities,
    bloc: blocOf(c.code, c.continent),
    population: Math.max(1000, c.population),
    birthRateBp: o.birth ?? clamp(base.birth * (1 + jitter(c.code, 2) * 0.12), 20, 600),
    deathRateBp: o.death ?? clamp(base.death * (1 + jitter(c.code, 3) * 0.12), 20, 300),
    courtStrictness: o.court ?? clamp(base.court + jitter(c.code, 4) * 8, 10, 95),
    corruption: o.corruption ?? clamp(base.corruption + jitter(c.code, 5) * 10, 5, 95),
    migrationOpenness: o.openness ?? clamp(40 + (tier === 'high' ? 5 : 0) + jitter(c.code, 6) * 15, 5, 90),
    dualCitizenship: !NO_DUAL.has(c.code),
    emissionsIndex: o.emissions ?? clamp(base.emissions * (1 + jitter(c.code, 7) * 0.3), 10, 300),
  };
}

export const countries: CountryDef[] = raw.map(build).sort((a, b) => (a.code < b.code ? -1 : 1));

/**
 * The 6,000+ real places live in a separate file and are loaded on demand (`loadLocations`):
 * the engine only needs the per-country city names above.
 */
export async function loadLocations(): Promise<LocationDef[]> {
  const mod = (await import('../data/locations.json')) as unknown as { default: { tz: string[]; rows: [number, string, string, number, number, number, number][] } };
  const { tz, rows } = mod.default;
  return rows.map(([id, name, countryCode, lat, lon, population, t]) => ({ id, name, countryCode, lat, lon, population, timezone: tz[t] as string }));
}

/** Fictional parties; their policy leans are balancing model values. */
export const parties: PartyDef[] = [
  { id: 'civic_alliance', name: 'Alleanza Civica', taxAdjustBp: 0, welfareBp: 3000, greenBp: 200 },
  { id: 'labour_union', name: 'Partito del Lavoro Unito', taxAdjustBp: 800, welfareBp: 5000, greenBp: 300 },
  { id: 'free_initiative', name: 'Libera Iniziativa', taxAdjustBp: -800, welfareBp: 1500, greenBp: 50 },
  { id: 'green_front', name: 'Fronte Verde', taxAdjustBp: 300, welfareBp: 3500, greenBp: 900 },
];

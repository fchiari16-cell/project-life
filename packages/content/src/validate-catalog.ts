import { LocationDefSchema, type ContentBundle, type LocationDef } from '@project-life/schemas';
import { CORE_KEYS, LOCALES, translations } from './i18n.js';

const dup = (ids: (string | number)[]): (string | number)[] => {
  const seen = new Set<string | number>();
  const out = new Set<string | number>();
  for (const id of ids) (seen.has(id) ? out : seen).add(id);
  return [...out];
};

const TIER_ORDER = ['N', 'S', 'V', 'B', 'M', 'D'] as const;
// Requirements are "any of": the entry tier is the lowest one that is accepted.
const tierOf = (req: readonly string[]): (typeof TIER_ORDER)[number] =>
  req.length === 0 ? 'N' : req.includes('secondary') ? 'S' : req.includes('vocational') ? 'V' : req.includes('bachelor') ? 'B' : req.includes('master') ? 'M' : 'D';
const EARLIEST_AGE = { N: 18, S: 18, V: 18, B: 21, M: 23, D: 26 } as const;

/**
 * Whole-catalogue checks (M5): geography, locations, professions, narrative reachability, economic
 * coherence. Empty result = the catalogue is publishable.
 */
export function validateCatalog(b: ContentBundle, locations: readonly LocationDef[]): string[] {
  const issues: string[] = [];
  const countryCodes = new Set(b.countries.map((c) => c.code));

  /* geography */
  if (b.countries.length < 200) issues.push(`only ${b.countries.length} countries/territories (global coverage needs 200+)`);
  for (const d of dup(b.countries.map((c) => c.code))) issues.push(`duplicate country code ${d}`);
  for (const d of dup(b.countries.map((c) => c.iso3))) issues.push(`duplicate ISO3 ${d}`);
  for (const c of b.countries) {
    if (!/^[A-Z]{2}$/.test(c.code)) issues.push(`country ${c.code}: bad ISO 3166 alpha-2`);
    if (!/^[A-Z]{3}$/.test(c.iso3)) issues.push(`country ${c.code}: bad ISO3 ${c.iso3}`);
    if (!/^[A-Z]{3}$/.test(c.currency)) issues.push(`country ${c.code}: bad currency ${c.currency}`);
    if (c.population <= 0) issues.push(`country ${c.code}: non-positive population`);
    if (c.fxPerEur <= 0 || c.wageFactor <= 0) issues.push(`country ${c.code}: non-positive economic factor`);
    if (c.cities.length === 0) issues.push(`country ${c.code}: no city to be born in`);
  }

  /* locations */
  if (locations.length < 5000) issues.push(`only ${locations.length} locations (5,000 required)`);
  for (const d of dup(locations.map((l) => l.id))) issues.push(`duplicate location id ${d}`);
  const byCountry = new Map<string, Set<string>>();
  const zones = new Set<string>();
  for (const l of locations) {
    const parsed = LocationDefSchema.safeParse(l);
    if (!parsed.success) issues.push(`location ${l.id}: ${parsed.error.issues.map((i) => i.message).join('; ')}`);
    if (!countryCodes.has(l.countryCode)) issues.push(`location ${l.id} (${l.name}): unknown country ${l.countryCode}`);
    if (!zones.has(l.timezone)) {
      zones.add(l.timezone);
      try {
        new Intl.DateTimeFormat('en', { timeZone: l.timezone });
      } catch {
        issues.push(`location ${l.id}: invalid time zone ${l.timezone}`);
      }
    }
    const set = byCountry.get(l.countryCode) ?? new Set<string>();
    set.add(l.name);
    byCountry.set(l.countryCode, set);
  }
  if (zones.size < 100) issues.push(`only ${zones.size} time zones are represented`);
  for (const c of b.countries) {
    for (const city of c.cities) {
      if (!byCountry.get(c.code)?.has(city) && city !== c.capital && city !== c.name) issues.push(`country ${c.code}: city "${city}" is not in the location catalogue`);
    }
  }

  /* professions */
  if (b.professions.length < 300) issues.push(`only ${b.professions.length} professions (300 required)`);
  const sectors = new Map<string, number>();
  for (const p of b.professions) sectors.set(p.sector, (sectors.get(p.sector) ?? 0) + 1);
  if (sectors.size < 15 || sectors.size > 20) issues.push(`${sectors.size} sectors (15–20 expected)`);
  for (const [s, n] of sectors) if (n < 5) issues.push(`sector ${s} has only ${n} professions`);
  const byArchetype = new Map<string, Map<string, number[]>>();
  for (const p of b.professions) {
    const t = tierOf(p.requires);
    if (p.minAge < EARLIEST_AGE[t]) issues.push(`profession ${p.id}: minimum age ${p.minAge} is lower than the earliest age to hold its qualification (${EARLIEST_AGE[t]})`);
    if (p.salaryRef < 1_000_000 || p.salaryRef > 15_000_000) issues.push(`profession ${p.id}: salary ${p.salaryRef} outside the plausible model range`);
    if (p.archetype !== 'sports' && p.archetype !== 'performing') {
      const tiers = byArchetype.get(p.archetype) ?? new Map<string, number[]>();
      tiers.set(t, [...(tiers.get(t) ?? []), p.salaryRef]);
      byArchetype.set(p.archetype, tiers);
    }
  }
  // Within a career family, more demanding qualifications must pay at least as much on average.
  for (const [arch, tiers] of byArchetype) {
    let prevMean = 0;
    let prevTier = '';
    for (const t of TIER_ORDER) {
      if (t === 'V') continue; // vocational and secondary are parallel entry routes, not rungs of one ladder
      const list = tiers.get(t) ?? [];
      if (list.length === 0) continue;
      const mean = list.reduce((a, c) => a + c, 0) / list.length;
      if (mean < prevMean) issues.push(`salaries are not coherent in ${arch}: mean for ${t} (${Math.round(mean)}) is below ${prevTier} (${Math.round(prevMean)})`);
      prevMean = mean;
      prevTier = t;
    }
  }
  for (const a of b.archetypes) {
    if (a.maxAge !== undefined && a.maxAge >= 67) issues.push(`archetype ${a.id}: maxAge must be below the retirement age`);
  }

  /* narrative reachability and circular dependencies */
  const produced = new Set<string>();
  for (const e of b.events) for (const c of e.choices) for (const o of c.outcomes) for (const fx of o.effects) if (fx.type === 'story') produced.add(`${fx.id}#${fx.stage}`);
  const archetypeIds = new Set(b.archetypes.map((a) => a.id));
  const edges = new Map<string, Set<string>>();
  for (const e of b.events) {
    const r = e.requires;
    if (r.story && !produced.has(`${r.story.id}#${r.story.stage}`)) issues.push(`event ${e.id}: needs story ${r.story.id} stage ${r.story.stage} that nothing produces (unreachable)`);
    if (r.archetype && !archetypeIds.has(r.archetype)) issues.push(`event ${e.id}: unknown archetype ${r.archetype}`);
    if (r.hasQualification && r.lacksQualification === r.hasQualification) issues.push(`event ${e.id}: requires and forbids the same qualification (impossible)`);
    if (r.employed === false && (r.archetype || r.minLevel || r.minYearsInRole)) issues.push(`event ${e.id}: needs a job and no job at once (impossible)`);
    if (r.studying === true && r.stages && !r.stages.some((x) => ['primary', 'secondary', 'university', 'vocational', 'postgraduate'].includes(x))) issues.push(`event ${e.id}: studying but no studying stage allowed`);
    if (r.story) {
      const from = `${r.story.id}#${r.story.stage}`;
      for (const c of e.choices) for (const o of c.outcomes) for (const fx of o.effects) if (fx.type === 'story') (edges.get(from) ?? edges.set(from, new Set()).get(from)!).add(`${fx.id}#${fx.stage}`);
    }
  }
  const state = new Map<string, 0 | 1 | 2>();
  const visit = (n: string): boolean => {
    if (state.get(n) === 1) return true;
    if (state.get(n) === 2) return false;
    state.set(n, 1);
    for (const m of edges.get(n) ?? []) if (visit(m)) return true;
    state.set(n, 2);
    return false;
  };
  for (const n of edges.keys()) if (visit(n)) issues.push(`circular story dependency through ${n}`);

  /* economic coherence */
  for (const s of b.businessSectors) {
    if (s.revPerEmpRef <= s.wagePerEmpRef) issues.push(`business sector ${s.id}: revenue per employee does not cover wages`);
  }
  return issues;
}

/** Translation tool: every language must be declared, complete for the core interface and honestly labelled. */
export function validateI18n(): string[] {
  const issues: string[] = [];
  if (LOCALES.length !== 20) issues.push(`${LOCALES.length} languages declared (20 required)`);
  for (const d of dup(LOCALES.map((l) => l.code))) issues.push(`duplicate language ${d}`);
  for (const l of LOCALES) {
    const t = translations[l.code];
    if (!t) {
      issues.push(`language ${l.code}: no translations`);
      continue;
    }
    for (const k of CORE_KEYS) if (!t[k] || t[k].trim() === '') issues.push(`language ${l.code}: missing translation for ${k}`);
    if (l.code !== 'it' && l.status === 'source') issues.push(`language ${l.code}: only Italian is a source language`);
    if (l.code !== 'it' && l.status !== 'machine-unverified') issues.push(`language ${l.code}: unverified translations must be labelled machine-unverified`);
    try {
      Intl.getCanonicalLocales(l.tag);
    } catch {
      issues.push(`language ${l.code}: invalid locale tag ${l.tag}`);
    }
    if ((l.code === 'ar') !== (l.dir === 'rtl')) issues.push(`language ${l.code}: text direction does not match (only Arabic is right-to-left)`);
  }
  return issues;
}

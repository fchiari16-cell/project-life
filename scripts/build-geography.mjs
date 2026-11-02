// Builds the geography catalog from the GeoNames dumps in data/raw (see data/SOURCES.md for provenance and licence).
// Usage: node scripts/build-geography.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const RAW = new URL('../data/raw/', import.meta.url);
const OUT = new URL('../packages/content/data/', import.meta.url);
mkdirSync(OUT, { recursive: true });

/* ------------------------------ countries -------------------------- */
const countries = readFileSync(new URL('countryInfo.txt', RAW), 'utf8')
  .split('\n')
  .filter((l) => l && !l.startsWith('#'))
  .map((l) => l.split('\t'))
  .filter((c) => c.length >= 17 && /^[A-Z]{2}$/.test(c[0] ?? ''))
  .map((c) => ({
    code: c[0],
    iso3: c[1],
    name: c[4],
    capital: c[5] ?? '',
    area: Number(c[6]) || 0,
    population: Number(c[7]) || 0,
    continent: c[8],
    currency: c[10] ?? '',
    currencyName: c[11] ?? '',
    languages: (c[15] ?? '').split(',').filter(Boolean),
    neighbours: (c[17] ?? '').split(',').filter(Boolean),
    geonameId: Number(c[16]) || 0,
  }));

/* ------------------------------ cities ----------------------------- */
const rows = readFileSync(new URL('cities15000.txt', RAW), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => l.split('\t'))
  .map((c) => ({
    id: Number(c[0]),
    name: c[1],
    lat: Number(Number(c[4]).toFixed(3)),
    lon: Number(Number(c[5]).toFixed(3)),
    cc: c[8],
    pop: Number(c[14]),
    tz: c[17],
  }))
  .filter((r) => r.id && r.name && r.cc && r.pop > 0 && r.tz);
rows.sort((a, b) => b.pop - a.pop || a.id - b.id);

const known = new Set(countries.map((c) => c.code));
const chosen = new Map();
// The largest cities worldwide…
for (const r of rows.slice(0, 6000)) if (known.has(r.cc)) chosen.set(r.id, r);
// …plus the three largest of every country, so small countries are not left out.
const perCountry = new Map();
for (const r of rows) {
  if (!known.has(r.cc)) continue;
  const n = perCountry.get(r.cc) ?? 0;
  if (n < 3) chosen.set(r.id, r);
  perCountry.set(r.cc, n + 1);
}
const locations = [...chosen.values()].sort((a, b) => b.pop - a.pop || a.id - b.id);
const tzTable = [...new Set(locations.map((l) => l.tz))].sort();
const tzIndex = new Map(tzTable.map((t, i) => [t, i]));

writeFileSync(
  new URL('locations.json', OUT),
  JSON.stringify({ tz: tzTable, rows: locations.map((l) => [l.id, l.name, l.cc, l.lat, l.lon, l.pop, tzIndex.get(l.tz)]) }),
);

const citiesByCountry = new Map();
for (const l of locations) {
  const list = citiesByCountry.get(l.cc) ?? [];
  if (list.length < 25) list.push(l.name);
  citiesByCountry.set(l.cc, list);
}
writeFileSync(
  new URL('countries.json', OUT),
  JSON.stringify(
    countries.map((c) => ({ ...c, cities: citiesByCountry.get(c.code) ?? (c.capital ? [c.capital] : []) })),
  ),
);

const sha = (f) => createHash('sha256').update(readFileSync(new URL(f, RAW))).digest('hex');
writeFileSync(
  new URL('catalog-stats.json', OUT),
  JSON.stringify({
    source: 'GeoNames (https://www.geonames.org/), CC BY 4.0',
    countries: countries.length,
    locations: locations.length,
    timeZones: tzTable.length,
    rawFiles: { 'countryInfo.txt': sha('countryInfo.txt'), 'cities15000.txt': sha('cities15000.txt') },
  }),
);

const withCities = countries.filter((c) => citiesByCountry.has(c.code)).length;
console.log(`countries: ${countries.length} (with listed cities: ${withCities}); locations: ${locations.length}; time zones: ${tzTable.length}`);

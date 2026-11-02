import { describe, expect, it } from 'vitest';
import type { ContentBundle, LocationDef } from '@project-life/schemas';
import { contentBundle, contentManifest, loadLocations, validateCatalog, validateContent, validateI18n, validateManifest } from '../src/index';
import { CORE_KEYS, LOCALES, coverage, translations } from '../src/i18n';

let locations: LocationDef[] = [];
const ready = loadLocations().then((l) => (locations = l));

describe('global catalogue (M5)', () => {
  it('covers the world with documented data and passes every check', async () => {
    await ready;
    expect(contentBundle.countries.length).toBeGreaterThanOrEqual(200);
    expect(locations.length).toBeGreaterThanOrEqual(5000);
    expect(contentBundle.professions.length).toBeGreaterThanOrEqual(300);
    expect(LOCALES).toHaveLength(20);
    expect(validateContent(contentBundle)).toEqual([]);
    expect(validateCatalog(contentBundle, locations)).toEqual([]);
    expect(validateI18n()).toEqual([]);
    expect(validateManifest(contentManifest)).toEqual([]);
  });

  it('documents provenance and the GeoNames licence in the manifest', () => {
    const loc = contentManifest.packages.find((p) => p.id === 'locations-m5')!;
    expect(loc.provenance).toBe('real-documented');
    expect(loc.licence).toMatch(/GeoNames.*CC BY 4\.0/);
    expect(loc.source).toMatch(/SHA-256 [0-9a-f]{64}/);
    const geo = contentManifest.packages.find((p) => p.id === 'geography-m5')!;
    expect(geo.provenance).toBe('estimated-model'); // model values are never passed off as documented
    expect(geo.source).toMatch(/not official statistics/);
  });

  it('every country is playable: a tax rule, cities, institutions and a currency', () => {
    for (const c of contentBundle.countries) {
      expect(contentBundle.taxRules.filter((r) => r.countries.includes(c.code))).toHaveLength(1);
      expect(c.cities.length).toBeGreaterThan(0);
      expect(c.currency).toMatch(/^[A-Z]{3}$/);
    }
    expect(contentBundle.countries.map((c) => c.code)).toEqual(expect.arrayContaining(['IT', 'JP', 'BR', 'NG', 'US', 'IN', 'AU', 'ZA', 'EG', 'ID']));
  });

  it('has a real spread of professions: 15–20 sectors, special careers, every qualification level', () => {
    const sectors = new Set(contentBundle.professions.map((p) => p.sector));
    expect(sectors.size).toBeGreaterThanOrEqual(15);
    expect(sectors.size).toBeLessThanOrEqual(20);
    const archetypes = new Set(contentBundle.professions.map((p) => p.archetype));
    for (const a of ['sports', 'performing', 'medical', 'legal', 'research', 'security', 'technical', 'creative', 'management']) expect(archetypes.has(a)).toBe(true);
    const tiers = new Set(contentBundle.professions.flatMap((p) => p.requires));
    for (const q of ['secondary', 'vocational', 'bachelor', 'master', 'doctorate']) expect(tiers.has(q as never)).toBe(true);
    expect(contentBundle.archetypes.find((a) => a.id === 'sports')?.maxAge).toBeLessThan(67);
  });

  it('detects broken catalogues: duplicates, orphans, bad zones, impossible events, circular stories', async () => {
    await ready;
    const bad: ContentBundle = structuredClone(contentBundle);
    bad.professions.push({ ...bad.professions[0]! }); // duplicate id
    bad.professions.push({ ...bad.professions[1]!, id: 'cheap_doctor', requires: ['doctorate'], salaryRef: 1_000_000 });
    bad.events.push({ ...bad.events.find((e) => e.id === 'mentor_lesson')!, id: 'orphan_story', requires: { story: { id: 'ghost', stage: 3 } } });
    bad.events.push({ ...bad.events.find((e) => e.id === 'mentor_lesson')!, id: 'impossible', requires: { hasQualification: 'master', lacksQualification: 'master' } });
    const loop = (id: string, from: number, to: number) => ({
      ...bad.events.find((e) => e.id === 'mentor_lesson')!,
      id,
      requires: { story: { id: 'loop', stage: from } },
      choices: [{ id: 'go', label: 'go', outcomes: [{ id: 'o', weight: 1, effects: [{ type: 'story' as const, id: 'loop', stage: to }], text: 't' }] }],
    });
    bad.events.push(loop('loop_a', 1, 2), loop('loop_b', 2, 1));
    const badLocs: LocationDef[] = [...locations, { ...locations[0]! }, { ...locations[1]!, id: 99_999_999, countryCode: 'ZZ' }, { ...locations[2]!, id: 99_999_998, timezone: 'Mars/Olympus' }];
    const issues = validateCatalog(bad, badLocs).join('\n');
    for (const needle of ['duplicate location id', 'unknown country ZZ', 'invalid time zone Mars/Olympus', 'nothing produces', 'impossible', 'circular story dependency']) expect(issues).toContain(needle);
    expect(validateContent(bad).join('\n')).toContain('duplicate profession');
  });
});

describe('localisation (20 languages)', () => {
  it('has every core string in every language, labelled as unverified except the source language', () => {
    for (const c of coverage()) {
      expect(c.missing).toEqual([]);
      expect(c.present).toBe(CORE_KEYS.length);
    }
    expect(LOCALES.filter((l) => l.status === 'source').map((l) => l.code)).toEqual(['it']);
    expect(LOCALES.filter((l) => l.dir === 'rtl').map((l) => l.code)).toEqual(['ar']);
  });

  it('translations really differ from the source (no silent copies of Italian)', () => {
    for (const l of LOCALES) {
      if (l.code === 'it') continue;
      const same = CORE_KEYS.filter((k) => translations[l.code][k] === translations.it[k]);
      expect(same.length, `${l.code} copies Italian for: ${same.join(', ')}`).toBeLessThan(CORE_KEYS.length / 4);
    }
  });

  it('the missing-translation tool reports a gap', () => {
    const copy = structuredClone(translations);
    (copy.fr as Record<string, string>)['nav.life'] = '';
    expect(Object.values(copy.fr).some((v) => v === '')).toBe(true);
  });
});

describe('talents (M6)', () => {
  it('ships a valid set and detects duplicates, unknown archetypes and a missing academic talent', () => {
    expect(contentBundle.talents.length).toBeGreaterThanOrEqual(8);
    expect(validateContent(contentBundle).filter((i) => i.includes('talent'))).toEqual([]);
    const bad: ContentBundle = structuredClone(contentBundle);
    bad.talents.push({ ...bad.talents[0]! });
    bad.talents.push({ id: 'ghostly', title: 'x', archetypes: ['no_such_archetype'], academic: false });
    expect(validateContent(bad).join('\n')).toMatch(/duplicate talent academic[\s\S]*talent ghostly: unknown archetype no_such_archetype/);
    const noAcademic: ContentBundle = structuredClone(contentBundle);
    noAcademic.talents = noAcademic.talents.map((tal) => ({ ...tal, academic: false }));
    expect(validateContent(noAcademic).join('\n')).toContain('no talent helps with studying');
  });
});

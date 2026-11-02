import {
  CONTENT_VERSION,
  ContentBundleSchema,
  ContentManifestSchema,
  SCHEMA_VERSION,
  type ContentBundle,
  type ContentManifest,
} from '@project-life/schemas';
import stats from '../data/catalog-stats.json';
import { events } from './events.js';
import { countries, parties } from './geography.js';
import { familyNames, givenNames } from './names.js';
import { businessSectors, taxRules } from './economy.js';
import { archetypes, professions } from './professions.js';
import { talents } from './talents.js';

/** Parsing applies schema defaults and fails loudly at start-up if the authored data is malformed. */
export const contentBundle: ContentBundle = ContentBundleSchema.parse({
  contentVersion: CONTENT_VERSION,
  countries,
  parties,
  talents,
  archetypes,
  professions,
  businessSectors,
  taxRules,
  events,
  givenNames,
  familyNames,
});

export const contentManifest: ContentManifest = ContentManifestSchema.parse({
  id: 'project-life-content',
  contentVersion: CONTENT_VERSION,
  schemaVersion: SCHEMA_VERSION,
  packages: [
    {
      id: 'geography-m5',
      kind: 'geography',
      version: '2',
      provenance: 'estimated-model',
      licence: 'Geographical data © GeoNames (CC BY 4.0); model values are the project\'s own',
      source:
        'Country names, ISO 3166/4217 codes and city names are real; exchange rates, wage factors, rounded population magnitudes, birth/death rates and institution scores are coarse balancing model values, not official statistics or a census.',
      entryCount: countries.length,
    },
    {
      id: 'professions-m5',
      kind: 'professions',
      version: '1',
      provenance: 'estimated-model',
      source: 'Job titles are generic; salaries and stress are balancing model values for M1, not statistics.',
      entryCount: professions.length,
    },
    {
      id: 'locations-m5',
      kind: 'geography',
      version: '1',
      provenance: 'real-documented',
      source: `${stats.source}; cities15000 dump (places above 15,000 inhabitants): the largest 6,000 worldwide plus the three largest of every country. SHA-256 ${stats.rawFiles['cities15000.txt']}`,
      licence: 'Geographical data © GeoNames (CC BY 4.0)',
      entryCount: stats.locations,
    },
    { id: 'archetypes-m3', kind: 'professions', version: '1', provenance: 'estimated-model', source: 'Career ladders, promotion odds and raises are balancing model values, not labour statistics.', entryCount: archetypes.length },
    { id: 'business-sectors-m3', kind: 'economy', version: '1', provenance: 'estimated-model', source: 'Revenue, wage and overhead per employee are balancing model values giving plausible margins; not sector statistics.', entryCount: businessSectors.length },
    { id: 'tax-rules-m3', kind: 'laws', version: '1', provenance: 'estimated-model', source: 'Coarse bracket/rate model per tax-system family, versioned by effective year; NOT the law of any country.', entryCount: taxRules.length },
    { id: 'parties-m4', kind: 'institutions', version: '1', provenance: 'fictional', source: null, entryCount: parties.length },
    { id: 'talents-m6', kind: 'professions', version: '1', provenance: 'fictional', source: null, entryCount: talents.length },
    { id: 'events-m5', kind: 'events', version: '1', provenance: 'fictional', source: null, entryCount: events.length },
    { id: 'names-m1', kind: 'names', version: '1', provenance: 'fictional', source: null, entryCount: givenNames.length },
  ],
});

export { validateContent, validateManifest } from './validate.js';
export { validateCatalog, validateI18n } from './validate-catalog.js';
export { loadLocations } from './geography.js';
export { CORE_KEYS, LOCALES, coverage, translations, type LocaleCode, type LocaleInfo } from './i18n.js';

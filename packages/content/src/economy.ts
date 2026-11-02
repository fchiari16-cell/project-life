import type { BusinessSector, TaxRuleSet } from '@project-life/schemas';
import { countries } from './geography.js';

const ANGLO = ['GB', 'US', 'CA', 'AU', 'NZ'];
/** Every territory belongs to exactly one tax-system family (by tier and bloc). */
const familyOf = (c: (typeof countries)[number]): 'anglo' | 'continental' | 'emerging' =>
  ANGLO.includes(c.code) ? 'anglo' : c.tier === 'high' || c.bloc === 'eu' ? 'continental' : 'emerging';
const members = (f: 'anglo' | 'continental' | 'emerging'): string[] => countries.filter((c) => familyOf(c) === f).map((c) => c.code);

/**
 * Business sectors (annual EUR cents per employee, reference economy). MODEL values for balancing:
 * they give plausible margins (roughly 5–15% in a normal year), not sector statistics.
 */
export const businessSectors: BusinessSector[] = [
  { id: 'workshop', title: 'Officina', revPerEmpRef: 6_500_000, wagePerEmpRef: 3_000_000, overheadRef: 2_400_000, startupRef: 3_000_000, volatilityBp: 800 },
  { id: 'restaurant', title: 'Trattoria', revPerEmpRef: 5_200_000, wagePerEmpRef: 2_300_000, overheadRef: 3_600_000, startupRef: 4_500_000, volatilityBp: 1500 },
  { id: 'consulting', title: 'Studio di consulenza', revPerEmpRef: 9_000_000, wagePerEmpRef: 4_200_000, overheadRef: 1_800_000, startupRef: 2_000_000, volatilityBp: 1800 },
  { id: 'software', title: 'Software house', revPerEmpRef: 10_500_000, wagePerEmpRef: 4_800_000, overheadRef: 2_000_000, startupRef: 2_500_000, volatilityBp: 2200 },
  { id: 'retail', title: 'Negozio', revPerEmpRef: 5_800_000, wagePerEmpRef: 2_100_000, overheadRef: 3_000_000, startupRef: 3_500_000, volatilityBp: 1200 },
  { id: 'construction_firm', title: 'Impresa edile', revPerEmpRef: 7_200_000, wagePerEmpRef: 3_200_000, overheadRef: 2_800_000, startupRef: 5_000_000, volatilityBp: 2000 },
];

/**
 * Versioned tax rule sets by territory and effective year. Rates and thresholds are coarse MODEL values
 * grouped by tax-system family; they are NOT the law of any country. The second period of each set shows
 * how rules change over time (effective-year versioning).
 */
export const taxRules: TaxRuleSet[] = [
  {
    id: 'model_continental',
    countries: members('continental'),
    version: '1',
    periods: [
      { fromYear: 1900, brackets: [{ upToRef: 1_500_000, rateBp: 2200 }, { upToRef: 3_500_000, rateBp: 3300 }, { upToRef: 7_000_000, rateBp: 4100 }, { upToRef: null, rateBp: 4500 }], capitalGainsBp: 2600, dividendBp: 2600, corporateBp: 2400, propertyTaxBp: 80 },
      { fromYear: 2035, brackets: [{ upToRef: 1_800_000, rateBp: 2000 }, { upToRef: 3_800_000, rateBp: 3200 }, { upToRef: 7_500_000, rateBp: 4000 }, { upToRef: null, rateBp: 4600 }], capitalGainsBp: 2800, dividendBp: 2800, corporateBp: 2300, propertyTaxBp: 90 },
    ],
  },
  {
    id: 'model_anglo',
    countries: members('anglo'),
    version: '1',
    periods: [
      { fromYear: 1900, brackets: [{ upToRef: 1_200_000, rateBp: 1000 }, { upToRef: 4_500_000, rateBp: 2200 }, { upToRef: 9_000_000, rateBp: 3200 }, { upToRef: null, rateBp: 3700 }], capitalGainsBp: 1800, dividendBp: 1800, corporateBp: 2100, propertyTaxBp: 60 },
      { fromYear: 2035, brackets: [{ upToRef: 1_400_000, rateBp: 1000 }, { upToRef: 4_800_000, rateBp: 2300 }, { upToRef: 9_500_000, rateBp: 3300 }, { upToRef: null, rateBp: 3800 }], capitalGainsBp: 2000, dividendBp: 2000, corporateBp: 2100, propertyTaxBp: 60 },
    ],
  },
  {
    id: 'model_emerging',
    countries: members('emerging'),
    version: '1',
    periods: [
      { fromYear: 1900, brackets: [{ upToRef: 1_000_000, rateBp: 0 }, { upToRef: 3_000_000, rateBp: 1500 }, { upToRef: null, rateBp: 2800 }], capitalGainsBp: 1500, dividendBp: 1000, corporateBp: 2800, propertyTaxBp: 40 },
      { fromYear: 2035, brackets: [{ upToRef: 1_200_000, rateBp: 0 }, { upToRef: 3_200_000, rateBp: 1500 }, { upToRef: null, rateBp: 2700 }], capitalGainsBp: 1500, dividendBp: 1000, corporateBp: 2600, propertyTaxBp: 50 },
    ],
  },
];

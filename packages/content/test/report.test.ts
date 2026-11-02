import { it } from 'vitest';
import { contentBundle, loadLocations, validateCatalog, validateContent, validateI18n } from '../src/index';

/**
 * Content validation report (`npm run validate:content`): prints every issue found in the catalogue and
 * fails when there is any. Run it after editing content or after rebuilding the geography data.
 */
it('content validation report', async () => {
  const locations = await loadLocations();
  const issues = [...validateContent(contentBundle), ...validateCatalog(contentBundle, locations), ...validateI18n()];
  console.info(
    `[content] ${contentBundle.countries.length} countries, ${locations.length} locations, ${contentBundle.professions.length} professions, ${new Set(contentBundle.professions.map((p) => p.sector)).size} sectors, ${contentBundle.events.length} events, ${issues.length} issue(s)`,
  );
  for (const i of issues) console.info(`[content][issue] ${i}`);
  if (issues.length > 0) throw new Error(`${issues.length} content issue(s)`);
});

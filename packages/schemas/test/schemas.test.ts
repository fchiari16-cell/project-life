import { describe, expect, it } from 'vitest';
import { ContentBundleSchema, ContentManifestSchema, EngineCommandSchema, StatsSchema } from '../src/index';
import { contentBundle, contentManifest, validateContent, validateManifest } from '../../content/src/index';

describe('schemas', () => {
  it('rejects out-of-range stats', () => {
    const ok = { health: 1, happiness: 1, intelligence: 1, appearance: 1, energy: 1, stress: 1, charisma: 1, fitness: 1 };
    expect(StatsSchema.safeParse(ok).success).toBe(true);
    expect(StatsSchema.safeParse({ ...ok, health: 101 }).success).toBe(false);
    expect(StatsSchema.safeParse({ ...ok, health: 1.5 }).success).toBe(false);
  });
  it('requires commandId/expectedRevision and a choiceId for RESOLVE_EVENT', () => {
    expect(EngineCommandSchema.safeParse({ type: 'ADVANCE_YEAR' }).success).toBe(false);
    expect(EngineCommandSchema.safeParse({ type: 'RESOLVE_EVENT', commandId: 'a', expectedRevision: 0 }).success).toBe(false);
  });
});

describe('content', () => {
  it('shipped M1 content passes validation', () => {
    expect(validateContent(contentBundle)).toEqual([]);
    expect(validateManifest(contentManifest)).toEqual([]);
    expect(ContentBundleSchema.safeParse(contentBundle).success).toBe(true);
  });
  it('manifest requires a source for non-fictional packs', () => {
    const m = ContentManifestSchema.parse({
      id: 'm', contentVersion: '1', schemaVersion: 1,
      packages: [{ id: 'geo', kind: 'geography', version: '1', provenance: 'real-documented', source: null, entryCount: 0 }],
    });
    expect(validateManifest(m)).toHaveLength(1);
  });
  it('detects duplicate ids, missing decline, and ungated birthday events', () => {
    const dupEvent = contentBundle.events[0]!;
    const bad = {
      ...contentBundle,
      professions: [...contentBundle.professions, contentBundle.professions[0]!],
      events: [
        ...contentBundle.events,
        dupEvent,
        { ...contentBundle.events.find((e) => e.id === 'job_search')!, id: 'job_x', choices: [] },
        { ...dupEvent, id: 'ungated', requires: {} },
      ],
    };
    const issues = validateContent(bad);
    expect(issues).toEqual(expect.arrayContaining([
      expect.stringContaining('duplicate profession'),
      expect.stringContaining('duplicate event'),
      expect.stringContaining('no choices'),
      expect.stringContaining('decline'),
      expect.stringContaining('gated'),
    ]));
  });
});

import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '@project-life/schemas';
import { migrateSlot, relationCode, simulate, stateChecksum, validateState } from '../src/index';
import type { GameState } from '@project-life/schemas';
import { autoPlay, ctx, legacyV2 } from './helpers';

describe('migration v2 to v3', () => {
  it('turns the flat family list into a valid NPC graph and keeps the life playable', () => {
    const raw = legacyV2();
    const res = migrateSlot(raw as never, ctx.content)!;
    expect(res.from).toBe(2);
    const slot = res.slot as { schemaVersion: number; state: never; checksum: string };
    expect(slot.schemaVersion).toBe(SCHEMA_VERSION);
    expect(validateState(slot.state)).toEqual([]);
    expect(stateChecksum(slot.state)).toBe(slot.checksum);
    const migrated = slot.state as GameState;
    expect(migrated.protagonist.parentIds).toHaveLength(2);
    expect(relationCode(migrated, migrated.protagonist.parentIds[0]!)).toBe('parent');
    expect(simulate(migrated, { type: 'ADVANCE_YEAR', commandId: 'm', expectedRevision: 0 }, ctx).ok).toBe(true);
  });

  it('never mutates the original and refuses unknown versions', () => {
    const raw = legacyV2();
    const before = JSON.stringify(raw);
    migrateSlot(raw as never, ctx.content);
    expect(JSON.stringify(raw)).toBe(before);
    expect(migrateSlot({ schemaVersion: 1, state: {} } as never, ctx.content)).toBeNull();
    expect(migrateSlot({ schemaVersion: SCHEMA_VERSION, state: {} } as never, ctx.content)).toBeNull();
  });
});



describe('migration chain end to end (release)', () => {
  const migrated = (): GameState => (migrateSlot(legacyV2() as never, ctx.content)!.slot as { state: GameState }).state;

  it('is deterministic: migrating the same old save twice gives byte-identical states', () => {
    expect(stateChecksum(migrated())).toBe(stateChecksum(migrated()));
  });

  it('a save from v2 goes through every step to the current schema and can be played to the end of the life', () => {
    const played = autoPlay(migrated(), 'legacy-life', 600);
    expect(played.state.protagonist.death).not.toBeNull();
    expect(validateState(played.state)).toEqual([]);
    expect(played.state.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('GOD MODE, achievements and the new character fields exist and are neutral after migrating', () => {
    const s = migrated();
    expect(s.config).toEqual({ godModeEnabled: false, godModeOrigin: 'migrated-no-usage' });
    expect(s.godMode).toEqual({ edits: 0, log: [] });
    expect(s.protagonist.talents).toEqual([]);
    expect(s.protagonist.predispositions).toEqual({ longevity: 50, robustness: 50 });
  });
});

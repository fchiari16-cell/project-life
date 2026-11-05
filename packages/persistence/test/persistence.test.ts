import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { GameState } from '@project-life/schemas';
import { createGame, simulate, stateChecksum } from '@project-life/engine';
import { ctx, legacyV2 } from '../../engine/test/helpers';
import {
  ProjectLifeDb,
  SaveConflictError,
  commit,
  deleteSave,
  exportSave,
  importSave,
  listSaves,
  load,
  recentEvents,
  verifySlot,
  adoptSave,
  checkIntegrity,
  lineageOf,
  exportBackup,
  planRestore,
  restoreBackup,
} from '../src/index';

let db: ProjectLifeDb;
let n = 0;

beforeEach(() => {
  db = new ProjectLifeDb(`test-${n++}`);
});

function created() {
  const r = createGame({ seed: 's', givenName: 'Ada', familyName: 'Verdi', startDate: { year: 2025, month: 1, day: 10 } }, ctx);
  if (!r.ok) throw new Error('create failed');
  return r;
}
function advanced(state: GameState, id: string) {
  const r = simulate(state, { type: 'ADVANCE_YEAR', commandId: id, expectedRevision: state.revision }, ctx);
  if (!r.ok) throw new Error('advance failed');
  return r;
}

describe('persistence', () => {
  it('creates, saves and restores an identical valid state (M0 exit criterion)', async () => {
    const r = created();
    await commit(db, { state: r.state, events: r.events, checkpoint: r.checkpoint });
    const loaded = await load(db, r.state.id);
    expect(loaded.ok && loaded.state).toEqual(r.state);
  });

  it('restores after reopening the database (simulated app restart)', async () => {
    const r = created();
    const a = advanced(r.state, 'c1');
    await commit(db, { state: r.state, events: r.events, checkpoint: r.checkpoint });
    await commit(db, { state: a.state, events: a.events, checkpoint: a.checkpoint });
    db.close();
    const reopened = new ProjectLifeDb(db.name);
    const loaded = await load(reopened, r.state.id);
    expect(loaded.ok && loaded.state.revision).toBe(1);
    expect(loaded.ok && loaded.state.rng).toEqual(a.state.rng);
    expect((await recentEvents(reopened, r.state.id, 1000)).length).toBe(r.events.length + a.events.length);
    expect((await recentEvents(reopened, r.state.id, 1000, (e) => e.type === 'LIFE_CREATED')).length).toBe(1);
  });

  it('commit is idempotent for the same revision and content', async () => {
    const r = created();
    await commit(db, { state: r.state, events: r.events, checkpoint: r.checkpoint });
    await commit(db, { state: r.state, events: r.events, checkpoint: r.checkpoint });
    expect(await db.saves.count()).toBe(1);
    expect(await db.journal.count()).toBe(1);
  });

  it('rejects an older revision instead of overwriting (no silent merge)', async () => {
    const r = created();
    const a = advanced(r.state, 'c1');
    await commit(db, { state: a.state, events: a.events, checkpoint: a.checkpoint });
    await expect(commit(db, { state: r.state, events: [], checkpoint: null })).rejects.toBeInstanceOf(
      SaveConflictError,
    );
    const loaded = await load(db, r.state.id);
    expect(loaded.ok && loaded.state.revision).toBe(1);
  });

  it('detects corruption via checksum', async () => {
    const r = created();
    await commit(db, { state: r.state, events: r.events, checkpoint: r.checkpoint });
    const slot = (await db.saves.get(r.state.id))!;
    await db.saves.put({
      ...slot,
      state: { ...slot.state, protagonist: { ...slot.state.protagonist, givenName: 'Eve' } },
    });
    expect(await load(db, r.state.id)).toMatchObject({ ok: false, reason: 'CORRUPT' });
  });

  it('reports a missing save and lists/deletes saves', async () => {
    expect(await load(db, 'nope')).toMatchObject({ ok: false, reason: 'NOT_FOUND' });
    const r = created();
    await commit(db, { state: r.state, events: r.events, checkpoint: r.checkpoint });
    expect(await listSaves(db)).toHaveLength(1);
    await deleteSave(db, r.state.id);
    expect(await listSaves(db)).toHaveLength(0);
    expect(await db.journal.count()).toBe(0);
  });

  it('exports and imports; conflicting import is rejected unless asCopy', async () => {
    const r = created();
    await commit(db, { state: r.state, events: r.events, checkpoint: r.checkpoint });
    const text = await exportSave(db, r.state.id);

    const other = new ProjectLifeDb(`import-${n++}`);
    const imported = await importSave(other, text);
    expect(imported.id).toBe(r.state.id);
    expect(await importSave(other, text)).toMatchObject({ id: r.state.id }); // idempotent

    const a = advanced(r.state, 'c1');
    await commit(other, { state: a.state, events: a.events, checkpoint: a.checkpoint });
    await expect(importSave(other, text)).rejects.toBeInstanceOf(SaveConflictError);
    const copy = await importSave(other, text, { asCopy: true });
    expect(copy.id).not.toBe(r.state.id);
    expect(await listSaves(other)).toHaveLength(2);
  });

  it('migrates a schema-v2 save on load, keeps a backup of the original, and the life stays playable', async () => {
    const legacy = legacyV2();
    await db.saves.put(legacy as never);
    const first = await load(db, legacy.id);
    expect(first).toMatchObject({ ok: true, migratedFrom: 2 });
    expect((await db.backups.get(`${legacy.id}@v2`))?.raw).toEqual(legacy);
    const second = await load(db, legacy.id);
    expect(second.ok && second.migratedFrom).toBeUndefined();
    if (!second.ok) throw new Error('load failed');
    const adv = advanced(second.state, 'after-migration');
    await commit(db, { state: adv.state, events: adv.events, checkpoint: adv.checkpoint });
    const third = await load(db, legacy.id);
    expect(third.ok && third.state.revision).toBe(1);
  });

  it('rejects a corrupt legacy save instead of migrating it', async () => {
    const legacy = legacyV2();
    await db.saves.put({ ...legacy, checksum: 'bad' } as never);
    expect(await load(db, legacy.id)).toMatchObject({ ok: false, reason: 'CORRUPT' });
    expect(await db.backups.count()).toBe(0);
  });

  it('reports saves with no migration path as incompatible, not corrupt', () => {
    expect(verifySlot({ schemaVersion: 1, state: {}, checksum: stateChecksum({}) })).toMatchObject({ ok: false, reason: 'INCOMPATIBLE' });
  });

  it('rejects garbage imports', async () => {
    await expect(importSave(db, 'not json')).rejects.toThrow();
    await expect(importSave(db, '{"format":"other"}')).rejects.toThrow();
  });
});

describe('full backup, restore and integrity', () => {
  async function seeded(dbx: ProjectLifeDb, seed: string) {
    const r = createGame({ seed, givenName: 'Ada', familyName: 'Verdi', startDate: { year: 2025, month: 1, day: 10 } }, ctx);
    if (!r.ok) throw new Error('create failed');
    await commit(dbx, { state: r.state, events: r.events, checkpoint: r.checkpoint });
    return r;
  }

  it('round-trips every save into an empty database', async () => {
    const a = await seeded(db, 'a');
    const b = await seeded(db, 'b');
    const text = await exportBackup(db);
    const fresh = new ProjectLifeDb(`test-fresh-${n++}`);
    expect((await planRestore(fresh, text)).map((e) => e.status)).toEqual(['NEW', 'NEW']);
    const res = await restoreBackup(fresh, text);
    expect(res.added.sort()).toEqual([a.state.id, b.state.id].sort());
    for (const r of [a, b]) {
      const loaded = await load(fresh, r.state.id);
      expect(loaded.ok && loaded.state).toEqual(r.state);
    }
    // restoring again changes nothing
    expect((await planRestore(fresh, text)).every((e) => e.status === 'IDENTICAL')).toBe(true);
    const again = await restoreBackup(fresh, text);
    expect(again).toEqual({ added: [], copied: [], replaced: [], skipped: [] });
  });

  it('never merges: a diverged save is kept as a copy by default, replaced only on explicit request', async () => {
    const r = await seeded(db, 'c');
    const text = await exportBackup(db);
    const next = advanced(r.state, 'c1');
    await commit(db, { state: next.state, events: next.events, checkpoint: next.checkpoint });
    expect((await planRestore(db, text))[0]?.status).toBe('CONFLICT');

    const skipped = await restoreBackup(db, text, { [r.state.id]: 'skip' });
    expect(skipped.skipped).toEqual([r.state.id]);
    expect((await listSaves(db)).length).toBe(1);

    const copied = await restoreBackup(db, text);
    expect(copied.copied).toHaveLength(1);
    expect((await listSaves(db)).length).toBe(2);
    const original = await load(db, r.state.id);
    expect(original.ok && original.state.revision).toBe(next.state.revision); // untouched
    const copy = await load(db, copied.copied[0]!);
    expect(copy.ok && copy.state.revision).toBe(r.state.revision);

    const replaced = await restoreBackup(db, text, { [r.state.id]: 'replace' });
    expect(replaced.replaced).toEqual([r.state.id]);
    const after = await load(db, r.state.id);
    expect(after.ok && after.state.revision).toBe(r.state.revision);
    expect(await db.backups.count()).toBe(1); // what was replaced is still recoverable
  });

  it('leaves out saves that fail verification and reports them; rejects foreign files', async () => {
    const r = await seeded(db, 'd');
    await seeded(db, 'e');
    const raw = await db.saves.get(r.state.id);
    await db.saves.put({ ...raw!, checksum: 'broken' });
    const file = JSON.parse(await exportBackup(db));
    expect(file.saves).toHaveLength(1);
    expect(file.skipped).toEqual([{ id: r.state.id, reason: 'checksum mismatch' }]);
    await expect(restoreBackup(db, '{"format":"nope"}')).rejects.toThrow(/not a PROJECT LIFE backup/);
    await expect(restoreBackup(db, 'garbage')).rejects.toThrow(/not valid JSON/);
  });

  it('integrity check reports corrupt saves and orphan rows, and modifies nothing', async () => {
    const r = await seeded(db, 'f');
    expect((await checkIntegrity(db)).ok).toBe(true);
    await db.journal.put({ id: 'ghost:1:0', gameId: 'ghost', revision: 1, event: {} as never });
    const raw = await db.saves.get(r.state.id);
    await db.saves.put({ ...raw!, checksum: 'broken' });
    const rep = await checkIntegrity(db);
    expect(rep.ok).toBe(false);
    expect(rep.orphanJournalRows).toBe(1);
    expect(rep.saves[0]).toMatchObject({ ok: false, message: 'checksum mismatch' });
    expect((await db.saves.get(r.state.id))!.checksum).toBe('broken');
  });
});

describe('sync support', () => {
  it('lineage lists the checksum of every checkpointed revision; adoptSave replaces a save but keeps the old one', async () => {
    const r = created();
    const a = advanced(r.state, 'c1');
    for (const x of [r, a]) await commit(db, { state: x.state, events: x.events, checkpoint: x.checkpoint });
    const lin = await lineageOf(db, r.state.id);
    expect(lin.map((p) => p.revision)).toEqual([r.state.revision, a.state.revision]);
    expect(lin[1]!.checksum).toBe(stateChecksum(a.state));

    const other = new ProjectLifeDb(`test-other-${n++}`);
    await commit(other, { state: r.state, events: r.events, checkpoint: r.checkpoint });
    const text = await exportSave(db, r.state.id); // the newer one
    const slot = await adoptSave(other, text);
    expect(slot.revision).toBe(a.state.revision);
    const loaded = await load(other, r.state.id);
    expect(loaded.ok && loaded.state.revision).toBe(a.state.revision);
    expect(await other.backups.count()).toBe(1);
    await expect(adoptSave(other, '{"format":"x"}')).rejects.toThrow(/not a PROJECT LIFE save/);
  });
});

describe('GOD MODE choice and the integrity of imports (T71)', () => {
  it('the choice survives save, load, export and import unchanged', async () => {
    const r = createGame({ seed: 'god-persist', givenName: 'Ada', familyName: 'Verdi', startDate: { year: 2025, month: 1, day: 10 }, godModeEnabled: true, initialGodPatch: { stats: { appearance: 90 } } }, ctx);
    if (!r.ok) throw new Error(r.error.message);
    await commit(db, { state: r.state, events: r.events, checkpoint: r.checkpoint });
    const loaded = await load(db, r.state.id);
    expect(loaded.ok && loaded.state.config).toEqual({ godModeEnabled: true, godModeOrigin: 'chosen' });
    const text = await exportSave(db, r.state.id);
    const other = new ProjectLifeDb(`test-god-${n++}`);
    await importSave(other, text);
    const again = await load(other, r.state.id);
    expect(again.ok && again.state.config.godModeEnabled).toBe(true);
    expect(again.ok && again.state.godMode.edits).toBe(1);
  });

  it('refuses a save that was edited to claim it never had GOD MODE although it shows activity', async () => {
    const r = createGame({ seed: 'god-forge', givenName: 'Ada', familyName: 'Verdi', startDate: { year: 2025, month: 1, day: 10 }, godModeEnabled: true, initialGodPatch: { stats: { appearance: 90 } } }, ctx);
    if (!r.ok) throw new Error(r.error.message);
    await commit(db, { state: r.state, events: r.events, checkpoint: r.checkpoint });
    const parsed = JSON.parse(await exportSave(db, r.state.id));
    parsed.slot.state.config.godModeEnabled = false;
    parsed.slot.checksum = stateChecksum(parsed.slot.state); // even with a consistent checksum
    const target = new ProjectLifeDb(`test-forge-${n++}`);
    await expect(importSave(target, JSON.stringify(parsed))).rejects.toThrow(/GOD MODE activity/);
    expect(await target.saves.count()).toBe(0);
  });
});

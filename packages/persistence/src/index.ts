import Dexie, { type EntityTable } from 'dexie';
import { contentBundle } from '@project-life/content';
import { migrateSlot, stateChecksum, validateState } from '@project-life/engine';
import {
  ENGINE_VERSION,
  SaveSlotSchema,
  SCHEMA_VERSION,
  type DomainEvent,
  type GameState,
  type SaveSlot,
  type SimulationCheckpoint,
} from '@project-life/schemas';

export interface JournalRow {
  /** `${gameId}:${revision}:${sequence}` — same as DomainEvent.id, so writes are idempotent. */
  id: string;
  gameId: string;
  revision: number;
  event: DomainEvent;
}
export interface CheckpointRow extends SimulationCheckpoint {
  state: GameState;
}

export class ProjectLifeDb extends Dexie {
  saves!: EntityTable<SaveSlot, 'id'>;
  journal!: EntityTable<JournalRow, 'id'>;
  checkpoints!: EntityTable<CheckpointRow, 'id'>;
  /** Untouched copies of saves taken right before a schema migration (id = `${saveId}@v${oldVersion}`). */
  backups!: EntityTable<{ id: string; savedAt: string; raw: unknown }, 'id'>;

  constructor(name = 'project-life') {
    super(name);
    this.version(1).stores({
      saves: 'id, updatedAt',
      journal: 'id, gameId, [gameId+revision]',
      checkpoints: 'id, gameId, [gameId+revision]',
    });
    this.version(2).stores({
      saves: 'id, updatedAt',
      journal: 'id, gameId, [gameId+revision]',
      checkpoints: 'id, gameId, [gameId+revision]',
      backups: 'id',
    });
  }
}

export class SaveConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaveConflictError';
  }
}
export class SaveCorruptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaveCorruptError';
  }
}

export interface CommitInput {
  state: GameState;
  events: DomainEvent[];
  checkpoint: SimulationCheckpoint | null;
  /** Display name, used only when the slot is created. */
  name?: string;
}

/**
 * Atomically persists one engine result: save slot + journal + checkpoint in a
 * single IndexedDB transaction. Re-committing the same revision is a no-op when
 * content is identical; a stale or divergent write is rejected, never merged.
 */
export async function commit(db: ProjectLifeDb, input: CommitInput): Promise<SaveSlot> {
  const { state, events, checkpoint } = input;
  const issues = validateState(state);
  if (issues.length) throw new SaveCorruptError(`refusing to save invalid state: ${issues.join('; ')}`);
  const sum = stateChecksum(state);
  const now = new Date().toISOString();

  return db.transaction('rw', db.saves, db.journal, db.checkpoints, async () => {
    const existing = await db.saves.get(state.id);
    if (existing) {
      if (existing.revision > state.revision) {
        throw new SaveConflictError(
          `stored revision ${existing.revision} is newer than ${state.revision}; resolve explicitly`,
        );
      }
      if (existing.revision === state.revision && existing.checksum !== sum) {
        throw new SaveConflictError(`revision ${state.revision} already stored with different content`);
      }
    }
    const slot: SaveSlot = {
      id: state.id,
      name: existing?.name ?? input.name ?? `${state.protagonist.givenName} ${state.protagonist.familyName}`,
      schemaVersion: SCHEMA_VERSION,
      engineVersion: ENGINE_VERSION,
      contentVersion: state.contentVersion,
      seed: state.seed,
      rng: state.rng,
      revision: state.revision,
      simulationStatus: state.simulation.status,
      dynasty: state.dynasty,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      checksum: sum,
      state,
    };
    await db.saves.put(slot);
    if (events.length) {
      await db.journal.bulkPut(
        events.map((event) => ({ id: event.id, gameId: state.id, revision: event.revision, event })),
      );
    }
    if (checkpoint) await db.checkpoints.put({ ...checkpoint, state });
    return slot;
  });
}

export type LoadResult =
  | { ok: true; slot: SaveSlot; state: GameState; migratedFrom?: number }
  | { ok: false; reason: 'NOT_FOUND' | 'CORRUPT' | 'INCOMPATIBLE'; message: string };

/** Loads and verifies a save: schema, version, checksum, then engine invariants. */
export async function load(db: ProjectLifeDb, id: string): Promise<LoadResult> {
  const raw = await db.saves.get(id);
  if (!raw) return { ok: false, reason: 'NOT_FOUND', message: `save ${id} not found` };
  const res = verifySlot(raw);
  if (res.ok && res.migratedFrom !== undefined) {
    // Keep the original bytes before replacing them with the migrated save.
    await db.transaction('rw', db.saves, db.backups, async () => {
      await db.backups.put({ id: `${id}@v${res.migratedFrom}`, savedAt: new Date().toISOString(), raw });
      await db.saves.put(res.slot);
    });
  }
  return res;
}

export function verifySlot(raw: unknown): LoadResult {
  const declared = (raw as { schemaVersion?: unknown } | null)?.schemaVersion;
  if (typeof declared === 'number' && declared < SCHEMA_VERSION) {
    const legacy = raw as { state?: unknown; checksum?: unknown };
    if (stateChecksum(legacy.state) !== legacy.checksum) {
      return { ok: false, reason: 'CORRUPT', message: 'checksum mismatch (legacy save)' };
    }
    const migrated = migrateSlot(raw as Record<string, unknown>, contentBundle);
    if (!migrated) {
      // e.g. pre-release M0 saves (schema v1): reported as incompatible rather than corrupt.
      return {
        ok: false,
        reason: 'INCOMPATIBLE',
        message: `save schema v${declared} is older than v${SCHEMA_VERSION} and no migration is available`,
      };
    }
    const res = verifySlot(migrated.slot);
    return res.ok ? { ...res, migratedFrom: migrated.from } : res;
  }
  const parsed = SaveSlotSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: 'CORRUPT', message: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  const slot = parsed.data;
  if (slot.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, reason: 'INCOMPATIBLE', message: `save schema v${slot.schemaVersion} is newer than this app (v${SCHEMA_VERSION})` };
  }
  // Older schema versions will be upgraded by a migration chain (none exist at v1).
  if (stateChecksum(slot.state) !== slot.checksum) {
    return { ok: false, reason: 'CORRUPT', message: 'checksum mismatch' };
  }
  const issues = validateState(slot.state);
  if (issues.length) return { ok: false, reason: 'CORRUPT', message: issues.join('; ') };
  return { ok: true, slot, state: slot.state };
}

export async function listSaves(db: ProjectLifeDb): Promise<SaveSlot[]> {
  return db.saves.orderBy('updatedAt').reverse().toArray();
}

/** Newest `limit` journal events of a game, oldest first. Optionally restricted by a predicate. */
export async function recentEvents(
  db: ProjectLifeDb,
  gameId: string,
  limit = 20,
  keep: (e: DomainEvent) => boolean = () => true,
): Promise<DomainEvent[]> {
  const rows = await db.journal
    .where('[gameId+revision]')
    .between([gameId, Dexie.minKey], [gameId, Dexie.maxKey])
    .reverse()
    .filter((r) => keep(r.event))
    .limit(limit)
    .toArray();
  return rows
    .map((r) => r.event)
    .sort((a, b) => a.revision - b.revision || a.sequence - b.sequence);
}

export async function deleteSave(db: ProjectLifeDb, id: string): Promise<void> {
  await db.transaction('rw', db.saves, db.journal, db.checkpoints, async () => {
    await db.saves.delete(id);
    await db.journal.where('gameId').equals(id).delete();
    await db.checkpoints.where('gameId').equals(id).delete();
  });
}

/* ------------------------------ export / import -------------------- */
const EXPORT_FORMAT = 'project-life-save';

export async function exportSave(db: ProjectLifeDb, id: string): Promise<string> {
  const res = await load(db, id);
  if (!res.ok) throw new SaveCorruptError(res.message);
  const journal = await db.journal.where('gameId').equals(id).toArray();
  return JSON.stringify({ format: EXPORT_FORMAT, exportVersion: 1, slot: res.slot, journal });
}

/**
 * Imports an exported save. If the id already exists with different content
 * the import is rejected with SaveConflictError (both versions are preserved);
 * the caller may retry with `asCopy` to keep the import under a new id.
 */
export async function importSave(
  db: ProjectLifeDb,
  text: string,
  opts: { asCopy?: boolean } = {},
): Promise<SaveSlot> {
  let data: { format?: string; slot?: unknown; journal?: JournalRow[] };
  try {
    data = JSON.parse(text);
  } catch {
    throw new SaveCorruptError('not valid JSON');
  }
  if (data.format !== EXPORT_FORMAT) throw new SaveCorruptError('not a PROJECT LIFE save export');
  const verified = verifySlot(data.slot);
  if (!verified.ok) throw new SaveCorruptError(verified.message);
  const incoming = verified.slot;

  const existing = await db.saves.get(incoming.id);
  if (existing && existing.checksum === incoming.checksum) return existing; // idempotent
  if (existing && !opts.asCopy) {
    throw new SaveConflictError(`a different save with id ${incoming.id} already exists`);
  }
  if (!existing) {
    await db.saves.put(incoming);
    if (data.journal?.length) await db.journal.bulkPut(data.journal);
    return incoming;
  }
  const copyId = `${incoming.id}-copy-${incoming.checksum.slice(0, 6)}`;
  const state = { ...incoming.state, id: copyId };
  const copy: SaveSlot = { ...incoming, id: copyId, name: `${incoming.name} (copia)`, state, checksum: stateChecksum(state) };
  await db.saves.put(copy);
  return copy;
}

/* ------------------------------ full backup / restore -------------------- */
const BACKUP_FORMAT = 'project-life-backup';

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  backupVersion: 1;
  createdAt: string;
  saves: { slot: unknown; journal: JournalRow[] }[];
  /** Saves that failed verification and were therefore left out (never silently repaired). */
  skipped: { id: string; reason: string }[];
}

/** Every verified save with its journal, as one JSON document. Works fully offline. */
export async function exportBackup(db: ProjectLifeDb): Promise<string> {
  const saves: BackupFile['saves'] = [];
  const skipped: BackupFile['skipped'] = [];
  for (const raw of await db.saves.toArray()) {
    const res = verifySlot(raw);
    if (!res.ok) {
      skipped.push({ id: raw.id, reason: res.message });
      continue;
    }
    saves.push({ slot: res.slot, journal: await db.journal.where('gameId').equals(raw.id).toArray() });
  }
  const file: BackupFile = { format: BACKUP_FORMAT, backupVersion: 1, createdAt: new Date().toISOString(), saves, skipped };
  return JSON.stringify(file);
}

export type RestoreStatus = 'NEW' | 'IDENTICAL' | 'CONFLICT' | 'INVALID';
export interface RestoreEntry {
  id: string;
  name: string;
  status: RestoreStatus;
  detail: string;
}
export type RestoreChoice = 'skip' | 'copy' | 'replace';

function parseBackup(text: string): { slot: SaveSlot | null; journal: JournalRow[]; id: string; error?: string }[] {
  let data: Partial<BackupFile>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new SaveCorruptError('not valid JSON');
  }
  if (data.format !== BACKUP_FORMAT || !Array.isArray(data.saves)) throw new SaveCorruptError('not a PROJECT LIFE backup');
  return data.saves.map((entry) => {
    const verified = verifySlot(entry.slot);
    const id = (entry.slot as { id?: string } | null)?.id ?? '?';
    return verified.ok
      ? { slot: verified.slot, journal: entry.journal ?? [], id: verified.slot.id }
      : { slot: null, journal: [], id, error: verified.message };
  });
}

/** Read-only comparison of a backup with what is stored now. Nothing is written. */
export async function planRestore(db: ProjectLifeDb, text: string): Promise<RestoreEntry[]> {
  const out: RestoreEntry[] = [];
  for (const e of parseBackup(text)) {
    if (!e.slot) {
      out.push({ id: e.id, name: e.id, status: 'INVALID', detail: e.error ?? 'invalid' });
      continue;
    }
    const existing = await db.saves.get(e.slot.id);
    if (!existing) out.push({ id: e.id, name: e.slot.name, status: 'NEW', detail: `revision ${e.slot.revision}` });
    else if (existing.checksum === e.slot.checksum) out.push({ id: e.id, name: e.slot.name, status: 'IDENTICAL', detail: `revision ${e.slot.revision}` });
    else out.push({ id: e.id, name: e.slot.name, status: 'CONFLICT', detail: `stored r${existing.revision} · backup r${e.slot.revision}` });
  }
  return out;
}

/**
 * Restores a backup. New saves are added, identical ones are left alone; for a conflicting save nothing is
 * ever merged or overwritten unless the caller explicitly says 'replace' (the replaced version is first
 * kept in `backups`). The default for a conflict is 'copy': both versions are kept.
 */
export async function restoreBackup(
  db: ProjectLifeDb,
  text: string,
  choices: Record<string, RestoreChoice> = {},
): Promise<{ added: string[]; copied: string[]; replaced: string[]; skipped: string[] }> {
  const result = { added: [] as string[], copied: [] as string[], replaced: [] as string[], skipped: [] as string[] };
  for (const e of parseBackup(text)) {
    if (!e.slot) {
      result.skipped.push(e.id);
      continue;
    }
    const incoming = e.slot;
    const existing = await db.saves.get(incoming.id);
    if (!existing) {
      await db.transaction('rw', db.saves, db.journal, async () => {
        await db.saves.put(incoming);
        if (e.journal.length) await db.journal.bulkPut(e.journal);
      });
      result.added.push(incoming.id);
      continue;
    }
    if (existing.checksum === incoming.checksum) continue;
    const choice = choices[incoming.id] ?? 'copy';
    if (choice === 'skip') result.skipped.push(incoming.id);
    else if (choice === 'replace') {
      await db.transaction('rw', db.saves, db.journal, db.backups, async () => {
        await db.backups.put({ id: `${incoming.id}@replaced-${Date.now()}`, savedAt: new Date().toISOString(), raw: existing });
        await db.saves.put(incoming);
        if (e.journal.length) await db.journal.bulkPut(e.journal);
      });
      result.replaced.push(incoming.id);
    } else {
      const copyId = `${incoming.id}-copy-${incoming.checksum.slice(0, 6)}`;
      const state = { ...incoming.state, id: copyId };
      await db.saves.put({ ...incoming, id: copyId, name: `${incoming.name} (copia)`, state, checksum: stateChecksum(state) });
      result.copied.push(copyId);
    }
  }
  return result;
}

/* ------------------------------ integrity -------------------------------- */
export interface IntegrityReport {
  ok: boolean;
  saves: { id: string; ok: boolean; message: string }[];
  orphanJournalRows: number;
  orphanCheckpoints: number;
}

/** Verifies every stored save (schema, checksum, invariants) without modifying anything. */
export async function checkIntegrity(db: ProjectLifeDb): Promise<IntegrityReport> {
  const raws = await db.saves.toArray();
  const ids = new Set(raws.map((r) => r.id));
  const saves = raws.map((raw) => {
    const res = verifySlot(raw);
    return { id: raw.id, ok: res.ok, message: res.ok ? 'ok' : res.message };
  });
  const orphanJournalRows = (await db.journal.toArray()).filter((r) => !ids.has(r.gameId)).length;
  const orphanCheckpoints = (await db.checkpoints.toArray()).filter((r) => !ids.has(r.gameId)).length;
  return { ok: saves.every((s) => s.ok) && orphanJournalRows === 0 && orphanCheckpoints === 0, saves, orphanJournalRows, orphanCheckpoints };
}

/* ------------------------------ sync support ----------------------------- */
/** Checksum of the state at each stored checkpoint: the history used to tell "ahead" from "diverged". */
export async function lineageOf(db: ProjectLifeDb, gameId: string): Promise<{ revision: number; checksum: string }[]> {
  const rows = await db.checkpoints.where('gameId').equals(gameId).toArray();
  const byRevision = new Map<number, string>();
  for (const r of rows) byRevision.set(r.state.revision, stateChecksum(r.state));
  return [...byRevision.entries()].map(([revision, checksum]) => ({ revision, checksum })).sort((a, b) => a.revision - b.revision).slice(-500);
}

/**
 * Replaces a stored save with a verified exported one (used when the player accepts the other side of a
 * sync). The replaced version stays recoverable in `backups`.
 */
export async function adoptSave(db: ProjectLifeDb, text: string): Promise<SaveSlot> {
  let data: { format?: string; slot?: unknown; journal?: JournalRow[] };
  try {
    data = JSON.parse(text);
  } catch {
    throw new SaveCorruptError('not valid JSON');
  }
  if (data.format !== EXPORT_FORMAT) throw new SaveCorruptError('not a PROJECT LIFE save export');
  const verified = verifySlot(data.slot);
  if (!verified.ok) throw new SaveCorruptError(verified.message);
  const incoming = verified.slot;
  await db.transaction('rw', db.saves, db.journal, db.backups, async () => {
    const existing = await db.saves.get(incoming.id);
    if (existing) await db.backups.put({ id: `${incoming.id}@adopted-${Date.now()}`, savedAt: new Date().toISOString(), raw: existing });
    await db.saves.put(incoming);
    if (data.journal?.length) await db.journal.bulkPut(data.journal);
  });
  return incoming;
}

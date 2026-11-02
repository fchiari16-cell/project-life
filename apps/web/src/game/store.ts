import { create } from 'zustand';
import { contentBundle } from '@project-life/content';
import { continueDynasty, createGame, simulate } from '@project-life/engine';
import {
  ProjectLifeDb,
  SaveConflictError,
  SaveCorruptError,
  adoptSave,
  checkIntegrity,
  commit,
  deleteSave,
  exportBackup,
  exportSave,
  importSave,
  lineageOf,
  listSaves,
  load,
  planRestore,
  recentEvents,
  restoreBackup,
  type IntegrityReport,
  type RestoreChoice,
  type RestoreEntry,
} from '@project-life/persistence';
import type { CloudRecord } from '@project-life/services';
import {
  CONTENT_VERSION,
  RULES_VERSION,
  type DomainEvent,
  type EngineCommand,
  type EngineResult,
  type GameState,
  type GodPatch,
  type SaveSlot,
  type SimulationContext,
} from '@project-life/schemas';
import { t } from '../i18n/it';

export const simulationContext: SimulationContext = {
  rulesVersion: RULES_VERSION,
  contentVersion: CONTENT_VERSION,
  content: contentBundle,
};

const LAST_KEY = 'pl-last-game';
const remember = (id: string | null): void => {
  try {
    if (id) localStorage.setItem(LAST_KEY, id);
    else localStorage.removeItem(LAST_KEY);
  } catch {
    /* storage unavailable: resume-last is a convenience only */
  }
};
const recall = (): string | null => {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
};

/** Monthly ticks, birthdays and bookkeeping are internal; the feed shows meaningful life events. */
export const isVisibleEvent = (e: DomainEvent): boolean =>
  e.type !== 'MONTH_ADVANCED' && e.type !== 'BIRTHDAY' && e.type !== 'FINANCE_YEAR' && e.type !== 'EVENT_TRIGGERED';

const FEED_SIZE = 60;
const visible = (events: DomainEvent[]): DomainEvent[] => events.filter(isVisibleEvent).slice(-FEED_SIZE);

const uid = (): string => crypto.randomUUID();
export const randomSeed = (): string => uid().slice(0, 8);

export interface ImportConflict {
  text: string;
}

interface GameStore {
  ready: boolean;
  busy: boolean;
  error: string | null;
  saves: SaveSlot[];
  game: GameState | null;
  events: DomainEvent[];
  importConflict: ImportConflict | null;

  init(): Promise<void>;
  createLife(input: { givenName: string; familyName: string; seed: string; countryCode: string | null }): Promise<void>;
  continueLife(input: { givenName: string; seed: string; parentId: string | null }): Promise<void>;
  advanceYear(): Promise<void>;
  resolveEvent(choiceId: string): Promise<void>;
  openSave(id: string): Promise<void>;
  removeSave(id: string): Promise<void>;
  closeGame(): void;
  godToggle(enabled: boolean): Promise<void>;
  /** Returns true when the edit was applied. */
  godEdit(targetId: string, patch: GodPatch): Promise<boolean>;
  exportAll(): Promise<string>;
  planBackup(text: string): Promise<RestoreEntry[]>;
  restoreBackupText(text: string, choices: Record<string, RestoreChoice>): Promise<string>;
  checkIntegrity(): Promise<IntegrityReport>;
  /** The open life in the shape the cloud stores. */
  cloudRecord(): Promise<CloudRecord | null>;
  /** Replaces the open life with the cloud version, or keeps that version as a copy. */
  adoptRemote(payload: string, asCopy: boolean): Promise<void>;
  exportCurrent(): Promise<string | null>;
  importText(text: string, asCopy?: boolean): Promise<void>;
  clearError(): void;
}

export function createGameStore(db: ProjectLifeDb) {
  const message = (e: unknown): string => {
    if (e instanceof SaveCorruptError) return `${t.errors.corrupt} (${e.message})`;
    if (e instanceof SaveConflictError) return e.message;
    if (e instanceof Error) return e.message;
    return t.errors.generic;
  };

  return create<GameStore>((set, get) => {
    const refreshSaves = async (): Promise<void> => set({ saves: await listSaves(db) });
    const guarded = async (fn: () => Promise<void>): Promise<void> => {
      if (get().busy) return; // blocks duplicate submissions (double click on "Avanza")
      set({ busy: true, error: null });
      try {
        await fn();
      } catch (e) {
        set({ error: message(e) });
      } finally {
        set({ busy: false });
      }
    };
    const open = async (id: string): Promise<void> => {
      const res = await load(db, id);
      if (!res.ok) {
        remember(null);
        set({ error: `${t.errors.corrupt} (${res.message})` });
        return;
      }
      set({ game: res.state, events: await recentEvents(db, id, FEED_SIZE, isVisibleEvent) });
      remember(id);
    };
    /** Run a command through the engine, persist the result atomically, then expose the new state. */
    const run = async (command: EngineCommand): Promise<void> => {
      const game = get().game;
      if (!game) return;
      const result: EngineResult = simulate(game, command, simulationContext);
      if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
      await commit(db, { state: result.state, events: result.events, checkpoint: result.checkpoint });
      set({ game: result.state, events: visible([...get().events, ...result.events]) });
      await refreshSaves();
    };

    return {
      ready: false,
      busy: false,
      error: null,
      saves: [],
      game: null,
      events: [],
      importConflict: null,

      async init() {
        try {
          await refreshSaves();
          const last = recall();
          if (last && get().saves.some((s) => s.id === last)) await open(last);
        } catch (e) {
          set({ error: `${t.errors.storage} ${message(e)}` });
        } finally {
          set({ ready: true });
        }
      },

      createLife: (input) =>
        guarded(async () => {
          const now = new Date();
          const result = createGame(
            {
              seed: input.seed,
              givenName: input.givenName,
              familyName: input.familyName,
              countryCode: input.countryCode,
              startDate: { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() },
            },
            simulationContext,
          );
          if (!result.ok) throw new Error(result.error.message);
          await commit(db, { state: result.state, events: result.events, checkpoint: result.checkpoint });
          set({ game: result.state, events: visible(result.events) });
          remember(result.state.id);
          await refreshSaves();
        }),

      continueLife: (input) =>
        guarded(async () => {
          const prev = get().game;
          if (!prev) return;
          const result = continueDynasty(prev, input, simulationContext);
          if (!result.ok) throw new Error(result.error.message);
          await commit(db, { state: result.state, events: result.events, checkpoint: result.checkpoint });
          set({ game: result.state, events: visible(result.events) });
          remember(result.state.id);
          await refreshSaves();
        }),

      advanceYear: () =>
        guarded(() => run({ type: 'ADVANCE_YEAR', commandId: uid(), expectedRevision: get().game?.revision ?? 0 })),

      resolveEvent: (choiceId) =>
        guarded(() =>
          run({ type: 'RESOLVE_EVENT', commandId: uid(), expectedRevision: get().game?.revision ?? 0, choiceId }),
        ),

      openSave: (id) => guarded(() => open(id)),

      removeSave: (id) =>
        guarded(async () => {
          await deleteSave(db, id);
          if (get().game?.id === id) {
            set({ game: null, events: [] });
            remember(null);
          }
          await refreshSaves();
        }),

      closeGame() {
        remember(null);
        set({ game: null, events: [] });
      },

      godToggle: (enabled) =>
        guarded(() => run({ type: 'GOD_TOGGLE', commandId: uid(), expectedRevision: get().game?.revision ?? 0, enabled })),

      async godEdit(targetId, patch) {
        const before = get().game?.revision;
        await guarded(() => run({ type: 'GOD_EDIT', commandId: uid(), expectedRevision: before ?? 0, targetId, patch }));
        return get().error === null;
      },

      exportAll: () => exportBackup(db),
      planBackup: (text) => planRestore(db, text),
      async restoreBackupText(text, choices) {
        const r = await restoreBackup(db, text, choices);
        await refreshSaves();
        const cur = get().game;
        if (cur && r.replaced.includes(cur.id)) await open(cur.id);
        return t.backup.done(r.added.length, r.copied.length, r.replaced.length);
      },
      checkIntegrity: () => checkIntegrity(db),

      async cloudRecord() {
        const g = get().game;
        if (!g) return null;
        const slot = (await listSaves(db)).find((s) => s.id === g.id);
        if (!slot) return null;
        return {
          id: slot.id,
          name: slot.name,
          revision: slot.revision,
          checksum: slot.checksum,
          lineage: await lineageOf(db, slot.id),
          updatedAt: slot.updatedAt,
          payload: await exportSave(db, slot.id),
        };
      },

      adoptRemote: (payload, asCopy) =>
        guarded(async () => {
          if (asCopy) await importSave(db, payload, { asCopy: true });
          else {
            const slot = await adoptSave(db, payload);
            if (get().game?.id === slot.id) await open(slot.id);
          }
          await refreshSaves();
        }),

      async exportCurrent() {
        const id = get().game?.id;
        if (!id) return null;
        try {
          return await exportSave(db, id);
        } catch (e) {
          set({ error: message(e) });
          return null;
        }
      },

      importText: (text, asCopy = false) =>
        guarded(async () => {
          try {
            await importSave(db, text, { asCopy });
            set({ importConflict: null });
            await refreshSaves();
          } catch (e) {
            if (e instanceof SaveConflictError) {
              set({ importConflict: { text } });
              return;
            }
            throw e;
          }
        }),

      clearError: () => set({ error: null }),
    };
  });
}

export const db = new ProjectLifeDb();
export const useGame = createGameStore(db);

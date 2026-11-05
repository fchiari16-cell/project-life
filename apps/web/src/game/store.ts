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
  type SimDate,
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

/** The diary groups events by year, so the per-year marker is not an entry of its own. */
export const isDiaryEvent = (e: DomainEvent): boolean => isVisibleEvent(e) && e.type !== 'YEAR_COMPLETED';

const DIARY_PAGE = 40;
const FEED_SIZE = 60;
const visible = (events: DomainEvent[]): DomainEvent[] => events.filter(isVisibleEvent).slice(-FEED_SIZE);

const uid = (): string => crypto.randomUUID();
export const randomSeed = (): string => uid().slice(0, 8);

/** Everything the creation screen collects for a new life (GOD MODE is decided here and nowhere else). */
export interface NewLifeInput {
  givenName: string;
  familyName: string;
  seed: string;
  countryCode: string | null;
  city: string | null;
  /** Null = today. */
  birthDate: SimDate | null;
  godModeEnabled: boolean;
  initialGodPatch?: GodPatch | undefined;
}

/** A new life born into the dynasty of a concluded one; GOD MODE is asked again, never inherited. */
export interface DynastyInput {
  /** The concluded life to continue; null = the life that is open. */
  fromSaveId: string | null;
  givenName: string;
  seed: string;
  parentId: string | null;
  godModeEnabled: boolean;
  initialGodPatch?: GodPatch | undefined;
}

export const todayDate = (): SimDate => {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
};

const createParams = (input: NewLifeInput) => ({
  seed: input.seed,
  givenName: input.givenName,
  familyName: input.familyName,
  countryCode: input.countryCode,
  city: input.city,
  startDate: input.birthDate ?? todayDate(),
  godModeEnabled: input.godModeEnabled,
  ...(input.initialGodPatch ? { initialGodPatch: input.initialGodPatch } : {}),
});

/** Pure: what the engine would create. Nothing is saved; used by the creation screen to preview the newborn. */
export const previewNewLife = (input: NewLifeInput): EngineResult => createGame(createParams(input), simulationContext);

/** Pure: the newborn of a dynasty continuation, before anything is saved. */
export const previewDynastyLife = (prev: GameState, input: Omit<DynastyInput, 'fromSaveId'>): EngineResult =>
  continueDynasty(
    prev,
    {
      seed: input.seed,
      givenName: input.givenName,
      parentId: input.parentId,
      godModeEnabled: input.godModeEnabled,
      ...(input.initialGodPatch ? { initialGodPatch: input.initialGodPatch } : {}),
    },
    simulationContext,
  );

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
  /** The persistent life diary, read from the journal (oldest first). */
  diary: DomainEvent[];
  /** True when older entries exist in the journal beyond those loaded. */
  diaryHasMore: boolean;
  /** True while the diary is being read from the journal after a life was opened. */
  diaryLoading: boolean;
  importConflict: ImportConflict | null;

  init(): Promise<void>;
  loadMoreDiary(): Promise<void>;
  createLife(input: NewLifeInput): Promise<void>;
  continueLife(input: DynastyInput): Promise<void>;
  advanceYear(): Promise<void>;
  resolveEvent(choiceId: string): Promise<void>;
  openSave(id: string): Promise<void>;
  removeSave(id: string): Promise<void>;
  closeGame(): void;
  /** Returns true when the edit was applied. Only possible in a life created with GOD MODE. */
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
    /** After a commit the written slot is the newest: update the list in place instead of re-reading every save (each one carries its whole state). */
    const noteSaved = (slot: SaveSlot): void => set({ saves: [slot, ...get().saves.filter((s) => s.id !== slot.id)] });
    let initialised: Promise<void> | null = null;
    let diaryLimit = DIARY_PAGE;
    const refreshDiary = async (): Promise<void> => {
      const game = get().game;
      if (!game) {
        set({ diary: [], diaryHasMore: false });
        return;
      }
      const rows = await recentEvents(db, game.id, diaryLimit + 1, isDiaryEvent); // one extra row tells if more exist
      if (get().game?.id !== game.id) return; // another life was opened meanwhile
      const more = rows.length > diaryLimit;
      set({ diary: more ? rows.slice(1) : rows, diaryHasMore: more });
    };
    /** Reading a long life's whole diary can take a while: it loads after the life is already on screen. */
    let diaryLoad: Promise<void> = Promise.resolve();
    const startDiaryLoad = (): void => {
      set({ diary: [], diaryHasMore: false, diaryLoading: true });
      diaryLoad = refreshDiary()
        .catch((e: unknown) => set({ error: message(e) }))
        .finally(() => set({ diaryLoading: false }));
    };
    /** Appends freshly recorded events to the loaded diary without reading the journal (one command = one year, so this stays O(1)). */
    const appendDiary = (added: DomainEvent[]): void => {
      const merged = [...get().diary, ...added.filter(isDiaryEvent)];
      const over = merged.length - diaryLimit;
      set({ diary: over > 0 ? merged.slice(over) : merged, diaryHasMore: get().diaryHasMore || over > 0 });
    };
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
      diaryLimit = DIARY_PAGE;
      startDiaryLoad();
      remember(id);
    };
    /** Run a command through the engine, persist the result atomically, then expose the new state. */
    const run = async (command: EngineCommand): Promise<void> => {
      await diaryLoad; // appending to a diary that is still loading would be overwritten by the load
      const game = get().game;
      if (!game) return;
      const result: EngineResult = simulate(game, command, simulationContext);
      if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
      noteSaved(await commit(db, { state: result.state, events: result.events, checkpoint: result.checkpoint }));
      set({ game: result.state, events: visible([...get().events, ...result.events]) });
      appendDiary(result.events);
    };

    return {
      ready: false,
      busy: false,
      error: null,
      saves: [],
      game: null,
      events: [],
      diary: [],
      diaryHasMore: false,
      diaryLoading: false,
      importConflict: null,

      async loadMoreDiary() {
        diaryLimit += DIARY_PAGE;
        await refreshDiary();
      },

      /** Runs once per store: a second call (a remount, React StrictMode) must not re-open a save over a command in flight. */
      init() {
        initialised ??= (async () => {
          try {
            await refreshSaves();
            const last = recall();
            if (last && get().saves.some((s) => s.id === last)) await open(last);
          } catch (e) {
            set({ error: `${t.errors.storage} ${message(e)}` });
          } finally {
            set({ ready: true });
          }
        })();
        return initialised;
      },

      createLife: (input) =>
        guarded(async () => {
          const result = previewNewLife(input);
          if (!result.ok) throw new Error(result.error.message);
          noteSaved(await commit(db, { state: result.state, events: result.events, checkpoint: result.checkpoint }));
          set({ game: result.state, events: visible(result.events) });
          diaryLimit = DIARY_PAGE;
          set({ diary: result.events.filter(isDiaryEvent), diaryHasMore: false });
          remember(result.state.id);
        }),

      continueLife: (input) =>
        guarded(async () => {
          let prev: GameState | null = get().game;
          if (input.fromSaveId && input.fromSaveId !== prev?.id) {
            const loaded = await load(db, input.fromSaveId);
            if (!loaded.ok) throw new Error(loaded.message);
            prev = loaded.state;
          }
          if (!prev) return;
          const result = previewDynastyLife(prev, input);
          if (!result.ok) throw new Error(result.error.message);
          noteSaved(await commit(db, { state: result.state, events: result.events, checkpoint: result.checkpoint }));
          set({ game: result.state, events: visible(result.events) });
          diaryLimit = DIARY_PAGE;
          set({ diary: result.events.filter(isDiaryEvent), diaryHasMore: false });
          remember(result.state.id);
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
            set({ game: null, events: [], diary: [], diaryHasMore: false });
            remember(null);
          }
          await refreshSaves();
        }),

      closeGame() {
        remember(null);
        set({ game: null, events: [], diary: [], diaryHasMore: false });
      },

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

import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { DomainEvent, GameState } from '@project-life/schemas';
import { App } from '../../App';
import { pendingChoices } from '@project-life/engine';
import { createGameStore, simulationContext, useGame } from '../../game/store';
import { ProjectLifeDb, listSaves } from '@project-life/persistence';
import { newLifeInput } from '../../game/test-inputs';
import { groupByAge } from './LifeDiary';
import { LifeStatBar } from './LifeStatBar';

let seedCounter = 0;
const inputFor = (seed: string) => newLifeInput({ seed });

async function freshLife(): Promise<GameState> {
  useGame.setState({ game: null, events: [], diary: [], diaryHasMore: false, saves: [], error: null, busy: false });
  window.history.pushState({}, '', '/');
  await useGame.getState().init();
  await useGame.getState().createLife(inputFor(`ui-r1-${seedCounter++}`)); // a fresh id each time: the fake database is shared by the tests
  await waitFor(() => expect(useGame.getState().busy).toBe(false)); // nothing left in flight from the previous test
  return useGame.getState().game!;
}
/** Plays until a decision is pending. */
async function untilDecision(): Promise<void> {
  for (let i = 0; i < 40 && useGame.getState().game?.simulation.status !== 'PAUSED_EVENT'; i++) await useGame.getState().advanceYear();
  expect(useGame.getState().game?.simulation.status).toBe('PAUSED_EVENT');
}

beforeEach(() => localStorage.clear());

describe('LifeStatBar', () => {
  it('says the value three ways (label, number, word) and is a real meter', () => {
    render(<LifeStatBar statKey="health" value={72} />);
    const meter = screen.getByRole('meter', { name: 'Salute' });
    expect(meter).toHaveAttribute('aria-valuenow', '72');
    expect(meter).toHaveAttribute('aria-valuetext', '72 (alto)');
    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.getByText(/alto/)).toBeInTheDocument();
  });

  it('uses the right word at the boundaries and treats stress as "higher is worse"', () => {
    const { rerender } = render(<LifeStatBar statKey="stress" value={33} />);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuetext', '33 (basso)');
    expect(screen.getByRole('meter').firstElementChild).toHaveClass('bg-stat-good'); // low stress is good
    rerender(<LifeStatBar statKey="stress" value={90} />);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuetext', '90 (alto)');
    expect(screen.getByRole('meter').firstElementChild).toHaveClass('bg-stat-bad');
    rerender(<LifeStatBar statKey="health" value={34} />);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuetext', '34 (medio)');
  });
});

describe('diary grouping', () => {
  it('lists every age from now down to birth, newest first, and shows empty years as such', async () => {
    const game = await freshLife();
    const at = (year: number, month = 12): DomainEvent['at'] => ({ year, month, day: 1 });
    const mk = (id: string, revision: number, when: DomainEvent['at']): DomainEvent => ({ id, revision, sequence: 0, at: when, type: 'SOCIAL', payload: { change: 'BIRTH', otherName: 'X', detail: null } }) as unknown as DomainEvent;
    const y0 = game.protagonist.birth.year;
    const now = { ...game, world: { ...game.world, currentDate: { year: y0 + 3, month: 12, day: 31 } } } as GameState;
    const groups = groupByAge(now, [mk('a', 1, at(y0 + 3)), mk('b', 2, at(y0 + 3)), mk('c', 0, at(y0))], false);
    expect(groups.map((g) => g.age)).toEqual([3, 2, 1, 0]);
    expect(groups[0]!.events.map((e) => e.id)).toEqual(['b', 'a']); // newest first within a year
    expect(groups[1]!.events).toEqual([]);
    expect(groups[3]!.events.map((e) => e.id)).toEqual(['c']);
  });

  it('with older entries still unloaded it stops at the oldest loaded age instead of inventing years', async () => {
    const game = await freshLife();
    const y0 = game.protagonist.birth.year;
    const now = { ...game, world: { ...game.world, currentDate: { year: y0 + 50, month: 12, day: 31 } } } as GameState;
    const e = { id: 'z', revision: 9, sequence: 0, at: { year: y0 + 40, month: 12, day: 31 }, type: 'SOCIAL', payload: {} } as unknown as DomainEvent;
    const ages = groupByAge(now, [e], true).map((g) => g.age);
    expect(ages[0]).toBe(50);
    expect(ages.at(-1)).toBe(40);
  });
});

describe('persistent diary', () => {
  it('is read from the journal: it survives a restart and matches what the engine recorded', async () => {
    const db = new ProjectLifeDb('diary-persist');
    const store = createGameStore(db);
    await store.getState().init();
    await store.getState().createLife(inputFor('ui-r1-persist'));
    await untilDecisionOn(store);
    await store.getState().resolveEvent(firstChoice(store));
    const before = store.getState().diary;
    expect(before.some((e) => e.type === 'EVENT_RESOLVED')).toBe(true);
    expect(before.every((e) => e.type !== 'YEAR_COMPLETED' && e.type !== 'MONTH_ADVANCED')).toBe(true);

    const restarted = createGameStore(db);
    await restarted.getState().init();
    expect(restarted.getState().ready).toBe(true); // the life is open before its diary has been read
    await waitFor(() => expect(restarted.getState().diaryLoading).toBe(false));
    expect(restarted.getState().diary.map((e) => e.id)).toEqual(before.map((e) => e.id));
  });
});

async function untilDecisionOn(store: ReturnType<typeof createGameStore>): Promise<void> {
  for (let i = 0; i < 40 && store.getState().game?.simulation.status !== 'PAUSED_EVENT'; i++) await store.getState().advanceYear();
  expect(store.getState().game?.simulation.status).toBe('PAUSED_EVENT');
}
function firstChoice(store: ReturnType<typeof createGameStore>): string {
  return pendingChoices(store.getState().game!, simulationContext)!.choices[0]!.id;
}

describe('store start-up', () => {
  it('init runs once per store: a remount or a second call must not re-open a save over a command in flight', async () => {
    const store = createGameStore(new ProjectLifeDb('init-once'));
    const first = store.getState().init();
    expect(store.getState().init()).toBe(first); // the same promise, not a second start-up
    await first;
    await store.getState().createLife(inputFor('ui-r1-init'));
    const pending = store.getState().advanceYear(); // a command in flight…
    await store.getState().init(); // …and a second start-up call, which must not touch the game
    await pending;
    expect(store.getState().game?.revision).toBe(1);
  });
});

describe('app shell (UI-R1)', () => {
  it('shows the settings menu top-left and the protagonist header on every screen', async () => {
    await freshLife();
    render(<App />);
    const header = await screen.findByRole('banner');
    const first = within(header).getAllByRole('button')[0]!;
    expect(first).toHaveAccessibleName('Apri il menu'); // first control of the header = top-left
    expect(within(header).getByText('Ada Verdi')).toBeInTheDocument();
    expect(within(header).getByText(/Italia/)).toBeInTheDocument();
    expect(within(header).getByText(/^0 anni$/)).toBeInTheDocument();
    expect(within(header).getByText(/^\d{2}\/\d{2}\/\d{4}$/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Finanze' }));
    expect(await screen.findByRole('heading', { name: 'Finanze' })).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('the menu has the required entries, marks unbuilt features as planned, and has no GOD MODE control', async () => {
    await freshLife();
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Apri il menu' }));
    const menu = await screen.findByRole('dialog', { name: 'Menu' });
    for (const name of ['Nuova vita', 'Continua vita', 'Gestione salvataggi', 'Cronologia delle vite', 'Importazione/esportazione', 'Informazioni sul gioco']) {
      expect(within(menu).getByText(name)).toBeInTheDocument();
    }
    expect(within(menu).getByRole('combobox', { name: 'Lingua' })).toBeInTheDocument();
    expect(within(menu).getByRole('group', { name: 'Tema' })).toBeInTheDocument();
    // not built yet: shown as planned, and not operable
    for (const name of ['Albero genealogico', 'Accessibilità', 'Audio e notifiche']) {
      const row = within(menu).getByRole('button', { name: new RegExp(name) });
      expect(row).toHaveAttribute('aria-disabled', 'true'); // focusable, described, and does nothing
      expect(row).toHaveAccessibleDescription(/Non ancora disponibile/);
    }
    expect(within(menu).getAllByText('Pianificata')).toHaveLength(3);
    expect(menu.textContent).not.toMatch(/god mode/i);
    // a life is open, so "continue" explains why it is unavailable
    expect(within(menu).getByRole('button', { name: /Continua vita/ })).toHaveAttribute('aria-disabled', 'true');
    expect(within(menu).getByText('Una vita è già aperta.')).toBeInTheDocument();
  });

  it('"Nuova vita" opens the creation screen and the open life stays open and saved; "Continua vita" explains why it is unavailable', async () => {
    const game = await freshLife();
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Apri il menu' }));
    fireEvent.click(await screen.findByRole('button', { name: /Nuova vita/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Rivedi e conferma', hidden: true })).toBeInTheDocument()); // hidden: true — see the note on Radix under jsdom below
    expect(useGame.getState().game?.id).toBe(game.id); // the life is still open…
    expect(useGame.getState().saves.some((s) => s.id === game.id)).toBe(true); // …and saved
    // Under jsdom the Radix menu stays mounted after closing (verified by hand and in e2e that it closes in a real
    // browser), so the page behind it is aria-hidden and queried with hidden: true.
    fireEvent.click(screen.getByRole('button', { name: 'Apri il menu' }));
    expect(await screen.findByRole('button', { name: /Continua vita/ })).toHaveAttribute('aria-disabled', 'true');
  });

  it('the yearly button cannot apply two years from two quick clicks', async () => {
    await freshLife();
    render(<App />);
    const button = await screen.findByRole('button', { name: /Avanza di un anno/ });
    const before = useGame.getState().game!.revision;
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(useGame.getState().busy).toBe(false));
    expect(useGame.getState().game!.revision).toBe(before + 1);
  });
});

describe('decision window', () => {
  it('blocks the game: Escape does not dismiss it, advancing is disabled, a choice resolves it and it closes', async () => {
    await freshLife();
    await untilDecision();
    render(<App />);
    const dialog = await screen.findByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chiudi' })).toBeNull();

    const revision = useGame.getState().game!.revision;
    const choices = within(dialog).getAllByRole('button');
    expect(choices.length).toBeGreaterThan(0);
    fireEvent.click(choices[0]!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(useGame.getState().game!.revision).toBe(revision + 1);
    expect(useGame.getState().game!.simulation.status).not.toBe('PAUSED_EVENT');
  });

  it('is restored after a reload: the pending decision is read from the saved state', async () => {
    await freshLife();
    await untilDecision();
    const title = pendingChoices(useGame.getState().game!, simulationContext)!.event.title;
    useGame.setState({ game: null, diary: [], events: [] });
    await useGame.getState().openSave(useGame.getState().saves[0]!.id);
    render(<App />);
    expect(await screen.findByRole('dialog', { name: title })).toBeInTheDocument();
  });
});

describe('profile page', () => {
  it('shows only visible facts of the protagonist, from the state', async () => {
    const game = await freshLife();
    window.history.pushState({}, '', '/profilo');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Ada Verdi' })).toBeInTheDocument();
    expect(screen.getByText('Nato/a il')).toBeInTheDocument();
    expect(screen.getByText('Cittadinanza')).toBeInTheDocument();
    expect(screen.getAllByRole('meter')).toHaveLength(8);
    expect(screen.queryByText(/resilienza|longevità|talent/i)).toBeNull(); // hidden traits stay hidden
    expect(game.protagonist.givenName).toBe('Ada');
  });
});

describe('save list', () => {
  it('follows each commit in place: newest first, one entry per life, always matching the open life', async () => {
    const db = new ProjectLifeDb('save-list');
    const store = createGameStore(db);
    await store.getState().init();
    await store.getState().createLife(inputFor('ui-r2-list-a'));
    const first = store.getState().game!.id;
    await store.getState().createLife(inputFor('ui-r2-list-b'));
    await store.getState().advanceYear();
    const s = store.getState();
    expect(s.saves).toHaveLength(2);
    expect(s.saves[0]!.id).toBe(s.game!.id);
    expect(s.saves[0]!.revision).toBe(s.game!.revision);
    expect(s.saves[1]!.id).toBe(first);
    // and it agrees with what is really stored
    const stored = await listSaves(db);
    expect(stored.map((x) => [x.id, x.revision])).toEqual(s.saves.map((x) => [x.id, x.revision]));
  });
});

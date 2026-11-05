import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { pendingChoices } from '@project-life/engine';
import { SUPPORTED_BIRTH_YEARS } from '@project-life/schemas';
import { NewLife } from './NewLife';
import { simulationContext, useGame } from '../../game/store';
import { newLifeInput } from '../../game/test-inputs';

let seedCounter = 0;
const uniqueSeed = (label: string): string => `nl-${label}-${seedCounter++}`;

async function reset(): Promise<void> {
  useGame.setState({ game: null, events: [], diary: [], diaryHasMore: false, error: null, busy: false });
  await useGame.getState().init();
  await waitFor(() => expect(useGame.getState().busy).toBe(false));
}
const open = (url = '/nuova-vita') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="*" element={<NewLife />} />
      </Routes>
    </MemoryRouter>,
  );
const typeInto = (label: string | RegExp, value: string): void => {
  fireEvent.change(screen.getByLabelText(label, { selector: 'input' }), { target: { value } });
};
const godRadio = (on: boolean): HTMLElement => screen.getByRole('radio', { name: new RegExp(`GOD MODE: ${on ? 'ATTIVA' : 'DISATTIVA'}`) });

/** Plays the open life to its end through the store (answering decisions with the first choice). */
async function playToDeath(): Promise<void> {
  for (let i = 0; i < 400 && useGame.getState().game?.protagonist.death === null; i++) {
    const g = useGame.getState().game!;
    if (g.simulation.status === 'PAUSED_EVENT') await useGame.getState().resolveEvent(pendingChoices(g, simulationContext)!.choices[0]!.id);
    else await useGame.getState().advanceYear();
  }
  expect(useGame.getState().game?.protagonist.death).not.toBeNull();
}

beforeEach(async () => {
  localStorage.clear();
  await reset();
});

describe('new life: modes decide what can be chosen', () => {
  it('custom: identity, place and birth date; random: only the name; wealth and family are never offered', () => {
    open();
    expect(screen.getByRole('radio', { name: /Personalizzata/ })).toBeChecked();
    expect(screen.getByLabelText('Paese di nascita')).toBeInTheDocument();
    expect(screen.getByLabelText('Città di nascita')).toBeDisabled(); // needs a country first
    expect(screen.getByLabelText(/Data di nascita/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /Casuale/ }));
    expect(screen.queryByLabelText('Paese di nascita')).toBeNull();
    expect(screen.queryByLabelText(/Data di nascita/)).toBeNull();
    expect(screen.getByLabelText('Nome', { selector: 'input' })).toBeInTheDocument();

    // never a way to choose money or the family: only an explanation
    for (const role of ['textbox', 'spinbutton', 'combobox', 'slider', 'checkbox'] as const) {
      expect(screen.queryByRole(role, { name: /patrimonio|ricchezza|denaro|condizione familiare|classe sociale/i })).toBeNull();
    }
    expect(screen.getByText(/La decide il caso alla nascita/)).toBeInTheDocument();
  });

  it('picking a country offers its cities', () => {
    open();
    fireEvent.change(screen.getByLabelText('Paese di nascita'), { target: { value: 'IT' } });
    const city = screen.getByLabelText('Città di nascita');
    expect(city).toBeEnabled();
    expect(within(city).getAllByRole('option').length).toBeGreaterThan(1);
  });

  it('dynasty continuation is unavailable, with the reason, while no life has ended', () => {
    open();
    expect(screen.getByRole('radio', { name: /Continuazione dinastica/ })).toBeDisabled();
    expect(screen.getByText(/Nessuna vita conclusa/)).toBeInTheDocument();
  });

  it('the birth date must be inside the supported window: the engine refuses anything else and says so', async () => {
    open();
    typeInto('Nome', 'Ada');
    typeInto('Cognome', 'Verdi');
    fireEvent.change(screen.getByLabelText(/Data di nascita/), { target: { value: `${SUPPORTED_BIRTH_YEARS.min - 10}-05-05` } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/birth year must be between/);
    expect(screen.getByRole('button', { name: 'Rivedi e conferma' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Data di nascita/), { target: { value: `${SUPPORTED_BIRTH_YEARS.min}-05-05` } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Rivedi e conferma' })).toBeEnabled());
  });
});

describe('new life: GOD MODE is chosen here, confirmed explicitly, and then locked', () => {
  it('defaults to OFF, explains the lock, and shows the customisation only when ON', () => {
    open();
    expect(godRadio(false)).toBeChecked();
    expect(godRadio(true)).not.toBeChecked();
    expect(screen.getByText(/Dopo la nascita resta bloccata per tutta la vita/)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Statistiche visibili' })).toBeNull();
    fireEvent.click(godRadio(true));
    expect(screen.getByRole('group', { name: 'Statistiche visibili' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Talenti/ })).toBeInTheDocument();
    fireEvent.click(godRadio(false));
    expect(screen.queryByRole('group', { name: 'Statistiche visibili' })).toBeNull();
  });

  it('needs a name, then asks for a definitive confirmation that states the choice; "Indietro" changes nothing', async () => {
    open();
    const review = screen.getByRole('button', { name: 'Rivedi e conferma' });
    expect(review).toBeDisabled();
    typeInto('Nome', 'Ada');
    typeInto('Cognome', 'Verdi');
    typeInto('Seed', uniqueSeed('review'));
    await waitFor(() => expect(review).toBeEnabled());
    fireEvent.click(review);
    const dialog = await screen.findByRole('dialog', { name: 'Conferma definitiva' });
    expect(within(dialog).getByTestId('confirm-god')).toHaveTextContent('GOD MODE: DISATTIVA');
    expect(within(dialog).getByText(/Resterà così per tutta questa vita/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Indietro' }));
    expect(useGame.getState().game).toBeNull(); // nothing was created
    // the choice can still be changed before the final confirmation
    fireEvent.click(godRadio(true));
    fireEvent.click(screen.getByRole('button', { name: 'Rivedi e conferma' }));
    expect(within(await screen.findByRole('dialog', { name: 'Conferma definitiva' })).getByTestId('confirm-god')).toHaveTextContent('GOD MODE: ATTIVA');
  });

  it('confirming with GOD MODE OFF creates a locked, unedited life', async () => {
    open();
    typeInto('Nome', 'Ada');
    typeInto('Cognome', 'Verdi');
    typeInto('Seed', uniqueSeed('off'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Rivedi e conferma' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Rivedi e conferma' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Conferma e nasci' }));
    await waitFor(() => expect(useGame.getState().game).not.toBeNull());
    const g = useGame.getState().game!;
    expect(g.config).toEqual({ godModeEnabled: false, godModeOrigin: 'chosen' });
    expect(g.godMode.edits).toBe(0);
    expect(await useGame.getState().godEdit(g.protagonist.id, { givenName: 'Nope' })).toBe(false);
  });

  it('confirming with GOD MODE ON applies the customisation at birth, shown in a preview first', async () => {
    open();
    typeInto('Nome', 'Ada');
    typeInto('Cognome', 'Verdi');
    typeInto('Seed', uniqueSeed('on'));
    fireEvent.click(godRadio(true));
    await waitFor(() => expect(screen.getByLabelText('Aspetto')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Aspetto'), { target: { value: '93' } });
    fireEvent.click(screen.getByLabelText('Orecchio musicale'));
    const preview = screen.getByRole('region', { name: 'Anteprima' });
    expect(preview).toHaveTextContent(/Aspetto: \d+ → 93/);
    expect(preview).toHaveTextContent(/Talenti/);
    expect(useGame.getState().game).toBeNull(); // still only a preview

    await waitFor(() => expect(screen.getByRole('button', { name: 'Rivedi e conferma' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Rivedi e conferma' }));
    const dialog = await screen.findByRole('dialog', { name: 'Conferma definitiva' });
    expect(within(dialog).getByTestId('confirm-god')).toHaveTextContent('GOD MODE: ATTIVA');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Conferma e nasci' }));
    await waitFor(() => expect(useGame.getState().game).not.toBeNull());
    const g = useGame.getState().game!;
    expect(g.config).toEqual({ godModeEnabled: true, godModeOrigin: 'chosen' });
    expect(g.protagonist.stats.appearance).toBe(93);
    expect(g.protagonist.talents).toContain('musical');
    expect(g.revision).toBe(0); // one atomic creation
    expect(g.godMode.edits).toBe(1);
  });
});

describe('new life: dynasty continuation asks the choice again', () => {
  it('is not inherited from the previous life, and the chronicle records what the previous life used', { timeout: 120_000 }, async () => {
    await useGame.getState().createLife(newLifeInput({ seed: uniqueSeed('dyn'), godModeEnabled: true }));
    await playToDeath();
    const deadId = useGame.getState().game!.id;

    open(`/nuova-vita?mode=dynasty&from=${deadId}`);
    expect(screen.getByRole('radio', { name: /Continuazione dinastica/ })).toBeChecked();
    expect(godRadio(false)).toBeChecked(); // the previous life had GOD MODE; this one starts at the default
    expect(godRadio(true)).not.toBeChecked();
    fireEvent.click(godRadio(true)); // …and can be chosen again, explicitly
    typeInto(/Nome del neonato/, 'Nova');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Rivedi e conferma' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Rivedi e conferma' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Conferma e nasci' }));
    await waitFor(() => expect(useGame.getState().game?.id).not.toBe(deadId));
    const g = useGame.getState().game!;
    expect(g.dynasty.generation).toBe(2);
    expect(g.config.godModeEnabled).toBe(true);
    expect(g.godMode).toEqual({ edits: 0, log: [] });
    expect(g.dynasty.chronicle.at(-1)?.godMode).toBe(true);
  });

  it('a new life of the dynasty without GOD MODE is not editable even though the ancestor was', { timeout: 120_000 }, async () => {
    await useGame.getState().createLife(newLifeInput({ seed: uniqueSeed('dyn2'), godModeEnabled: true }));
    await playToDeath();
    const deadId = useGame.getState().game!.id;
    open(`/nuova-vita?mode=dynasty&from=${deadId}`);
    typeInto(/Nome del neonato/, 'Nova');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Rivedi e conferma' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Rivedi e conferma' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Conferma e nasci' }));
    await waitFor(() => expect(useGame.getState().game?.id).not.toBe(deadId));
    const g = useGame.getState().game!;
    expect(g.config.godModeEnabled).toBe(false);
    expect(await useGame.getState().godEdit(g.protagonist.id, { givenName: 'Nope' })).toBe(false);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { Globe } from 'lucide-react';
import { AVAILABILITY_REASONS, AVAILABILITY_REQUIREMENTS, certainCost, pendingChoices } from '@project-life/engine';
import type { ActionAvailability, GameState } from '@project-life/schemas';
import { App } from '../../App';
import { simulationContext, useGame } from '../../game/store';
import { newLifeInput } from '../../game/test-inputs';
import { t } from '../../i18n/it';
import { LifeCategoryDivider, LifeList, LifeListItem } from './LifeList';
import { LifeDecisionButton } from './LifeDecisionButton';
import { LifeDisabledAction } from './LifeDisabledAction';
import { LifeProgressIndicator } from './LifeProgressIndicator';

const inRouter = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);
const blocked: ActionAvailability = { available: false, reasons: ['decision_pending'], requirements: ['answer_pending_decision'] };

let seed = 0;
async function freshLife(over: Parameters<typeof newLifeInput>[0] = {}): Promise<GameState> {
  useGame.setState({ game: null, events: [], diary: [], diaryHasMore: false, error: null, busy: false });
  await useGame.getState().init();
  await useGame.getState().createLife(newLifeInput({ seed: `lists-${seed++}`, ...over }));
  await waitFor(() => expect(useGame.getState().busy).toBe(false));
  return useGame.getState().game!;
}

beforeEach(() => localStorage.clear());

describe('every code the engine can return has a sentence in the interface', () => {
  it('reasons and requirements are all translated (no raw codes ever shown)', () => {
    for (const c of AVAILABILITY_REASONS) expect(t.availability.reason[c], c).toMatch(/\S/);
    for (const c of AVAILABILITY_REQUIREMENTS) expect(t.availability.need[c], c).toMatch(/\S/);
  });
});

describe('LifeListItem', () => {
  it('a row can be information, a link to a subsection or a direct action', () => {
    const pick = vi.fn();
    inRouter(
      <LifeList label="demo">
        <LifeListItem icon={Globe} title="Solo informazione" description="nessuna azione" value="42" />
        <LifeListItem icon={Globe} title="Sottosezione" to="/altrove" />
        <LifeListItem icon={Globe} title="Azione diretta" onSelect={pick} />
      </LifeList>,
    );
    const list = screen.getByRole('list', { name: 'demo' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(within(list).getByRole('link', { name: 'Sottosezione' })).toHaveAttribute('href', '/altrove');
    fireEvent.click(within(list).getByRole('button', { name: 'Azione diretta' }));
    expect(pick).toHaveBeenCalledTimes(1);
    expect(within(list).queryByRole('button', { name: /Solo informazione/ })).toBeNull();
    expect(within(list).queryByRole('link', { name: /Solo informazione/ })).toBeNull();
    expect(within(list).getByText('42')).toBeInTheDocument();
  });

  it('a row can carry a stat bar and a progress indicator, both with real roles and values', () => {
    inRouter(
      <LifeList>
        <LifeListItem title="Giulia" stat={{ key: 'affection', label: 'Affetto', value: 72 }} progress={{ label: 'Rendimento', value: 40, valueText: '40/100' }} />
      </LifeList>,
    );
    expect(screen.getByRole('meter', { name: 'Affetto' })).toHaveAttribute('aria-valuenow', '72');
    expect(screen.getByRole('progressbar', { name: 'Rendimento' })).toHaveAttribute('aria-valuetext', '40/100');
  });

  it('a blocked row shows why and what is needed, cannot be activated, and can still be reached with the keyboard', () => {
    const pick = vi.fn();
    inRouter(
      <LifeList>
        <LifeListItem title="Avanza" onSelect={pick} availability={blocked} />
      </LifeList>,
    );
    const button = screen.getByRole('button', { name: /Avanza/ });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled(); // focusable: the explanation must be reachable
    expect(button).toHaveAccessibleDescription(/Una decisione ti attende\./);
    expect(button).toHaveAccessibleDescription(/Rispondi alla decisione in sospeso\./);
    fireEvent.click(button);
    expect(pick).not.toHaveBeenCalled();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('an available verdict leaves the row fully operable', () => {
    const pick = vi.fn();
    inRouter(
      <LifeList>
        <LifeListItem title="Avanza" onSelect={pick} availability={{ available: true, reasons: [], requirements: [] }} />
      </LifeList>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Avanza' }));
    expect(pick).toHaveBeenCalled();
  });

  it('a planned row is labelled as planned and does nothing', () => {
    const pick = vi.fn();
    inRouter(
      <LifeList>
        <LifeListItem title="Albero genealogico" planned onSelect={pick} to="/x" />
      </LifeList>,
    );
    const button = screen.getByRole('button', { name: /Albero genealogico/ });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Pianificata')).toBeInTheDocument();
    fireEvent.click(button);
    expect(pick).not.toHaveBeenCalled();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('the contextual menu opens from the keyboard, runs available actions and refuses blocked ones with their reason', async () => {
    const open = vi.fn();
    const edit = vi.fn();
    inRouter(
      <LifeList>
        <LifeListItem
          title="Marco"
          menuLabel="Azioni per Marco"
          menu={[
            { id: 'open', label: 'Apri la scheda', onSelect: open },
            { id: 'edit', label: 'Modifica', onSelect: edit, availability: { available: false, reasons: ['god_mode_not_chosen'], requirements: ['choose_god_mode_at_creation'] } },
          ]}
        />
      </LifeList>,
    );
    const trigger = screen.getByRole('button', { name: 'Azioni per Marco' });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    const menu = await screen.findByRole('menu');
    const editItem = within(menu).getByRole('menuitem', { name: /Modifica/ });
    expect(editItem).toHaveAttribute('aria-disabled', 'true');
    expect(within(editItem).getByText('Questa vita è stata creata senza GOD MODE.')).toBeInTheDocument();
    fireEvent.click(editItem);
    expect(edit).not.toHaveBeenCalled();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Apri la scheda' }));
    expect(open).toHaveBeenCalledTimes(1);
  });
});

describe('small components', () => {
  it('a category divider is a heading with its count', () => {
    render(<LifeCategoryDivider title="Genitori" count={2} />);
    expect(screen.getByRole('heading', { level: 3, name: /Genitori/ })).toHaveTextContent('2');
  });

  it('the progress indicator clamps to its range and always has text, not only colour', () => {
    const { rerender } = render(<LifeProgressIndicator label="Studio" value={150} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText('100 su 100')).toBeInTheDocument();
    rerender(<LifeProgressIndicator label="Studio" value={-5} max={10} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('a disabled action explains itself and does not react', () => {
    render(<LifeDisabledAction label="Avanza" availability={blocked} />);
    const b = screen.getByRole('button', { name: /Avanza/ });
    expect(b).toHaveAttribute('aria-disabled', 'true');
    expect(b).toHaveAccessibleDescription(/Una decisione ti attende/);
  });

  it('a decision option shows a cost only when given one, and becomes a blocked action when the engine says so', () => {
    const choose = vi.fn();
    const { rerender } = render(<LifeDecisionButton label="Compra" cost="1.200 €" onChoose={choose} />);
    expect(screen.getByText('Costo certo: da 1.200 €')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Compra/ }));
    expect(choose).toHaveBeenCalledTimes(1);
    rerender(<LifeDecisionButton label="Compra" onChoose={choose} />);
    expect(screen.queryByText(/Costo certo/)).toBeNull();
    rerender(<LifeDecisionButton label="Compra" availability={blocked} onChoose={choose} />);
    fireEvent.click(screen.getByRole('button', { name: /Compra/ }));
    expect(choose).toHaveBeenCalledTimes(1); // the blocked one did nothing
  });
});

describe('decision window', () => {
  it('tells the kind of event and the person involved, from the state and the content', async () => {
    const game = await freshLife();
    // a real pending decision, re-pointed at an event that involves a person: the parent
    const event = simulationContext.content.events.find((e) => e.actor === 'parent');
    expect(event, 'content has an event that involves a parent').toBeDefined();
    const parent = game.npcs[game.protagonist.parentIds[0]!]!;
    const crafted: GameState = { ...game, simulation: { ...game.simulation, status: 'PAUSED_EVENT', pending: { eventId: event!.id, instanceId: 'x', actorId: parent.id, offers: [] } } };
    useGame.setState({ game: crafted });
    render(<App />);
    const dialog = await screen.findByRole('dialog');
    const chip = within(dialog).getByText(t.eventCategory[event!.category]!);
    expect(chip).toBeInTheDocument();
    const actor = within(dialog).getByTestId('event-actor');
    expect(actor).toHaveTextContent(`${parent.givenName} ${parent.familyName}`);
    expect(actor).toHaveTextContent('Genitore');
    expect(within(dialog).getByText(/Gli esiti non sono noti in anticipo/)).toBeInTheDocument();
  });

  it('shows no actor row when nobody is involved, and shows a certain cost only where the content guarantees one', async () => {
    const game = await freshLife();
    const adult: GameState = structuredClone(game);
    adult.world.currentDate = { ...adult.world.currentDate, year: adult.world.currentDate.year + 30 };
    const withCost = simulationContext.content.events.find((e) => e.actor === 'none' && e.choices.some((c) => certainCost(adult, simulationContext, c) !== null));
    expect(withCost, 'the shipped content has choices with a guaranteed cost').toBeDefined();
    if (!withCost) return;
    adult.simulation = { ...adult.simulation, status: 'PAUSED_EVENT', pending: { eventId: withCost.id, instanceId: 'x', actorId: null, offers: [] } };
    useGame.setState({ game: adult });
    render(<App />);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByTestId('event-actor')).toBeNull();
    const view = pendingChoices(adult, simulationContext)!;
    const costly = view.choices.filter((c) => certainCost(adult, simulationContext, c) !== null).length;
    expect(within(dialog).queryAllByText(/Costo certo/)).toHaveLength(costly);
    expect(costly).toBeGreaterThan(0);
  });
});

describe('relationships as lists', () => {

  it('groups the family into parents, siblings and relatives, each row opening its sheet', async () => {
    const game = await freshLife();
    window.history.pushState({}, '', '/relazioni');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Famiglia' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /Genitori/ })).toBeInTheDocument();
    const parents = screen.getByRole('list', { name: 'Genitori' });
    const hrefs = within(parents).getAllByRole('link').map((l) => l.getAttribute('href'));
    expect([...hrefs].sort()).toEqual(game.protagonist.parentIds.map((id) => `/relazioni/${encodeURIComponent(id)}`).sort());
    expect(within(parents).getAllByRole('meter').length).toBeGreaterThan(0); // how they feel about you, as a real meter
  });

  it('the sheet shows both directions of the relationship and the memories; without GOD MODE, editing is a blocked action with its reason', async () => {
    const game = await freshLife();
    const id = game.protagonist.parentIds[0]!;
    window.history.pushState({}, '', `/relazioni/${encodeURIComponent(id)}`);
    render(<App />);
    const npc = game.npcs[id]!;
    expect(await screen.findByRole('heading', { level: 1, name: `${npc.givenName} ${npc.familyName}` })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: `Cosa prova ${npc.givenName} per te` })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cosa provi tu' })).toBeInTheDocument();
    expect(screen.getAllByRole('meter')).toHaveLength(14); // 7 dimensions × 2 directions
    expect(screen.getByRole('heading', { name: 'Ricordi' })).toBeInTheDocument();
    const edit = screen.getByRole('button', { name: /Modifica personaggio/ });
    expect(edit).toHaveAttribute('aria-disabled', 'true');
    expect(edit).toHaveAccessibleDescription('Questa vita è stata creata senza GOD MODE. Per sbloccarla: GOD MODE si sceglie solo alla creazione di una vita.');
  });

  it('with GOD MODE chosen at creation, the same sheet offers the editor', async () => {
    const game = await freshLife({ godModeEnabled: true });
    const id = game.protagonist.parentIds[0]!;
    window.history.pushState({}, '', `/relazioni/${encodeURIComponent(id)}?modifica=1`);
    render(<App />);
    expect(await screen.findByRole('form', { name: /Modifica:/ })).toBeInTheDocument();
  });
});

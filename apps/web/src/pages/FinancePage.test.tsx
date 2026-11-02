import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { pendingChoices, simulate } from '@project-life/engine';
import { createGame } from '@project-life/engine';
import type { GameState } from '@project-life/schemas';
import { simulationContext, useGame } from '../game/store';
import { FinancePage } from './FinancePage';

const PREFER = ['consulting', 'software', 'workshop', 'retail', 'invest_half', 'buy'];

/** Plays seeded lives (preferring investing, buying and founding) until one holds a home and an investment portfolio or a business. */
function richLife(): GameState {
  for (let i = 0; i < 80; i++) {
    const made = createGame({ seed: `ui-${i}`, givenName: 'Ada', familyName: 'Verdi', countryCode: 'IT', startDate: { year: 2025, month: 3, day: 14 } }, simulationContext);
    if (!made.ok) throw new Error(made.error.message);
    let s = made.state;
    for (let n = 0; n < 400 && !s.protagonist.death; n++) {
      let r;
      if (s.simulation.status === 'PAUSED_EVENT') {
        const choices = pendingChoices(s, simulationContext)!.choices;
        const pick = choices.find((c) => PREFER.includes(c.id)) ?? choices.find((c) => c.id.startsWith('accept:')) ?? choices[0]!;
        r = simulate(s, { type: 'RESOLVE_EVENT', commandId: `r${n}`, expectedRevision: s.revision, choiceId: pick.id }, simulationContext);
      } else r = simulate(s, { type: 'ADVANCE_YEAR', commandId: `r${n}`, expectedRevision: s.revision }, simulationContext);
      if (!r.ok) throw new Error(r.error.message);
      s = r.state;
      if (Object.keys(s.properties).length > 0 && Object.values(s.businesses).some((b) => b.status === 'active') && !s.protagonist.death) return s;
    }
  }
  throw new Error('no life reached a home and a business');
}

describe('FinancePage', () => {
  it('shows balances, homes, businesses and the economy from the canonical state', { timeout: 60_000 }, () => {
    const game = richLife();
    useGame.setState({ game, ready: true });
    render(<FinancePage />);
    expect(screen.getByRole('heading', { name: 'Saldi' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Immobili' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Attività' })).toBeInTheDocument();
    const biz = Object.values(game.businesses).find((b) => b.status === 'active')!;
    expect(screen.getByText(biz.name, { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Condizioni economiche/ })).toBeInTheDocument();
    expect(screen.getAllByText(/Mutuo residuo/).length).toBeGreaterThan(0);
  });
});

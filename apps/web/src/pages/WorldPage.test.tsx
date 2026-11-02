import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createGame } from '@project-life/engine';
import { simulationContext, useGame } from '../game/store';
import { applyLocale } from '../i18n/locale';
import { t } from '../i18n/it';
import { SocietyPage } from './SocietyPage';
import { WorldPage } from './WorldPage';

function life() {
  const r = createGame({ seed: 'world-ui', givenName: 'Ada', familyName: 'Verdi', countryCode: 'DE', startDate: { year: 2025, month: 3, day: 14 } }, simulationContext);
  if (!r.ok) throw new Error(r.error.message);
  return r.state;
}

describe('world and society pages', () => {
  it('show your country and the biggest ones with their government and economy, and search finds any of the 252', () => {
    applyLocale('it');
    useGame.setState({ game: life(), ready: true });
    render(<WorldPage />);
    expect(screen.getByRole('heading', { name: 'Mondo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Germania/ })).toBeInTheDocument(); // yours
    expect(screen.getByRole('heading', { name: /India/ })).toBeInTheDocument(); // among the biggest
    expect(screen.queryByRole('heading', { name: /Islanda/ })).toBeNull();
    expect(screen.getByText(/dove vivi/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Cerca un paese/), { target: { value: 'isl' } });
    expect(screen.getByRole('heading', { name: /Islanda/ })).toBeInTheDocument();
    expect(screen.getByText(/di 252 paesi/)).toBeInTheDocument();
  });

  it('shows residence, politics, justice and fame, and says that an accusation is not guilt', () => {
    applyLocale('it');
    const game = life();
    game.society.legal = { offense: 'accusation', severity: 1, stage: 'charged', evidence: 20, sinceYear: 2030, lawyer: false, plea: false, releaseYear: null };
    useGame.setState({ game, ready: true });
    render(<SocietyPage />);
    expect(screen.getByRole('heading', { name: 'Residenza e cittadinanza' })).toBeInTheDocument();
    expect(screen.getByText('Rinviato/a a giudizio')).toBeInTheDocument();
    expect(screen.getByText(/non significa essere colpevoli/)).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Notorietà' })).toBeInTheDocument();
  });

  it('switches the interface language, including right-to-left, and falls back to Italian for the rest', () => {
    applyLocale('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    expect(t.nav.life).toBe('الحياة');
    expect(t.world.search).toBe('Cerca un paese'); // not translated: documented fallback to Italian
    applyLocale('ja');
    expect(document.documentElement.dir).toBe('ltr');
    expect(t.nav.finance).toBe('財務');
    applyLocale('it');
    expect(t.nav.life).toBe('Vita');
  });
});

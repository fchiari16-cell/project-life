import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App shell', () => {
  it('renders the five primary navigation sections and the new-life form', async () => {
    render(<App />);
    const nav = await screen.findByRole('navigation', { name: /navigazione principale/i });
    for (const name of ['Vita', 'Relazioni', 'Carriera', 'Finanze', 'Altro']) {
      expect(nav).toHaveTextContent(name);
    }
    expect(await screen.findByRole('button', { name: 'Rivedi e conferma' })).toBeInTheDocument();
  });
});

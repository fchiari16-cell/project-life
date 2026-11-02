import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProjectLifeDb } from '@project-life/persistence';
import { MemoryCloudAdapter, narrate, syncOne } from '@project-life/services';
import { GodEditor } from '../components/GodEditor';
import { createGameStore, useGame } from './store';

let n = 0;
const fresh = () => {
  const db = new ProjectLifeDb(`web-svc-${n++}`);
  return { db, store: createGameStore(db) };
};
const input = { givenName: 'Ada', familyName: 'Verdi', seed: 'abc', countryCode: 'IT' };

beforeEach(() => localStorage.clear());

describe('GOD MODE through the store', () => {
  it('toggles, edits, persists across a restart and logs; a refused edit saves nothing', async () => {
    const { db, store } = fresh();
    await store.getState().init();
    await store.getState().createLife(input);
    const id = store.getState().game!.protagonist.id;

    // off by default: the edit is refused and reported, nothing changes
    expect(await store.getState().godEdit(id, { givenName: 'Nope' })).toBe(false);
    expect(store.getState().error).toMatch(/INVALID_TRANSITION/);
    expect(store.getState().game!.protagonist.givenName).toBe('Ada');
    store.getState().clearError();

    await store.getState().godToggle(true);
    expect(await store.getState().godEdit(id, { givenName: 'Nova', stats: { health: 88 } })).toBe(true);
    const g = store.getState().game!;
    expect([g.protagonist.givenName, g.protagonist.stats.health]).toEqual(['Nova', 88]);
    expect(g.godMode.log.map((l) => l.action)).toEqual(['ENABLED', 'EDITED']);

    const restarted = createGameStore(db);
    await restarted.getState().init();
    expect(restarted.getState().game).toEqual(g);

    await store.getState().godToggle(false);
    expect(store.getState().game!.protagonist.givenName).toBe('Nova'); // switching off keeps the edits
  });
});

describe('GodEditor (preview → confirm)', () => {
  it('shows the exact changes before saving, saves nothing until confirmed, then applies them', async () => {
    await useGame.getState().init();
    await useGame.getState().createLife(input);
    await useGame.getState().godToggle(true);
    const id = useGame.getState().game!.protagonist.id;
    const revision = useGame.getState().game!.revision;
    const onClose = vi.fn();
    render(<GodEditor targetId={id} onClose={onClose} />);

    expect(screen.getByRole('button', { name: 'Conferma e salva' })).toBeDisabled();
    expect(screen.getByText('Nessuna modifica rispetto a ora.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Nova' } });
    fireEvent.change(screen.getByLabelText('Salute'), { target: { value: '12' } });
    const preview = screen.getByRole('region', { name: 'Anteprima' });
    expect(preview).toHaveTextContent(/Nome: Ada → Nova/);
    expect(preview).toHaveTextContent(/Salute: \d+ → 12/);
    expect(useGame.getState().game!.revision).toBe(revision); // previewing writes nothing

    fireEvent.click(screen.getByLabelText('Orecchio musicale'));
    fireEvent.click(screen.getByRole('button', { name: 'Conferma e salva' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const g = useGame.getState().game!;
    expect(g.protagonist.givenName).toBe('Nova');
    expect(g.protagonist.stats.health).toBe(12);
    expect(g.protagonist.talents).toContain('musical');
    expect(g.revision).toBe(revision + 1);
  });

  it('cancel discards the draft', async () => {
    await useGame.getState().init();
    await useGame.getState().createLife(input);
    await useGame.getState().godToggle(true);
    const g0 = useGame.getState().game!;
    const onClose = vi.fn();
    render(<GodEditor targetId={g0.protagonist.id} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Zed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(onClose).toHaveBeenCalled();
    expect(useGame.getState().game).toEqual(g0);
  });
});

describe('backup through the store', () => {
  it('exports everything, then restores into a clean database', async () => {
    const a = fresh();
    await a.store.getState().init();
    await a.store.getState().createLife(input);
    await a.store.getState().createLife({ ...input, seed: 'other', givenName: 'Bea' });
    const text = await a.store.getState().exportAll();

    const b = fresh();
    await b.store.getState().init();
    const plan = await b.store.getState().planBackup(text);
    expect(plan.map((p) => p.status)).toEqual(['NEW', 'NEW']);
    expect(await b.store.getState().restoreBackupText(text, {})).toMatch(/2 aggiunte/);
    expect(b.store.getState().saves).toHaveLength(2);
    expect((await b.store.getState().checkIntegrity()).ok).toBe(true);
  });
});

describe('cloud sync: diverged devices keep both versions', () => {
  it('conflict → remote kept as a copy → explicit decision', async () => {
    const cloud = new MemoryCloudAdapter();
    const device1 = fresh();
    await device1.store.getState().init();
    await device1.store.getState().createLife(input);
    const rec1 = (await device1.store.getState().cloudRecord())!;
    expect(await syncOne(cloud, rec1, rec1.id)).toEqual({ status: 'PUSHED' });

    // device 2 downloads the life, then both devices play on separately
    const device2 = fresh();
    await device2.store.getState().init();
    await device2.store.getState().adoptRemote(cloud.rows.get(rec1.id)!.payload, false);
    await device2.store.getState().openSave(rec1.id);
    await device1.store.getState().advanceYear();
    await device2.store.getState().godToggle(true);

    expect(await syncOne(cloud, (await device1.store.getState().cloudRecord())!, rec1.id)).toEqual({ status: 'PUSHED' });
    const local2 = (await device2.store.getState().cloudRecord())!;
    const outcome = await syncOne(cloud, local2, rec1.id);
    expect(outcome.status).toBe('CONFLICT');
    if (outcome.status !== 'CONFLICT') return;

    // the caller keeps the cloud version as a local copy before anything is decided
    await device2.store.getState().adoptRemote(outcome.remote.payload, true);
    expect(device2.store.getState().saves).toHaveLength(2);
    expect(cloud.rows.get(rec1.id)!.checksum).toBe(outcome.remote.checksum); // cloud untouched

    expect(await syncOne(cloud, local2, rec1.id, 'use_local')).toEqual({ status: 'PUSHED' });
    expect(cloud.rows.get(rec1.id)!.checksum).toBe(local2.checksum);
  });
});

describe('offline guarantee', () => {
  it('the whole game, GOD MODE, backup and narration work with no network at all, and never touch it', async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new TypeError('offline')));
    vi.stubGlobal('fetch', fetchSpy);
    try {
      const { store } = fresh();
      await store.getState().init();
      await store.getState().createLife(input);
      await store.getState().advanceYear();
      await store.getState().godToggle(true);
      await store.getState().godEdit(store.getState().game!.protagonist.id, { traits: { empathy: 77 } });
      const text = await store.getState().exportAll();
      await store.getState().restoreBackupText(text, {});
      expect(await narrate(null, { locale: 'it', kind: 'X', summary: 'Una frase di prova.' })).toEqual({ text: 'Una frase di prova.', source: 'template' });
      expect(store.getState().error).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

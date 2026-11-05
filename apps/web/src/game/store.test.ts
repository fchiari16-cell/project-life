import { beforeEach, describe, expect, it } from 'vitest';
import { pendingChoices } from '@project-life/engine';
import { ProjectLifeDb } from '@project-life/persistence';
import { createGameStore, simulationContext } from './store';
import { dynastyInput, newLifeInput } from './test-inputs';

let n = 0;
const fresh = () => {
  const db = new ProjectLifeDb(`web-test-${n++}`);
  return { db, store: createGameStore(db) };
};
const input = newLifeInput();

beforeEach(() => localStorage.clear());

describe('game store', () => {
  it('creates a life, persists it and lists it', async () => {
    const { store } = fresh();
    await store.getState().init();
    await store.getState().createLife(input);
    const s = store.getState();
    expect(s.game?.protagonist.givenName).toBe('Ada');
    expect(s.game?.location.countryCode).toBe('IT');
    expect(s.saves).toHaveLength(1);
    expect(s.events.map((e) => e.type)).toEqual(['LIFE_CREATED']);
    expect(s.error).toBeNull();
  });

  it('applies one command per click even when clicked twice concurrently', async () => {
    const { store } = fresh();
    await store.getState().init();
    await store.getState().createLife(input);
    await Promise.all([store.getState().advanceYear(), store.getState().advanceYear()]);
    expect(store.getState().game?.revision).toBe(1);
    expect(store.getState().events.some((e) => e.type === 'MONTH_ADVANCED')).toBe(false);
  });

  it('resumes the last life after a restart, including a pending decision', async () => {
    const { db, store } = fresh();
    await store.getState().init();
    await store.getState().createLife(input);
    for (let i = 0; i < 30 && store.getState().game?.simulation.status !== 'PAUSED_EVENT'; i++) {
      const g = store.getState().game!;
      if (g.protagonist.death) break;
      await store.getState().advanceYear();
    }
    const before = store.getState().game;
    const restarted = createGameStore(db);
    await restarted.getState().init();
    expect(restarted.getState().game).toEqual(before);
    expect(restarted.getState().events.map((e) => e.id)).toEqual(store.getState().events.map((e) => e.id));
  });

  it('plays a whole life through the store, persisting every step, and restores the dead life', async () => {
    const { db, store } = fresh();
    await store.getState().init();
    await store.getState().createLife(input);
    for (let i = 0; i < 400 && !store.getState().game?.protagonist.death; i++) {
      const g = store.getState().game!;
      if (g.simulation.status === 'PAUSED_EVENT') {
        await store.getState().resolveEvent(pendingChoices(g, simulationContext)!.choices[0]!.id);
      } else await store.getState().advanceYear();
      expect(store.getState().error).toBeNull();
    }
    const final = store.getState().game!;
    expect(final.protagonist.death).not.toBeNull();
    expect(store.getState().events.at(-1)?.type).toBe('DEATH');

    const restarted = createGameStore(db);
    await restarted.getState().init();
    expect(restarted.getState().game).toEqual(final);
  }, 60_000);

  it('continues the dynasty: a newborn of the next generation, saved next to the previous life', async () => {
    const { db, store } = fresh();
    await store.getState().init();
    await store.getState().createLife(input);
    for (let i = 0; i < 400 && !store.getState().game?.protagonist.death; i++) {
      const g = store.getState().game!;
      if (g.simulation.status === 'PAUSED_EVENT') await store.getState().resolveEvent(pendingChoices(g, simulationContext)!.choices[0]!.id);
      else await store.getState().advanceYear();
    }
    const dead = store.getState().game!;
    await store.getState().continueLife(dynastyInput());
    expect(store.getState().error).toBeNull();
    const born = store.getState().game!;
    expect(born.dynasty).toMatchObject({ id: dead.dynasty.id, generation: 2 });
    expect(born.dynasty.chronicle).toHaveLength(1);
    expect(born.protagonist.death).toBeNull();
    expect(store.getState().saves.map((s) => s.dynasty.generation).sort()).toEqual([1, 2]);

    const restarted = createGameStore(db);
    await restarted.getState().init();
    expect(restarted.getState().game).toEqual(born);
  }, 60_000);

  it('surfaces validation errors instead of throwing', async () => {
    const { store } = fresh();
    await store.getState().init();
    await store.getState().createLife({ ...input, givenName: '  ' });
    expect(store.getState().game).toBeNull();
    expect(store.getState().error).toMatch(/name/i);
  });

  it('deletes a life', async () => {
    const { store } = fresh();
    await store.getState().init();
    await store.getState().createLife(input);
    await store.getState().removeSave(store.getState().game!.id);
    expect(store.getState().game).toBeNull();
    expect(store.getState().saves).toHaveLength(0);
  });
});

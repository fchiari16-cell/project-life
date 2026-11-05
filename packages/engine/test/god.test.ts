import { describe, expect, it } from 'vitest';
import { EngineCommandSchema, SCHEMA_VERSION, SUPPORTED_BIRTH_YEARS, type GameState, type GodPatch } from '@project-life/schemas';
import { ACHIEVEMENT_IDS, canonicalStringify, continueDynasty, createGame, dynastyOptions, migrateSlot, monthlyDeathChance, planGodEdit, simulate, validateState } from '../src/index';
import { autoPlay, ctx, newLife, START } from './helpers';

let n = 0;
const cmd = <T extends object>(c: T) => ({ commandId: `g${n++}`, ...c });
const toggle = (s: GameState, enabled: boolean) => simulate(s, cmd({ type: 'GOD_TOGGLE', expectedRevision: s.revision, enabled }), ctx);
const edit = (s: GameState, targetId: string, patch: unknown) => simulate(s, cmd({ type: 'GOD_EDIT', expectedRevision: s.revision, targetId, patch }), ctx);
const must = (r: ReturnType<typeof simulate>): GameState => {
  if (!r.ok) throw new Error(r.error.message);
  return r.state;
};
const godLife = (seed: string, extra: Parameters<typeof newLife>[1] = {}): GameState => newLife(seed, { godModeEnabled: true, ...extra });
/** Everything except the fixed choice itself, so a GOD life and a normal life can be compared. */
const strip = (s: GameState): string => canonicalStringify({ ...s, revision: 0, config: null, godMode: null, lastCommandId: null });

describe('GOD MODE is chosen when the life is created, and then locked', () => {
  it('is off unless chosen; the choice is stored in the state', () => {
    expect(newLife('god-default').config).toEqual({ godModeEnabled: false, godModeOrigin: 'chosen' });
    expect(godLife('god-on').config).toEqual({ godModeEnabled: true, godModeOrigin: 'chosen' });
    expect(godLife('god-on').godMode).toEqual({ edits: 0, log: [] });
  });

  it('cannot be switched by any command, in either direction, and nothing changes', () => {
    for (const s of [newLife('lock-off'), godLife('lock-on')]) {
      const before = canonicalStringify(s);
      for (const enabled of [true, false]) {
        const r = toggle(s, enabled);
        expect(r.ok).toBe(false);
        expect(!r.ok && r.error.code).toBe('INVALID_TRANSITION');
        expect(!r.ok && r.error.message).toMatch(/created/);
      }
      expect(canonicalStringify(s)).toBe(before);
    }
  });

  it('is not reachable through game actions: playing, deciding and editing never change it', () => {
    for (const startOn of [false, true]) {
      const start = startOn ? godLife('lock-play') : newLife('lock-play');
      const played = autoPlay(start, 'lock', 600).state;
      expect(played.config).toEqual(start.config);
    }
    const s = godLife('lock-edit');
    const edited = must(edit(s, s.protagonist.id, { givenName: 'Nova' }));
    expect(edited.config).toEqual(s.config);
  });

  it('no command or GOD MODE patch can carry the choice', () => {
    const s = godLife('lock-schema');
    for (const patch of [{ godModeEnabled: false }, { config: { godModeEnabled: false } }, { godMode: { edits: 0, log: [] } }]) {
      expect(EngineCommandSchema.safeParse({ type: 'GOD_EDIT', commandId: 'x', expectedRevision: 0, targetId: s.protagonist.id, patch }).success, JSON.stringify(patch)).toBe(false);
      expect(edit(s, s.protagonist.id, patch).ok).toBe(false);
    }
  });

  it('a state that shows GOD MODE activity but says it was never chosen is invalid (checked on import and migration)', () => {
    const s = godLife('lock-forged');
    const edited = must(edit(s, s.protagonist.id, { givenName: 'Nova' }));
    expect(validateState(edited)).toEqual([]);
    const forged = structuredClone(edited);
    forged.config.godModeEnabled = false;
    expect(validateState(forged).join(' ')).toMatch(/GOD MODE activity recorded in a life created without GOD MODE/);
  });

  it('choosing GOD MODE without using it changes nothing about how a life unfolds', () => {
    const plain = autoPlay(newLife('god-neutral'), 'p', 600).state;
    const withGod = autoPlay(godLife('god-neutral'), 'p', 600).state;
    expect(strip(withGod)).toBe(strip(plain));
    expect(withGod.achievements).toEqual(plain.achievements); // achievements are shared
  });

  it('a life without GOD MODE cannot be edited', () => {
    const s = newLife('god-off');
    const r = edit(s, s.protagonist.id, { givenName: 'X' });
    expect(r).toMatchObject({ ok: false, error: { code: 'INVALID_TRANSITION' } });
  });
});

describe('GOD MODE: editing the protagonist (only when chosen at creation)', () => {
  const patch: GodPatch = {
    givenName: 'Nova',
    familyName: 'Rossi',
    stats: { health: 99, appearance: 80, stress: 5 },
    traits: { ambition: 90, empathy: 10 },
    predispositions: { longevity: 90 },
    talents: ['musical', 'athletic'],
    skills: { creative: 70 },
  };

  it('applies exactly the requested changes, atomically, with a log entry and a checkpoint', () => {
    const s = godLife('god-edit');
    const r = edit(s, s.protagonist.id, patch);
    if (!r.ok) throw new Error(r.error.message);
    const p = r.state.protagonist;
    expect([p.givenName, p.familyName]).toEqual(['Nova', 'Rossi']);
    expect(p.stats).toMatchObject({ health: 99, appearance: 80, stress: 5 });
    expect(p.stats.intelligence).toBe(s.protagonist.stats.intelligence); // untouched
    expect(p.traits).toMatchObject({ ambition: 90, empathy: 10 });
    expect(p.predispositions.longevity).toBe(90);
    expect(p.talents).toEqual(['musical', 'athletic']);
    expect(p.skills.creative).toBe(70);
    expect(r.state.revision).toBe(s.revision + 1);
    expect(r.checkpoint?.reason).toBe('MANUAL');
    expect(r.state.rng).toEqual(s.rng); // the random stream is untouched
    expect(r.state.world).toEqual(s.world); // so are the clock and the world
    expect(r.state.godMode.edits).toBe(1);
    const entry = r.state.godMode.log.at(-1)!;
    expect(entry).toMatchObject({ action: 'EDITED', targetId: s.protagonist.id });
    expect(entry.changes.find((c) => c.path === 'stats.health')).toEqual({ path: 'stats.health', from: String(s.protagonist.stats.health), to: '99' });
    expect(r.events[0]).toMatchObject({ type: 'GOD', payload: { action: 'EDITED' } });
    expect(validateState(r.state)).toEqual([]);
  });

  it('works while a decision is pending', () => {
    let s = godLife('god-pending');
    for (let i = 0; i < 30 && s.simulation.status !== 'PAUSED_EVENT'; i++) s = must(simulate(s, cmd({ type: 'ADVANCE_YEAR', expectedRevision: s.revision }), ctx));
    expect(s.simulation.status).toBe('PAUSED_EVENT');
    const after = must(edit(s, s.protagonist.id, { stats: { fitness: 60 } }));
    expect(after.simulation.status).toBe('PAUSED_EVENT');
    expect(after.simulation.pending).toEqual(s.simulation.pending);
  });

  it('the preview shows the same changes the command then applies, and changes nothing itself', () => {
    const s = godLife('god-preview');
    const before = canonicalStringify(s);
    const plan = planGodEdit(s, s.protagonist.id, patch, ctx.content);
    expect(canonicalStringify(s)).toBe(before);
    expect(plan.ok).toBe(true);
    const r = edit(s, s.protagonist.id, patch);
    expect(r.ok && r.state.godMode.log.at(-1)!.changes).toEqual(plan.changes);
  });

  it('is idempotent: the same command id is ignored, and re-applying the same values is a no-op', () => {
    const s = godLife('god-idem');
    const c = cmd({ type: 'GOD_EDIT', expectedRevision: s.revision, targetId: s.protagonist.id, patch });
    const first = simulate(s, c, ctx);
    if (!first.ok) throw new Error(first.error.message);
    const again = simulate(first.state, c, ctx);
    expect(again.ok && again.duplicate).toBe(true);
    const repeat = edit(first.state, s.protagonist.id, patch);
    expect(repeat.ok && repeat.duplicate).toBe(true);
    expect(repeat.ok && repeat.state.godMode.log).toHaveLength(first.state.godMode.log.length);
    expect(repeat.ok && repeat.state.revision).toBe(first.state.revision);
  });

  it('is rejected as a whole when any part is invalid (no partial edits)', () => {
    const s = godLife('god-atomic');
    const before = canonicalStringify(s);
    for (const bad of [
      { stats: { health: 50 }, talents: ['unknown_talent'] },
      { talents: ['musical', 'musical'] },
      { stats: { health: 101 } },
      { stats: { health: -1 } },
      { traits: { ambition: 1.5 } },
      { givenName: '' },
      { givenName: 'x'.repeat(65) },
      { talents: ['academic', 'athletic', 'musical', 'artistic', 'mathematical', 'linguistic'] },
    ]) {
      expect(edit(s, s.protagonist.id, bad).ok, JSON.stringify(bad)).toBe(false);
    }
    expect(canonicalStringify(s)).toBe(before);
  });

  it('refuses everything outside its scope: money, career, degrees, world, laws, future events, genealogy, history, relationships', () => {
    const s = godLife('god-scope');
    const forbidden = [
      { cash: 1_000_000 }, { finance: { accounts: {} } }, { career: { job: null } }, { job: 'surgeon' }, { qualifications: ['doctorate'] },
      { education: { stage: 'finished' } }, { properties: {} }, { businesses: {} }, { world: { priceIndex: 1 } }, { laws: [] },
      { society: { record: false } }, { eventLog: {} }, { pending: null }, { parentIds: [] }, { birth: { year: 1900, month: 1, day: 1 } },
      { death: null }, { relationships: {} }, { unions: {} }, { flags: {} }, { revision: 0 }, { achievements: { wealthy: 2000 } },
      { stats: { money: 5 } }, { traits: { luck: 99 } },
    ];
    const before = canonicalStringify(s);
    for (const bad of forbidden) {
      expect(EngineCommandSchema.safeParse({ type: 'GOD_EDIT', commandId: 'x', expectedRevision: s.revision, targetId: s.protagonist.id, patch: bad }).success, JSON.stringify(bad)).toBe(false);
      expect(edit(s, s.protagonist.id, bad).ok, JSON.stringify(bad)).toBe(false);
    }
    expect(canonicalStringify(s)).toBe(before);
  });

  it('cannot target strangers or the dead', () => {
    const s = godLife('god-targets');
    expect(edit(s, 'nobody', { givenName: 'X' })).toMatchObject({ ok: false });
    const dead = autoPlay(godLife('god-dead'), 'd', 600).state;
    expect(edit(dead, dead.protagonist.id, { givenName: 'X' }).ok).toBe(false);
  });

  it('edited predispositions really change the simulation (they are not decoration)', () => {
    const lo = monthlyDeathChance(70, 50, 0);
    const mid = monthlyDeathChance(70, 50, 50);
    const hi = monthlyDeathChance(70, 50, 100);
    expect(lo).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(hi);
    expect(lo / hi).toBeCloseTo(1.2 / 0.8, 5);
    expect(ctx.content.talents.find((t) => t.academic)).toBeDefined();
  });
});

describe('GOD MODE: customising the character as part of the creation', () => {
  const patch: GodPatch = { givenName: 'Nova', stats: { appearance: 90 }, talents: ['musical'], traits: { curiosity: 80 } };
  const params = { seed: 'create-god', givenName: 'Ada', familyName: 'Verdi', startDate: START };

  it('is applied atomically at revision 0, recorded in the log, with a GOD event', () => {
    const r = createGame({ ...params, godModeEnabled: true, initialGodPatch: patch }, ctx);
    if (!r.ok) throw new Error(r.error.message);
    const p = r.state.protagonist;
    expect([p.givenName, p.familyName, p.stats.appearance, p.talents, p.traits.curiosity]).toEqual(['Nova', 'Verdi', 90, ['musical'], 80]);
    expect(r.state.revision).toBe(0);
    expect(r.state.godMode.edits).toBe(1);
    expect(r.state.godMode.log).toHaveLength(1);
    expect(r.state.godMode.log[0]).toMatchObject({ revision: 0, action: 'EDITED' });
    expect(r.events.map((e) => e.type)).toEqual(['LIFE_CREATED', 'GOD']);
    expect(validateState(r.state)).toEqual([]);
  });

  it('the character before customising is exactly what the creation screen previews (same seed, same draw)', () => {
    const base = createGame({ ...params, godModeEnabled: true }, ctx);
    const custom = createGame({ ...params, godModeEnabled: true, initialGodPatch: { stats: { appearance: 90 } } }, ctx);
    if (!base.ok || !custom.ok) throw new Error('create failed');
    expect(custom.state.rng).toEqual(base.state.rng); // the customisation never touches the random stream
    expect(custom.state.protagonist.stats.intelligence).toBe(base.state.protagonist.stats.intelligence);
    expect(custom.state.protagonist.traits).toEqual(base.state.protagonist.traits);
    expect(custom.state.npcs).toEqual(base.state.npcs);
    expect(custom.state.family).toEqual(base.state.family);
  });

  it('is refused without GOD MODE, and an invalid customisation refuses the whole creation', () => {
    expect(createGame({ ...params, initialGodPatch: patch }, ctx)).toMatchObject({ ok: false, error: { code: 'INVALID_COMMAND' } });
    expect(createGame({ ...params, godModeEnabled: false, initialGodPatch: patch }, ctx).ok).toBe(false);
    for (const bad of [{ talents: ['nope'] }, { stats: { health: 400 } }, { cash: 5 }, { parentIds: [] }]) {
      expect(createGame({ ...params, godModeEnabled: true, initialGodPatch: bad as GodPatch }, ctx).ok, JSON.stringify(bad)).toBe(false);
    }
  });

  it('never allows free wealth or a different family: those are not part of the patch', () => {
    for (const bad of [{ finance: { accounts: {} } }, { family: { class: 'high' } }, { money: 1_000_000 }]) {
      expect(createGame({ ...params, godModeEnabled: true, initialGodPatch: bad as GodPatch }, ctx).ok, JSON.stringify(bad)).toBe(false);
    }
  });
});

describe('birth date of a new life', () => {
  it('must be inside the supported contemporary window', () => {
    const base = { seed: 'date', givenName: 'A', familyName: 'B' };
    const at = (year: number) => createGame({ ...base, startDate: { year, month: 6, day: 1 } }, ctx);
    expect(at(SUPPORTED_BIRTH_YEARS.min).ok).toBe(true);
    expect(at(SUPPORTED_BIRTH_YEARS.min - 1).ok).toBe(false);
    expect(at(SUPPORTED_BIRTH_YEARS.max + 1).ok).toBe(false);
  });
});

describe('GOD MODE: editing NPCs', () => {
  it('edits names, traits, predispositions and talents but keeps memory, relationships and autonomy; stats and skills do not exist for NPCs', () => {
    let s = godLife('god-npc');
    const id = s.protagonist.parentIds[0]!;
    const before = structuredClone(s.npcs[id]!);
    const rel = structuredClone(s.relationships[`${s.protagonist.id}>${id}`]);
    s = must(edit(s, id, { givenName: 'Edited', traits: { empathy: 99 }, talents: ['leadership'], predispositions: { robustness: 80 } }));
    const npc = s.npcs[id]!;
    expect(npc.givenName).toBe('Edited');
    expect(npc.traits.empathy).toBe(99);
    expect(npc.talents).toEqual(['leadership']);
    expect(npc.memories).toEqual(before.memories);
    expect(npc.parentIds).toEqual(before.parentIds);
    expect(npc.birthYear).toBe(before.birthYear);
    expect(s.relationships[`${s.protagonist.id}>${id}`]).toEqual(rel);
    expect(edit(s, id, { stats: { health: 10 } }).ok).toBe(false);
    expect(edit(s, id, { skills: { social: 10 } }).ok).toBe(false);
    const played = autoPlay(s, 'npc-life', 600);
    expect(validateState(played.state)).toEqual([]);
    expect(played.state.npcs[id]?.givenName ?? 'Edited').toBe('Edited');
  });
});

describe('dynasty: the choice is asked again for every life', () => {
  const dieAndContinue = (godFirst: boolean, next: { godModeEnabled?: boolean; initialGodPatch?: GodPatch }, seed: string) => {
    const dead = autoPlay(godFirst ? godLife(seed) : newLife(seed), 'dyn', 600).state;
    const opts = dynastyOptions(dead);
    const r = continueDynasty(dead, { seed: `next-${seed}`, givenName: 'Nova', parentId: opts[0]?.npcId ?? null, ...next }, ctx);
    if (!r.ok) throw new Error(r.error.message);
    return { dead, next: r };
  };

  it('is not inherited: a life played with GOD MODE is followed by a life without it unless chosen again', () => {
    const { dead, next } = dieAndContinue(true, {}, 'dyn-a');
    expect(dead.config.godModeEnabled).toBe(true);
    expect(next.state.config).toEqual({ godModeEnabled: false, godModeOrigin: 'chosen' });
    expect(next.state.godMode).toEqual({ edits: 0, log: [] }); // the log belongs to the life it was written in
    expect(edit(next.state, next.state.protagonist.id, { givenName: 'X' }).ok).toBe(false);
  });

  it('can be chosen for the new life even if the previous one had none, and the chronicle records the previous choice', () => {
    const a = dieAndContinue(false, { godModeEnabled: true }, 'dyn-b');
    expect(a.next.state.config.godModeEnabled).toBe(true);
    expect(a.next.state.dynasty.chronicle.at(-1)?.godMode).toBe(false);
    const b = dieAndContinue(true, { godModeEnabled: true }, 'dyn-c');
    expect(b.next.state.dynasty.chronicle.at(-1)?.godMode).toBe(true);
  });

  it('customises the new life at creation, only when GOD MODE is chosen for it', () => {
    const ok = dieAndContinue(false, { godModeEnabled: true, initialGodPatch: { stats: { appearance: 77 } } }, 'dyn-d');
    expect(ok.next.state.protagonist.stats.appearance).toBe(77);
    expect(ok.next.state.godMode.edits).toBe(1);
    const dead = autoPlay(newLife('dyn-e'), 'dyn', 600).state;
    const refused = continueDynasty(dead, { seed: 'x', givenName: 'Nova', initialGodPatch: { stats: { appearance: 77 } } }, ctx);
    expect(refused.ok).toBe(false);
  });

  it('achievements stay shared across the dynasty and across modes', () => {
    expect(new Set(ACHIEVEMENT_IDS).size).toBe(ACHIEVEMENT_IDS.length);
    let carried = false;
    for (let i = 0; i < 12 && !carried; i++) {
      const s0 = godLife(`ach-${i}`);
      const edited = must(edit(s0, s0.protagonist.id, { stats: { happiness: 100 } }));
      const dead = autoPlay(edited, `a${i}`, 600, ['ask_out', 'propose', 'try']).state;
      const opts = dynastyOptions(dead);
      if (opts.length === 0) continue;
      const r = continueDynasty(dead, { seed: `next-${i}`, givenName: 'Nova', parentId: opts[0]!.npcId }, ctx);
      if (!r.ok) throw new Error(r.error.message);
      for (const id of Object.keys(dead.achievements)) expect(r.state.achievements[id]).toBe(dead.achievements[id]);
      carried = true;
    }
    expect(carried).toBe(true);
  });
});

describe('migration v7 → v8: the choice is derived from what the save proves, never invented', () => {
  /** A save as schema v7 stored it: a switch plus a log, and no `config`. */
  function asV7(s: GameState, god: { enabled: boolean; edits: number; log: unknown[] }): Record<string, unknown> {
    const raw = structuredClone(s) as unknown as Record<string, unknown>;
    raw.schemaVersion = 7;
    delete raw.config;
    raw.godMode = god;
    return raw;
  }
  const migrate = (raw: Record<string, unknown>): GameState => {
    const res = migrateSlot({ schemaVersion: 7, state: raw, rng: raw.rng, checksum: 'x' } as never, ctx.content)!;
    expect(res.from).toBe(7);
    return (res.slot as { state: GameState }).state;
  };
  const entry = (action: 'ENABLED' | 'DISABLED' | 'EDITED') => ({ revision: 1, year: 2025, action, targetId: null, targetName: null, changes: [] });

  it('no GOD MODE activity in the save → off, locked, and marked as derived', () => {
    const m = migrate(asV7(newLife('mig-none'), { enabled: false, edits: 0, log: [] }));
    expect(m.config).toEqual({ godModeEnabled: false, godModeOrigin: 'migrated-no-usage' });
    expect(m.godMode).toEqual({ edits: 0, log: [] });
    expect(validateState(m)).toEqual([]);
    expect(edit(m, m.protagonist.id, { givenName: 'X' }).ok).toBe(false);
  });

  it('an activation in the log → on, locked (even if it was switched off again later)', () => {
    const m = migrate(asV7(newLife('mig-toggled'), { enabled: false, edits: 0, log: [entry('ENABLED'), entry('DISABLED')] }));
    expect(m.config).toEqual({ godModeEnabled: true, godModeOrigin: 'migrated-from-usage' });
    expect(m.godMode.log).toHaveLength(2); // the history is kept
    expect(validateState(m)).toEqual([]);
    expect(edit(m, m.protagonist.id, { givenName: 'X' }).ok).toBe(true);
    expect(toggle(m, false).ok).toBe(false);
  });

  it('recorded edits → on, locked', () => {
    const m = migrate(asV7(newLife('mig-edited'), { enabled: true, edits: 2, log: [entry('ENABLED'), entry('EDITED'), entry('EDITED')] }));
    expect(m.config.godModeEnabled).toBe(true);
    expect(m.godMode.edits).toBe(2);
    expect(validateState(m)).toEqual([]);
  });

  it('a switch that says "on" with no trace of use does not by itself prove anything', () => {
    const m = migrate(asV7(newLife('mig-switch-only'), { enabled: true, edits: 0, log: [] }));
    expect(m.config).toEqual({ godModeEnabled: false, godModeOrigin: 'migrated-no-usage' });
  });

  it('chronicle entries of a migrated dynasty get the informational flag', () => {
    const dead = autoPlay(newLife('mig-dyn'), 'd', 600).state;
    const next = continueDynasty(dead, { seed: 'n', givenName: 'Nova', parentId: dynastyOptions(dead)[0]?.npcId ?? null }, ctx);
    if (!next.ok) throw new Error(next.error.message);
    const raw = asV7(next.state, { enabled: false, edits: 0, log: [] });
    (raw.dynasty as { chronicle: Record<string, unknown>[] }).chronicle = (raw.dynasty as { chronicle: Record<string, unknown>[] }).chronicle.map(({ godMode: _g, ...rest }) => rest);
    const m = migrate(raw);
    expect(m.dynasty.chronicle.every((c) => c.godMode === false)).toBe(true);
    expect(validateState(m)).toEqual([]);
  });

  it('migration is deterministic and the migrated life plays on', () => {
    const raw = asV7(newLife('mig-play'), { enabled: false, edits: 0, log: [entry('ENABLED')] });
    expect(canonicalStringify(migrate(raw))).toBe(canonicalStringify(migrate(raw)));
    const played = autoPlay(migrate(raw), 'mp', 600).state;
    expect(played.protagonist.death).not.toBeNull();
    expect(validateState(played)).toEqual([]);
  });
});

describe('older saves: v6 → v8 through the whole chain', () => {
  it('adds neutral talents, skills and predispositions, and a GOD MODE choice derived from (no) use', () => {
    const s = newLife('mig-v6');
    const old = structuredClone(s) as unknown as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    old.schemaVersion = 6;
    delete old.config;
    delete old.godMode;
    delete old.achievements;
    delete old.protagonist.talents;
    delete old.protagonist.skills;
    delete old.protagonist.predispositions;
    for (const npc of Object.values<any>(old.npcs)) { // eslint-disable-line @typescript-eslint/no-explicit-any
      delete npc.talents;
      delete npc.predispositions;
    }
    const res = migrateSlot({ schemaVersion: 6, state: old, rng: s.rng, checksum: 'x' } as never, ctx.content)!;
    const migrated = (res.slot as { state: GameState; schemaVersion: number }).state;
    expect((res.slot as { schemaVersion: number }).schemaVersion).toBe(SCHEMA_VERSION);
    expect(migrated.config).toEqual({ godModeEnabled: false, godModeOrigin: 'migrated-no-usage' });
    expect(migrated.godMode).toEqual({ edits: 0, log: [] });
    expect(migrated.protagonist.predispositions).toEqual({ longevity: 50, robustness: 50 });
    expect(validateState(migrated)).toEqual([]);
    const r = simulate(migrated, { type: 'ADVANCE_YEAR', commandId: 'm', expectedRevision: migrated.revision }, ctx);
    expect(r.ok).toBe(true);
  });
});

describe('talents, skills and predispositions in play', () => {
  it('are drawn at birth, stay within bounds, and children inherit from their parents', () => {
    let withTalent = 0;
    let inherited = 0;
    for (let i = 0; i < 20; i++) {
      const s = newLife(`gifted-${i}`);
      const p = s.protagonist;
      expect(p.talents.length).toBeLessThanOrEqual(5);
      expect(new Set(p.talents).size).toBe(p.talents.length);
      for (const v of [...Object.values(p.predispositions), ...Object.values(p.skills)]) expect(v >= 0 && v <= 100).toBe(true);
      if (p.talents.length) withTalent++;
      const parents = p.parentIds.map((id) => s.npcs[id]!);
      if (parents.some((q) => q.talents.some((x) => p.talents.includes(x)))) inherited++;
    }
    expect(withTalent).toBeGreaterThan(0);
    expect(inherited).toBeGreaterThan(0);
  });

  it('skills only grow with practice, and the same seed always gives the same talents', () => {
    const a = newLife('skills-seed');
    const b = newLife('skills-seed');
    expect(a.protagonist.talents).toEqual(b.protagonist.talents);
    expect(a.protagonist.predispositions).toEqual(b.protagonist.predispositions);
    const played = autoPlay(a, 'practice', 400).state;
    for (const k of ['social', 'technical', 'creative', 'physical'] as const) {
      expect(played.protagonist.skills[k]).toBeGreaterThanOrEqual(a.protagonist.skills[k]);
    }
  });
});

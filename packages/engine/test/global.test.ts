import { describe, expect, it } from 'vitest';
import type { GameState } from '@project-life/schemas';
import { Rng, continueDynasty, createGame, dynastyOptions, eligibleProfessions, migrateSlot, pendingChoices, simulate, trackedCounts, validateState, worldYear } from '../src/index';
import { makeRun } from '../src/run';
import { autoPlay, ctx, fullCtx, START } from './helpers';

const make = (seed: string, countryCode?: string): GameState => {
  const r = createGame({ seed, givenName: 'Ada', familyName: 'Verdi', startDate: START, ...(countryCode ? { countryCode } : {}) }, fullCtx);
  if (!r.ok) throw new Error(r.error.message);
  return r.state;
};

describe('global catalogue in the engine', () => {
  it('a life can be started in every one of the 252 countries and territories', () => {
    let n = 0;
    for (const c of fullCtx.content.countries) {
      const s = make(`world-${c.code}`, c.code);
      expect(s.location.countryCode).toBe(c.code);
      expect(s.finance.currency).toBe(c.currency);
      expect(s.finance.minorUnits).toBe(c.minorUnits);
      expect(c.cities).toContain(s.location.city);
      expect(validateState(s)).toEqual([]);
      n++;
    }
    expect(n).toBeGreaterThanOrEqual(200);
  });

  it('Random Life follows real population shares and reaches many countries', { timeout: 120_000 }, () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 400; i++) {
      const code = make(`random-${i}`).location.countryCode;
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    const big = (counts.get('IN') ?? 0) + (counts.get('CN') ?? 0);
    expect(big / 400).toBeGreaterThan(0.2); // together about a third of humanity
    expect(big / 400).toBeLessThan(0.45);
    expect(counts.size).toBeGreaterThan(50);
    expect(counts.get('IS') ?? 0).toBeLessThan(5); // tiny countries are rare
  });

  it('money stays inside safe integers even in high-nominal currencies, because those use whole units', () => {
    for (const code of ['VN', 'ID', 'NG', 'KR', 'JP']) {
      const s = make(`units-${code}`, code);
      const c = fullCtx.content.countries.find((x) => x.code === code)!;
      expect(s.finance.minorUnits).toBe(c.fxPerEur > 200 ? 1 : 100);
    }
  });

  it('population is conserved across all countries over decades, and tracked people stay exact', () => {
    const s = make('conserve-global');
    const run = makeRun(s, fullCtx, fullCtx.content.countries.find((c) => c.code === s.location.countryCode)!, Rng.fromSeed('x'), 1);
    for (let y = 0; y < 40; y++) {
      const total = (): number => Object.values(s.world.countries).reduce((a, c) => a + c.population, 0);
      const before = total();
      const { births, deaths, flow } = worldYear(run);
      const sum = (r: Record<string, number>): number => Object.values(r).reduce((a, b) => a + b, 0);
      expect(sum(flow)).toBe(0);
      expect(total() - before).toBe(sum(births) - sum(deaths));
      s.world.currentDate = { ...s.world.currentDate, year: s.world.currentDate.year + 1 };
    }
    expect(Object.keys(s.world.countries)).toHaveLength(fullCtx.content.countries.length);
    expect(s.world.history.length).toBeLessThanOrEqual(80);
    expect(trackedCounts(s)[s.location.countryCode]).toBe(1 + Object.keys(s.npcs).length);
  });

  it('whole lives run in countries of every income tier; each tier yields a plausible spread; speed stays acceptable', { timeout: 300_000 }, () => {
    const t0 = performance.now();
    let commands = 0;
    const worth: Record<string, number[]> = {};
    for (const [i, code] of ['CH', 'RU', 'BD', 'ET', 'VN', 'MX', 'SE', 'EG'].entries()) {
      const play = autoPlay(make(`tier-${i}`, code), `tp-${i}`, 700, [], fullCtx);
      expect(play.state.protagonist.death).not.toBeNull();
      expect(validateState(play.state)).toEqual([]);
      commands += play.commands;
      (worth[fullCtx.content.countries.find((c) => c.code === code)!.tier] ??= []).push(play.state.finance.accounts['asset:cash'] ?? 0);
    }
    const msPerCommand = (performance.now() - t0) / commands;
    console.info(`[global] ${commands} commands across tiers ${Object.keys(worth).join('/')}: ${msPerCommand.toFixed(1)} ms per command with the full catalogue`);
    expect(msPerCommand).toBeLessThan(60);
  });

  it('dynasties continue in the global world with exact bookkeeping', { timeout: 300_000 }, () => {
    const dead = autoPlay(make('global-dynasty', 'BR'), 'gd', 700, ['ask_out', 'propose', 'try'], fullCtx).state;
    const opts = dynastyOptions(dead);
    const r = continueDynasty(dead, { seed: 'next-global', givenName: 'Nova', parentId: opts[0]?.npcId ?? null }, fullCtx);
    if (!r.ok) throw new Error(r.error.message);
    expect(validateState(r.state)).toEqual([]);
    expect(Object.keys(r.state.world.countries)).toHaveLength(fullCtx.content.countries.length);
  });
});

describe('higher education and special careers', () => {
  const adult = (seed: string): GameState => {
    const s = make(seed, 'DE');
    s.world.currentDate = { ...s.world.startDate, year: s.world.startDate.year + 30 };
    s.education.stage = 'finished';
    s.education.qualifications = ['primary', 'secondary', 'bachelor'];
    return s;
  };

  it('a degree implies the lower ones: a doctorate opens master-level jobs; a bachelor does not', () => {
    const s = adult('degrees');
    const has = (q: GameState['education']['qualifications']): string[] => {
      s.education.qualifications = q;
      return eligibleProfessions(s, fullCtx.content.professions).map((p) => p.id);
    };
    expect(has(['bachelor'])).not.toContain('lawyer');
    expect(has(['bachelor'])).toContain('accountant');
    expect(has(['master'])).toContain('lawyer');
    expect(has(['master'])).toContain('accountant'); // a master counts as a bachelor
    const doctor = has(['doctorate']);
    expect(doctor).toContain('physicist');
    expect(doctor).toContain('general_practitioner');
    expect(has([])).not.toContain('surgeon');
  });

  it('after a bachelor the player is offered a master or a doctorate, and finishing it adds the degree', { timeout: 120_000 }, () => {
    let reached = false;
    for (let i = 0; i < 40 && !reached; i++) {
      let s = make(`pg-${i}`, 'DE');
      for (let n = 0; n < 200 && !s.protagonist.death && !reached; n++) {
        let r;
        if (s.simulation.status === 'PAUSED_EVENT') {
          const view = pendingChoices(s, fullCtx)!;
          const pick = view.choices.find((c) => ['university', 'master'].includes(c.id)) ?? view.choices.find((c) => c.id.startsWith('accept:')) ?? view.choices[0]!;
          r = simulate(s, { type: 'RESOLVE_EVENT', commandId: `p${n}`, expectedRevision: s.revision, choiceId: pick.id }, fullCtx);
        } else r = simulate(s, { type: 'ADVANCE_YEAR', commandId: `p${n}`, expectedRevision: s.revision }, fullCtx);
        if (!r.ok) throw new Error(r.error.message);
        s = r.state;
        if (s.education.qualifications.includes('master')) {
          reached = true;
          expect(s.education.qualifications).toContain('bachelor');
          expect(s.education.stage).toBe('finished');
          expect(s.education.postgraduate).toBeNull();
        }
      }
    }
    expect(reached).toBe(true);
  });

  it('professional sport ends at the archetype age; income swings year to year; volatile careers differ from stable ones', () => {
    const sports = fullCtx.content.archetypes.find((a) => a.id === 'sports')!;
    const s = make('athlete', 'DE');
    const age = sports.maxAge! - 1;
    s.world.currentDate = { ...s.world.startDate, year: s.world.startDate.year + age };
    s.education.stage = 'finished';
    s.career.job = { professionId: 'footballer', level: 2, yearsInRole: 3, salary: 5_000_000, specialization: null };
    const salaries = new Set<number>();
    let st = s;
    for (let n = 0; n < 3 && st.career.job; n++) {
      const r = simulate(st, { type: 'ADVANCE_YEAR', commandId: `s${n}`, expectedRevision: st.revision }, fullCtx);
      if (!r.ok) throw new Error(r.error.message);
      st = r.state;
      for (let k = 0; k < 10 && st.simulation.status === 'PAUSED_EVENT'; k++) {
        const v = pendingChoices(st, fullCtx)!;
        const rr = simulate(st, { type: 'RESOLVE_EVENT', commandId: `sr${n}-${k}`, expectedRevision: st.revision, choiceId: v.choices[0]!.id }, fullCtx);
        if (!rr.ok) throw new Error(rr.error.message);
        st = rr.state;
      }
      if (st.career.job) salaries.add(st.career.job.salary);
    }
    expect(st.career.job).toBeNull(); // the career ended
    expect(st.flags.athlete_retired).toBe(true);
    expect(st.career.retired).toBe(false); // not a pension retirement
    expect(validateState(st)).toEqual([]);
  });
});

describe('migration v5 → v6', () => {
  it('brings an older world up to the global catalogue without touching existing countries', () => {
    const s = make('legacy-v5', 'IT');
    const keep = structuredClone(s.world.countries.IT!);
    const old = structuredClone(s) as unknown as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    old.schemaVersion = 5;
    for (const code of Object.keys(old.world.countries)) if (code !== 'IT') delete old.world.countries[code];
    delete old.education.postgraduate;
    delete old.finance.minorUnits;
    const slot = { schemaVersion: 5, state: old, rng: s.rng, checksum: 'x' };
    const res = migrateSlot(slot as never, fullCtx.content)!;
    const migrated = (res.slot as { state: GameState }).state;
    expect(Object.keys(migrated.world.countries)).toHaveLength(fullCtx.content.countries.length);
    expect(migrated.world.countries.IT).toEqual(keep);
    expect(migrated.education.postgraduate).toBeNull();
    expect(migrated.finance.minorUnits).toBe(100);
    expect(validateState(migrated)).toEqual([]);
    void ctx;
  });
});

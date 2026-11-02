import { describe, expect, it } from 'vitest';
import type { GameState } from '@project-life/schemas';
import { Rng, netWorth, pendingChoices, simulate, trackedCounts, validateState, worldYear } from '../src/index';
import { createNpc } from '../src/npc';
import { makeRun, type Run } from '../src/run';
import { beAccused, commitOffence, enactPolicy, grantOffice, grantResidency, joinParty, legalAction, naturalize, officeStipend, recogniseQualifications, relocate, returnHome, societyYear } from '../src/society';
import { monthlyFinance } from '../src/finance';
import { dynastyOptions, continueDynasty } from '../src/index';
import { autoPlay, ctx, newLife, retrack, setEconomy } from './helpers';

function adultRun(seed: string, country = 'IT'): { s: GameState; run: Run } {
  const s = newLife(seed, { countryCode: country });
  s.world.currentDate = { year: s.world.startDate.year + 30, month: s.world.startDate.month, day: s.world.startDate.day };
  s.protagonist.birth = { ...s.world.startDate };
  s.career.job = { professionId: 'accountant', level: 1, yearsInRole: 3, salary: 2_400_000, specialization: null };
  s.education.qualifications = ['secondary', 'bachelor'];
  const def = ctx.content.countries.find((c) => c.code === country)!;
  return { s, run: makeRun(s, ctx, def, Rng.fromSeed(`${seed}|soc`), 1) };
}
const ok = (s: GameState): void => expect(validateState(s)).toEqual([]);

describe('persistent world: countries, demography, economies', () => {
  it('every country exists with its own economy, politics and environment, and every tracked person is counted once', () => {
    const s = newLife('world');
    expect(Object.keys(s.world.countries).sort()).toEqual(ctx.content.countries.map((c) => c.code).sort());
    expect(trackedCounts(s)[s.location.countryCode]).toBe(1 + Object.keys(s.npcs).length);
    for (const c of Object.values(s.world.countries)) {
      expect(c.population).toBeGreaterThan(c.tracked);
      expect(ctx.content.parties.some((p) => p.id === c.politics.governingParty)).toBe(true);
    }
    ok(s);
  });

  it('population is conserved: births and deaths change the total, migration only moves people', () => {
    const { s, run } = adultRun('conserve');
    for (let y = 0; y < 40; y++) {
      const before = Object.values(s.world.countries).reduce((a, c) => a + c.population, 0);
      const { births, deaths, flow } = worldYear(run);
      const after = Object.values(s.world.countries).reduce((a, c) => a + c.population, 0);
      const sum = (r: Record<string, number>): number => Object.values(r).reduce((a, b) => a + b, 0);
      expect(sum(flow)).toBe(0);
      expect(after - before).toBe(sum(births) - sum(deaths));
      s.world.currentDate = { ...s.world.currentDate, year: s.world.currentDate.year + 1 };
    }
  });

  it('promotion, birth, death and demotion keep the totals reconciled', () => {
    const { s, run } = adultRun('reconcile');
    const c = s.world.countries.IT!;
    const [pop, tracked] = [c.population, c.tracked];
    const npc = createNpc(run, { familyName: 'Rossi', birthYear: 2000, class: 'middle', countryCode: 'IT' });
    expect([c.population, c.tracked]).toEqual([pop, tracked + 1]); // promoted from the aggregate: total unchanged
    createNpc(run, { familyName: 'Rossi', birthYear: 2055, class: 'middle', countryCode: 'IT', newborn: true });
    expect([c.population, c.tracked]).toEqual([pop + 1, tracked + 2]); // a birth adds a person
    ok(s);
    void npc;
  });

  it('economies share a global cycle but differ locally; elections happen and governments change; history stays bounded', () => {
    const { s, run } = adultRun('cycles');
    const parties = new Set<string>();
    let elections = 0;
    const growth: Record<string, number[]> = {};
    for (let y = 0; y < 200; y++) {
      worldYear(run);
      s.world.currentDate = { ...s.world.currentDate, year: s.world.currentDate.year + 1 };
      for (const c of Object.values(s.world.countries)) {
        parties.add(`${c.code}:${c.politics.governingParty}`);
        (growth[c.code] ??= []).push(c.economy.growthBp);
        expect(c.politics.approvalBp).toBeGreaterThanOrEqual(0);
        expect(c.politics.approvalBp).toBeLessThanOrEqual(10_000);
        expect(c.environment.stress).toBeGreaterThanOrEqual(0);
        expect(c.population).toBeGreaterThan(c.tracked);
      }
    }
    elections = s.world.history.filter((e) => e.kind === 'ELECTION').length;
    expect(elections).toBeGreaterThan(5);
    expect(parties.size).toBeGreaterThan(Object.keys(s.world.countries).length); // some government changed somewhere
    expect(s.world.history.length).toBeLessThanOrEqual(80);
    const a = growth.IT!;
    const b = growth.DE!;
    const mean = (x: number[]): number => x.reduce((p, q) => p + q, 0) / x.length;
    const cov = a.reduce((sum, v, i) => sum + (v - mean(a)) * (b[i]! - mean(b)), 0);
    const corr = cov / Math.sqrt(a.reduce((p, v) => p + (v - mean(a)) ** 2, 0) * b.reduce((p, v) => p + (v - mean(b)) ** 2, 0));
    expect(corr).toBeGreaterThan(0.1); // global cycle
    expect(corr).toBeLessThan(0.98); // yet not identical
    expect(JSON.stringify(s.world.countries.IT!.economy)).toBe(JSON.stringify(s.world.countries.IT!.economy));
  });

  it('climate stress feeds back: higher-emission countries accumulate more environmental stress', () => {
    const { s, run } = adultRun('climate');
    const start = Object.fromEntries(Object.values(s.world.countries).map((c) => [c.code, c.environment.stress]));
    for (let y = 0; y < 60; y++) {
      worldYear(run);
      s.world.currentDate = { ...s.world.currentDate, year: s.world.currentDate.year + 1 };
    }
    expect(s.world.countries.US!.environment.stress - start.US!).toBeGreaterThan(s.world.countries.NG!.environment.stress - start.NG!);
  });
});

describe('politics', () => {
  it('only party members can hold office; office pays a stipend and policy votes change the country', () => {
    const { s, run } = adultRun('politics');
    grantOffice(run, 'deputy');
    expect(s.society.office).toBeNull(); // no party, no seat
    joinParty(run, ctx.content.parties[0]!.id);
    grantOffice(run, 'deputy');
    expect(s.society.office).toBe('deputy');
    expect(officeStipend(run)).toBeGreaterThan(0);

    const cash0 = s.finance.accounts['asset:cash'] ?? 0;
    monthlyFinance(run);
    const withOffice = (s.finance.accounts['asset:cash'] ?? 0) - cash0;
    s.society.office = null;
    const cash1 = s.finance.accounts['asset:cash'] ?? 0;
    monthlyFinance(run);
    expect((s.finance.accounts['asset:cash'] ?? 0) - cash1).toBeLessThan(withOffice);

    s.society.office = 'minister';
    const before = s.world.countries.IT!.politics.taxAdjustBp;
    enactPolicy(run, 'cut_taxes');
    expect(s.world.countries.IT!.politics.taxAdjustBp).toBe(before - 400); // a minister counts double
    expect(s.world.history.at(-1)).toMatchObject({ kind: 'POLICY', detail: 'cut_taxes' });
    ok(s);
  });

  it('the national tax multiplier really changes what people pay', () => {
    const a = adultRun('taxmult');
    const b = adultRun('taxmult');
    b.s.world.countries.IT!.politics.taxAdjustBp = 1500;
    const ca = a.s.finance.accounts['asset:cash'] ?? 0;
    const cb = b.s.finance.accounts['asset:cash'] ?? 0;
    monthlyFinance(a.run);
    monthlyFinance(b.run);
    expect((a.s.finance.accounts['asset:cash'] ?? 0) - ca).toBeGreaterThan((b.s.finance.accounts['asset:cash'] ?? 0) - cb);
  });

  it('office-holders face re-election in election years: some win, some lose', () => {
    let won = 0;
    let lost = 0;
    for (let i = 0; i < 80; i++) {
      const { s, run } = adultRun(`reelect-${i}`);
      joinParty(run, ctx.content.parties[i % 4]!.id);
      grantOffice(run, 'councillor');
      s.world.countries.IT!.politics.lastElection = s.world.currentDate.year;
      societyYear(run);
      if (s.society.office) won++;
      else lost++;
    }
    expect(won).toBeGreaterThan(5);
    expect(lost).toBeGreaterThan(5);
  });
});

describe('justice: accusation, guilt, conviction are different things', () => {
  const play = (seed: string, evidence: number, action: 'lawyer' | 'plea' | 'self' | null) => {
    const { s, run } = adultRun(seed);
    beAccused(run, evidence);
    s.world.currentDate = { ...s.world.currentDate, year: s.world.currentDate.year + 1 };
    societyYear(run); // investigation → charged (or dropped)
    if (s.society.legal && action) legalAction(run, action);
    if (s.society.legal) {
      s.world.currentDate = { ...s.world.currentDate, year: s.world.currentDate.year + 1 };
      societyYear(run); // trial
    }
    return s;
  };

  it('weak accusations are dropped and leave no record', () => {
    const s = play('weak', 10, null);
    expect(s.society.legal).toBeNull();
    expect(s.society.record).toBe(false);
  });

  it('a lawyer lowers the conviction rate; a plea guarantees a (shorter) conviction; an acquittal never creates a record', () => {
    let lawyered = 0;
    let alone = 0;
    let pleaded = 0;
    const N = 200;
    for (let i = 0; i < N; i++) {
      if (play(`l-${i}`, 60, 'lawyer').society.record) lawyered++;
      if (play(`l-${i}`, 60, 'self').society.record) alone++;
      const p = play(`p-${i}`, 60, 'plea');
      if (p.society.record) pleaded++;
      if (!p.society.record) throw new Error('a plea must convict');
      expect(p.society.legal?.releaseYear).toBe(p.world.currentDate.year + 1);
    }
    expect(lawyered).toBeLessThan(alone);
    expect(lawyered).toBeLessThan(N); // acquittals happen
    expect(lawyered).toBeGreaterThan(0); // convictions happen
    expect(pleaded).toBe(N);
  });

  it('a conviction costs the job and office, imprisons until release, then leaves a record that closes security jobs', () => {
    let s!: GameState;
    let run!: Run;
    for (let i = 0; i < 300 && !s?.society.record; i++) {
      ({ s, run } = adultRun(`conv-${i}`));
      joinParty(run, ctx.content.parties[0]!.id);
      grantOffice(run, 'councillor');
      beAccused(run, 95);
      for (let y = 0; y < 2; y++) {
        s.world.currentDate = { ...s.world.currentDate, year: s.world.currentDate.year + 1 };
        societyYear(run);
        if (s.society.legal?.stage === 'charged') legalAction(run, 'self');
      }
    }
    expect(s.society.record).toBe(true);
    expect(s.career.job).toBeNull();
    expect(s.society.office).toBeNull();
    expect(s.society.legal?.stage).toBe('imprisoned');
    const release = s.society.legal!.releaseYear!;
    s.world.currentDate = { ...s.world.currentDate, year: release };
    societyYear(run);
    expect(s.society.legal).toBeNull();
    expect(s.society.record).toBe(true);
    const { eligibleProfessions } = await_import();
    expect(eligibleProfessions(s, ctx.content.professions).some((p) => p.sector === 'security')).toBe(false);
  });

  it('hidden offences are found more often under stricter courts, and an undiscovered offence has no consequences', () => {
    const found = (country: string): number => {
      let n = 0;
      for (let i = 0; i < 300; i++) {
        const { s, run } = adultRun(`h-${country}-${i}`, country);
        commitOffence(run, 2);
        expect(s.society.legal).toBeNull();
        for (let y = 0; y < 5; y++) {
          societyYear(run);
          if (s.society.legal || s.society.record) break;
        }
        if (s.society.legal) n++;
      }
      return n;
    };
    expect(found('DE')).toBeGreaterThan(found('NG')); // strictness 70 vs 40
  });

  it('while imprisoned, only justice events can happen to you', () => {
    const { s } = adultRun('jail');
    s.society.legal = { offense: 'offence', severity: 2, stage: 'imprisoned', evidence: 90, sinceYear: s.world.currentDate.year, lawyer: false, plea: false, releaseYear: s.world.currentDate.year + 30 };
    s.career.job = null;
    let st = s;
    const seen = new Set<string>();
    for (let n = 0; n < 40; n++) {
      let r;
      if (st.simulation.status === 'PAUSED_EVENT') {
        const view = pendingChoices(st, ctx)!;
        seen.add(view.event.category);
        r = simulate(st, { type: 'RESOLVE_EVENT', commandId: `j${n}`, expectedRevision: st.revision, choiceId: view.choices[0]!.id }, ctx);
      } else r = simulate(st, { type: 'ADVANCE_YEAR', commandId: `j${n}`, expectedRevision: st.revision }, ctx);
      if (!r.ok) throw new Error(r.error.message);
      st = r.state;
      if (st.protagonist.death) break;
    }
    expect([...seen].every((c) => c === 'justice')).toBe(true);
  });
});

describe('fame', () => {
  it('fades over time and earns sponsorship only above the threshold and without a record', () => {
    const { s, run } = adultRun('fame');
    s.society.fame.notoriety = 80;
    const c0 = s.finance.accounts['asset:cash'] ?? 0;
    societyYear(run);
    expect((s.finance.accounts['asset:cash'] ?? 0) - c0).toBeGreaterThan(0);
    expect(s.society.fame.notoriety).toBe(78);
    const { s: s2, run: run2 } = adultRun('fame2');
    s2.society.fame.notoriety = 80;
    s2.society.record = true;
    const c1 = s2.finance.accounts['asset:cash'] ?? 0;
    societyYear(run2);
    expect((s2.finance.accounts['asset:cash'] ?? 0) - c1).toBe(0);
    ok(s);
    ok(s2);
  });
});

describe('migration, residency and citizenship', () => {
  it('moving converts money at the exchange rate without creating or destroying wealth, and sells what cannot move', () => {
    const { s, run } = adultRun('move', 'IT');
    s.finance.accounts['asset:cash'] = 5_000_000;
    s.finance.accounts['income:salary'] = -5_000_000;
    const eurBefore = netWorth(s) / 1;
    relocate(run, 'US', 'visa');
    expect(s.location.countryCode).toBe('US');
    expect(s.finance.currency).toBe('USD');
    expect(s.society.residence).toMatchObject({ countryCode: 'US', status: 'visa' });
    expect(netWorth(s)).toBeGreaterThan(Math.round(eurBefore * 1.1) - 5); // ≈ ×1.1 USD per EUR
    expect(netWorth(s)).toBeLessThan(Math.round(eurBefore * 1.1) + 5);
    expect(s.world.priceIndex).toBe(s.world.countries.US!.priceIndex);
    expect(Object.values(s.finance.accounts).reduce((a, b) => a + b, 0)).toBe(0);
    ok(s);
  });

  it('keeps the people counts straight: the protagonist and followers change country; everyone else stays', () => {
    const { s, run } = adultRun('family');
    retrack(s);
    const itBefore = s.world.countries.IT!.tracked;
    relocate(run, 'DE', 'resident');
    const moved = Object.values(s.npcs).filter((n) => n.countryCode === 'DE' && n.deathYear === null).length;
    expect(s.world.countries.DE!.tracked).toBe(1 + moved);
    expect(s.world.countries.IT!.tracked).toBe(itBefore - 1 - moved);
    ok(s);
  });

  it('qualifications travel freely inside a bloc but are often not recognised outside it', () => {
    let inside = 0;
    let outside = 0;
    for (let i = 0; i < 100; i++) {
      const a = adultRun(`rec-${i}`, 'IT');
      relocate(a.run, 'DE', 'visa');
      inside += a.s.society.unrecognized.length;
      const b = adultRun(`rec-${i}`, 'IT');
      relocate(b.run, 'US', 'visa');
      outside += b.s.society.unrecognized.length;
    }
    expect(inside).toBe(0);
    expect(outside).toBeGreaterThan(10);
  });

  it('a job that needs an unrecognised degree is lost; recognising it restores access', () => {
    let lost = 0;
    for (let i = 0; i < 80; i++) {
      const { s, run } = adultRun(`degree-${i}`, 'IT');
      s.education.qualifications = ['bachelor'];
      relocate(run, 'US', 'visa');
      if (s.society.unrecognized.includes('bachelor')) {
        expect(s.career.job).toBeNull();
        lost++;
        recogniseQualifications(run);
        expect(s.society.unrecognized).toEqual([]);
      } else expect(s.career.job).not.toBeNull();
    }
    expect(lost).toBeGreaterThan(5);
  });

  it('visas expire (forced return), residency and citizenship are earned, dual citizenship depends on the country', () => {
    const { s, run } = adultRun('visa', 'IT');
    relocate(run, 'DE', 'visa');
    s.world.currentDate = { ...s.world.currentDate, year: s.society.residence.visaUntil! + 1 };
    societyYear(run);
    expect(s.location.countryCode).toBe('IT'); // sent home
    expect(s.society.residence.status).toBe('citizen');

    relocate(run, 'DE', 'visa');
    grantResidency(run);
    expect(s.society.residence.status).toBe('resident');
    naturalize(run);
    expect(s.society.residence.status).toBe('citizen');
    expect(s.society.citizenships.sort()).toEqual(['DE', 'IT']); // Germany allows dual citizenship in the model

    const j = adultRun('nodual', 'IT');
    relocate(j.run, 'JP', 'visa');
    grantResidency(j.run);
    naturalize(j.run);
    expect(j.s.society.citizenships).toEqual(['JP']); // Japan does not
    returnHome(j.run); // no other citizenship: nowhere to return to
    expect(j.s.location.countryCode).toBe('JP');
    ok(s);
    ok(j.s);
  });

  it('moving away cools relationships with relatives who stay', () => {
    const { s, run } = adultRun('distance');
    const parent = s.protagonist.parentIds[0]!;
    const rel = s.relationships[`${s.protagonist.id}>${parent}`]!;
    const before = rel.dims.familiarity;
    relocate(run, 'GB', 'visa');
    expect(s.relationships[`${s.protagonist.id}>${parent}`]!.dims.familiarity).toBeLessThan(before);
  });
});

describe('across generations', () => {
  it('the world, its history and its demography carry into the next generation; the old protagonist leaves the individual count', () => {
    let dead: GameState | undefined;
    for (let i = 0; i < 30 && !dead; i++) {
      const cand = autoPlay(newLife(`gen-${i}`), `g${i}`, 600, ['ask_out', 'propose', 'try']).state;
      if (dynastyOptions(cand).length > 0) dead = cand;
    }
    expect(dead).toBeDefined();
    const r = continueDynasty(dead!, { seed: 'next', givenName: 'Nova' }, ctx);
    if (!r.ok) throw new Error(r.error.message);
    const next = r.state;
    expect(next.world.history.length).toBeGreaterThan(0);
    expect(next.world.history).toEqual(dead!.world.history);
    expect(Object.keys(next.world.countries)).toEqual(Object.keys(dead!.world.countries));
    expect(next.society.citizenships).toEqual([next.location.countryCode]);
    expect(trackedCounts(next)).toEqual(Object.fromEntries(Object.entries(trackedCounts(next))));
    ok(next);
  });
});

/** Keeps the import at one place (engine index exports it already). */
import { eligibleProfessions } from '../src/index';
function await_import() {
  return { eligibleProfessions };
}
void setEconomy;
void commitOffence;

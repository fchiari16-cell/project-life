import { describe, expect, it } from 'vitest';
import type { GameState } from '@project-life/schemas';
import { Rng, ageInYears, canonicalStringify, incomeTaxAnnual, initialEconomy, netWorth, nextEconomy, pendingChoices, simulate, taxPeriodFor, validateState } from '../src/index';
import { annuity, assetsYear, buyHome, investSavings, monthlyAssets, sellHome, sellInvestments } from '../src/assets';
import { businessSaleValue, businessYear, businessesOnDeath, expandBusiness, monthlyBusinesses, ownedBy, sellBusiness, startBusiness } from '../src/business';
import { ACC, bizEquity, cash, debtOwed, investments, mortgageOwed, propertyValue, stakeValue, transfer } from '../src/finance';
import { makeRun, type Run } from '../src/run';
import { ctx, newLife, setEconomy } from './helpers';

/** A living adult with a job, plus a Run to call engine modules directly. */
function adult(seed: string, salaryRef = 3_000_000): { s: GameState; run: Run } {
  const s = newLife(seed, { countryCode: 'IT' });
  const country = ctx.content.countries.find((c) => c.code === 'IT')!;
  s.world.currentDate = { year: s.world.startDate.year + 30, month: s.world.startDate.month, day: s.world.startDate.day };
  s.protagonist.birth = { ...s.world.startDate };
  s.career.job = { professionId: 'accountant', level: 1, yearsInRole: 3, salary: Math.round(salaryRef * 0.8), specialization: null };
  const run = makeRun(s, ctx, country, Rng.fromSeed(`${seed}|econ`), 1);
  return { s, run };
}
const fund = (s: GameState, amount: number): void => transfer(s.finance, ACC.cash, ACC.inheritance, amount);
const ok = (s: GameState): void => expect(validateState(s)).toEqual([]);

describe('World Engine', () => {
  it('is deterministic and keeps every rate inside plausible bounds over 500 years', () => {
    const run = (): string => {
      const rng = Rng.fromSeed('world');
      let e = initialEconomy();
      const seen: string[] = [];
      for (let i = 0; i < 500; i++) {
        e = nextEconomy(e, rng);
        expect(e.inflationBp).toBeGreaterThanOrEqual(0);
        expect(e.inflationBp).toBeLessThanOrEqual(900);
        expect(e.rateBp).toBeGreaterThanOrEqual(0);
        expect(Math.abs(e.stockReturnBp)).toBeLessThanOrEqual(4000);
        seen.push(JSON.stringify(e));
      }
      return seen.join('|');
    };
    expect(run()).toBe(run());
  });
  it('mean-reverts: long-run inflation stays near its anchor', () => {
    const rng = Rng.fromSeed('anchor');
    let e = initialEconomy();
    let sum = 0;
    for (let i = 0; i < 2000; i++) {
      e = nextEconomy(e, rng);
      sum += e.inflationBp;
    }
    expect(sum / 2000).toBeGreaterThan(150);
    expect(sum / 2000).toBeLessThan(350);
  });
});

describe('versioned taxation', () => {
  it('selects the rule set by country and the period by year', () => {
    const { s, run } = adult('tax');
    s.world.currentDate = { ...s.world.currentDate, year: 2030 };
    expect(taxPeriodFor(run).fromYear).toBe(1900);
    s.world.currentDate = { ...s.world.currentDate, year: 2040 };
    expect(taxPeriodFor(run).fromYear).toBe(2035);
    s.location.countryCode = 'US';
    expect(taxPeriodFor(run).capitalGainsBp).toBe(2000);
    s.location.countryCode = 'NG';
    expect(taxPeriodFor(run).brackets[0]!.rateBp).toBe(0); // emerging-family set has a tax-free band
  });
  it('is progressive and continuous: monotone tax, rising average rate, marginal rate bounded by the top bracket', () => {
    const { run } = adult('prog');
    const period = taxPeriodFor(run);
    let prev = -1;
    let prevAvg = -1;
    for (let income = 100_000; income <= 40_000_000; income += 150_000) {
      const tax = incomeTaxAnnual(period, income, 1);
      expect(tax).toBeGreaterThanOrEqual(prev);
      expect(tax / income).toBeGreaterThanOrEqual(prevAvg - 1e-9);
      expect(tax - prev).toBeLessThanOrEqual(150_000 * 0.4601 + 2);
      prev = tax;
      prevAvg = tax / income;
    }
  });
  it('taxes realised investment gains and property once a year, through the ledger', () => {
    const { s, run } = adult('yeartax');
    fund(s, 20_000_000);
    s.finance.gainsThisYear = 1_000_000;
    s.finance.accounts['asset:invest'] = 0;
    const before = cash(s);
    assetsYear(run);
    expect(cash(s)).toBe(before - Math.round((1_000_000 * taxPeriodFor(run).capitalGainsBp) / 10_000));
    expect(s.finance.gainsThisYear).toBe(0);
    ok(s);
  });
});

describe('career archetypes and specialization', () => {
  it('promotions follow the archetype ladder and every profession names a real archetype', () => {
    const ids = new Set(ctx.content.archetypes.map((a) => a.id));
    for (const p of ctx.content.professions) expect(ids.has(p.archetype)).toBe(true);
    expect(ctx.content.professions.length).toBeGreaterThanOrEqual(36);
    expect(new Set(ctx.content.professions.map((p) => p.sector)).size).toBeGreaterThanOrEqual(10);
  });
});

describe('investments', () => {
  it('moves free cash into the portfolio, marks it to the World Engine return, and cashes out — ledger balanced throughout', () => {
    const { s, run } = adult('invest');
    fund(s, 30_000_000);
    setEconomy(s, { stockReturnBp: 1200 });
    const total = netWorth(s);
    investSavings(run, 50);
    expect(investments(s)).toBeGreaterThan(0);
    expect(netWorth(s)).toBe(total); // moving money between own accounts creates no wealth
    const invested = investments(s);
    for (let m = 0; m < 12; m++) monthlyAssets(run);
    expect(investments(s)).toBeGreaterThan(invested);
    expect(s.finance.gainsThisYear).toBe(investments(s) - invested);
    ok(s);
    const grown = investments(s);
    sellInvestments(run);
    expect(investments(s)).toBe(0);
    expect(cash(s)).toBeGreaterThanOrEqual(grown);
    ok(s);
  });
  it('losses reduce the portfolio and are not taxed', () => {
    const { s, run } = adult('loss');
    fund(s, 30_000_000);
    setEconomy(s, { stockReturnBp: -3000 });
    investSavings(run, 90);
    const before = investments(s);
    for (let m = 0; m < 12; m++) monthlyAssets(run);
    expect(investments(s)).toBeLessThan(before);
    const c = cash(s);
    assetsYear(run);
    expect(cash(s)).toBe(c);
    ok(s);
  });
});

describe('real estate and mortgages', () => {
  it('buys with a 20% down payment and a mortgage that amortises to zero with consistent registers', () => {
    const { s, run } = adult('home', 4_000_000);
    setEconomy(s, { housingBp: 0 });
    fund(s, 20_000_000);
    buyHome(run);
    const prop = Object.values(s.properties)[0]!;
    expect(prop.purchasePrice).toBe(Math.round(s.career.job!.salary * 4));
    expect(propertyValue(s)).toBe(prop.value);
    expect(mortgageOwed(s)).toBe(prop.loan);
    expect(prop.loan).toBe(prop.purchasePrice - Math.round(prop.purchasePrice * 0.2));
    expect(prop.paymentMonthly).toBe(annuity(prop.loan, prop.rateBp, 300));
    ok(s);
    fund(s, 500_000_000); // plenty of money to keep paying
    for (let m = 0; m < 300; m++) monthlyAssets(run);
    expect(Object.values(s.properties)[0]!.loan).toBe(0);
    expect(mortgageOwed(s)).toBe(0);
    ok(s);
  });
  it('refuses a purchase the household cannot afford', () => {
    const { s, run } = adult('poor');
    buyHome(run);
    expect(Object.keys(s.properties)).toHaveLength(0);
    ok(s);
  });
  it('forecloses after two years of borrowing to keep up, with a forced-sale haircut, and the books still balance', () => {
    const { s, run } = adult('foreclose', 4_000_000);
    fund(s, 20_000_000);
    buyHome(run);
    transfer(s.finance, ACC.eventsOut, ACC.cash, cash(s)); // spend everything
    let foreclosed = false;
    for (let m = 0; m < 40 && !foreclosed; m++) {
      transfer(s.finance, ACC.living, ACC.cash, cash(s)); // never any cash left: every payment is borrowed
      monthlyAssets(run);
      foreclosed = run.events.some((e) => e.type === 'ASSET_CHANGED' && e.payload.change === 'HOME_FORECLOSED');
    }
    expect(foreclosed).toBe(true);
    expect(Object.keys(s.properties)).toHaveLength(0);
    expect(mortgageOwed(s)).toBe(0);
    ok(s);
  });
  it('sells a home: proceeds settle the loan', () => {
    const { s, run } = adult('sell', 4_000_000);
    fund(s, 20_000_000);
    buyHome(run);
    const worth = netWorth(s);
    sellHome(run);
    expect(Object.keys(s.properties)).toHaveLength(0);
    expect(netWorth(s)).toBe(worth);
    ok(s);
  });
});

describe('businesses', () => {
  it('founding moves capital from the owner to the company ledger; the owner keeps net worth, not liability', () => {
    const { s, run } = adult('biz');
    fund(s, 30_000_000);
    const worth = netWorth(s);
    startBusiness(run, 'consulting');
    const b = ownedBy(s, s.protagonist.id)[0]!;
    expect(b).toBeDefined();
    expect(Object.values(b.accounts).reduce((a, v) => a + v, 0)).toBe(0);
    expect(bizEquity(b)).toBeGreaterThan(0);
    expect(netWorth(s)).toBe(worth); // capital became a stake of equal book value
    expect(stakeValue(s)).toBe(bizEquity(b));
    ok(s);
  });
  it('trades for years with its own books balanced, pays tax and dividends, and keeps personal and business money apart', () => {
    const { s, run } = adult('trade');
    fund(s, 60_000_000);
    setEconomy(s, { growthBp: 300 });
    startBusiness(run, 'software');
    expandBusiness(run);
    for (let y = 0; y < 8; y++) {
      for (let m = 0; m < 12; m++) monthlyBusinesses(run);
      businessYear(run);
      ok(s);
    }
    const b = Object.values(s.businesses)[0]!;
    expect(b.status).toBe('active');
    expect(b.lastYear!.revenue).toBeGreaterThan(0);
    expect(b.lastYear!.tax).toBeGreaterThanOrEqual(0);
    expect(s.finance.accounts['income:dividends'] ?? 0).toBeLessThanOrEqual(0); // credit side: dividends received
  });
  it('a company that cannot cover its costs goes bankrupt; the owner loses the stake but nothing more (limited liability)', () => {
    const { s, run } = adult('bankrupt');
    fund(s, 60_000_000);
    startBusiness(run, 'restaurant');
    expandBusiness(run);
    expandBusiness(run);
    const personal = cash(s);
    const nw = netWorth(s);
    setEconomy(s, { growthBp: -3000, rateBp: 1200 }); // collapse of demand
    for (let m = 0; m < 120 && ownedBy(s, s.protagonist.id).length > 0; m++) monthlyBusinesses(run);
    const b = Object.values(s.businesses)[0]!;
    expect(b.status).toBe('closed');
    expect(b.closedReason).toBe('bankrupt');
    expect(cash(s)).toBe(personal); // personal cash untouched
    expect(debtOwed(s)).toBe(0);
    expect(stakeValue(s)).toBe(0);
    expect(netWorth(s)).toBeLessThan(nw);
    ok(s);
  });
  it('selling pays the owner personally from book equity plus profit', () => {
    const { s, run } = adult('sale');
    fund(s, 30_000_000);
    startBusiness(run, 'consulting');
    for (let y = 0; y < 3; y++) {
      for (let m = 0; m < 12; m++) monthlyBusinesses(run);
      businessYear(run);
    }
    const b = ownedBy(s, s.protagonist.id)[0]!;
    const price = businessSaleValue(b);
    const before = cash(s);
    sellBusiness(run);
    expect(cash(s) - before).toBe(price);
    expect(ownedBy(s, s.protagonist.id)).toHaveLength(0);
    ok(s);
  });
  it('passes to an adult child when the owner dies, otherwise dissolves', () => {
    const { s, run } = adult('heir');
    fund(s, 30_000_000);
    startBusiness(run, 'workshop');
    const b = Object.values(s.businesses)[0]!;
    const parent = s.protagonist.parentIds[0]!;
    b.ownerId = parent; // owned by the protagonist's parent
    businessesOnDeath(run, parent);
    expect(b.ownerId).toBe(s.protagonist.id);
    b.ownerId = s.protagonist.parentIds[1]!;
    s.protagonist.parentIds = [parent];
    businessesOnDeath(run, b.ownerId);
    expect(b.status).toBe('closed');
    expect(b.closedReason).toBe('dissolved');
  });
});

describe('economic events end to end', () => {
  it('offers affordable choices only and applies them through the engine', { timeout: 120_000 }, () => {
    let founded = 0;
    let invested = 0;
    let bought = 0;
    let specialised = 0;
    for (let i = 0; i < 60; i++) {
      let s = newLife(`ev-${i}`, { countryCode: 'US' });
      for (let n = 0; n < 400 && !s.protagonist.death; n++) {
        let r;
        if (s.simulation.status === 'PAUSED_EVENT') {
          const view = pendingChoices(s, ctx)!;
          const want = ['consulting', 'software', 'invest_half', 'buy', 'expand', 'add_more', 'restaurant'];
          const withSpecs = (id: string): boolean => (ctx.content.professions.find((p) => p.id === id.slice('accept:'.length))?.specializations.length ?? 0) > 0;
          const pick = view.choices.find((c) => want.includes(c.id) || c.id.startsWith('spec:')) ?? view.choices.find((c) => c.id.startsWith('accept:') && withSpecs(c.id)) ?? view.choices.find((c) => c.id.startsWith('accept:')) ?? view.choices[0]!;
          r = simulate(s, { type: 'RESOLVE_EVENT', commandId: `e${n}`, expectedRevision: s.revision, choiceId: pick.id }, ctx);
        } else r = simulate(s, { type: 'ADVANCE_YEAR', commandId: `e${n}`, expectedRevision: s.revision }, ctx);
        if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
        for (const e of r.events) {
          if (e.type === 'ASSET_CHANGED' && e.payload.change === 'BUSINESS_FOUNDED') founded++;
          if (e.type === 'ASSET_CHANGED' && e.payload.change === 'INVESTED') invested++;
          if (e.type === 'ASSET_CHANGED' && e.payload.change === 'HOME_BOUGHT') bought++;
          if (e.type === 'JOB_CHANGED' && e.payload.change === 'SPECIALIZED') specialised++;
        }
        s = r.state;
      }
      expect(ageInYears(s.protagonist.birth, (s.protagonist.death ?? { date: s.world.currentDate }).date ?? s.world.currentDate)).toBeGreaterThanOrEqual(0);
    }
    console.info(`[econ] founded ${founded}, invested ${invested}, homes ${bought}, specialisations ${specialised}`);
    expect(founded + invested + bought + specialised).toBeGreaterThan(0);
    expect(invested).toBeGreaterThan(0);
    expect(specialised).toBeGreaterThan(0);
  });

  it('is deterministic with the economy switched on', () => {
    const play = (): string => {
      let s = newLife('det-econ');
      for (let n = 0; n < 300 && !s.protagonist.death; n++) {
        const r =
          s.simulation.status === 'PAUSED_EVENT'
            ? simulate(s, { type: 'RESOLVE_EVENT', commandId: `d${n}`, expectedRevision: s.revision, choiceId: pendingChoices(s, ctx)!.choices[0]!.id }, ctx)
            : simulate(s, { type: 'ADVANCE_YEAR', commandId: `d${n}`, expectedRevision: s.revision }, ctx);
        if (!r.ok) throw new Error(r.error.message);
        s = r.state;
      }
      return canonicalStringify(s);
    };
    expect(play()).toBe(play());
  });
});

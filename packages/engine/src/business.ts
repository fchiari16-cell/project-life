import type { Business, GameState } from '@project-life/schemas';
import { taxPeriodFor } from './economy.js';
import { ACC, BIZ, chargeCost, cash, costScale, bizEquity, transfer, wageScale } from './finance.js';
import { addStat, currentAge, emit, type Run } from './run.js';

const MAX_OWNED = 2;
/** Beyond this size a firm is out of scope for the personal-life model. */
const MAX_EMPLOYEES = 250;

const acc = (b: Business, a: string): number => b.accounts[a] ?? 0;
const move = (b: Business, debit: string, credit: string, amount: number): void => {
  if (!Number.isInteger(amount) || amount < 0) throw new RangeError(`invalid business transfer ${amount}`);
  if (amount === 0) return;
  b.accounts[debit] = acc(b, debit) + amount;
  b.accounts[credit] = acc(b, credit) - amount;
};
const debtOf = (b: Business): number => -acc(b, BIZ.debt);

export const ownedBy = (s: GameState, id: string): Business[] =>
  Object.values(s.businesses)
    .filter((b) => b.status === 'active' && b.ownerId === id)
    .sort((a, c) => (a.id < c.id ? -1 : 1));

export function startBusiness(run: Run, sectorId: string): void {
  const s = run.s;
  const sector = run.ctx.content.businessSectors.find((x) => x.id === sectorId);
  if (!sector || ownedBy(s, s.protagonist.id).length >= MAX_OWNED || currentAge(s) < 18) return;
  const capital = Math.round(sector.startupRef * costScale(run));
  if (cash(s) < capital) return; // cannot raise the capital: nothing happens
  const id = `${s.id}:biz${Object.keys(s.businesses).length}:${s.world.currentDate.year}`;
  const biz: Business = {
    id,
    name: `${sector.title} ${run.rng.pick(run.ctx.content.familyNames)}`,
    sector: sector.id,
    foundedYear: s.world.currentDate.year,
    ownerId: s.protagonist.id,
    ownerSharePct: 100,
    employees: 1,
    demandShockBp: 0,
    status: 'active',
    closedReason: null,
    accounts: {},
    thisYear: { revenue: 0, costs: 0, tax: 0, interest: 0 },
    lastYear: null,
  };
  // Personal side: the money leaves the owner's ledger; the company's books receive it as equity.
  transfer(s.finance, ACC.bizInvest, ACC.cash, capital);
  move(biz, BIZ.cash, BIZ.equity, capital);
  s.businesses[id] = biz;
  emit(run, 'ASSET_CHANGED', { change: 'BUSINESS_FOUNDED', label: biz.name, amount: capital });
}

export function expandBusiness(run: Run): void {
  const s = run.s;
  const biz = ownedBy(s, s.protagonist.id)[0];
  if (!biz) return;
  const sector = run.ctx.content.businessSectors.find((x) => x.id === biz.sector);
  if (!sector) return;
  const cost = Math.round(sector.startupRef * costScale(run) * 0.4);
  if (cash(s) < cost || biz.employees >= MAX_EMPLOYEES) return;
  transfer(s.finance, ACC.bizInvest, ACC.cash, cost);
  move(biz, BIZ.cash, BIZ.equity, cost);
  biz.employees += 2;
  emit(run, 'ASSET_CHANGED', { change: 'BUSINESS_EXPANDED', label: biz.name, amount: cost });
}

/** The buyer pays book equity plus two years of last year's profit, share-weighted; the owner is paid personally. */
export function businessSaleValue(b: Business): number {
  const ly = b.lastYear;
  const profit = ly ? ly.revenue - ly.costs - ly.tax - ly.interest : 0;
  return Math.max(0, Math.round(((Math.max(0, bizEquity(b)) + 2 * Math.max(0, profit)) * b.ownerSharePct) / 100));
}

export function sellBusiness(run: Run): void {
  const s = run.s;
  const biz = ownedBy(s, s.protagonist.id)[0];
  if (!biz) return;
  const proceeds = businessSaleValue(biz);
  transfer(s.finance, ACC.cash, ACC.bizSale, proceeds);
  biz.status = 'closed';
  biz.closedReason = 'sold';
  emit(run, 'ASSET_CHANGED', { change: 'BUSINESS_SOLD', label: biz.name, amount: proceeds });
}

function bankrupt(run: Run, b: Business): void {
  b.status = 'closed';
  b.closedReason = 'bankrupt';
  if (b.ownerId === run.s.protagonist.id) {
    addStat(run, 'stress', 15);
    addStat(run, 'happiness', -10);
    emit(run, 'ASSET_CHANGED', { change: 'BUSINESS_BANKRUPT', label: b.name, amount: Math.max(0, bizEquity(b)) });
  }
}

/** One month of every active company: sales, wages, overhead, interest, corporate tax, credit. */
export function monthlyBusinesses(run: Run): void {
  const s = run.s;
  const eco = s.world.economy;
  const period = taxPeriodFor(run);
  for (const id of Object.keys(s.businesses).sort()) {
    const b = s.businesses[id];
    if (!b || b.status !== 'active') continue;
    const sector = run.ctx.content.businessSectors.find((x) => x.id === b.sector);
    if (!sector) continue;
    const demand = Math.max(0.3, (1 + (eco.growthBp / 10_000) * 3) * (1 + b.demandShockBp / 10_000));
    const noise = run.rng.int(-sector.volatilityBp, sector.volatilityBp) / 10_000;
    // Diminishing returns: each extra hire adds a little less than the last (markets saturate).
    const revenue = Math.round((((b.employees * sector.revPerEmpRef) / 12) * wageScale(run) * demand * (1 + noise)) / (1 + b.employees / 200));
    const wages = Math.round(((b.employees * sector.wagePerEmpRef) / 12) * wageScale(run));
    const overhead = Math.round((sector.overheadRef / 12) * costScale(run));
    const interest = Math.round((debtOf(b) * (eco.rateBp + 300)) / 12 / 10_000);
    const profit = revenue - wages - overhead - interest;
    const tax = profit > 0 ? Math.round((profit * period.corporateBp) / 10_000) : 0;

    move(b, BIZ.cash, BIZ.revenue, revenue);
    move(b, BIZ.wages, BIZ.cash, wages);
    move(b, BIZ.overhead, BIZ.cash, overhead);
    move(b, BIZ.interest, BIZ.debt, interest);
    move(b, BIZ.tax, BIZ.cash, tax);
    b.thisYear.revenue += revenue;
    b.thisYear.costs += wages + overhead;
    b.thisYear.interest += interest;
    b.thisYear.tax += tax;

    const monthlyCosts = wages + overhead;
    if (acc(b, BIZ.cash) < 0) move(b, BIZ.cash, BIZ.debt, -acc(b, BIZ.cash)); // bank credit
    else if (debtOf(b) > 0 && acc(b, BIZ.cash) > monthlyCosts * 2) {
      move(b, BIZ.debt, BIZ.cash, Math.min(debtOf(b), acc(b, BIZ.cash) - monthlyCosts * 2));
    }
    // Banks lend against current sales: a company whose revenue collapses quickly loses its credit line.
    const creditLimit = Math.max(Math.round(revenue * 1.5), Math.round(sector.startupRef * costScale(run) * 0.25));
    if (debtOf(b) > creditLimit) bankrupt(run, b);
  }
}

/** Birthday: closed companies are dropped, years roll over and owners receive dividends. */
export function businessYear(run: Run): void {
  const s = run.s;
  const period = taxPeriodFor(run);
  for (const id of Object.keys(s.businesses).sort()) {
    const b = s.businesses[id];
    if (!b) continue;
    if (b.status === 'closed') {
      delete s.businesses[id];
      continue;
    }
    b.lastYear = b.thisYear;
    b.thisYear = { revenue: 0, costs: 0, tax: 0, interest: 0 };
    const monthlyCosts = Math.round((b.lastYear.costs + b.lastYear.interest) / 12);
    const free = acc(b, BIZ.cash) - monthlyCosts * 3;
    if (free > 0 && debtOf(b) === 0 && b.ownerId === s.protagonist.id) {
      const dividend = Math.floor((free * 0.5 * b.ownerSharePct) / 100);
      move(b, BIZ.dividends, BIZ.cash, dividend);
      transfer(s.finance, ACC.cash, ACC.dividends, dividend);
      s.finance.thisYear.income += dividend;
      chargeCost(run, ACC.tax, Math.round((dividend * period.dividendBp) / 10_000), 'tax');
    }
  }
}

/** When an NPC owner dies the company passes to an adult descendant protagonist, or is dissolved. */
export function businessesOnDeath(run: Run, npcId: string): void {
  const s = run.s;
  for (const b of ownedBy(s, npcId)) {
    const isHeir = currentAge(s) >= 18 && s.protagonist.parentIds.includes(npcId);
    if (isHeir) {
      b.ownerId = s.protagonist.id;
      emit(run, 'ASSET_CHANGED', { change: 'BUSINESS_INHERITED', label: b.name, amount: Math.max(0, bizEquity(b)) });
    } else {
      b.status = 'closed';
      b.closedReason = 'dissolved';
    }
  }
}

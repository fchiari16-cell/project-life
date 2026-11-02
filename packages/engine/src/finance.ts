import type { Business, Finance, GameState, YearTotals } from '@project-life/schemas';
import { incomeTaxAnnual, taxPeriodFor } from './economy.js';
import { activeUnion } from './genealogy.js';
import { isImprisoned, officeStipend } from './society.js';
import { localCountry } from './world.js';
import { CLASS_INDEX, currentAge, isStudying, type Run } from './run.js';

export const ACC = {
  cash: 'asset:cash',
  debt: 'liability:debt',
  salary: 'income:salary',
  pension: 'income:pension',
  welfare: 'income:welfare',
  inheritance: 'equity:inheritance',
  eventsIn: 'income:events',
  tax: 'expense:tax',
  living: 'expense:living',
  interest: 'expense:interest',
  tuition: 'expense:tuition',
  eventsOut: 'expense:events',
  invest: 'asset:invest',
  property: 'asset:property',
  mortgage: 'liability:mortgage',
  investIncome: 'income:invest',
  revaluation: 'income:revaluation',
  dividends: 'income:dividends',
  mortgageInterest: 'expense:mortgage_interest',
  propertyTax: 'expense:property_tax',
  bizInvest: 'expense:business_investment',
  bizSale: 'income:business_sale',
  sponsor: 'income:sponsor',
} as const;

/** Accounts of a company ledger (kept separate from the owner's personal ledger). */
export const BIZ = {
  cash: 'b:cash',
  debt: 'b:debt',
  equity: 'b:equity',
  revenue: 'b:revenue',
  wages: 'b:wages',
  overhead: 'b:overhead',
  interest: 'b:interest',
  tax: 'b:tax',
  dividends: 'b:dividends',
} as const;

/** Reference living cost per month, EUR cents (model value, scaled to country cost level). */
const LIVING_REF = 90_000;
const WELFARE_SHARE = 0.3;

export const emptyTotals = (): YearTotals => ({ income: 0, tax: 0, living: 0, interest: 0, other: 0 });
export const bal = (f: Finance, account: string): number => f.accounts[account] ?? 0;

/**
 * Atomic double-entry movement: `debit` rises by `amount`, `credit` falls by the same amount,
 * so the sum of all accounts never leaves zero. Integer minor units only.
 */
export function transfer(f: Finance, debit: string, credit: string, amount: number): void {
  if (!Number.isInteger(amount) || amount < 0) throw new RangeError(`invalid transfer amount ${amount}`);
  if (amount === 0) return;
  f.accounts[debit] = bal(f, debit) + amount;
  f.accounts[credit] = bal(f, credit) - amount;
}

export const cash = (s: GameState): number => bal(s.finance, ACC.cash);
export const debtOwed = (s: GameState): number => 0 - bal(s.finance, ACC.debt);
export const investments = (s: GameState): number => bal(s.finance, ACC.invest);
export const propertyValue = (s: GameState): number => bal(s.finance, ACC.property);
export const mortgageOwed = (s: GameState): number => 0 - bal(s.finance, ACC.mortgage);
const bizBal = (b: Business, a: string): number => b.accounts[a] ?? 0;
/** Book equity of a company: its cash minus what it owes. */
export const bizEquity = (b: Business): number => bizBal(b, BIZ.cash) + bizBal(b, BIZ.debt);
/** What the protagonist's stakes in active companies are worth on the books (never below zero: limited liability). */
export const stakeValue = (s: GameState): number =>
  Object.values(s.businesses)
    .filter((b) => b.status === 'active' && b.ownerId === s.protagonist.id)
    .reduce((sum, b) => sum + Math.round((Math.max(0, bizEquity(b)) * b.ownerSharePct) / 100), 0);
/** Everything owned minus everything owed, personal and business stakes included. */
export const netWorth = (s: GameState): number =>
  cash(s) + investments(s) + propertyValue(s) + stakeValue(s) - debtOwed(s) - mortgageOwed(s);

/** Local minor units per reference EUR cent for wages / for living-cost items. */
export function wageScale(run: { s: GameState; country: { fxPerEur: number; wageFactor: number } }): number {
  return (run.country.fxPerEur * run.country.wageFactor * run.s.world.priceIndex * (run.s.finance.minorUnits / 100)) / 10_000;
}
export function costScale(run: { s: GameState; country: { fxPerEur: number; wageFactor: number } }): number {
  return (run.country.fxPerEur * (0.35 + 0.65 * run.country.wageFactor) * run.s.world.priceIndex * (run.s.finance.minorUnits / 100)) / 10_000;
}

/** Borrow whatever is needed to bring cash back to zero. */
export function settleShortfall(s: GameState): void {
  const c = cash(s);
  if (c < 0) transfer(s.finance, ACC.cash, ACC.debt, -c);
}

export function chargeCost(run: Run, account: string, amount: number, bucket: keyof YearTotals): void {
  transfer(run.s.finance, account, ACC.cash, amount);
  run.s.finance.thisYear[bucket] += amount;
  settleShortfall(run.s);
}

export function monthlyFinance(run: Run): void {
  const s = run.s;
  const f = s.finance;
  const age = currentAge(s);
  const wage = wageScale(run);
  const cost = costScale(run);

  let gross = 0;
  let grossAccount: string = ACC.salary;
  if (s.career.job) gross = Math.round(s.career.job.salary / 12);
  else if (s.career.retired && s.career.pension > 0) {
    gross = Math.round(s.career.pension / 12);
    grossAccount = ACC.pension;
  }
  gross += Math.round(officeStipend(run) / 12); // public office pays a stipend on top of any job
  const jailed = isImprisoned(s);
  const policy = localCountry(s).politics;
  const living = age >= 18 && !jailed ? Math.round(LIVING_REF * cost) : 0;
  const studentSupported = isStudying(s) && CLASS_INDEX[s.family.class] >= CLASS_INDEX.middle;
  // Placeholder safety net until institutions exist (M4).
  const welfare =
    age >= 18 && gross === 0 && !isStudying(s) && !jailed ? Math.round((LIVING_REF * cost * WELFARE_SHARE * policy.welfareBp) / 3000) : 0;
  // Income tax: the versioned rule set for this territory and year, applied to annualised pay and spread monthly.
  const tax = Math.round(((incomeTaxAnnual(taxPeriodFor(run), gross * 12, wage) / 12) * (10_000 + policy.taxAdjustBp)) / 10_000);
  const interest = Math.round((debtOwed(s) * (s.world.economy.rateBp + 300)) / 12 / 10_000);
  const dependents = Object.values(s.npcs).filter(
    (n) => n.deathYear === null && n.parentIds.includes(s.protagonist.id) && s.world.currentDate.year - n.birthYear < 18,
  ).length;
  // Each dependent child costs 30% of a reference adult; a partner shares half of it.
  const childCost = Math.round(dependents * LIVING_REF * cost * 0.3 * (activeUnion(s) ? 0.5 : 1));
  // Owning a home replaces rent (about 35% of living costs); the mortgage is paid separately.
  const housingFactor = Object.keys(s.properties).length > 0 ? 0.65 : 1;
  const livingCost = Math.round((studentSupported ? 0 : living) * housingFactor) + childCost;

  transfer(f, ACC.cash, grossAccount, gross);
  transfer(f, ACC.cash, ACC.welfare, welfare);
  transfer(f, ACC.tax, ACC.cash, tax);
  transfer(f, ACC.living, ACC.cash, livingCost);
  transfer(f, ACC.interest, ACC.debt, interest);
  f.thisYear.income += gross + welfare;
  f.thisYear.tax += tax;
  f.thisYear.living += livingCost;
  f.thisYear.interest += interest;

  settleShortfall(s);
  const buffer = livingCost * 3;
  const owed = debtOwed(s);
  if (owed > 0 && cash(s) > buffer) transfer(f, ACC.debt, ACC.cash, Math.min(owed, cash(s) - buffer));
}

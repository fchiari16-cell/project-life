import { taxPeriodFor } from './economy.js';
import { ACC, cash, chargeCost, costScale, debtOwed, investments, settleShortfall, transfer } from './finance.js';
import { currentAge, emit, type Run } from './run.js';

const LIVING_REF = 90_000;
const MORTGAGE_MONTHS = 300;
const DOWN_PAYMENT = 0.2;
const CLOSING_COSTS = 0.02;
const FORECLOSURE_AFTER_MONTHS = 24;

const livingMonthly = (run: Run): number => Math.round(LIVING_REF * costScale(run));

/** (1 + r)^n by repeated multiplication, so every JS engine produces bit-identical results. */
function compound(r: number, n: number): number {
  let x = 1;
  for (let i = 0; i < n; i++) x *= 1 + r;
  return x;
}

/** Fixed annuity payment for a loan. */
export function annuity(principal: number, rateBp: number, months: number): number {
  const r = rateBp / 10_000 / 12;
  if (r === 0) return Math.ceil(principal / months);
  const g = compound(r, months);
  return Math.ceil((principal * r * g) / (g - 1));
}

/* ------------------------------ investments ------------------------ */
export function investSavings(run: Run, pct: number): void {
  const s = run.s;
  const buffer = livingMonthly(run) * 3;
  const free = cash(s) - buffer - (debtOwed(s) > 0 ? cash(s) : 0);
  const amount = Math.floor((Math.max(0, free) * pct) / 100);
  if (amount <= 0) return;
  transfer(s.finance, ACC.invest, ACC.cash, amount);
  emit(run, 'ASSET_CHANGED', { change: 'INVESTED', label: null, amount });
}

export function sellInvestments(run: Run): void {
  const amount = investments(run.s);
  if (amount <= 0) return;
  transfer(run.s.finance, ACC.cash, ACC.invest, amount);
  emit(run, 'ASSET_CHANGED', { change: 'DIVESTED', label: null, amount });
}

/** Monthly mark-to-market of the portfolio at the World Engine's stock return. */
function revalueInvestments(run: Run): void {
  const s = run.s;
  const held = investments(s);
  if (held <= 0) return;
  const change = Math.round((held * s.world.economy.stockReturnBp) / 12 / 10_000);
  if (change >= 0) transfer(s.finance, ACC.invest, ACC.investIncome, change);
  else transfer(s.finance, ACC.investIncome, ACC.invest, -change);
  s.finance.gainsThisYear += change;
}

/* ------------------------------ property --------------------------- */
export function buyHome(run: Run): void {
  const s = run.s;
  const salary = s.career.job?.salary ?? 0;
  if (salary <= 0 || Object.keys(s.properties).length > 0 || currentAge(s) < 21) return;
  const price = Math.round(salary * 4);
  const down = Math.round(price * DOWN_PAYMENT);
  const closing = Math.round(price * CLOSING_COSTS);
  if (debtOwed(s) > 0) return; // the bank says no to borrowers already in debt
  if (cash(s) < down + closing + livingMonthly(run) * 6) return; // and the household keeps six months of reserves
  const loan = price - down;
  const rateBp = Math.max(200, s.world.economy.rateBp + 150);
  const id = `${s.id}:home${Object.keys(s.properties).length}:${s.world.currentDate.year}`;
  transfer(s.finance, ACC.property, ACC.cash, down);
  transfer(s.finance, ACC.property, ACC.mortgage, loan);
  chargeCost(run, ACC.eventsOut, closing, 'other');
  s.properties[id] = {
    id,
    purchaseYear: s.world.currentDate.year,
    purchasePrice: price,
    value: price,
    loan,
    paymentMonthly: annuity(loan, rateBp, MORTGAGE_MONTHS),
    rateBp,
    missed: 0,
  };
  emit(run, 'ASSET_CHANGED', { change: 'HOME_BOUGHT', label: null, amount: price });
}

function closeProperty(run: Run, id: string, proceeds: number, change: 'HOME_SOLD' | 'HOME_FORECLOSED'): void {
  const s = run.s;
  const p = s.properties[id];
  if (!p) return;
  transfer(s.finance, ACC.cash, ACC.property, proceeds);
  transfer(s.finance, ACC.mortgage, ACC.cash, p.loan);
  transfer(s.finance, ACC.revaluation, ACC.property, p.value - proceeds); // the haircut of a forced sale
  delete s.properties[id];
  settleShortfall(s);
  emit(run, 'ASSET_CHANGED', { change, label: null, amount: proceeds });
}

export function sellHome(run: Run): void {
  const first = Object.keys(run.s.properties).sort()[0];
  const p = first ? run.s.properties[first] : undefined;
  if (first && p) closeProperty(run, first, p.value, 'HOME_SOLD');
}

function payMortgages(run: Run): void {
  const s = run.s;
  for (const id of Object.keys(s.properties).sort()) {
    const p = s.properties[id];
    if (!p || p.loan <= 0) continue;
    const interest = Math.round((p.loan * p.rateBp) / 12 / 10_000);
    const principal = Math.min(p.loan, Math.max(0, p.paymentMonthly - interest));
    transfer(s.finance, ACC.mortgageInterest, ACC.cash, interest);
    transfer(s.finance, ACC.mortgage, ACC.cash, principal);
    s.finance.thisYear.interest += interest;
    p.loan -= principal;
  }
  settleShortfall(s);
  for (const id of Object.keys(s.properties).sort()) {
    const p = s.properties[id];
    if (!p) continue;
    p.missed = debtOwed(s) > 0 && p.loan > 0 ? p.missed + 1 : 0;
    if (p.missed >= FORECLOSURE_AFTER_MONTHS) closeProperty(run, id, Math.round(p.value * 0.85), 'HOME_FORECLOSED');
  }
}

export function monthlyAssets(run: Run): void {
  revalueInvestments(run);
  payMortgages(run);
}

/** January: homes follow the housing index. */
export function revalueProperties(run: Run): void {
  const s = run.s;
  for (const id of Object.keys(s.properties).sort()) {
    const p = s.properties[id];
    if (!p) continue;
    const next = Math.round((p.value * (10_000 + s.world.economy.housingBp)) / 10_000);
    const delta = next - p.value;
    if (delta >= 0) transfer(s.finance, ACC.property, ACC.revaluation, delta);
    else transfer(s.finance, ACC.revaluation, ACC.property, -delta);
    p.value = next;
  }
}

/** Birthday: tax on the year's investment gains and on property held. */
export function assetsYear(run: Run): void {
  const s = run.s;
  const period = taxPeriodFor(run);
  const gains = Math.max(0, s.finance.gainsThisYear);
  if (gains > 0) chargeCost(run, ACC.tax, Math.round((gains * period.capitalGainsBp) / 10_000), 'tax');
  s.finance.gainsThisYear = 0;
  for (const p of Object.values(s.properties)) {
    const tax = Math.round((p.value * period.propertyTaxBp) / 10_000);
    if (tax > 0) chargeCost(run, ACC.propertyTax, tax, 'tax');
  }
}

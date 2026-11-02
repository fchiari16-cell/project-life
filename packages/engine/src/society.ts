import type { CountryDef, GameState, OfficeLevel, Qualification, Society } from '@project-life/schemas';
import { sellHome } from './assets.js';
import { ownedBy, sellBusiness } from './business.js';
import { incomeTaxAnnual, taxPeriodFor } from './economy.js';
import { ACC, chargeCost, transfer, wageScale } from './finance.js';
import { childrenOf, partnerIdOf } from './genealogy.js';
import { nudge, relOf } from './npc.js';
import { addStat, clamp100, currentAge, emit, expandQualifications, type Run } from './run.js';
import { pickCity } from './simulate.js';
import { separate } from './social.js';
import { localCountry, syncLocal, trackPerson, untrackPerson } from './world.js';

const OFFICE_PAY_REF: Record<OfficeLevel, number> = { councillor: 1_200_000, deputy: 4_500_000, minister: 9_000_000 };
const OFFICE_WEIGHT: Record<OfficeLevel, number> = { councillor: 0.5, deputy: 1, minister: 2 };
const SPONSOR_REF = 15_000;
const VISA_YEARS = 3;

export function defaultSociety(countryCode: string, year: number): Society {
  return {
    party: null,
    office: null,
    officeSince: null,
    hiddenOffence: null,
    legal: null,
    record: false,
    fame: { notoriety: 3, credibility: 50, influence: 2, reputation: 50 },
    citizenships: [countryCode],
    residence: { countryCode, status: 'citizen', since: year, visaUntil: null },
    unrecognized: [],
  };
}

export const isImprisoned = (s: GameState): boolean => s.society.legal?.stage === 'imprisoned';

/** Annual stipend of the office held, in local minor units (0 when none). */
export function officeStipend(run: Pick<Run, 's' | 'country'>): number {
  const o = run.s.society.office;
  return o ? Math.round(OFFICE_PAY_REF[o] * wageScale(run)) : 0;
}

const countryDef = (run: Run, code: string): CountryDef | undefined => run.ctx.content.countries.find((c) => c.code === code);

const RECOGNITION: Record<Qualification, number> = { primary: 1, secondary: 0.9, vocational: 0.5, bachelor: 0.7, master: 0.65, doctorate: 0.75 };
/** Chance that a qualification earned in one country is recognised in another (same bloc: always). */
export const recognitionProb = (from: CountryDef, to: CountryDef, q: Qualification): number => (from.bloc === to.bloc ? 1 : RECOGNITION[q]);

/* ------------------------------ fame ------------------------------- */
export function addFame(run: Run, dim: keyof Society['fame'], delta: number): void {
  const f = run.s.society.fame;
  f[dim] = clamp100(f[dim] + delta);
}

/* ------------------------------ politics --------------------------- */
export function joinParty(run: Run, partyId: string): void {
  const party = run.ctx.content.parties.find((p) => p.id === partyId);
  if (!party || currentAge(run.s) < 18) return;
  run.s.society.party = party.id;
  addFame(run, 'influence', 3);
  emit(run, 'SOCIETY', { change: 'JOINED_PARTY', detail: party.name });
}

export function leaveParty(run: Run): void {
  const soc = run.s.society;
  if (!soc.party) return;
  soc.party = null;
  soc.office = null;
  soc.officeSince = null;
  emit(run, 'SOCIETY', { change: 'LEFT_PARTY', detail: null });
}

export function grantOffice(run: Run, level: OfficeLevel): void {
  const soc = run.s.society;
  if (!soc.party || soc.legal || currentAge(run.s) < 21) return;
  soc.office = level;
  soc.officeSince = run.s.world.currentDate.year;
  addFame(run, 'notoriety', 15);
  addFame(run, 'influence', 10);
  emit(run, 'SOCIETY', { change: 'ELECTED', detail: level });
}

export function resign(run: Run): void {
  const soc = run.s.society;
  if (!soc.office) return;
  soc.office = null;
  soc.officeSince = null;
  emit(run, 'SOCIETY', { change: 'RESIGNED', detail: null });
}

/** An office-holder's vote moves the country's policy; ministers count more than councillors. */
export function enactPolicy(run: Run, kind: 'cut_taxes' | 'raise_welfare' | 'green' | 'austerity'): void {
  const soc = run.s.society;
  if (!soc.office) return;
  const m = OFFICE_WEIGHT[soc.office];
  const c = localCountry(run.s);
  const p = c.politics;
  const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, Math.round(n)));
  switch (kind) {
    case 'cut_taxes':
      p.taxAdjustBp = clamp(p.taxAdjustBp - 200 * m, -3000, 3000);
      p.approvalBp = clamp(p.approvalBp + 100 * m, 0, 10_000);
      p.debtBp = clamp(p.debtBp + 150 * m, 0, 40_000);
      break;
    case 'raise_welfare':
      p.welfareBp = clamp(p.welfareBp + 300 * m, 0, 8000);
      p.approvalBp = clamp(p.approvalBp + 200 * m, 0, 10_000);
      p.debtBp = clamp(p.debtBp + 200 * m, 0, 40_000);
      break;
    case 'green':
      c.environment.stress = clamp(c.environment.stress - 3 * m, 0, 100);
      p.debtBp = clamp(p.debtBp + 100 * m, 0, 40_000);
      break;
    case 'austerity':
      p.taxAdjustBp = clamp(p.taxAdjustBp + 200 * m, -3000, 3000);
      p.welfareBp = clamp(p.welfareBp - 300 * m, 0, 8000);
      p.debtBp = clamp(p.debtBp - 300 * m, 0, 40_000);
      p.approvalBp = clamp(p.approvalBp - 200 * m, 0, 10_000);
      break;
  }
  run.s.world.history.push({ year: run.s.world.currentDate.year, countryCode: c.code, kind: 'POLICY', detail: kind });
  if (run.s.world.history.length > 80) run.s.world.history.shift();
  addFame(run, 'influence', 2);
  emit(run, 'SOCIETY', { change: 'POLICY_PASSED', detail: kind });
}

/* ------------------------------ justice ---------------------------- */
/** An abstract illicit act. Nothing happens to the protagonist until (and unless) it is discovered. */
export function commitOffence(run: Run, severity: number): void {
  const soc = run.s.society;
  if (soc.hiddenOffence || soc.legal) return;
  const corruption = localCountry(run.s) ? (countryDef(run, run.s.location.countryCode)?.corruption ?? 40) : 40;
  soc.hiddenOffence = { severity, year: run.s.world.currentDate.year, evidence: clamp100(run.rng.int(10, 40) - (corruption - 40) / 4) };
  emit(run, 'SOCIETY', { change: 'OFFENCE_COMMITTED', detail: String(severity) });
}

/** An accusation without proof of guilt: a case exists, but conviction is far from certain. */
export function beAccused(run: Run, evidence: number): void {
  const soc = run.s.society;
  if (soc.legal) return;
  soc.legal = { offense: 'accusation', severity: 1, stage: 'investigation', evidence, sinceYear: run.s.world.currentDate.year, lawyer: false, plea: false, releaseYear: null };
  addFame(run, 'reputation', -8);
  emit(run, 'SOCIETY', { change: 'INVESTIGATION_OPENED', detail: 'accusation' });
}

export function legalAction(run: Run, action: 'lawyer' | 'plea' | 'self'): void {
  const legal = run.s.society.legal;
  if (!legal || legal.stage !== 'charged') return;
  if (action === 'lawyer') legal.lawyer = true;
  if (action === 'plea') legal.plea = true;
  legal.stage = 'trial';
  legal.sinceYear = run.s.world.currentDate.year;
}

function legalYear(run: Run): void {
  const s = run.s;
  const soc = s.society;
  const year = s.world.currentDate.year;
  const strict = countryDef(run, s.location.countryCode)?.courtStrictness ?? 50;
  if (soc.hiddenOffence && !soc.legal) {
    if (run.rng.float() < 0.12 * (strict / 50)) {
      const h = soc.hiddenOffence;
      soc.legal = { offense: 'offence', severity: h.severity, stage: 'investigation', evidence: clamp100(h.evidence + run.rng.int(0, 20)), sinceYear: year, lawyer: false, plea: false, releaseYear: null };
      soc.hiddenOffence = null;
      addFame(run, 'reputation', -10);
      emit(run, 'SOCIETY', { change: 'INVESTIGATION_OPENED', detail: 'offence' });
    }
    return;
  }
  const legal = soc.legal;
  if (!legal) return;
  switch (legal.stage) {
    case 'investigation':
      if (legal.evidence >= 35) {
        legal.stage = 'charged';
        legal.sinceYear = year;
        addFame(run, 'notoriety', 5);
        addFame(run, 'reputation', -10);
        addStat(run, 'stress', 8);
        emit(run, 'SOCIETY', { change: 'CHARGED', detail: null });
      } else {
        soc.legal = null;
        emit(run, 'SOCIETY', { change: 'CASE_DROPPED', detail: null });
      }
      break;
    case 'charged':
      if (year - legal.sinceYear >= 1) legal.stage = 'trial'; // no decision taken: the trial goes ahead undefended
      break;
    case 'trial': {
      const p = Math.max(0.02, Math.min(0.97, (legal.evidence / 100) * (0.5 + strict / 200) - (legal.lawyer ? 0.25 : 0)));
      if (legal.plea || run.rng.float() < p) {
        const years = Math.max(1, Math.round(legal.severity * 2 * (legal.plea ? 0.5 : 1)));
        legal.stage = 'imprisoned';
        legal.releaseYear = year + years;
        soc.record = true;
        soc.office = null;
        soc.officeSince = null;
        if (s.career.job) {
          emit(run, 'JOB_CHANGED', { change: 'LOST', professionId: s.career.job.professionId, salary: 0 });
          s.career.job = null;
        }
        addFame(run, 'reputation', -25);
        emit(run, 'SOCIETY', { change: 'CONVICTED', detail: String(years) });
      } else {
        soc.legal = null;
        addFame(run, 'reputation', 5);
        emit(run, 'SOCIETY', { change: 'ACQUITTED', detail: null });
      }
      break;
    }
    case 'imprisoned':
      if (legal.releaseYear !== null && year >= legal.releaseYear) {
        soc.legal = null;
        addFame(run, 'reputation', -5);
        emit(run, 'SOCIETY', { change: 'RELEASED', detail: null });
      }
      break;
  }
}

/* ------------------------------ residence & migration -------------- */
/** Moves the protagonist (and the family who go with them) to another country. */
export function relocate(run: Run, toCode: string, status: 'visa' | 'resident' | 'citizen'): void {
  const s = run.s;
  const from = countryDef(run, s.location.countryCode);
  const to = countryDef(run, toCode);
  if (!from || !to || from.code === to.code) return;
  // Property and companies stay behind: they are sold on the way out.
  while (Object.keys(s.properties).length > 0) sellHome(run);
  while (ownedBy(s, s.protagonist.id).length > 0) sellBusiness(run);

  // Money keeps its value: balances are converted at the exchange rate, rounding drift goes to an FX account.
  const ratio = (to.fxPerEur / from.fxPerEur) * (to.minorUnits / s.finance.minorUnits);
  const acc = s.finance.accounts;
  for (const k of Object.keys(acc)) acc[k] = Math.round((acc[k] ?? 0) * ratio);
  const drift = Object.values(acc).reduce((a, b) => a + b, 0);
  if (drift !== 0) acc['equity:fx'] = (acc['equity:fx'] ?? 0) - drift;
  s.finance.currency = to.currency;
  s.finance.minorUnits = to.minorUnits;
  s.finance.thisYear = { income: 0, tax: 0, living: 0, interest: 0, other: 0 };
  s.finance.lastYear = null;
  s.finance.gainsThisYear = Math.round(s.finance.gainsThisYear * ratio);
  // Pay follows purchasing power: exchange rate and the destination's wage level.
  const pay = (to.fxPerEur * to.wageFactor * to.minorUnits) / (from.fxPerEur * from.wageFactor * from.minorUnits);
  if (s.career.job) s.career.job.salary = Math.round(s.career.job.salary * pay);
  s.career.pension = Math.round(s.career.pension * pay);

  // Qualifications may not be recognised abroad; a job that needs them is lost.
  s.society.unrecognized = expandQualifications(s.education.qualifications).filter((q) => run.rng.float() >= recognitionProb(from, to, q));
  const job = s.career.job;
  if (job) {
    const prof = run.ctx.content.professions.find((p) => p.id === job.professionId);
    const valid = expandQualifications(s.education.qualifications).filter((q) => !s.society.unrecognized.includes(q));
    if (prof && prof.requires.length > 0 && !prof.requires.some((q) => valid.includes(q))) {
      emit(run, 'JOB_CHANGED', { change: 'LOST', professionId: job.professionId, salary: 0 });
      s.career.job = null;
    }
  }

  // Family: a partner may follow or the relationship ends; minor children come along; distance cools everyone else.
  const partnerId = partnerIdOf(s);
  const minors = childrenOf(s, s.protagonist.id).filter((c) => c.deathYear === null && s.world.currentDate.year - c.birthYear < 18).map((c) => c.id);
  let followers: string[] = [...minors];
  if (partnerId) {
    if (run.rng.float() < 0.7) followers.push(partnerId);
    else separate(run);
  }
  followers = followers.filter((id) => s.npcs[id]);
  for (const id of Object.keys(s.relationships)) {
    const r = s.relationships[id];
    if (!r || r.from !== s.protagonist.id || followers.includes(r.to)) continue;
    nudge(r, 'familiarity', -15);
    nudge(r, 'affection', -5);
    nudge(relOf(s, r.to, s.protagonist.id), 'familiarity', -15);
    nudge(relOf(s, r.to, s.protagonist.id), 'affection', -5);
  }
  untrackPerson(s, from.code);
  trackPerson(s, to.code, false);
  for (const id of followers) {
    const n = s.npcs[id];
    if (!n || n.deathYear !== null) continue;
    untrackPerson(s, n.countryCode);
    trackPerson(s, to.code, false);
    n.countryCode = to.code;
  }

  const year = s.world.currentDate.year;
  s.location = { countryCode: to.code, city: pickCity(run.rng, to.cities) };
  s.society.residence = { countryCode: to.code, status, since: year, visaUntil: status === 'visa' ? year + VISA_YEARS : null };
  if (status === 'citizen' && !s.society.citizenships.includes(to.code)) s.society.citizenships.push(to.code);
  run.country = to;
  syncLocal(s);
  emit(run, 'SOCIETY', { change: 'MOVED', detail: to.code });
}

export function grantResidency(run: Run): void {
  const r = run.s.society.residence;
  if (r.status !== 'visa') return;
  run.s.society.residence = { ...r, status: 'resident', since: run.s.world.currentDate.year, visaUntil: null };
  emit(run, 'SOCIETY', { change: 'RESIDENCY_GRANTED', detail: r.countryCode });
}

export function naturalize(run: Run): void {
  const s = run.s;
  const r = s.society.residence;
  if (r.status !== 'resident') return;
  const here = countryDef(run, r.countryCode);
  s.society.citizenships = here?.dualCitizenship ? [...new Set([...s.society.citizenships, r.countryCode])] : [r.countryCode];
  s.society.residence = { ...r, status: 'citizen', since: s.world.currentDate.year };
  emit(run, 'SOCIETY', { change: 'CITIZENSHIP_GRANTED', detail: r.countryCode });
}

export function recogniseQualifications(run: Run): void {
  if (run.s.society.unrecognized.length === 0) return;
  run.s.society.unrecognized = [];
  emit(run, 'SOCIETY', { change: 'QUALIFICATION_RECOGNISED', detail: null });
}

export function returnHome(run: Run): void {
  const home = run.s.society.citizenships.find((c) => c !== run.s.location.countryCode);
  if (home) relocate(run, home, 'citizen');
}

/* ------------------------------ yearly ----------------------------- */
/** Birthday: fame fades, sponsors pay, offices face re-election, courts move, visas expire. */
export function societyYear(run: Run): void {
  const s = run.s;
  const soc = s.society;
  const year = s.world.currentDate.year;
  const f = soc.fame;
  const sponsor = f.notoriety >= 40 && !soc.record ? Math.round((f.notoriety - 30) * SPONSOR_REF * wageScale(run)) : 0;
  f.notoriety = clamp100(f.notoriety - 2);
  f.influence = clamp100(f.influence - 1);
  f.credibility = clamp100(f.credibility + (50 - f.credibility) * 0.1);
  f.reputation = clamp100(f.reputation + (50 - f.reputation) * 0.05);
  if (sponsor > 0) {
    transfer(s.finance, ACC.cash, ACC.sponsor, sponsor);
    s.finance.thisYear.income += sponsor;
    chargeCost(run, ACC.tax, incomeTaxAnnual(taxPeriodFor(run), sponsor, wageScale(run)), 'tax');
  }

  legalYear(run);

  if (soc.office && localCountry(s).politics.lastElection === year) {
    const approval = localCountry(s).politics.approvalBp;
    const governing = localCountry(s).politics.governingParty === soc.party;
    const p = Math.max(0.05, Math.min(0.9, 0.3 + f.notoriety / 200 + f.credibility / 300 + (governing ? (approval - 5000) / 20_000 : -(approval - 5000) / 40_000)));
    if (run.rng.float() < p) {
      soc.officeSince = year;
      emit(run, 'SOCIETY', { change: 'RE_ELECTED', detail: soc.office });
    } else {
      soc.office = null;
      soc.officeSince = null;
      emit(run, 'SOCIETY', { change: 'OFFICE_LOST', detail: null });
    }
  }

  const r = soc.residence;
  if (r.status === 'visa' && r.visaUntil !== null && year > r.visaUntil) {
    emit(run, 'SOCIETY', { change: 'VISA_EXPIRED', detail: r.countryCode });
    returnHome(run);
  }
}

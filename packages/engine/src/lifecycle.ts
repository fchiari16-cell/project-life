import type { Job, Qualification, SimulationContext, StatKey } from '@project-life/schemas';
import { ACC, bal, chargeCost, costScale, debtOwed, emptyTotals } from './finance.js';
import { assetsYear, revalueProperties } from './assets.js';
import { businessYear } from './business.js';
import { societyYear } from './society.js';
import { trackDeath, worldYear } from './world.js';
import { npcYear } from './social.js';
import { CLASS_INDEX, addStat, clamp100, currentAge, emit, isStudying, type Run } from './run.js';

const TUITION_UNIVERSITY_REF = 400_000;
const TUITION_VOCATIONAL_REF = 150_000;
const TUITION_POSTGRADUATE_REF = 300_000;
export /** Which learned skill a career family trains. */
const SKILL_OF: Record<string, 'social' | 'technical' | 'creative' | 'physical'> = {
  service: 'social', management: 'social', teaching: 'social', legal: 'social', public_service: 'social',
  technical: 'technical', research: 'technical', medical: 'technical', office: 'technical',
  creative: 'creative', performing: 'creative',
  security: 'physical', sports: 'physical', craft: 'physical', logistics: 'physical', care: 'physical',
};

const RETIREMENT_AGE = 67;

/* ------------------------------ death ------------------------------ */
export function die(run: Run, cause: string): void {
  if (run.died) return;
  const s = run.s;
  s.protagonist.death = { date: s.world.currentDate, cause };
  s.simulation.pending = null;
  run.died = true;
  trackDeath(s, s.location.countryCode);
  emit(run, 'DEATH', { personId: s.protagonist.id, age: currentAge(s), cause });
}

/* ------------------------------ education -------------------------- */
function addQualification(run: Run, q: Qualification): void {
  if (!run.s.education.qualifications.includes(q)) run.s.education.qualifications.push(q);
}

export function chargeTuition(run: Run): void {
  const s = run.s;
  const ref =
    s.education.stage === 'university'
      ? TUITION_UNIVERSITY_REF
      : s.education.stage === 'vocational'
        ? TUITION_VOCATIONAL_REF
        : s.education.stage === 'postgraduate'
          ? TUITION_POSTGRADUATE_REF
          : 0;
  if (ref === 0 || CLASS_INDEX[s.family.class] >= CLASS_INDEX.upper_middle) return; // family pays
  const share = s.education.scholarship ? 0.5 : 1;
  chargeCost(run, ACC.tuition, Math.round(ref * costScale(run) * share), 'other');
}

export function enroll(run: Run, path: 'university' | 'vocational' | 'work' | 'master' | 'doctorate'): void {
  const e = run.s.education;
  e.yearsInStage = 0;
  if (path === 'work') {
    e.stage = 'finished';
    emit(run, 'EDUCATION_CHANGED', { change: 'FINISHED', stage: 'finished', qualification: null });
    return;
  }
  const postgraduate = path === 'master' || path === 'doctorate';
  e.stage = postgraduate ? 'postgraduate' : path;
  e.postgraduate = postgraduate ? path : null;
  e.scholarship = (path === 'university' || postgraduate) && e.performance >= 80;
  emit(run, 'EDUCATION_CHANGED', { change: 'ENROLLED', stage: e.stage, qualification: null });
  chargeTuition(run);
}

function yearlyPerformance(run: Run): number {
  const s = run.s;
  const { stats, traits } = s.protagonist;
  const score =
    0.3 * stats.intelligence +
    0.2 * traits.discipline +
    0.1 * (100 - stats.stress) +
    0.1 * stats.health +
    0.1 * traits.curiosity +
    CLASS_INDEX[s.family.class] * 3 +
    (s.protagonist.talents.some((id) => run.ctx.content.talents.find((t) => t.id === id)?.academic) ? 5 : 0) +
    run.rng.int(-10, 10);
  return clamp100(score);
}

function educationBirthday(run: Run, age: number): void {
  const e = run.s.education;
  if (isStudying(run.s)) {
    e.performance = clamp100(0.6 * e.performance + 0.4 * yearlyPerformance(run));
    e.yearsInStage += 1;
  }
  switch (e.stage) {
    case 'none':
      if (age >= 6) {
        e.stage = 'primary';
        e.yearsInStage = 0;
        e.performance = run.s.protagonist.stats.intelligence;
        emit(run, 'EDUCATION_CHANGED', { change: 'ENROLLED', stage: 'primary', qualification: null });
      }
      break;
    case 'primary':
      if (e.yearsInStage >= 5) {
        addQualification(run, 'primary');
        e.stage = 'secondary';
        e.yearsInStage = 0;
        emit(run, 'EDUCATION_CHANGED', { change: 'GRADUATED', stage: 'secondary', qualification: 'primary' });
      }
      break;
    case 'secondary':
      if (e.yearsInStage >= 7) {
        e.yearsInStage = 0;
        if (e.performance >= 30) {
          addQualification(run, 'secondary');
          e.stage = 'choice';
          emit(run, 'EDUCATION_CHANGED', { change: 'GRADUATED', stage: 'choice', qualification: 'secondary' });
        } else {
          e.stage = 'finished';
          emit(run, 'EDUCATION_CHANGED', { change: 'DROPPED_OUT', stage: 'finished', qualification: null });
        }
      }
      break;
    case 'choice':
      // The choice event is forced on this birthday; if it somehow went unanswered, move on to work.
      if (e.yearsInStage > 0) enroll(run, 'work');
      else e.yearsInStage += 1;
      break;
    case 'university':
      if (e.yearsInStage >= 4) {
        e.stage = 'finished';
        e.yearsInStage = 0;
        if (e.performance >= 35) {
          addQualification(run, 'bachelor');
          emit(run, 'EDUCATION_CHANGED', { change: 'GRADUATED', stage: 'finished', qualification: 'bachelor' });
        } else emit(run, 'EDUCATION_CHANGED', { change: 'DROPPED_OUT', stage: 'finished', qualification: null });
      } else chargeTuition(run);
      break;
    case 'vocational':
      if (e.yearsInStage >= 2) {
        e.stage = 'finished';
        e.yearsInStage = 0;
        if (e.performance >= 30) {
          addQualification(run, 'vocational');
          emit(run, 'EDUCATION_CHANGED', { change: 'GRADUATED', stage: 'finished', qualification: 'vocational' });
        } else emit(run, 'EDUCATION_CHANGED', { change: 'DROPPED_OUT', stage: 'finished', qualification: null });
      } else chargeTuition(run);
      break;
    case 'postgraduate': {
      const years = e.postgraduate === 'doctorate' ? 4 : 2;
      if (e.yearsInStage >= years) {
        const degree = e.postgraduate ?? 'master';
        e.stage = 'finished';
        e.postgraduate = null;
        e.yearsInStage = 0;
        if (e.performance >= (degree === 'doctorate' ? 45 : 40)) {
          addQualification(run, degree);
          emit(run, 'EDUCATION_CHANGED', { change: 'GRADUATED', stage: 'finished', qualification: degree });
        } else emit(run, 'EDUCATION_CHANGED', { change: 'DROPPED_OUT', stage: 'finished', qualification: null });
      } else chargeTuition(run);
      break;
    }
    case 'finished':
      break;
  }
}

/* ------------------------------ career ----------------------------- */
/** Level title of a job, e.g. "Senior" + specialization, from its archetype ladder. */
export function jobTitle(content: SimulationContext['content'], job: Job): string {
  const prof = content.professions.find((p) => p.id === job.professionId);
  const arch = content.archetypes.find((a) => a.id === prof?.archetype);
  const level = arch ? (arch.levelTitles[Math.min(job.level, arch.levelTitles.length) - 1] ?? '') : '';
  const spec = prof?.specializations.find((x) => x.id === job.specialization)?.title;
  return [prof?.title ?? job.professionId, level && job.level > 1 ? level : '', spec ?? ''].filter(Boolean).join(' · ');
}

function careerBirthday(run: Run, age: number): void {
  const c = run.s.career;
  const { traits, stats } = run.s.protagonist;
  if (c.job) {
    c.job.yearsInRole += 1;
    const own = run.ctx.content.professions.find((p) => p.id === c.job?.professionId);
    const ownArch = run.ctx.content.archetypes.find((a) => a.id === own?.archetype);
    if (ownArch?.maxAge !== undefined && age >= ownArch.maxAge && age < RETIREMENT_AGE) {
      // A short career (professional sport) ends: the pay stops, the person moves on to something else.
      emit(run, 'JOB_CHANGED', { change: 'RETIRED', professionId: c.job.professionId, salary: 0 });
      run.s.flags.athlete_retired = true;
      c.job = null;
      return;
    }
    if (ownArch && ownArch.volatilityPct > 0) {
      c.job.salary = Math.max(1, Math.round((c.job.salary * (100 + run.rng.int(-ownArch.volatilityPct, ownArch.volatilityPct))) / 100));
    }
    if (age >= RETIREMENT_AGE) {
      c.pension = Math.round(c.job.salary * 0.55);
      emit(run, 'JOB_CHANGED', { change: 'RETIRED', professionId: c.job.professionId, salary: c.pension });
      c.job = null;
      c.retired = true;
      return;
    }
    const prof = run.ctx.content.professions.find((p) => p.id === c.job?.professionId);
    const arch = run.ctx.content.archetypes.find((a) => a.id === prof?.archetype);
    if (arch) {
      const skill = (arch.skill.stat ? stats[arch.skill.stat] : 50) / 100 + (arch.skill.trait ? traits[arch.skill.trait] : 50) / 100;
      const drive = 0.6 + traits.ambition / 125; // 0.6 – 1.4
      const family = SKILL_OF[arch.id] ?? 'social';
      const gift = run.s.protagonist.talents.some((id) => run.ctx.content.talents.find((t) => t.id === id)?.archetypes.includes(arch.id)) ? 1.35 : 1;
      const practice = 0.8 + run.s.protagonist.skills[family] / 250; // 0.8 – 1.2
      const p = (arch.promotionBp / 10_000) * Math.max(0.3, Math.min(2.5, skill * drive * gift * practice));
      run.s.protagonist.skills[family] = clamp100(run.s.protagonist.skills[family] + run.rng.int(1, 3));
      if (c.job.yearsInRole >= 1 && run.rng.float() < p) {
        c.job.salary = Math.round((c.job.salary * (100 + arch.raisePct)) / 100);
        c.job.level += 1;
        c.job.yearsInRole = 0;
        emit(run, 'JOB_CHANGED', { change: 'PROMOTED', professionId: c.job.professionId, salary: c.job.salary });
      }
    }
  } else if (!c.retired && age >= RETIREMENT_AGE) {
    c.retired = true; // never worked: no pension (welfare only)
  }
}

/* ------------------------------ stats ------------------------------ */
function statsBirthday(run: Run, age: number): void {
  const s = run.s;
  const { stats, traits } = s.protagonist;
  const r = run.rng;
  const bump = (k: StatKey, d: number): void => addStat(run, k, d);
  const job = s.career.job;

  // Slow-moving capacities.
  if (age <= 24) bump('intelligence', r.int(0, 2));
  else if (age >= 65) bump('intelligence', -r.int(0, 1));
  if (isStudying(s) && s.education.performance > 60) bump('intelligence', 1);
  if (age <= 20) bump('appearance', r.int(0, 2));
  else if (age >= 40) bump('appearance', -r.int(0, 2));
  else bump('appearance', r.int(-1, 1));
  if (age <= 18) bump('fitness', r.int(0, 2));
  else if (age >= 35) bump('fitness', -r.int(0, 2) - (age >= 60 ? 1 : 0));
  else bump('fitness', r.int(-1, 1));
  if (age <= 40) bump('charisma', r.int(0, 1));

  // Stress pulls towards a target set by work, study, debt and resilience.
  const jobStress = job ? (run.ctx.content.professions.find((p) => p.id === job.professionId)?.jobStress ?? 40) : 0;
  const debtLoad = debtOwed(s) > Math.round(job ? job.salary / 2 : 1) && debtOwed(s) > 0 ? 10 : 0;
  const stressTarget = 25 + jobStress * 0.4 + (isStudying(s) && age >= 12 ? 10 : 0) + debtLoad - traits.resilience * 0.15;
  bump('stress', Math.round((stressTarget - stats.stress) * 0.4) + r.int(-4, 4));

  const healthDelta =
    (stats.fitness - 50) * 0.04 -
    (stats.stress - 50) * 0.05 -
    (age > 45 ? (age - 45) * 0.08 : 0) +
    (age < 18 ? 1 : 0) +
    r.int(-2, 2) +
    (s.protagonist.predispositions.robustness - 50) / 25;
  bump('health', Math.round(healthDelta));

  const energyTarget = 85 - stats.stress * 0.4 - Math.max(0, age - 40) * 0.4 + (stats.health - 50) * 0.2;
  bump('energy', Math.round((energyTarget - stats.energy) * 0.5));

  const parentAlive = s.protagonist.parentIds.some((id) => s.npcs[id]?.deathYear === null);
  const happinessTarget =
    50 + (stats.health - 50) * 0.25 - (stats.stress - 30) * 0.3 + (parentAlive && age < 25 ? 5 : 0) + incomeSatisfaction(run);
  bump('happiness', Math.round((happinessTarget - stats.happiness) * 0.35) + r.int(-3, 3));
}

function incomeSatisfaction(run: Run): number {
  const s = run.s;
  const living = Math.round(90_000 * costScale(run));
  const income = s.career.job ? s.career.job.salary / 12 : s.career.pension / 12;
  if (currentAge(s) < 18 || income === 0) return 0;
  const ratio = income / living;
  return Math.max(-10, Math.min(10, Math.round((ratio - 1.5) * 6)));
}

/* ------------------------------ annual summary --------------------- */
function financeSummary(run: Run): void {
  const f = run.s.finance;
  const t = f.thisYear;
  emit(run, 'FINANCE_YEAR', { ...t, cash: bal(f, ACC.cash), debt: debtOwed(run.s) });
  f.lastYear = t;
  f.thisYear = emptyTotals();
}

/** Everything that happens in the birth month, in a fixed order. */
export function birthday(run: Run): void {
  const age = currentAge(run.s);
  emit(run, 'BIRTHDAY', { personId: run.s.protagonist.id, age });
  npcYear(run);
  educationBirthday(run, age);
  careerBirthday(run, age);
  statsBirthday(run, age);
  businessYear(run);
  assetsYear(run);
  societyYear(run);
  financeSummary(run);
}

/** January: the World Engine issues the year's economy; prices, wages, pensions and home values follow it. */
export function worldTurn(run: Run): void {
  const s = run.s;
  worldYear(run); // every country's economy, politics, demography and environment; mirrors the local one into the world
  const bp = s.world.economy.inflationBp;
  if (s.career.job) s.career.job.salary = Math.round((s.career.job.salary * (10_000 + bp)) / 10_000);
  s.career.pension = Math.round((s.career.pension * (10_000 + bp)) / 10_000);
  revalueProperties(run);
  // Every company draws its own luck for the year: usually a small swing, occasionally a serious blow.
  for (const id of Object.keys(s.businesses).sort()) {
    const b = s.businesses[id];
    if (b && b.status === 'active') b.demandShockBp = run.rng.float() < 0.07 ? run.rng.int(-6000, -3000) : run.rng.int(-500, 500);
  }
}

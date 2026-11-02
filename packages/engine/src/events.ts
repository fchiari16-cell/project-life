import type { Choice, Effect, EventDef, GameState, Outcome, ProfessionDef, SimulationContext } from '@project-life/schemas';
import { buyHome, investSavings, sellHome, sellInvestments } from './assets.js';
import { expandBusiness, ownedBy, sellBusiness, startBusiness } from './business.js';
import { ACC, cash, chargeCost, costScale, investments, settleShortfall, transfer, wageScale } from './finance.js';
import { activeUnion, childrenOf } from './genealogy.js';
import { die, enroll } from './lifecycle.js';
import { fullName, nudge, relOf, remember } from './npc.js';
import {
  addFame,
  beAccused,
  commitOffence,
  enactPolicy,
  grantOffice,
  grantResidency,
  isImprisoned,
  joinParty,
  leaveParty,
  legalAction,
  naturalize,
  recogniseQualifications,
  relocate,
  resign,
  returnHome,
} from './society.js';
import { localCountry } from './world.js';
import { addStat, addTrait, currentAge, emit, expandQualifications, isStudying, validQualifications, type Run } from './run.js';
import {
  actorAvailable,
  befriend,
  chooseActor,
  discardUnusedActor,
  endStory,
  haveChild,
  marry,
  separate,
  setStory,
  startRomance,
} from './social.js';

const MONTHLY_EVENT_CHANCE = 0.17;
const MAX_OFFERS = 3;

export function eligibleProfessions(s: GameState, professions: readonly ProfessionDef[]): ProfessionDef[] {
  const age = currentAge(s);
  // Qualifications that are not recognised in the current country do not count; a criminal record closes security jobs.
  const valid = validQualifications(s);
  return professions.filter(
    (p) => age >= p.minAge && (p.requires.length === 0 || p.requires.some((q) => valid.includes(q))) && !(s.society.record && p.sector === 'security'),
  );
}

function requirementsMet(def: EventDef, run: Run): boolean {
  const { s } = run;
  const r = def.requires;
  if (r.minCashRef !== undefined && cash(s) < Math.round(r.minCashRef * costScale(run))) return false;
  if (r.business !== undefined && (ownedBy(s, s.protagonist.id).length > 0) !== r.business) return false;
  if (r.investments !== undefined && (investments(s) > 0) !== r.investments) return false;
  if (r.property !== undefined && (Object.keys(s.properties).length > 0) !== r.property) return false;
  if (r.specializable !== undefined) {
    const prof = s.career.job ? run.ctx.content.professions.find((p) => p.id === s.career.job?.professionId) : undefined;
    const can = !!prof && prof.specializations.length > 0 && !s.career.job?.specialization && (s.career.job?.level ?? 0) >= 2;
    if (can !== r.specializable) return false;
  }
  if (r.hasQualification && !expandQualifications(s.education.qualifications).includes(r.hasQualification)) return false;
  if (r.lacksQualification && s.education.qualifications.includes(r.lacksQualification)) return false;
  if (r.archetype !== undefined || r.minLevel !== undefined) {
    const prof = s.career.job ? run.ctx.content.professions.find((p) => p.id === s.career.job?.professionId) : undefined;
    if (r.archetype !== undefined && prof?.archetype !== r.archetype) return false;
    if (r.minLevel !== undefined && (s.career.job?.level ?? 0) < r.minLevel) return false;
  }
  if (r.employed !== undefined && (s.career.job !== null) !== r.employed) return false;
  if (r.studying !== undefined && isStudying(s) !== r.studying) return false;
  if (r.parentAlive !== undefined) {
    const alive = s.protagonist.parentIds.some((id) => s.npcs[id]?.deathYear === null);
    if (alive !== r.parentAlive) return false;
  }
  if (r.stages && !r.stages.includes(s.education.stage)) return false;
  if (r.minYearsInRole !== undefined && (s.career.job?.yearsInRole ?? -1) < r.minYearsInRole) return false;
  if (r.notFlag && s.flags[r.notFlag]) return false;
  const union = activeUnion(s);
  if (r.partner !== undefined && (union !== undefined) !== r.partner) return false;
  if (r.partnerStatus && union?.status !== r.partnerStatus) return false;
  if (r.minUnionYears !== undefined && (!union || s.world.currentDate.year - union.startYear < r.minUnionYears)) return false;
  if (r.maxChildren !== undefined && childrenOf(s, s.protagonist.id).length > r.maxChildren) return false;
  if (r.story && s.stories[r.story.id]?.stage !== r.story.stage) return false;
  if (r.notStory && s.stories[r.notStory]) return false;
  const soc = s.society;
  const year = s.world.currentDate.year;
  if (r.partyMember !== undefined && (soc.party !== null) !== r.partyMember) return false;
  if (r.inOffice !== undefined && (soc.office !== null) !== r.inOffice) return false;
  if (r.electionYear !== undefined && (localCountry(s).politics.lastElection === year) !== r.electionYear) return false;
  if (r.legalStage && soc.legal?.stage !== r.legalStage) return false;
  if (r.record !== undefined && soc.record !== r.record) return false;
  if (r.minNotoriety !== undefined && soc.fame.notoriety < r.minNotoriety) return false;
  if (r.onVisa !== undefined && (soc.residence.status === 'visa') !== r.onVisa) return false;
  if (r.minResidentYears !== undefined && !(soc.residence.status === 'resident' && year - soc.residence.since >= r.minResidentYears)) return false;
  if (r.unrecognized !== undefined && (soc.unrecognized.length > 0) !== r.unrecognized) return false;
  if (r.free !== undefined && !isImprisoned(s) !== r.free) return false;
  return true;
}

export function isEligible(def: EventDef, run: Run): boolean {
  const { s, ctx } = run;
  const age = currentAge(s);
  if (age < def.minAge || age > def.maxAge) return false;
  if (isImprisoned(s) && def.category !== 'justice') return false; // behind bars only the justice system happens to you
  if (!requirementsMet(def, run)) return false;
  const log = s.eventLog[def.id];
  if (log && (log.count >= def.maxTimes || s.world.currentDate.year - log.lastYear <= def.cooldownYears)) return false;
  if (def.dynamicOffers === 'jobs' && eligibleProfessions(s, ctx.content.professions).length === 0) return false;
  if (def.dynamicOffers === 'specializations' && !s.career.job) return false;
  if (def.dynamicOffers === 'countries' && ctx.content.countries.length < 2) return false;
  return actorAvailable(run, def);
}

function startEvent(run: Run, def: EventDef): void {
  const s = run.s;
  const d = s.world.currentDate;
  let offers: string[] = [];
  if (def.dynamicOffers === 'jobs') {
    const pool = [...eligibleProfessions(s, run.ctx.content.professions)];
    while (offers.length < MAX_OFFERS && pool.length > 0) {
      const [pick] = pool.splice(run.rng.int(0, pool.length - 1), 1);
      if (pick) offers.push(pick.id);
    }
  } else if (def.dynamicOffers === 'specializations') {
    const prof = run.ctx.content.professions.find((p) => p.id === s.career.job?.professionId);
    offers = (prof?.specializations ?? []).map((x) => x.id);
  } else if (def.dynamicOffers === 'parties') {
    offers = run.ctx.content.parties.map((p) => p.id);
  } else if (def.dynamicOffers === 'countries') {
    const pool = run.ctx.content.countries.filter((c) => c.code !== s.location.countryCode);
    while (offers.length < MAX_OFFERS && pool.length > 0) {
      const [pick] = pool.splice(run.rng.int(0, pool.length - 1), 1);
      if (pick) offers.push(pick.code);
    }
  } else offers = [];
  const actorId = chooseActor(run, def);
  const instanceId = `${s.id}:${def.id}:${d.year}-${d.month}`;
  const prev = s.eventLog[def.id];
  s.eventLog[def.id] = { lastYear: d.year, count: (prev?.count ?? 0) + 1 };
  s.simulation.pending = { eventId: def.id, instanceId, offers, actorId };
  s.simulation.status = 'PAUSED_EVENT';
  run.paused = true;
  emit(run, 'EVENT_TRIGGERED', { eventId: def.id, instanceId });
}

/** Birthday-scheduled events come first; otherwise a monthly chance of a random one. True if the run paused. */
export function maybeTriggerEvent(run: Run, isBirthMonth: boolean): boolean {
  const { s, ctx, rng } = run;
  const defs = ctx.content.events;
  if (isBirthMonth) {
    const scheduled = defs.find((d) => d.trigger === 'birthday' && isEligible(d, run));
    if (scheduled) {
      startEvent(run, scheduled);
      return true;
    }
  }
  if (rng.float() >= MONTHLY_EVENT_CHANCE) return false;
  const pool = defs.filter((d) => d.trigger === 'random' && isEligible(d, run));
  if (pool.length === 0) return false;
  let roll = rng.float() * pool.reduce((sum, d) => sum + d.weight, 0);
  const chosen = pool.find((d) => (roll -= d.weight) < 0) ?? pool[pool.length - 1];
  if (!chosen) return false;
  startEvent(run, chosen);
  void s;
  return true;
}

/** Replaces `{actor}` with the NPC's name. */
export const fillActor = (text: string, name: string | null): string => text.replaceAll('{actor}', name ?? '');

export interface PendingView {
  event: EventDef;
  choices: Choice[];
  actorName: string | null;
}

/** The decision the player sees: authored choices plus, for job offers, one synthesised `accept:<id>` per offer. */
export function pendingChoices(s: GameState, ctx: SimulationContext): PendingView | null {
  const pending = s.simulation.pending;
  if (!pending) return null;
  const event = ctx.content.events.find((e) => e.id === pending.eventId);
  if (!event) return null;
  const actor = pending.actorId ? s.npcs[pending.actorId] : undefined;
  const name = actor ? fullName(actor) : null;
  const jobProfession = ctx.content.professions.find((x) => x.id === s.career.job?.professionId);
  const accepts: Choice[] = pending.offers.flatMap((id): Choice[] => {
    if (event.dynamicOffers === 'parties') {
      const party = ctx.content.parties.find((x) => x.id === id);
      if (!party) return [];
      return [{ id: 'party:' + id, label: `Iscriviti: ${party.name}`, outcomes: [{ id: 'joined', weight: 1, effects: [{ type: 'joinParty' as const }], text: `Ti sei iscritto/a a ${party.name}.` }] }];
    }
    if (event.dynamicOffers === 'countries') {
      const dest = ctx.content.countries.find((x) => x.code === id);
      if (!dest) return [];
      // Visa odds: the destination's openness, a little better with a degree.
      const odds = Math.max(5, Math.min(95, dest.migrationOpenness + (s.education.qualifications.includes('bachelor') ? 10 : 0)));
      return [
        {
          id: 'move:' + id,
          label: `Trasferisciti: ${dest.name}`,
          outcomes: [
            { id: 'granted', weight: odds, effects: [{ type: 'migrate' as const }, { type: 'stat' as const, stat: 'stress' as const, delta: 3 }], text: `Hai ottenuto il visto e ti sei trasferito/a in ${dest.name}.` },
            { id: 'denied', weight: 100 - odds, effects: [{ type: 'stat' as const, stat: 'stress' as const, delta: 3 }, { type: 'stat' as const, stat: 'happiness' as const, delta: -2 }], text: `La richiesta di visto per ${dest.name} è stata respinta.` },
          ],
        },
      ];
    }
    if (event.dynamicOffers === 'specializations') {
      const spec = jobProfession?.specializations.find((x) => x.id === id);
      if (!spec) return [];
      return [
        {
          id: 'spec:' + id,
          label: `Specializzati: ${spec.title}`,
          outcomes: [{ id: 'specialized', weight: 1, effects: [{ type: 'specialize' as const }], text: `Ti sei specializzato/a: ${spec.title}.` }],
        },
      ];
    }
    const p = ctx.content.professions.find((x) => x.id === id);
    if (!p) return [];
    return [
      {
        id: `accept:${id}`,
        label: `Accetta: ${p.title}`,
        outcomes: [{ id: 'accepted', weight: 1, effects: [{ type: 'takeJob' as const }], text: `Hai iniziato a lavorare come ${p.title}.` }],
      },
    ];
  });
  const fill = (c: Choice): Choice => ({ ...c, label: fillActor(c.label, name) });
  return {
    event: { ...event, title: fillActor(event.title, name), body: fillActor(event.body, name) },
    choices: [...accepts, ...event.choices].map(fill),
    actorName: name,
  };
}

function pickOutcome(run: Run, choice: Choice, actorId: string | null): Outcome {
  const s = run.s;
  const actor = actorId ? s.npcs[actorId] : undefined;
  const rel = actorId ? relOf(s, actorId, s.protagonist.id) : undefined;
  const weights = choice.outcomes.map((o) => {
    let w = o.weight;
    if (o.statBias) w += o.statBias.perPoint * (s.protagonist.stats[o.statBias.stat] - 50);
    if (o.relBias && rel) w += o.relBias.perPoint * (rel.dims[o.relBias.dim] - 50);
    if (o.actorTraitBias && actor) w += o.actorTraitBias.perPoint * (actor.traits[o.actorTraitBias.trait] - 50);
    return Math.max(0.05, w);
  });
  let roll = run.rng.float() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i] ?? 0;
    if (roll < 0) return choice.outcomes[i] as Outcome;
  }
  return choice.outcomes[choice.outcomes.length - 1] as Outcome;
}

function applyEffect(run: Run, effect: Effect, choiceId: string, eventId: string, actorId: string | null): void {
  const s = run.s;
  const actor = actorId ? s.npcs[actorId] : undefined;
  switch (effect.type) {
    case 'stat':
      addStat(run, effect.stat, effect.delta);
      break;
    case 'trait':
      addTrait(run, effect.trait, effect.delta);
      break;
    case 'money': {
      if (currentAge(s) < 18) break; // minors' costs and gifts are handled by the family
      const amount = Math.round(Math.abs(effect.ref) * costScale(run));
      if (effect.ref < 0) chargeCost(run, ACC.eventsOut, amount, 'other');
      else {
        transfer(s.finance, ACC.cash, ACC.eventsIn, amount);
        s.finance.thisYear.other -= amount;
        settleShortfall(s);
      }
      break;
    }
    case 'performance':
      s.education.performance = Math.max(0, Math.min(100, s.education.performance + effect.delta));
      break;
    case 'enroll':
      enroll(run, effect.path);
      break;
    case 'takeJob': {
      const prof = run.ctx.content.professions.find((p) => p.id === choiceId.slice('accept:'.length));
      if (!prof) break;
      const salary = Math.round(prof.salaryRef * wageScale(run));
      s.career.job = { professionId: prof.id, level: 1, yearsInRole: 0, salary, specialization: null };
      emit(run, 'JOB_CHANGED', { change: 'HIRED', professionId: prof.id, salary });
      break;
    }
    case 'specialize': {
      const job = s.career.job;
      const prof = run.ctx.content.professions.find((p) => p.id === job?.professionId);
      const spec = prof?.specializations.find((x) => x.id === choiceId.slice('spec:'.length));
      if (!job || !spec) break;
      job.specialization = spec.id;
      job.salary = Math.round((job.salary * spec.salaryPct) / 100);
      emit(run, 'JOB_CHANGED', { change: 'SPECIALIZED', professionId: job.professionId, salary: job.salary });
      break;
    }
    case 'fame':
      addFame(run, effect.dim, effect.delta);
      break;
    case 'joinParty':
      joinParty(run, choiceId.slice('party:'.length));
      break;
    case 'leaveParty':
      leaveParty(run);
      break;
    case 'office':
      grantOffice(run, effect.level);
      break;
    case 'resign':
      resign(run);
      break;
    case 'policy':
      enactPolicy(run, effect.kind);
      break;
    case 'offence':
      commitOffence(run, effect.severity);
      break;
    case 'accused':
      beAccused(run, effect.evidence);
      break;
    case 'legalAction':
      legalAction(run, effect.action);
      break;
    case 'migrate':
      relocate(run, choiceId.slice('move:'.length), 'visa');
      break;
    case 'residency':
      grantResidency(run);
      break;
    case 'naturalize':
      naturalize(run);
      break;
    case 'recognize':
      recogniseQualifications(run);
      break;
    case 'returnHome':
      returnHome(run);
      break;
    case 'startBusiness':
      startBusiness(run, effect.sector);
      break;
    case 'expandBusiness':
      expandBusiness(run);
      break;
    case 'sellBusiness':
      sellBusiness(run);
      break;
    case 'investSavings':
      investSavings(run, effect.pct);
      break;
    case 'sellInvestments':
      sellInvestments(run);
      break;
    case 'buyHome':
      buyHome(run);
      break;
    case 'sellHome':
      sellHome(run);
      break;
    case 'loseJob':
      if (s.career.job) {
        emit(run, 'JOB_CHANGED', { change: 'LOST', professionId: s.career.job.professionId, salary: 0 });
        s.career.job = null;
      }
      break;
    case 'raise':
      if (s.career.job) {
        s.career.job.salary = Math.round((s.career.job.salary * (100 + effect.pct)) / 100);
        emit(run, 'JOB_CHANGED', { change: 'RAISE', professionId: s.career.job.professionId, salary: s.career.job.salary });
      }
      break;
    case 'deathRisk':
      if (run.rng.float() < effect.p) die(run, `event:${eventId}`);
      break;
    case 'flag':
      s.flags[effect.key] = true;
      break;
    case 'relationship':
      if (actorId) {
        nudge(relOf(s, actorId, s.protagonist.id), effect.dim, effect.delta);
        nudge(relOf(s, s.protagonist.id, actorId), effect.dim, Math.round(effect.delta * 0.6));
      }
      break;
    case 'memory':
      remember(actor, { year: s.world.currentDate.year, type: effect.memory, otherId: s.protagonist.id, valence: effect.valence, weight: effect.weight });
      break;
    case 'befriend':
      befriend(run, actorId);
      break;
    case 'startRomance':
      startRomance(run, actorId);
      break;
    case 'marry':
      marry(run);
      break;
    case 'separate':
      separate(run);
      break;
    case 'child':
      haveChild(run);
      break;
    case 'story':
      setStory(run, effect.id, effect.stage, actorId);
      break;
    case 'endStory':
      endStory(run, effect.id);
      break;
  }
}

/** Applies the chosen outcome exactly once and clears the pending decision. Returns false for an unknown choice. */
export function resolvePending(run: Run, choiceId: string): boolean {
  const view = pendingChoices(run.s, run.ctx);
  const choice = view?.choices.find((c) => c.id === choiceId);
  const actorId = run.s.simulation.pending?.actorId ?? null;
  if (!view || !choice) return false;
  const outcome = pickOutcome(run, choice, actorId);
  emit(run, 'EVENT_RESOLVED', { eventId: view.event.id, choiceId, outcomeId: outcome.id, actorName: view.actorName });
  run.s.simulation.pending = null;
  for (const effect of outcome.effects) {
    applyEffect(run, effect, choiceId, view.event.id, actorId);
    if (run.died) break;
  }
  discardUnusedActor(run, actorId);
  return true;
}

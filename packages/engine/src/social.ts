import type { ActorKind, EventDef, FamilyClass, Npc, Traits, Union } from '@project-life/schemas';
import { activeUnion, childrenOf, partnerIdOf, relationCode } from './genealogy.js';
import { businessesOnDeath } from './business.js';
import { ACC, costScale, netWorth, transfer } from './finance.js';
import { annualMortality, longevityFactor } from './mortality.js';
import { createNpc, drawPredispositions, drawTalents, drawTraits, fullName, link, memoryTone, nudge, relKey, relOf, remember, setBond, unlink } from './npc.js';
import { addStat, clamp100, currentAge, emit, type Run } from './run.js';
import { trackDeath, untrackPerson } from './world.js';

const INHERITANCE_REF = { low: 200_000, lower_middle: 800_000, middle: 2_000_000, upper_middle: 6_000_000, high: 20_000_000 };
const CLASSES: FamilyClass[] = ['low', 'lower_middle', 'middle', 'upper_middle', 'high'];

export function wealthClassOf(run: Run): FamilyClass {
  const s = run.s;
  const living = Math.round(90_000 * costScale(run)) * 12;
  const income = s.career.job ? s.career.job.salary : s.career.retired ? s.career.pension : 0;
  const net = Math.max(0, netWorth(s));
  const ratio = (income + net / 10) / living;
  return CLASSES[ratio < 1.2 ? 0 : ratio < 2 ? 1 : ratio < 3.5 ? 2 : ratio < 6 ? 3 : 4] as FamilyClass;
}

const sortedLiving = (run: Run): Npc[] =>
  Object.keys(run.s.npcs)
    .sort()
    .map((id) => run.s.npcs[id] as Npc)
    .filter((n) => n.deathYear === null);

/* ------------------------------ guardianship ----------------------- */
export function updateGuardian(run: Run): void {
  const s = run.s;
  const age = currentAge(s);
  const parentsAlive = s.protagonist.parentIds.some((p) => s.npcs[p]?.deathYear === null);
  let guardian: string | null = null;
  if (age < 18 && !parentsAlive) {
    const year = s.world.currentDate.year;
    const sibs = sortedLiving(run).filter((n) => relationCode(s, n.id) === 'sibling' && year - n.birthYear >= 18);
    sibs.sort((a, b) => a.birthYear - b.birthYear);
    guardian = sibs[0]?.id ?? null;
  }
  if (guardian !== s.family.guardianId) {
    s.family.guardianId = guardian;
    if (age < 18 && !parentsAlive) {
      const g = guardian ? s.npcs[guardian] : undefined;
      emit(run, 'SOCIAL', { change: 'GUARDIAN_ASSIGNED', otherName: g ? fullName(g) : null, detail: g ? 'sibling' : 'state_care' });
    }
  }
}

/* ------------------------------ yearly NPC life -------------------- */
function endUnion(u: Union, year: number): void {
  u.status = 'ended';
  u.endYear = year;
}

function npcDies(run: Run, npc: Npc): void {
  const s = run.s;
  const year = s.world.currentDate.year;
  const age = currentAge(s);
  npc.deathYear = year;
  businessesOnDeath(run, npc.id);
  trackDeath(s, npc.countryCode);
  for (const u of Object.values(s.unions)) if (u.status !== 'ended' && u.members.includes(npc.id)) endUnion(u, year);
  const code = relationCode(s, npc.id);
  let inheritance = 0;
  if (code === 'parent' && age >= 18) {
    const heirs = 1 + sortedLiving(run).filter((n) => relationCode(s, n.id) === 'sibling').length;
    inheritance = Math.round((INHERITANCE_REF[s.family.class] / 2 / heirs) * costScale(run));
    transfer(s.finance, ACC.cash, ACC.inheritance, inheritance);
    s.finance.thisYear.other -= inheritance;
  }
  emit(run, 'FAMILY_DEATH', { memberId: npc.id, relation: code, inheritance });
  if (relOf(s, s.protagonist.id, npc.id)) {
    const close = code === 'parent' || code === 'spouse' || code === 'child' || code === 'partner';
    addStat(run, 'happiness', close ? -8 : -4);
    addStat(run, 'stress', close ? 6 : 3);
  }
}

function autonomousUnion(run: Run, npc: Npc): void {
  const s = run.s;
  const year = s.world.currentDate.year;
  const age = year - npc.birthYear;
  if (npc.parentIds.length === 0 || age < 22 || age > 38) return;
  if (Object.values(s.unions).some((u) => u.status !== 'ended' && u.members.includes(npc.id))) return;
  if (run.rng.float() >= 0.12) return;
  const spouse = createNpc(run, {
    familyName: run.rng.pick(run.ctx.content.familyNames),
    birthYear: npc.birthYear + run.rng.int(-4, 4),
    class: npc.class,
    countryCode: npc.countryCode,
  });
  const id = `${s.id}:u${Object.keys(s.unions).length}:${year}:${npc.id.slice(-4)}`;
  s.unions[id] = { id, members: [npc.id, spouse.id], status: 'married', startYear: year, endYear: null };
}

function autonomousBirths(run: Run): void {
  const s = run.s;
  const year = s.world.currentDate.year;
  for (const u of Object.values(s.unions).sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (u.status !== 'married' || u.members.includes(s.protagonist.id)) continue; // the player decides for their own family
    const [a, b] = u.members.map((m) => s.npcs[m]) as [Npc | undefined, Npc | undefined];
    if (!a || !b || a.deathYear !== null || b.deathYear !== null) continue;
    const ages = [year - a.birthYear, year - b.birthYear];
    if (ages.some((x) => x < 20 || x > 42)) continue;
    const kids = childrenOf(s, a.id).filter((c) => c.parentIds.includes(b.id));
    if (kids.length >= 3 || kids.some((k) => year - k.birthYear < 2)) continue;
    if (run.rng.float() >= 0.2) continue;
    const child = createNpc(run, {
      familyName: a.familyName,
      birthYear: year,
      parentIds: [a.id, b.id],
      class: a.class,
      countryCode: a.countryCode,
      newborn: true,
      traits: drawTraits(run.rng, [a.traits, b.traits]),
      predispositions: drawPredispositions(run.rng, [a.predispositions, b.predispositions]),
      talents: drawTalents(run.rng, run.ctx.content, [a.talents, b.talents]),
    });
    const code = relationCode(s, child.id);
    if (code === 'nibling' || code === 'grandchild' || code === 'cousin') {
      link(run, s.protagonist.id, child.id, 'family');
      emit(run, 'SOCIAL', { change: 'RELATIVE_BORN', otherName: fullName(child), detail: code });
    }
  }
}

function driftRelationships(run: Run): void {
  const s = run.s;
  const me = s.protagonist.id;
  const year = s.world.currentDate.year;
  const base = { family: 55, friend: 45, romantic: 60, ex: 25 } as const;
  for (const key of Object.keys(s.relationships).sort()) {
    const rel = s.relationships[key];
    if (!rel || rel.from !== me) continue;
    const other = s.npcs[rel.to];
    const back = relOf(s, rel.to, me);
    if (!other || other.deathYear !== null || !back) continue;
    const tone = memoryTone(other, me, year - 1);
    const interacted = other.memories.some((m) => m.otherId === me && m.year >= year - 1);
    for (const r of [rel, back]) {
      r.dims.conflict = clamp100(r.dims.conflict * 0.75);
      const target = base[r.bond] + tone * 4 + ((r === back ? other.traits.empathy : s.protagonist.traits.empathy) - 50) * 0.1;
      r.dims.affection = clamp100(r.dims.affection + (target - r.dims.affection) * 0.15);
      r.dims.trust = clamp100(r.dims.trust + (50 + tone * 5 - r.dims.trust) * 0.1);
      const fam = r.bond === 'family' ? 1 : r.bond === 'romantic' ? 2 : interacted ? 3 : -2;
      r.dims.familiarity = clamp100(r.dims.familiarity + fam);
    }
    if (rel.bond === 'friend' && back.dims.affection < 20 && back.dims.familiarity < 25) {
      unlink(s, me, other.id);
      untrackPerson(s, other.countryCode);
      delete s.npcs[other.id];
      emit(run, 'SOCIAL', { change: 'FRIEND_FADED', otherName: fullName(other), detail: null });
      continue;
    }
    const union = activeUnion(s);
    if (union && union.members.includes(other.id) && back.dims.affection + back.dims.trust < 70 && back.dims.conflict > 40 && run.rng.float() < 0.3) {
      endUnion(union, year);
      setBond(s, me, other.id, 'ex');
      remember(other, { year, type: 'breakup', otherId: me, valence: -1, weight: 3 });
      addStat(run, 'happiness', -10);
      addStat(run, 'stress', 10);
      emit(run, 'SOCIAL', { change: 'SEPARATED', otherName: fullName(other), detail: 'autonomous' });
    }
  }
}

/** Everything the people around the protagonist do over a year, whether or not the player interacts with them. */
export function npcYear(run: Run): void {
  const s = run.s;
  const year = s.world.currentDate.year;
  for (const npc of sortedLiving(run)) {
    if (run.rng.float() < annualMortality(year - npc.birthYear) * longevityFactor(npc.predispositions.longevity)) npcDies(run, npc);
    else autonomousUnion(run, npc);
  }
  autonomousBirths(run);
  driftRelationships(run);
  updateGuardian(run);
  // A romance story only lives as long as the relationship does (also when the NPC ended it or died).
  if (s.stories.romance && !activeUnion(s)) endStory(run, 'romance');
}

/* ------------------------------ actors ----------------------------- */
const livingNpcs = (run: Run, pred: (n: Npc) => boolean): Npc[] => sortedLiving(run).filter(pred);

function candidates(run: Run, kind: ActorKind): Npc[] {
  const s = run.s;
  const me = s.protagonist.id;
  switch (kind) {
    case 'friend':
      return livingNpcs(run, (n) => relOf(s, me, n.id)?.bond === 'friend');
    case 'partner': {
      const p = partnerIdOf(s);
      const n = p ? s.npcs[p] : undefined;
      return n && n.deathYear === null ? [n] : [];
    }
    case 'parent':
      return livingNpcs(run, (n) => s.protagonist.parentIds.includes(n.id));
    case 'sibling':
      return livingNpcs(run, (n) => relationCode(s, n.id) === 'sibling');
    case 'child':
      return livingNpcs(run, (n) => n.parentIds.includes(me));
    default:
      return [];
  }
}

export function actorAvailable(run: Run, def: EventDef): boolean {
  const age = currentAge(run.s);
  switch (def.actor) {
    case 'none':
      return true;
    case 'new_peer':
      return age >= 6;
    case 'new_adult':
      return age >= 18;
    default:
      return candidates(run, def.actor).length > 0;
  }
}

/** Picks (or creates) the NPC an event is about. */
export function chooseActor(run: Run, def: EventDef): string | null {
  const s = run.s;
  const year = s.world.currentDate.year;
  const age = currentAge(s);
  if (def.actor === 'none') return null;
  if (def.actor === 'new_peer' || def.actor === 'new_adult') {
    const lo = def.actor === 'new_adult' ? Math.max(18, age - 6) : Math.max(0, age - 3);
    const peerAge = run.rng.int(lo, Math.max(lo, def.actor === 'new_adult' ? age + 6 : age + 3));
    return createNpc(run, {
      familyName: run.rng.pick(run.ctx.content.familyNames),
      birthYear: year - peerAge,
      class: s.family.class,
      countryCode: s.location.countryCode,
    }).id;
  }
  const pool = candidates(run, def.actor);
  return pool.length ? run.rng.pick(pool).id : null;
}

/** New actors that did not become part of the protagonist's life are forgotten. */
export function discardUnusedActor(run: Run, actorId: string | null): void {
  if (!actorId) return;
  const s = run.s;
  const n = s.npcs[actorId];
  if (!n || n.parentIds.length > 0) return;
  const tied =
    s.relationships[relKey(s.protagonist.id, actorId)] ||
    Object.values(s.unions).some((u) => u.members.includes(actorId)) ||
    childrenOf(s, actorId).length > 0;
  if (!tied) {
    untrackPerson(s, n.countryCode);
    delete s.npcs[actorId];
  }
}

/* ------------------------------ social effects --------------------- */
export function befriend(run: Run, actorId: string | null): void {
  const n = actorId ? run.s.npcs[actorId] : undefined;
  if (!n || relOf(run.s, run.s.protagonist.id, n.id)) return;
  link(run, run.s.protagonist.id, n.id, 'friend');
  emit(run, 'SOCIAL', { change: 'FRIEND_MADE', otherName: fullName(n), detail: null });
}

export function startRomance(run: Run, actorId: string | null): void {
  const s = run.s;
  const n = actorId ? s.npcs[actorId] : undefined;
  if (!n || activeUnion(s) || currentAge(s) < 18 || s.world.currentDate.year - n.birthYear < 18) return;
  const existing = relOf(s, s.protagonist.id, n.id);
  if (existing) {
    setBond(s, s.protagonist.id, n.id, 'romantic');
    for (const rel of [existing, relOf(s, n.id, s.protagonist.id)]) nudge(rel, 'attraction', 40);
  } else link(run, s.protagonist.id, n.id, 'romantic');
  const year = s.world.currentDate.year;
  const id = `${s.id}:u${Object.keys(s.unions).length}:${year}:${n.id.slice(-4)}`;
  s.unions[id] = { id, members: [s.protagonist.id, n.id], status: 'dating', startYear: year, endYear: null };
  emit(run, 'SOCIAL', { change: 'ROMANCE_STARTED', otherName: fullName(n), detail: null });
}

export function marry(run: Run): void {
  const u = activeUnion(run.s);
  const n = u ? run.s.npcs[partnerIdOf(run.s) as string] : undefined;
  if (!u || u.status !== 'dating' || !n) return;
  u.status = 'married';
  remember(n, { year: run.s.world.currentDate.year, type: 'wedding', otherId: run.s.protagonist.id, valence: 1, weight: 3 });
  emit(run, 'SOCIAL', { change: 'MARRIED', otherName: fullName(n), detail: null });
}

export function separate(run: Run): void {
  const s = run.s;
  const u = activeUnion(s);
  const pid = partnerIdOf(s);
  const n = pid ? s.npcs[pid] : undefined;
  if (!u || !n) return;
  endUnion(u, s.world.currentDate.year);
  setBond(s, s.protagonist.id, n.id, 'ex');
  remember(n, { year: s.world.currentDate.year, type: 'breakup', otherId: s.protagonist.id, valence: -1, weight: 2 });
  emit(run, 'SOCIAL', { change: 'SEPARATED', otherName: fullName(n), detail: 'chosen' });
}

export function haveChild(run: Run): void {
  const s = run.s;
  const pid = partnerIdOf(s);
  const partner = pid ? s.npcs[pid] : undefined;
  const parents: Traits[] = [s.protagonist.traits, ...(partner ? [partner.traits] : [])];
  const child = createNpc(run, {
    familyName: s.protagonist.familyName,
    birthYear: s.world.currentDate.year,
    parentIds: [s.protagonist.id, ...(partner ? [partner.id] : [])],
    class: wealthClassOf(run),
    countryCode: s.location.countryCode,
    newborn: true,
    traits: drawTraits(run.rng, parents),
    predispositions: drawPredispositions(run.rng, [s.protagonist.predispositions, ...(partner ? [partner.predispositions] : [])]),
    talents: drawTalents(run.rng, run.ctx.content, [s.protagonist.talents, ...(partner ? [partner.talents] : [])]),
  });
  link(run, s.protagonist.id, child.id, 'family');
  remember(partner, { year: s.world.currentDate.year, type: 'birth', otherId: s.protagonist.id, valence: 1, weight: 3 });
  addStat(run, 'happiness', 6);
  addStat(run, 'stress', 6);
  emit(run, 'SOCIAL', { change: 'CHILD_BORN', otherName: fullName(child), detail: null });
}

export function setStory(run: Run, id: string, stage: number, subjectId: string | null): void {
  const prev = run.s.stories[id];
  run.s.stories[id] = { stage, since: prev?.since ?? run.s.world.currentDate.year, subjectId: subjectId ?? prev?.subjectId ?? null };
  if (!prev) emit(run, 'SOCIAL', { change: 'STORY_STARTED', otherName: null, detail: id });
}

export function endStory(run: Run, id: string): void {
  if (!run.s.stories[id]) return;
  delete run.s.stories[id];
  emit(run, 'SOCIAL', { change: 'STORY_ENDED', otherName: null, detail: id });
}

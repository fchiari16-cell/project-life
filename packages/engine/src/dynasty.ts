import {
  SCHEMA_VERSION,
  type DomainEvent,
  type EngineResult,
  type FamilyClass,
  type GameState,
  type Npc,
  type SimulationContext,
} from '@project-life/schemas';
import { checksum, stateChecksum } from './canonical.js';
import { emptyTotals, netWorth } from './finance.js';
import { childrenOf, descendantsOf, partnerIdOf, relationCode, unionOf } from './genealogy.js';
import { validateState } from './invariants.js';
import { createNpc, drawPredispositions, drawTalents, drawTraits, fullName, link, nudge, relOf } from './npc.js';
import { defaultSociety } from './society.js';
import { syncLocal, trackPerson, untrackPerson } from './world.js';
import { Rng } from './rng.js';
import { CLASS_INDEX, makeRun } from './run.js';
import { drawStats, pickCity } from './simulate.js';
import { wealthClassOf } from './social.js';

const CLASSES: FamilyClass[] = ['low', 'lower_middle', 'middle', 'upper_middle', 'high'];
const MIN_HEIR_AGE = 18;
const MAX_HEIR_AGE = 45;

export interface DynastyOption {
  npcId: string;
  name: string;
  age: number;
  lineage: 'descendant' | 'collateral';
  partnerName: string | null;
}

const deathYearOf = (s: GameState): number => (s.protagonist.death as NonNullable<GameState['protagonist']['death']>).date.year;

/** Living adult relatives who could become the parent of the next protagonist, descendants first. */
export function dynastyOptions(prev: GameState): DynastyOption[] {
  if (!prev.protagonist.death) return [];
  const year = deathYearOf(prev);
  const descendants = descendantsOf(prev, prev.protagonist.id);
  const out: DynastyOption[] = [];
  for (const n of Object.values(prev.npcs)) {
    const age = year - n.birthYear;
    if (n.deathYear !== null || age < MIN_HEIR_AGE || age > MAX_HEIR_AGE) continue;
    const code = relationCode(prev, n.id);
    const lineage = descendants.has(n.id) ? 'descendant' : code === 'sibling' || code === 'nibling' || code === 'cousin' ? 'collateral' : null;
    if (!lineage) continue;
    const union = Object.values(prev.unions).find((u) => u.status === 'married' && u.members.includes(n.id));
    const partner = union ? prev.npcs[union.members.find((m) => m !== n.id) as string] : undefined;
    out.push({ npcId: n.id, name: fullName(n), age, lineage, partnerName: partner && partner.deathYear === null ? fullName(partner) : null });
  }
  return out.sort((a, b) => (a.lineage === b.lineage ? a.npcId.localeCompare(b.npcId) : a.lineage === 'descendant' ? -1 : 1));
}

/**
 * Keeps the new protagonist's circle: the roots (close living kin), everyone's ancestors (so the tree stays whole),
 * and the spouses of roots. Everyone else — old friends, distant branches — is forgotten.
 */
function prune(s: GameState, roots: Set<string>): void {
  const keep = new Set<string>(roots);
  const addAncestors = (id: string): void => {
    for (const p of id === s.protagonist.id ? s.protagonist.parentIds : (s.npcs[id]?.parentIds ?? [])) {
      if (!keep.has(p)) {
        keep.add(p);
        addAncestors(p);
      }
    }
  };
  addAncestors(s.protagonist.id);
  for (const id of [...roots]) addAncestors(id);
  for (const u of Object.values(s.unions)) {
    const [x, y] = u.members;
    if (roots.has(x) && s.npcs[y]) keep.add(y);
    if (roots.has(y) && s.npcs[x]) keep.add(x);
  }
  for (const id of Object.keys(s.npcs)) {
    if (keep.has(id)) continue;
    const n = s.npcs[id];
    if (n && n.deathYear === null) untrackPerson(s, n.countryCode); // demoted back into the aggregate population
    delete s.npcs[id];
  }
  for (const [id, u] of Object.entries(s.unions)) {
    if (u.members.some((m) => !s.npcs[m] && m !== s.protagonist.id)) delete s.unions[id];
  }
}

/**
 * Starts the next generation: a NEWBORN protagonist, child of a living adult relative of the deceased
 * (chosen by the player, or the first descendant by default). The family graph, unions and prices carry over;
 * traits are inherited as a predisposition, the estate can lift the household class, and feuds persist.
 */
export function continueDynasty(
  prev: GameState,
  params: { seed: string; givenName: string; parentId?: string | null },
  ctx: SimulationContext,
): EngineResult {
  const fail = (message: string): EngineResult => ({ ok: false, error: { code: 'INVALID_COMMAND', message } });
  if (!prev.protagonist.death) return fail('the current life has not ended');
  if (!params.seed.trim() || !params.givenName.trim()) return fail('seed and name are required');
  const country = ctx.content.countries.find((c) => c.code === prev.location.countryCode);
  if (!country) return { ok: false, error: { code: 'UNKNOWN_CONTENT', message: 'unknown country' } };

  const options = dynastyOptions(prev);
  const chosen = params.parentId ? options.find((o) => o.npcId === params.parentId) : options[0];
  if (params.parentId && !chosen) return fail('the chosen parent is not an eligible living relative');

  const s: GameState = structuredClone(prev);
  const death = deathYearOf(prev);
  const deathDate = (prev.protagonist.death as NonNullable<GameState['protagonist']['death']>).date;
  const me = prev.protagonist;
  const generation = prev.dynasty.generation + 1;

  // Estate: what the deceased left, shared among living children and spouse.
  const heirs = childrenOf(prev, me.id).filter((c) => c.deathYear === null).length + (partnerIdOf(prev) ? 1 : 0);
  const net = netWorth(prev);
  const refShare = heirs > 0 ? Math.max(0, net) / heirs / ((country.fxPerEur * prev.world.priceIndex) / 10_000) : 0;
  const bump = refShare >= 20_000_000 ? 2 : refShare >= 5_000_000 ? 1 : 0;

  // The deceased becomes an ancestor in the genealogy.
  const run = makeRun(s, ctx, country, Rng.fromSeed(params.seed), 0);
  const rng = run.rng;
  const wealth = wealthClassOf(makeRun(prev, ctx, country, Rng.fromSeed(params.seed), 0));
  s.npcs[me.id] = {
    id: me.id,
    givenName: me.givenName,
    familyName: me.familyName,
    birthYear: me.birth.year,
    deathYear: death,
    traits: me.traits,
    predispositions: me.predispositions,
    talents: me.talents,
    class: wealth,
    countryCode: prev.location.countryCode,
    parentIds: [...me.parentIds],
    memories: [],
  };

  // Parent of the newborn: the chosen heir, or a distant relative if the line has run out of adults.
  let parent: Npc;
  if (chosen) parent = s.npcs[chosen.npcId] as Npc;
  else
    parent = createNpc(run, {
      familyName: me.familyName,
      birthYear: death - rng.int(24, 34),
      class: wealth,
      countryCode: prev.location.countryCode,
    });
  if (descendantsOf(prev, me.id).has(parent.id)) parent.class = CLASSES[Math.min(4, Math.max(CLASS_INDEX[parent.class], CLASS_INDEX[wealth]) + bump)] as FamilyClass;

  let partner = ((): Npc | undefined => {
    const u = Object.values(s.unions).find((x) => x.status === 'married' && x.members.includes(parent.id));
    const p = u ? s.npcs[u.members.find((m) => m !== parent.id) as string] : undefined;
    return p && p.deathYear === null ? p : undefined;
  })();
  if (!partner) {
    partner = createNpc(run, {
      familyName: rng.pick(ctx.content.familyNames),
      birthYear: parent.birthYear + rng.int(-4, 4),
      class: parent.class,
      countryCode: parent.countryCode,
    });
    const uid = `${s.id}:u${Object.keys(s.unions).length}:gen${generation}`;
    if (!unionOf(s, parent.id, partner.id)) s.unions[uid] = { id: uid, members: [parent.id, partner.id], status: 'married', startYear: death - 1, endYear: null };
  }

  const family = parent.familyName;
  const id = `life-${checksum(`${params.seed}|${params.givenName}|${family}|g${generation}`)}`;
  const personId = `${id}:p0`;
  const newCountry = ctx.content.countries.find((c) => c.code === parent.countryCode) ?? country;
  const city = newCountry.code === prev.location.countryCode ? prev.location.city : pickCity(rng, newCountry.cities);

  const next: GameState = {
    ...s,
    schemaVersion: SCHEMA_VERSION,
    id,
    revision: 0,
    seed: params.seed,
    rng: rng.state(),
    rulesVersion: ctx.rulesVersion,
    contentVersion: ctx.contentVersion,
    dynasty: {
      id: prev.dynasty.id,
      generation,
      chronicle: [
        ...prev.dynasty.chronicle,
        {
          generation: prev.dynasty.generation,
          personId: me.id,
          name: `${me.givenName} ${me.familyName}`,
          birthYear: me.birth.year,
          deathYear: death,
          cause: me.death?.cause ?? 'unknown',
          currency: prev.finance.currency,
          netWorth: net,
          minorUnits: prev.finance.minorUnits,
          qualifications: prev.education.qualifications,
          lastProfession: prev.career.job?.professionId ?? null,
          children: childrenOf(prev, me.id).length,
        },
      ],
    },
    world: { originDate: prev.world.originDate, startDate: deathDate, currentDate: deathDate, priceIndex: prev.world.priceIndex, economy: prev.world.economy, countries: s.world.countries, history: s.world.history },
    simulation: { status: 'IDLE', monthsDone: 0, pending: null },
    location: { countryCode: newCountry.code, city },
    protagonist: {
      id: personId,
      givenName: params.givenName.trim(),
      familyName: family,
      birth: deathDate,
      stats: drawStats(rng),
      traits: drawTraits(rng, [parent.traits, partner.traits]),
      predispositions: drawPredispositions(rng, [parent.predispositions, partner.predispositions]),
      talents: drawTalents(rng, ctx.content, [parent.talents, partner.talents]),
      skills: { social: 10, technical: 10, creative: 10, physical: 10 },
      parentIds: [parent.id, partner.id],
      death: null,
    },
    family: { class: parent.class, guardianId: null },
    relationships: {},
    stories: {},
    education: { stage: 'none', postgraduate: null, yearsInStage: 0, performance: 50, qualifications: [], scholarship: false },
    career: { job: null, retired: false, pension: 0 },
    finance: { currency: newCountry.currency, minorUnits: newCountry.minorUnits, accounts: {}, thisYear: emptyTotals(), lastYear: null, gainsThisYear: 0 },
    society: defaultSociety(newCountry.code, deathDate.year),
    properties: {},
    eventLog: {},
    flags: {},
    lastCommandId: null,
  };

  // The previous protagonist's friends, exes and acquaintances are strangers to the next generation.
  const close = new Set('parent grandparent ancestor sibling uncle_aunt cousin nibling'.split(' '));
  const roots = new Set(Object.values(next.npcs).filter((n) => n.deathYear === null && close.has(relationCode(next, n.id))).map((n) => n.id));
  prune(next, roots);
  syncLocal(next);
  trackPerson(next, newCountry.code, true); // the newborn adds to the population
  // Companies pass to the heir parent and keep running; closed ones are forgotten.
  for (const [bid, b] of Object.entries(next.businesses)) {
    if (b.status === 'closed') delete next.businesses[bid];
    else if (b.ownerId === me.id) b.ownerId = parent.id;
  }
  for (const [bid, b] of Object.entries(next.businesses)) if (!next.npcs[b.ownerId]) delete next.businesses[bid];
  const run2 = makeRun(next, ctx, newCountry, rng, 0);
  const alive = (n: Npc | undefined): n is Npc => !!n && n.deathYear === null;
  const relatives = new Set<string>();
  for (const pid of next.protagonist.parentIds) {
    relatives.add(pid);
    for (const gp of next.npcs[pid]?.parentIds ?? []) relatives.add(gp);
  }
  const parentsOfParents = new Set(next.protagonist.parentIds.flatMap((p) => next.npcs[p]?.parentIds ?? []));
  for (const n of Object.values(next.npcs)) {
    const sibling = n.parentIds.some((p) => next.protagonist.parentIds.includes(p)); // siblings
    const uncleAunt = parentsOfParents.size > 0 && n.parentIds.some((p) => parentsOfParents.has(p)); // parents' siblings
    if (sibling || uncleAunt) relatives.add(n.id);
  }
  for (const rid of [...relatives].sort()) if (alive(next.npcs[rid])) link(run2, personId, rid, 'family');

  // Feuds outlive the people who started them: inherited grudges colour the new family's relationships.
  for (const [sid, story] of Object.entries(prev.stories)) {
    if (!sid.startsWith('feud') || !story.subjectId || !alive(next.npcs[story.subjectId])) continue;
    next.stories[sid] = { stage: story.stage, since: story.since, subjectId: story.subjectId };
    const subject = story.subjectId;
    for (const n of Object.values(next.npcs)) {
      if (n.id === subject || n.parentIds.includes(subject)) {
        nudge(relOf(next, n.id, personId), 'conflict', 30);
        nudge(relOf(next, personId, n.id), 'conflict', 20);
      }
    }
  }
  next.rng = rng.state();

  const issues = validateState(next);
  if (issues.length) return { ok: false, error: { code: 'INVARIANT_VIOLATION', message: issues.join('; ') } };
  const events: DomainEvent[] = [
    { id: `${id}:0:0`, revision: 0, sequence: 0, at: deathDate, type: 'LIFE_CREATED', payload: { personId, seed: params.seed, countryCode: newCountry.code } },
  ];
  return {
    ok: true,
    state: next,
    events,
    checkpoint: { id: `${id}:cp:0`, gameId: id, revision: 0, at: deathDate, reason: 'LIFE_CREATED', stateChecksum: stateChecksum(next) },
    duplicate: false,
  };
}


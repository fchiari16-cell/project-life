import { GameStateSchema, STAT_KEYS, type GameState, type SimDate } from '@project-life/schemas';
import { validateGenealogy } from './genealogy.js';
import { trackedCounts } from './world.js';

export const monthIndex = (d: SimDate): number => d.year * 12 + (d.month - 1);

export function ageInYears(birth: SimDate, now: SimDate): number {
  return Math.floor((monthIndex(now) - monthIndex(birth)) / 12);
}

/** Returns human-readable violations; empty array means the state is valid. */
export function validateState(input: unknown): string[] {
  const parsed = GameStateSchema.safeParse(input);
  if (!parsed.success) {
    return parsed.error.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`);
  }
  return invariantIssues(parsed.data);
}

/** Cross-field rules for a state that already passed the schema. */
export function invariantIssues(s: GameState): string[] {
  const issues: string[] = [];
  // GOD MODE is fixed at creation: a life that shows any GOD MODE activity must have been created with it.
  if (!s.config.godModeEnabled && (s.godMode.edits > 0 || s.godMode.log.length > 0)) issues.push('GOD MODE activity recorded in a life created without GOD MODE');
  if (monthIndex(s.world.currentDate) < monthIndex(s.world.startDate)) {
    issues.push('world.currentDate precedes world.startDate');
  }
  if (monthIndex(s.protagonist.birth) > monthIndex(s.world.startDate)) {
    issues.push('protagonist born after world start');
  }
  for (const k of STAT_KEYS) {
    const v = s.protagonist.stats[k];
    if (v < 0 || v > 100) issues.push(`stat ${k} out of range`);
  }

  const ledgerSum = Object.values(s.finance.accounts).reduce((a, b) => a + b, 0);
  if (ledgerSum !== 0) issues.push(`ledger out of balance by ${ledgerSum}`);
  if ((s.finance.accounts['asset:cash'] ?? 0) < 0) issues.push('negative cash (shortfall must be borrowed)');
  if ((s.finance.accounts['liability:debt'] ?? 0) > 0) issues.push('debt account has a credit-side surplus');

  const status = s.simulation.status;
  if ((status === 'PAUSED_EVENT') !== (s.simulation.pending !== null)) {
    issues.push('pending decision must exist exactly when status is PAUSED_EVENT');
  }
  if (status !== 'RUNNING' && status !== 'PAUSED_EVENT' && s.simulation.monthsDone !== 0) {
    issues.push('monthsDone must be 0 outside an in-flight year');
  }
  if (s.protagonist.death && s.simulation.pending) issues.push('a dead protagonist cannot have a pending decision');
  // Assets and liabilities in the personal ledger must match the property register exactly.
  const props = Object.values(s.properties);
  if ((s.finance.accounts['asset:property'] ?? 0) !== props.reduce((a, p) => a + p.value, 0)) issues.push('property account differs from the register');
  if (-(s.finance.accounts['liability:mortgage'] ?? 0) !== props.reduce((a, p) => a + p.loan, 0)) issues.push('mortgage account differs from the register');
  if ((s.finance.accounts['asset:invest'] ?? 0) < 0) issues.push('negative investments');
  for (const b of Object.values(s.businesses)) {
    const sum = Object.values(b.accounts).reduce((a, v) => a + v, 0);
    if (sum !== 0) issues.push(`business ${b.id} ledger out of balance by ${sum}`);
    if ((b.accounts['b:cash'] ?? 0) < 0) issues.push(`business ${b.id} has negative cash`);
    if (b.ownerId !== s.protagonist.id && !s.npcs[b.ownerId]) issues.push(`business ${b.id} has an unknown owner`);
  }
  // The world: every individually simulated person is counted exactly once, and aggregates never go negative.
  const counts = trackedCounts(s);
  for (const [code, c] of Object.entries(s.world.countries)) {
    if (c.tracked !== (counts[code] ?? 0)) issues.push(`country ${code}: tracked ${c.tracked} != living individuals ${counts[code] ?? 0}`);
    if (c.population < c.tracked) issues.push(`country ${code}: population below tracked individuals`);
  }
  const home = s.world.countries[s.location.countryCode];
  if (!home) issues.push('location points to an unknown country');
  else {
    if (JSON.stringify(home.economy) !== JSON.stringify(s.world.economy)) issues.push('world.economy is not the local economy');
    if (home.priceIndex !== s.world.priceIndex) issues.push('world.priceIndex is not the local price level');
  }
  if (s.society.office && !s.society.party) issues.push('office without a party');
  if (s.society.legal?.stage === 'imprisoned' && s.society.legal.releaseYear === null) issues.push('imprisoned without a release year');
  if (s.society.residence.countryCode !== s.location.countryCode) issues.push('residence differs from location');
  for (const [id, talents] of [[s.protagonist.id, s.protagonist.talents] as const, ...Object.values(s.npcs).map((n) => [n.id, n.talents] as const)]) {
    if (new Set(talents).size !== talents.length) issues.push(`${id}: duplicate talents`);
  }
  issues.push(...validateGenealogy(s));
  for (const n of Object.values(s.npcs)) {
    if (n.deathYear !== null && n.deathYear < n.birthYear) issues.push(`npc ${n.id} died before birth`);
  }
  for (const [key, r] of Object.entries(s.relationships)) {
    if (key !== `${r.from}>${r.to}`) issues.push(`relationship key mismatch ${key}`);
    if (r.from !== s.protagonist.id && r.to !== s.protagonist.id) issues.push(`relationship ${key} does not involve the protagonist`);
    const other = r.from === s.protagonist.id ? r.to : r.from;
    if (!s.npcs[other]) issues.push(`relationship ${key} points to unknown npc`);
  }
  for (const u of Object.values(s.unions)) {
    for (const m of u.members) if (m !== s.protagonist.id && !s.npcs[m]) issues.push(`union ${u.id} has unknown member ${m}`);
    if (u.status === 'ended' && u.endYear === null) issues.push(`union ${u.id} ended without a year`);
  }
  if (Object.values(s.unions).filter((u) => u.status !== 'ended' && u.members.includes(s.protagonist.id)).length > 1) {
    issues.push('protagonist has more than one active union');
  }
  const actor = s.simulation.pending?.actorId;
  if (actor && !s.npcs[actor]) issues.push('pending actor does not exist');
  return issues;
}

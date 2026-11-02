import type { GameState, SimulationContext } from '@project-life/schemas';
import { childrenOf } from './genealogy.js';
import { netWorth } from './finance.js';
import { currentAge, emit, expandQualifications, type Run } from './run.js';

interface Def {
  id: string;
  check(s: GameState, content: SimulationContext['content']): boolean;
}

/** Net worth expressed in reference EUR cents, so the same goal means the same thing in every country. */
function referenceWorth(s: GameState, content: SimulationContext['content']): number {
  const c = content.countries.find((x) => x.code === s.location.countryCode);
  if (!c) return 0;
  return netWorth(s) / ((c.fxPerEur * s.world.priceIndex * (s.finance.minorUnits / 100)) / 10_000);
}

/**
 * Goals shared by normal play and GOD MODE: they are evaluated from the state alone, whatever tools the
 * player used to get there, and once unlocked they stay unlocked.
 */
export const ACHIEVEMENTS: readonly Def[] = [
  { id: 'first_child', check: (s) => childrenOf(s, s.protagonist.id).length > 0 },
  { id: 'married', check: (s) => Object.values(s.unions).some((u) => u.members.includes(s.protagonist.id) && u.status === 'married') },
  { id: 'graduate', check: (s) => expandQualifications(s.education.qualifications).includes('bachelor') },
  { id: 'scholar', check: (s) => s.education.qualifications.includes('doctorate') },
  { id: 'homeowner', check: (s) => Object.keys(s.properties).length > 0 },
  { id: 'founder', check: (s) => Object.values(s.businesses).some((b) => b.ownerId === s.protagonist.id) },
  { id: 'elected', check: (s) => s.society.office !== null },
  { id: 'expat', check: (s) => s.society.citizenships[0] !== s.location.countryCode },
  { id: 'veteran', check: (s) => (s.career.job?.level ?? 0) >= 4 },
  { id: 'wealthy', check: (s, c) => referenceWorth(s, c) >= 100_000_000 },
  { id: 'celebrity', check: (s) => s.society.fame.notoriety >= 70 },
  { id: 'centenarian', check: (s) => currentAge(s) >= 100 },
  { id: 'dynasty_three', check: (s) => s.dynasty.generation >= 3 },
];

export const ACHIEVEMENT_IDS: readonly string[] = ACHIEVEMENTS.map((a) => a.id);

/** Unlocks whatever is newly true. Never removes anything, and never looks at how it was achieved. */
export function updateAchievements(run: Run): void {
  const s = run.s;
  for (const a of ACHIEVEMENTS) {
    if (s.achievements[a.id] !== undefined) continue;
    if (a.check(s, run.ctx.content)) {
      s.achievements[a.id] = s.world.currentDate.year;
      emit(run, 'ACHIEVEMENT', { id: a.id });
    }
  }
}

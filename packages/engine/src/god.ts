import type {
  ContentBundle,
  GameState,
  GodLogEntry,
  GodPatch,
  Npc,
  Person,
} from '@project-life/schemas';

export interface GodChange {
  path: string;
  from: string;
  to: string;
}

export interface GodPlan {
  ok: boolean;
  /** What would change. Empty with ok = nothing to do (the edit is idempotent). */
  changes: GodChange[];
  issues: string[];
}

type Target = { kind: 'protagonist'; ref: Person } | { kind: 'npc'; ref: Npc };

/** Only living people can be edited. */
export function godTarget(s: GameState, id: string): Target | null {
  if (id === s.protagonist.id) return s.protagonist.death ? null : { kind: 'protagonist', ref: s.protagonist };
  const n = s.npcs[id];
  return n && n.deathYear === null ? { kind: 'npc', ref: n } : null;
}

const same = (a: readonly string[], b: readonly string[]): boolean => [...a].sort().join('|') === [...b].sort().join('|');

/**
 * Pure planning step shared by the preview and the command: validates the patch against the character
 * schema and the content, and lists exactly what would change. Nothing is modified.
 */
export function planGodEdit(s: GameState, targetId: string, patch: GodPatch, content: ContentBundle): GodPlan {
  const target = godTarget(s, targetId);
  if (!target) return { ok: false, changes: [], issues: ['unknown or deceased target'] };
  const issues: string[] = [];
  const changes: GodChange[] = [];
  const note = (path: string, from: unknown, to: unknown): void => {
    if (String(from) !== String(to)) changes.push({ path, from: String(from), to: String(to) });
  };

  if (target.kind === 'npc' && (patch.stats || patch.skills)) issues.push('non-player characters have no visible stats or skills to edit');
  if (patch.givenName !== undefined) note('givenName', target.ref.givenName, patch.givenName);
  if (patch.familyName !== undefined) note('familyName', target.ref.familyName, patch.familyName);
  if (patch.traits) for (const [k, v] of Object.entries(patch.traits)) note(`traits.${k}`, target.ref.traits[k as keyof typeof target.ref.traits], v);
  if (patch.predispositions) for (const [k, v] of Object.entries(patch.predispositions)) note(`predispositions.${k}`, target.ref.predispositions[k as keyof typeof target.ref.predispositions], v);
  if (patch.talents) {
    const known = new Set(content.talents.map((t) => t.id));
    if (new Set(patch.talents).size !== patch.talents.length) issues.push('duplicate talents');
    for (const t of patch.talents) if (!known.has(t)) issues.push(`unknown talent ${t}`);
    if (!same(patch.talents, target.ref.talents)) note('talents', target.ref.talents.join(', ') || '—', patch.talents.join(', ') || '—');
  }
  if (target.kind === 'protagonist') {
    if (patch.stats) for (const [k, v] of Object.entries(patch.stats)) note(`stats.${k}`, target.ref.stats[k as keyof typeof target.ref.stats], v);
    if (patch.skills) for (const [k, v] of Object.entries(patch.skills)) note(`skills.${k}`, target.ref.skills[k as keyof typeof target.ref.skills], v);
  }
  return { ok: issues.length === 0, changes: issues.length ? [] : changes, issues };
}

/** Applies an already validated patch to a draft. */
export function applyGodPatch(s: GameState, targetId: string, patch: GodPatch): void {
  const target = godTarget(s, targetId);
  if (!target) return;
  const ref = target.ref;
  if (patch.givenName !== undefined) ref.givenName = patch.givenName;
  if (patch.familyName !== undefined) ref.familyName = patch.familyName;
  if (patch.traits) Object.assign(ref.traits, patch.traits);
  if (patch.predispositions) Object.assign(ref.predispositions, patch.predispositions);
  if (patch.talents) ref.talents = [...patch.talents];
  if (target.kind === 'protagonist') {
    if (patch.stats) Object.assign(target.ref.stats, patch.stats);
    if (patch.skills) Object.assign(target.ref.skills, patch.skills);
  }
}

export function pushGodLog(s: GameState, entry: GodLogEntry): void {
  s.godMode.log.push(entry);
  if (s.godMode.log.length > 200) s.godMode.log.splice(0, s.godMode.log.length - 200);
}

import type { GameState, Npc, Union } from '@project-life/schemas';

export const MIN_PARENT_AGE = 14;

export const parentIdsOf = (s: GameState, id: string): readonly string[] =>
  id === s.protagonist.id ? s.protagonist.parentIds : (s.npcs[id]?.parentIds ?? []);

export const birthYearOf = (s: GameState, id: string): number | undefined =>
  id === s.protagonist.id ? s.protagonist.birth.year : s.npcs[id]?.birthYear;

export function ancestorsOf(s: GameState, id: string): Set<string> {
  const seen = new Set<string>();
  const stack = [...parentIdsOf(s, id)];
  while (stack.length) {
    const next = stack.pop() as string;
    if (seen.has(next)) continue;
    seen.add(next);
    stack.push(...parentIdsOf(s, next));
  }
  return seen;
}

/** True if making `parentId` a parent of `childId` would loop the family tree (or a person their own parent). */
export function wouldCreateCycle(s: GameState, childId: string, parentId: string): boolean {
  return parentId === childId || ancestorsOf(s, parentId).has(childId);
}

export function childrenOf(s: GameState, id: string): Npc[] {
  return Object.values(s.npcs).filter((n) => n.parentIds.includes(id));
}

export function descendantsOf(s: GameState, id: string): Set<string> {
  const out = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop() as string;
    for (const c of childrenOf(s, cur)) {
      if (!out.has(c.id)) {
        out.add(c.id);
        stack.push(c.id);
      }
    }
  }
  return out;
}

export function validateGenealogy(s: GameState): string[] {
  const issues: string[] = [];
  const people: [string, readonly string[], number][] = [
    [s.protagonist.id, s.protagonist.parentIds, s.protagonist.birth.year],
    ...Object.values(s.npcs).map((n): [string, readonly string[], number] => [n.id, n.parentIds, n.birthYear]),
  ];
  for (const [id, parents, birth] of people) {
    if (new Set(parents).size !== parents.length) issues.push(`${id}: duplicate parent`);
    for (const p of parents) {
      const pb = birthYearOf(s, p);
      if (pb === undefined) issues.push(`${id}: unknown parent ${p}`);
      else if (pb + MIN_PARENT_AGE > birth) issues.push(`${id}: parent ${p} was younger than ${MIN_PARENT_AGE} at the birth`);
    }
    if (ancestorsOf(s, id).has(id)) issues.push(`${id}: is their own ancestor`);
  }
  return issues;
}

export function activeUnion(s: GameState): Union | undefined {
  return Object.values(s.unions).find((u) => u.status !== 'ended' && u.members.includes(s.protagonist.id));
}

export function partnerIdOf(s: GameState): string | null {
  const u = activeUnion(s);
  return u ? ((u.members.find((m) => m !== s.protagonist.id) as string) ?? null) : null;
}

export function unionOf(s: GameState, a: string, b: string): Union | undefined {
  return Object.values(s.unions).find((u) => u.members.includes(a) && u.members.includes(b));
}

export type RelationCode =
  | 'parent'
  | 'child'
  | 'sibling'
  | 'grandparent'
  | 'ancestor'
  | 'grandchild'
  | 'descendant'
  | 'uncle_aunt'
  | 'nibling'
  | 'cousin'
  | 'partner'
  | 'spouse'
  | 'ex'
  | 'friend'
  | 'relative'
  | 'acquaintance';

/** How `id` relates to the protagonist, derived from the genealogy graph and the unions. */
export function relationCode(s: GameState, id: string): RelationCode {
  const me = s.protagonist.id;
  const u = Object.values(s.unions).find((x) => x.members.includes(me) && x.members.includes(id));
  if (u) return u.status === 'married' ? 'spouse' : u.status === 'dating' ? 'partner' : 'ex';
  const myParents = new Set(s.protagonist.parentIds);
  const theirParents = parentIdsOf(s, id);
  if (myParents.has(id)) return 'parent';
  if (theirParents.includes(me)) return 'child';
  if (theirParents.some((p) => myParents.has(p))) return 'sibling';
  const grandparents = new Set([...myParents].flatMap((p) => parentIdsOf(s, p)));
  if (grandparents.has(id)) return 'grandparent';
  if (theirParents.some((p) => parentIdsOf(s, p).includes(me))) return 'grandchild';
  if (ancestorsOf(s, me).has(id)) return 'ancestor';
  if (ancestorsOf(s, id).has(me)) return 'descendant';
  const uncles = new Set([...grandparents].flatMap((g) => childrenOf(s, g).map((c) => c.id)).filter((x) => !myParents.has(x)));
  if (uncles.has(id)) return 'uncle_aunt';
  if (theirParents.some((p) => uncles.has(p))) return 'cousin';
  const siblings = Object.values(s.npcs).filter((n) => n.parentIds.some((p) => myParents.has(p)));
  if (theirParents.some((p) => siblings.some((sib) => sib.id === p))) return 'nibling';
  const rel = s.relationships[`${me}>${id}`];
  if (rel?.bond === 'friend') return 'friend';
  if (rel?.bond === 'family') return 'relative';
  return 'acquaintance';
}

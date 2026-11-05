import { useNavigate } from 'react-router';
import { actionAvailability, fullName, relationCode, type RelationCode } from '@project-life/engine';
import type { Npc } from '@project-life/schemas';
import { PlaceholderPage } from './PlaceholderPage';
import { LifeCategoryDivider, LifeList, LifeListItem } from '../components/life/LifeList';
import { LifeSectionHeader } from '../components/life/LifeSectionHeader';
import { useGame } from '../game/store';
import { t } from '../i18n/it';

type Group = keyof typeof t.rel.groups;

const groupOf = (code: RelationCode): Group => {
  if (code === 'partner' || code === 'spouse') return 'partner';
  if (code === 'friend') return 'friends';
  if (code === 'acquaintance' || code === 'ex') return 'other';
  return 'family';
};

/** The family is long enough to deserve its own sub-categories. */
const FAMILY_PARTS: { key: keyof typeof t.rel.familyParts; test: (c: RelationCode) => boolean }[] = [
  { key: 'parents', test: (c) => c === 'parent' },
  { key: 'siblings', test: (c) => c === 'sibling' },
  { key: 'relatives', test: (c) => c !== 'parent' && c !== 'sibling' },
];
const WHOLE = [{ key: null, test: () => true }] as const;

/** The people the protagonist knows, as a list of rows; each opens the person's sheet. */
export function RelationshipsPage() {
  const game = useGame((s) => s.game);
  const navigate = useNavigate();
  if (!game) return <PlaceholderPage title={t.nav.relationships} description={t.family.none} milestone="M2 (apri una vita)" />;

  const year = (game.protagonist.death?.date ?? game.world.currentDate).year;
  const groups: Record<Group, { npc: Npc; code: RelationCode }[]> = { family: [], partner: [], friends: [], other: [] };
  for (const npc of Object.values(game.npcs)) {
    if (!game.relationships[`${game.protagonist.id}>${npc.id}`]) continue; // only people the protagonist actually knows
    const code = relationCode(game, npc.id);
    groups[groupOf(code)].push({ npc, code });
  }
  for (const g of Object.values(groups)) g.sort((a, b) => Number(a.npc.deathYear !== null) - Number(b.npc.deathYear !== null) || a.npc.birthYear - b.npc.birthYear);

  const row = (npc: Npc, code: RelationCode) => {
    const theirs = game.relationships[`${npc.id}>${game.protagonist.id}`];
    const status = npc.deathYear === null ? t.rel.age(year - npc.birthYear) : `${t.rel.deceased(npc.deathYear)} (${t.rel.age(npc.deathYear - npc.birthYear)})`;
    const guardian = game.family.guardianId === npc.id ? ` · ${t.rel.guardian(fullName(npc))}` : '';
    const to = `/relazioni/${encodeURIComponent(npc.id)}`;
    return (
      <LifeListItem
        key={npc.id}
        avatar={{ id: npc.id, name: fullName(npc) }}
        title={fullName(npc)}
        description={`${t.rel.code[code]} · ${status}${guardian}`}
        stat={theirs ? { key: 'affection', label: t.rel.dims.affection, value: theirs.dims.affection } : undefined}
        to={to}
        menuLabel={t.lists.actions(fullName(npc))}
        menu={[
          { id: 'open', label: t.lists.openSheet, onSelect: () => void navigate(to) },
          { id: 'god', label: t.lists.editCharacter, availability: actionAvailability(game, 'GOD_EDIT', { targetId: npc.id }), onSelect: () => void navigate(`${to}?modifica=1`) },
        ]}
      />
    );
  };

  return (
    <div className="grid gap-6" data-area="relationships">
      <div>
        <h1 className="text-2xl font-bold">{t.nav.relationships}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.family.class[game.family.class]}</p>
        {game.family.guardianId === null && game.protagonist.death === null && !game.protagonist.parentIds.some((id) => game.npcs[id]?.deathYear === null) && game.world.currentDate.year - game.protagonist.birth.year < 18 && (
          <p className="mt-2 text-sm">{t.rel.stateCare}</p>
        )}
      </div>
      {(Object.keys(groups) as Group[]).map((g) => (
        <section key={g} aria-labelledby={`g-${g}`}>
          <LifeSectionHeader id={`g-${g}`} title={t.rel.groups[g]} />
          {groups[g].length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.rel.none}</p>
          ) : (
            <div className="grid gap-2">
              {(g === 'family' ? FAMILY_PARTS : WHOLE).map((part) => {
                const people = groups[g].filter(({ code }) => part.test(code));
                if (people.length === 0) return null;
                const label = part.key ? t.rel.familyParts[part.key] : t.rel.groups[g];
                return (
                  <div key={part.key ?? 'all'}>
                    {part.key && <LifeCategoryDivider title={label} count={people.length} />}
                    <LifeList label={label}>{people.map(({ npc, code }) => row(npc, code))}</LifeList>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

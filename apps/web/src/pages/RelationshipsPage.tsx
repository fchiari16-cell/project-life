import { REL_DIMS, type GameState, type Npc, type RelDims } from '@project-life/schemas';
import { fullName, relationCode, type RelationCode } from '@project-life/engine';
import { useState } from 'react';
import { PlaceholderPage } from './PlaceholderPage';
import { Button } from '../components/ui/button';
import { GodEditor } from '../components/GodEditor';
import { useGame } from '../game/store';
import { t } from '../i18n/it';

type Group = keyof typeof t.rel.groups;

const groupOf = (code: RelationCode): Group => {
  if (code === 'partner' || code === 'spouse') return 'partner';
  if (code === 'friend') return 'friends';
  if (code === 'acquaintance' || code === 'ex') return 'other';
  return 'family';
};

function Dims({ label, dims }: { label: string; dims: RelDims }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-muted-foreground">{label}</p>
      <ul className="grid gap-1.5">
        {REL_DIMS.map((d) => (
          <li key={d} className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-2 text-xs">
            <span>{t.rel.dims[d]}</span>
            <div role="meter" aria-label={`${label}: ${t.rel.dims[d]}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={dims[d]} className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${dims[d]}%` }} />
            </div>
            <span className="tabular-nums text-right">{dims[d]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Person({ game, npc, code }: { game: GameState; npc: Npc; code: RelationCode }) {
  const year = (game.protagonist.death?.date ?? game.world.currentDate).year;
  const mine = game.relationships[`${game.protagonist.id}>${npc.id}`];
  const theirs = game.relationships[`${npc.id}>${game.protagonist.id}`];
  const status = npc.deathYear === null ? t.rel.age(year - npc.birthYear) : `${t.rel.deceased(npc.deathYear)} (${t.rel.age(npc.deathYear - npc.birthYear)})`;
  const guardian = game.family.guardianId === npc.id;
  const [editing, setEditing] = useState(false);
  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <details>
        <summary className="cursor-pointer list-none">
          <span className="font-semibold">{fullName(npc)}</span>
          <span className="block text-sm text-muted-foreground">
            {t.rel.code[code]} · {status}
            {guardian && ` · ${t.rel.guardian(fullName(npc))}`}
          </span>
        </summary>
        {mine && theirs ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Dims label={t.rel.theirFeelings(npc.givenName)} dims={theirs.dims} />
            <Dims label={t.rel.yourFeelings} dims={mine.dims} />
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">—</p>
        )}
        <div className="mt-4">
          <p className="mb-1 text-xs font-semibold text-muted-foreground">{t.rel.memories}</p>
          {npc.memories.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.rel.noMemories}</p>
          ) : (
            <ul className="grid gap-1 text-sm">
              {[...npc.memories].reverse().map((m, i) => (
                <li key={i}>
                  <span aria-hidden="true">{m.valence > 0 ? '＋' : '－'}</span> {t.rel.memory[m.type]} <span className="text-muted-foreground">({m.year})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {game.config.godModeEnabled && npc.deathYear === null && (
          <div className="mt-4">
            {editing ? (
              <GodEditor targetId={npc.id} onClose={() => setEditing(false)} />
            ) : (
              <Button variant="outline" onClick={() => setEditing(true)}>
                {t.god.editProfile}
              </Button>
            )}
          </div>
        )}
      </details>
    </li>
  );
}

export function RelationshipsPage() {
  const game = useGame((s) => s.game);
  if (!game) return <PlaceholderPage title={t.nav.relationships} description={t.family.none} milestone="M2 (apri una vita)" />;

  const groups: Record<Group, { npc: Npc; code: RelationCode }[]> = { family: [], partner: [], friends: [], other: [] };
  for (const npc of Object.values(game.npcs)) {
    if (!game.relationships[`${game.protagonist.id}>${npc.id}`]) continue; // only people the protagonist actually knows
    const code = relationCode(game, npc.id);
    groups[groupOf(code)].push({ npc, code });
  }
  for (const g of Object.values(groups)) g.sort((a, b) => Number(a.npc.deathYear !== null) - Number(b.npc.deathYear !== null) || a.npc.birthYear - b.npc.birthYear);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t.nav.relationships}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.family.class[game.family.class]}</p>
        {game.family.guardianId === null && game.protagonist.death === null && !game.protagonist.parentIds.some((id) => game.npcs[id]?.deathYear === null) && game.world.currentDate.year - game.protagonist.birth.year < 18 && (
          <p className="mt-2 text-sm">{t.rel.stateCare}</p>
        )}
      </div>
      {(Object.keys(groups) as Group[]).map((g) => (
        <section key={g} aria-labelledby={`g-${g}`}>
          <h2 id={`g-${g}`} className="mb-2 text-lg font-bold">
            {t.rel.groups[g]}
          </h2>
          {groups[g].length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.rel.none}</p>
          ) : (
            <ul className="grid gap-3">
              {groups[g].map(({ npc, code }) => (
                <Person key={npc.id} game={game} npc={npc} code={code} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

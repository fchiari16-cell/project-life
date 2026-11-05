import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { actionAvailability, fullName, relationCode } from '@project-life/engine';
import { REL_DIMS, type RelDims } from '@project-life/schemas';
import { PlaceholderPage } from './PlaceholderPage';
import { Button } from '../components/ui/button';
import { GodEditor } from '../components/GodEditor';
import { LifeAvatar } from '../components/life/LifeAvatar';
import { LifeDisabledAction } from '../components/life/LifeDisabledAction';
import { LifeSectionHeader } from '../components/life/LifeSectionHeader';
import { LifeStatBar } from '../components/life/LifeStatBar';
import { useGame } from '../game/store';
import { t } from '../i18n/it';

function Feelings({ id, title, dims }: { id: string; title: string; dims: RelDims }) {
  return (
    <section aria-labelledby={id} className="rounded-xl border border-border bg-card p-5">
      <LifeSectionHeader id={id} title={title} level={3} />
      <ul className="grid gap-3">
        {REL_DIMS.map((d) => (
          <li key={d}>
            <LifeStatBar statKey={d} label={t.rel.dims[d]} value={dims[d]} lowerIsBetter={d === 'conflict'} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The sheet of one person: how they feel about the protagonist and the other way round, and what they remember. */
export function RelationshipDetailPage() {
  const game = useGame((s) => s.game);
  const { id = '' } = useParams();
  const [query] = useSearchParams();
  const [editing, setEditing] = useState(query.get('modifica') === '1');
  const npc = game?.npcs[id];
  if (!game || !npc || !game.relationships[`${game.protagonist.id}>${npc.id}`]) {
    return <PlaceholderPage title={t.nav.relationships} description={t.rel.none} milestone="UI-R3" />;
  }

  const year = (game.protagonist.death?.date ?? game.world.currentDate).year;
  const mine = game.relationships[`${game.protagonist.id}>${npc.id}`];
  const theirs = game.relationships[`${npc.id}>${game.protagonist.id}`];
  const status = npc.deathYear === null ? t.rel.age(year - npc.birthYear) : `${t.rel.deceased(npc.deathYear)} (${t.rel.age(npc.deathYear - npc.birthYear)})`;
  const verdict = actionAvailability(game, 'GOD_EDIT', { targetId: npc.id });

  return (
    <div className="grid gap-5" data-area="relationships">
      <Link to="/relazioni" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t.nav.relationships}
      </Link>
      <div className="flex items-center gap-4">
        <LifeAvatar id={npc.id} name={fullName(npc)} size="lg" />
        <div>
          <h1 className="text-2xl font-bold">{fullName(npc)}</h1>
          <p className="text-sm text-muted-foreground">
            {t.rel.code[relationCode(game, npc.id)]} · {status}
          </p>
        </div>
      </div>

      {mine && theirs ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <Feelings id="their" title={t.rel.theirFeelings(npc.givenName)} dims={theirs.dims} />
          <Feelings id="mine" title={t.rel.yourFeelings} dims={mine.dims} />
        </div>
      ) : null}

      <section aria-labelledby="memories" className="rounded-xl border border-border bg-card p-5">
        <LifeSectionHeader id="memories" title={t.rel.memories} level={3} />
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
      </section>

      {npc.deathYear === null && (
        <section aria-labelledby="edit" className="rounded-xl border border-border bg-card p-5">
          <LifeSectionHeader id="edit" title={t.god.title} level={3} />
          {!verdict.available ? (
            <LifeDisabledAction label={t.lists.editCharacter} availability={verdict} />
          ) : editing ? (
            <GodEditor targetId={npc.id} onClose={() => setEditing(false)} />
          ) : (
            <Button variant="outline" onClick={() => setEditing(true)}>
              {t.god.editProfile}
            </Button>
          )}
        </section>
      )}
    </div>
  );
}

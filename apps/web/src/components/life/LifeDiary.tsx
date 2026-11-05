import { ageInYears } from '@project-life/engine';
import type { DomainEvent, GameState } from '@project-life/schemas';
import { Button } from '../ui/button';
import { LifeSectionHeader } from './LifeSectionHeader';
import { describeEvent, fmtDate } from '../../game/describe';
import { useGame } from '../../game/store';
import { t } from '../../i18n/it';

/** Entries grouped by the protagonist's age at the time, newest year first; within a year, newest first. */
export function groupByAge(game: GameState, diary: DomainEvent[], hasMore: boolean): { age: number; events: DomainEvent[] }[] {
  const p = game.protagonist;
  const now = ageInYears(p.birth, p.death?.date ?? game.world.currentDate);
  const byAge = new Map<number, DomainEvent[]>();
  for (const e of diary) {
    const age = Math.min(now, Math.max(0, ageInYears(p.birth, e.at)));
    byAge.set(age, [...(byAge.get(age) ?? []), e]);
  }
  // Years without entries are shown as such (not invented), down to the oldest loaded entry, or to birth.
  const oldest = hasMore ? Math.min(...byAge.keys(), now) : 0;
  const out: { age: number; events: DomainEvent[] }[] = [];
  for (let age = now; age >= oldest; age--) {
    const events = (byAge.get(age) ?? []).sort((a, b) => b.revision - a.revision || b.sequence - a.sequence);
    out.push({ age, events });
  }
  return out;
}

const isoDate = (d: DomainEvent['at']): string => `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;

function DiaryEntries({ game, groups }: { game: GameState; groups: ReturnType<typeof groupByAge> }) {
  return (
    <ol className="grid gap-5">
      {groups.map(({ age, events }) => (
        <li key={age}>
          <h3 className="mb-1 text-sm font-bold text-area-ink">{t.diary.age(age)}</h3>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.diary.quiet}</p>
          ) : (
            <ul className="grid gap-2 border-l-2 border-border pl-3 text-sm">
              {events.map((e) => {
                const d = describeEvent(e, game.finance.currency);
                return (
                  <li key={e.id} className="flex justify-between gap-3">
                    <span>
                      <span className="font-medium">{d.text}</span>
                      {d.detail && <span className="block text-muted-foreground">{d.detail}</span>}
                    </span>
                    <time className="shrink-0 tabular-nums text-xs text-muted-foreground" dateTime={isoDate(e.at)}>
                      {fmtDate(e.at)}
                    </time>
                  </li>
                );
              })}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}

/**
 * The life diary: every entry is a real domain event from the persistent journal, shown with the age it
 * happened at. It survives reloads because it is read from IndexedDB, not kept in memory; a long life's
 * diary loads after the life is already on screen.
 */
export function LifeDiary() {
  const game = useGame((s) => s.game);
  const diary = useGame((s) => s.diary);
  const hasMore = useGame((s) => s.diaryHasMore);
  const loadMore = useGame((s) => s.loadMoreDiary);
  const loading = useGame((s) => s.diaryLoading);
  if (!game) return null;

  return (
    <section aria-labelledby="diary" data-testid="diary" className="rounded-xl border border-border bg-card p-5">
      <LifeSectionHeader id="diary" title={t.diary.title} />
      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t.diary.loading}
        </p>
      ) : (
        <>
          <DiaryEntries game={game} groups={groupByAge(game, diary, hasMore)} />
          {hasMore ? (
            <Button variant="outline" className="mt-4" onClick={() => void loadMore()}>
              {t.diary.older}
            </Button>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">{t.diary.ofLife}</p>
          )}
        </>
      )}
    </section>
  );
}

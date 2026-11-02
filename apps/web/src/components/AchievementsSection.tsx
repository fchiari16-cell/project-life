import { ACHIEVEMENT_IDS } from '@project-life/engine';
import { useGame } from '../game/store';
import { t } from '../i18n/it';

export function AchievementsSection() {
  const game = useGame((s) => s.game);
  if (!game) return null;
  const unlocked = Object.keys(game.achievements).length;
  return (
    <section aria-labelledby="ach" className="rounded-xl border border-border bg-card p-5">
      <h2 id="ach" className="mb-1 text-lg font-bold">
        {t.ach.title} ({unlocked}/{ACHIEVEMENT_IDS.length})
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">{t.ach.intro}</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {ACHIEVEMENT_IDS.map((id) => {
          const year = game.achievements[id];
          const [name, desc] = t.ach.names[id] ?? [id, ''];
          return (
            <li key={id} data-unlocked={year !== undefined} className={year !== undefined ? 'rounded-lg border border-primary p-3' : 'rounded-lg border border-dashed border-border p-3'}>
              <p className="text-sm font-semibold">{name}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
              <p className="mt-1 text-xs">{year !== undefined ? t.ach.unlocked(year) : t.ach.locked}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

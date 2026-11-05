import { Link } from 'react-router';
import { dynastyOptions } from '@project-life/engine';
import { useGame } from '../game/store';
import { t } from '../i18n/it';

/** Shown when a life has ended: the next newborn is created on the creation screen, with GOD MODE asked again. */
export function DynastyCard() {
  const game = useGame((s) => s.game);
  if (!game?.protagonist.death) return null;
  const heirs = dynastyOptions(game).length;

  return (
    <section aria-labelledby="continue" className="rounded-xl border border-border bg-card p-5">
      <h2 id="continue" className="text-lg font-bold">
        {t.dynasty.continueTitle}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t.dynasty.continueHint}</p>
      {heirs === 0 && <p className="mt-2 text-sm">{t.dynasty.noHeirs}</p>}
      <Link
        to={`/nuova-vita?mode=dynasty&from=${encodeURIComponent(game.id)}`}
        className="mt-4 inline-flex min-h-14 w-full items-center justify-center rounded-lg bg-primary px-6 text-base font-semibold text-primary-foreground hover:opacity-90"
      >
        {t.newLife.continueCta}
      </Link>
    </section>
  );
}

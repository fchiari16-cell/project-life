import { Link } from 'react-router';
import { ageInYears } from '@project-life/engine';
import { LifeAvatar } from './LifeAvatar';
import { LifeMenu } from './LifeMenu';
import { LifeMoneyDisplay } from './LifeMoneyDisplay';
import { countryName, fmtDate, occupationLabel } from '../../game/describe';
import { useGame } from '../../game/store';
import { t } from '../../i18n/it';

/**
 * Top bar, present on every screen: settings menu (always top-left), protagonist (avatar, name, place, age,
 * occupation, link to the full profile) and net worth. Everything is read from the canonical state.
 */
export function LifeCharacterHeader() {
  const game = useGame((s) => s.game);
  const p = game?.protagonist;
  const endDate = game && p ? (p.death?.date ?? game.world.currentDate) : null;
  const age = game && p && endDate ? ageInYears(p.birth, endDate) : 0;

  return (
    <header className="sticky top-0 z-[var(--z-nav)] border-b border-border bg-card px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] md:px-8">
      <div className="flex items-center gap-3">
        <LifeMenu />
        {game && p && endDate ? (
          <>
            <Link to="/profilo" className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1 hover:bg-muted">
              <LifeAvatar id={p.id} name={`${p.givenName} ${p.familyName}`} />
              <span className="min-w-0">
                <span className="block truncate font-bold">
                  <span className="sr-only">{t.shell.profile}: </span>
                  {p.givenName} {p.familyName}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {game.location.city}, {countryName(game.location.countryCode)} · <span>{t.life.ageUnit(age)}</span> · {occupationLabel(game, age)}
                </span>
              </span>
            </Link>
            <span className="shrink-0 text-right text-sm">
              <LifeMoneyDisplay game={game} className="block" />
              <span className="block text-xs tabular-nums text-muted-foreground">{fmtDate(endDate)}</span>
            </span>
          </>
        ) : (
          <span className="flex-1 font-bold tracking-wide">{t.appName}</span>
        )}
      </div>
    </header>
  );
}

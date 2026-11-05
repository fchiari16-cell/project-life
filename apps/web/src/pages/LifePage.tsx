import { ageInYears, cash, debtOwed, netWorth } from '@project-life/engine';
import { Button } from '../components/ui/button';
import { DynastyCard } from '../components/DynastyCard';
import { LifeDiary } from '../components/life/LifeDiary';
import { LifeSectionHeader } from '../components/life/LifeSectionHeader';
import { LifeStatList } from '../components/life/LifeStatBar';
import { SaveList } from '../components/SaveList';
import { NewLife } from '../components/life/NewLife';
import { causeLabel, formatMoney, professionTitle } from '../game/describe';
import { useGame } from '../game/store';
import { t } from '../i18n/it';

const card = 'rounded-xl border border-border bg-card p-5';

function Dashboard() {
  const game = useGame((s) => s.game);
  const events = useGame((s) => s.events);
  const busy = useGame((s) => s.busy);
  const advanceYear = useGame((s) => s.advanceYear);
  const closeGame = useGame((s) => s.closeGame);
  if (!game) return null;
  const p = game.protagonist;
  const endDate = p.death?.date ?? game.world.currentDate;
  const age = ageInYears(p.birth, endDate);
  const currency = game.finance.currency;
  const dead = p.death !== null;
  const waiting = game.simulation.status === 'PAUSED_EVENT';
  const lastJob = [...events].reverse().find((e) => e.type === 'JOB_CHANGED' && e.payload.professionId);

  return (
    <div className="grid gap-5 pb-24 md:pb-0 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
      <div className="grid gap-5">
        {dead && p.death && (
          <section aria-labelledby="ended" className="rounded-xl border-2 border-primary bg-card p-5">
            <h2 id="ended" className="text-xl font-bold">
              {t.life.ended}
            </h2>
            <p className="mt-2">{t.life.diedAt(age, causeLabel(p.death.cause))}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">{t.life.netWorth}</dt>
                <dd className="font-semibold">{formatMoney(netWorth(game), currency)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t.career.qualifications}</dt>
                <dd className="font-semibold">
                  {game.education.qualifications.length ? game.education.qualifications.map((q) => t.edu.qualification[q]).join(', ') : '—'}
                </dd>
              </div>
              {lastJob && lastJob.type === 'JOB_CHANGED' && (
                <div>
                  <dt className="text-muted-foreground">{t.life.occupation}</dt>
                  <dd className="font-semibold">{professionTitle(lastJob.payload.professionId)}</dd>
                </div>
              )}
            </dl>
          </section>
        )}

        <DynastyCard />

        {!dead && (
          <div className="fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 md:sticky md:inset-x-auto md:bottom-auto md:top-24">
            <Button size="lg" className="w-full text-base uppercase tracking-wide shadow-ui-2" onClick={() => void advanceYear()} disabled={busy || waiting} aria-busy={busy}>
              {busy ? t.life.advancing : t.life.advance}
            </Button>
            {waiting && <p className="mt-1 rounded bg-card px-2 text-center text-xs text-muted-foreground">{t.life.decisionWaiting}</p>}
          </div>
        )}

        <LifeDiary />
      </div>

      <aside aria-label={t.life.stats} className="grid gap-5">
        <section aria-labelledby="stats" className={card}>
          <LifeSectionHeader id="stats" title={t.life.stats} hint={t.life.statsNote} />
          <LifeStatList stats={p.stats} columns={1} />
        </section>

        <section aria-labelledby="money" className={card}>
          <LifeSectionHeader id="money" title={t.life.money} />
          <dl className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-muted-foreground">{t.life.cash}</dt>
              <dd className="font-semibold">{formatMoney(cash(game), currency)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t.life.debt}</dt>
              <dd className="font-semibold">{formatMoney(debtOwed(game), currency)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t.life.netWorth}</dt>
              <dd className="font-semibold">{formatMoney(netWorth(game), currency)}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="stories" className={card}>
          <LifeSectionHeader id="stories" title={t.stories.title} />
          {Object.keys(game.stories).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.stories.none}</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {Object.entries(game.stories).map(([id, st]) => (
                <li key={id} className="flex justify-between gap-3">
                  <span className="font-medium">{t.stories.names[id] ?? id}</span>
                  <span className="text-muted-foreground">
                    {t.stories.stage(st.stage)} · {t.stories.since(st.since)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-xs text-muted-foreground">{t.life.lastSaved}</p>
        <Button variant="ghost" onClick={closeGame} className="justify-self-start">
          {t.life.closeLife}
        </Button>
      </aside>
    </div>
  );
}

export function LifePage() {
  const ready = useGame((s) => s.ready);
  const game = useGame((s) => s.game);
  if (!ready) return <p role="status">…</p>;
  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-bold">{game ? `${game.protagonist.givenName} ${game.protagonist.familyName}` : t.nav.life}</h1>
        {game && <p className="text-xs text-muted-foreground">{t.dynasty.generation(game.dynasty.generation)}</p>}
      </div>
      {game ? (
        <Dashboard />
      ) : (
        <div className="grid gap-5">
          <NewLife />
          <SaveList />
        </div>
      )}
    </>
  );
}

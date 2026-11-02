import { useState, type FormEvent } from 'react';
import { contentBundle } from '@project-life/content';
import { ageInYears, cash, debtOwed, netWorth } from '@project-life/engine';
import { Button } from '../components/ui/button';
import { EventFeed } from '../components/EventFeed';
import { DynastyCard } from '../components/DynastyCard';
import { SaveList } from '../components/SaveList';
import { StatMeters } from '../components/StatMeter';
import { causeLabel, countryName, fmtDate, formatMoney, occupationLabel, professionTitle } from '../game/describe';
import { localeTag } from '../i18n/locale';
import { randomSeed, useGame } from '../game/store';
import { t } from '../i18n/it';

const card = 'rounded-xl border border-border bg-card p-5';

function NewLifeForm() {
  const createLife = useGame((s) => s.createLife);
  const busy = useGame((s) => s.busy);
  const [givenName, setGivenName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [seed, setSeed] = useState(randomSeed);
  const [country, setCountry] = useState('');

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    void createLife({ givenName, familyName, seed, countryCode: country || null });
  };
  const field = 'mt-1 block min-h-11 w-full rounded-lg border border-border bg-card px-3 text-base';

  return (
    <section aria-labelledby="new-life" className={card}>
      <h2 id="new-life" className="text-lg font-bold">
        {t.life.newLifeTitle}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t.life.newLifeHint}</p>
      <form onSubmit={submit} className="mt-4 grid gap-4">
        <label className="text-sm font-medium">
          {t.life.givenName}
          <input className={field} value={givenName} onChange={(e) => setGivenName(e.target.value)} required maxLength={64} autoComplete="off" />
        </label>
        <label className="text-sm font-medium">
          {t.life.familyName}
          <input className={field} value={familyName} onChange={(e) => setFamilyName(e.target.value)} required maxLength={64} autoComplete="off" />
        </label>
        <label className="text-sm font-medium">
          {t.life.country}
          <select className={field} value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">{t.life.randomCountry}</option>
            {[...contentBundle.countries].sort((a, b) => countryName(a.code).localeCompare(countryName(b.code), localeTag())).map((c) => (
              <option key={c.code} value={c.code}>
                {countryName(c.code)}
              </option>
            ))}
          </select>
        </label>
        <div>
          <label className="text-sm font-medium" htmlFor="seed">
            {t.life.seed}
          </label>
          <div className="flex gap-2">
            <input id="seed" className={field} value={seed} onChange={(e) => setSeed(e.target.value)} required autoComplete="off" />
            <Button type="button" variant="outline" className="mt-1 shrink-0" onClick={() => setSeed(randomSeed())}>
              {t.life.randomSeed}
            </Button>
          </div>
        </div>
        <Button type="submit" size="lg" disabled={busy}>
          {t.life.create}
        </Button>
      </form>
    </section>
  );
}

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

      <section aria-labelledby="identity" className={card}>
        <h2 id="identity" className="text-2xl font-bold">
          {p.givenName} {p.familyName}
        </h2>
        <p className="text-xs text-muted-foreground">{t.dynasty.generation(game.dynasty.generation)}</p>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-muted-foreground">{t.life.age}</dt>
            <dd className="font-semibold">{t.life.ageUnit(age)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t.life.date}</dt>
            <dd className="font-semibold">{fmtDate(endDate)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t.life.place}</dt>
            <dd className="font-semibold">
              {game.location.city}, {countryName(game.location.countryCode)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t.life.occupation}</dt>
            <dd className="font-semibold">{occupationLabel(game, age)}</dd>
          </div>
        </dl>
      </section>

      {!dead && (
        <Button size="lg" onClick={() => void advanceYear()} disabled={busy || waiting} aria-busy={busy}>
          {busy ? t.life.advancing : t.life.advance}
        </Button>
      )}

      <section aria-labelledby="money" className={card}>
        <h2 id="money" className="mb-3 text-lg font-bold">
          {t.life.money}
        </h2>
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
        <h2 id="stories" className="mb-3 text-lg font-bold">
          {t.stories.title}
        </h2>
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

      <section aria-labelledby="stats" className={card}>
        <h2 id="stats" className="mb-1 text-lg font-bold">
          {t.life.stats}
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">{t.life.statsNote}</p>
        <StatMeters stats={p.stats} />
      </section>

      <section aria-labelledby="recent" className={card}>
        <h2 id="recent" className="mb-3 text-lg font-bold">
          {t.life.recent}
        </h2>
        {events.length === 0 ? <p className="text-sm text-muted-foreground">{t.life.noEvents}</p> : <EventFeed events={events.slice(-8)} currency={currency} />}
      </section>

      <p className="text-xs text-muted-foreground">{t.life.lastSaved}</p>
      <Button variant="ghost" onClick={closeGame} className="justify-self-start">
        {t.life.closeLife}
      </Button>
    </div>
  );
}

export function LifePage() {
  const ready = useGame((s) => s.ready);
  const game = useGame((s) => s.game);
  if (!ready) return <p role="status">…</p>;
  return (
    <>
      <h1 className="mb-5 text-2xl font-bold">{t.nav.life}</h1>
      {game ? (
        <Dashboard />
      ) : (
        <div className="grid gap-5">
          <NewLifeForm />
          <SaveList />
        </div>
      )}
    </>
  );
}

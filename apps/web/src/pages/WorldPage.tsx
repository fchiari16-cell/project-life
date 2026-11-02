import { contentBundle } from '@project-life/content';
import { PlaceholderPage } from './PlaceholderPage';
import { useState } from 'react';
import { countryName } from '../game/describe';
import { useGame } from '../game/store';
import { t } from '../i18n/it';

const card = 'rounded-xl border border-border bg-card p-5';
const pct = (bp: number): string => `${(bp / 100).toFixed(1).replace('.', ',')}%`;
const people = (n: number): string => new Intl.NumberFormat('it-IT', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

export function WorldPage() {
  const game = useGame((s) => s.game);
  const [query, setQuery] = useState('');
  if (!game) return <PlaceholderPage title={t.world.title} description={t.life.noSaves} milestone="M4 (apri una vita)" />;
  const here = game.location.countryCode;
  const name = countryName;
  const all = Object.values(game.world.countries);
  const needle = query.trim().toLowerCase();
  // 250+ territories: show yours and the biggest by default, or whatever the search matches.
  const matches = needle
    ? all.filter((c) => name(c.code).toLowerCase().includes(needle) || c.code.toLowerCase() === needle)
    : [...all].sort((a, b) => b.population - a.population).slice(0, 10);
  const countries = [...new Map([...(game.world.countries[here] ? [game.world.countries[here]] : []), ...matches].map((c) => [c.code, c])).values()].slice(0, 30);
  const party = (id: string): string => contentBundle.parties.find((p) => p.id === id)?.name ?? id;

  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-bold">{t.world.title}</h1>
      <p className="text-sm text-muted-foreground">{t.world.note}</p>
      <label className="text-sm font-medium">
        {t.world.search}
        <input type="search" className="mt-1 block min-h-11 w-full rounded-lg border border-border bg-card px-3 text-base" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <p className="text-xs text-muted-foreground">{t.world.showing(countries.length, all.length)}</p>

      <ul className="grid gap-3">
        {countries.map((c) => (
          <li key={c.code} className={`${card} ${c.code === here ? 'border-primary' : ''}`}>
            <h2 className="text-lg font-bold">
              {name(c.code)} {c.code === here && <span className="text-sm font-normal text-primary">· {t.world.here}</span>}
            </h2>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">{t.world.population}</dt>
                <dd className="font-semibold">{people(c.population)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t.world.growth}</dt>
                <dd className="font-semibold">{pct(c.economy.growthBp)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t.world.inflation}</dt>
                <dd className="font-semibold">{pct(c.economy.inflationBp)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t.world.government}</dt>
                <dd className="font-semibold">{party(c.politics.governingParty)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t.world.approval}</dt>
                <dd className="font-semibold">{pct(c.politics.approvalBp)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t.world.environment}</dt>
                <dd className="font-semibold">{c.environment.stress}/100</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t.world.taxes}</dt>
                <dd className="font-semibold">{c.politics.taxAdjustBp > 0 ? '+' : ''}{pct(c.politics.taxAdjustBp)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t.world.debt}</dt>
                <dd className="font-semibold">{pct(c.politics.debtBp)}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <section aria-labelledby="whistory" className={card}>
        <h2 id="whistory" className="mb-3 text-lg font-bold">
          {t.world.history}
        </h2>
        {game.world.history.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.world.noHistory}</p>
        ) : (
          <ol className="grid gap-2 text-sm">
            {[...game.world.history].reverse().slice(0, 25).map((e, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>
                  <span className="font-medium">{t.world.kinds[e.kind]}</span>
                  {e.countryCode && <span className="text-muted-foreground"> · {name(e.countryCode)}</span>}
                  {e.kind === 'ELECTION' && <span className="text-muted-foreground"> · {party(e.detail)}</span>}
                  {e.kind === 'POLICY' && <span className="text-muted-foreground"> · {t.world.policies[e.detail] ?? e.detail}</span>}
                </span>
                <span className="tabular-nums text-muted-foreground">{e.year}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

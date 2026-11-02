import { bizEquity, cash, debtOwed, investments, mortgageOwed, netWorth, propertyValue, stakeValue } from '@project-life/engine';
import { contentBundle } from '@project-life/content';
import { PlaceholderPage } from './PlaceholderPage';
import { formatMoney } from '../game/describe';
import { useGame } from '../game/store';
import { t } from '../i18n/it';

const card = 'rounded-xl border border-border bg-card p-5';
const bp = (n: number): string => `${(n / 100).toFixed(1).replace('.', ',')}%`;

export function FinancePage() {
  const game = useGame((s) => s.game);
  if (!game) return <PlaceholderPage title={t.nav.finance} description={t.life.noSaves} milestone="M1 (apri una vita)" />;
  const cur = game.finance.currency;
  const f = (n: number): string => formatMoney(n, cur);
  const last = game.finance.lastYear;
  const eco = game.world.economy;
  const rows: [string, number][] = last
    ? [
        [t.finance.income, last.income],
        [t.finance.tax, -last.tax],
        [t.finance.living, -last.living],
        [t.finance.interest, -last.interest],
        [t.finance.other, -last.other],
      ]
    : [];
  const props = Object.values(game.properties);
  const biz = Object.values(game.businesses).filter((b) => b.status === 'active');
  const dl = 'grid grid-cols-2 gap-2 text-sm sm:grid-cols-3';

  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-bold">{t.nav.finance}</h1>

      <section aria-labelledby="bal" className={card}>
        <h2 id="bal" className="mb-3 text-lg font-bold">
          {t.finance.balances}
        </h2>
        <dl className={dl}>
          <div>
            <dt className="text-muted-foreground">{t.life.cash}</dt>
            <dd className="font-semibold">{f(cash(game))}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t.finance.investments}</dt>
            <dd className="font-semibold">{f(investments(game))}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t.finance.homes}</dt>
            <dd className="font-semibold">{f(propertyValue(game))}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t.finance.stakes}</dt>
            <dd className="font-semibold">{f(stakeValue(game))}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t.life.debt}</dt>
            <dd className="font-semibold">{f(debtOwed(game))}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t.finance.mortgage}</dt>
            <dd className="font-semibold">{f(mortgageOwed(game))}</dd>
          </div>
        </dl>
        <p className="mt-3 border-t border-border pt-3 text-sm">
          {t.life.netWorth}: <strong>{f(netWorth(game))}</strong>
        </p>
      </section>

      <section aria-labelledby="ly" className={card}>
        <h2 id="ly" className="mb-3 text-lg font-bold">
          {t.finance.lastYear}
        </h2>
        {last ? (
          <dl className="grid gap-2 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt>{label}</dt>
                <dd className="tabular-nums font-semibold">{f(value)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">{t.finance.none}</p>
        )}
      </section>

      <section aria-labelledby="homes" className={card}>
        <h2 id="homes" className="mb-3 text-lg font-bold">
          {t.finance.homes}
        </h2>
        {props.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.finance.noHomes}</p>
        ) : (
          <ul className="grid gap-3 text-sm">
            {props.map((p) => (
              <li key={p.id}>
                <p className="font-semibold">
                  {t.finance.homeBought(p.purchaseYear)} · {f(p.value)}
                </p>
                <p className="text-muted-foreground">
                  {t.finance.mortgage}: {f(p.loan)} · {t.finance.payment}: {f(p.paymentMonthly)}/{t.finance.month} · {bp(p.rateBp)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="biz" className={card}>
        <h2 id="biz" className="mb-3 text-lg font-bold">
          {t.finance.businesses}
        </h2>
        {biz.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.finance.noBusinesses}</p>
        ) : (
          <ul className="grid gap-4 text-sm">
            {biz.map((b) => {
              const owner = b.ownerId === game.protagonist.id ? t.finance.owner : (game.npcs[b.ownerId]?.givenName ?? '—');
              const ly = b.lastYear;
              return (
                <li key={b.id}>
                  <p className="font-semibold">
                    {b.name} <span className="font-normal text-muted-foreground">· {contentBundle.businessSectors.find((x) => x.id === b.sector)?.title}</span>
                  </p>
                  <p className="text-muted-foreground">
                    {t.finance.employees(b.employees)} · {t.finance.equity}: {f(bizEquity(b))} · {t.finance.ownedBy(owner, b.ownerSharePct)}
                  </p>
                  {ly && (
                    <p className="text-muted-foreground">
                      {t.finance.revenue}: {f(ly.revenue)} · {t.finance.costs}: {f(ly.costs)} · {t.finance.tax}: {f(ly.tax)}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="eco" className={card}>
        <h2 id="eco" className="mb-1 text-lg font-bold">
          {t.finance.economy}
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">{t.finance.economyNote}</p>
        <dl className={dl}>
          <div>
            <dt className="text-muted-foreground">{t.finance.inflation}</dt>
            <dd className="font-semibold">{bp(eco.inflationBp)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t.finance.growth}</dt>
            <dd className="font-semibold">{bp(eco.growthBp)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t.finance.rate}</dt>
            <dd className="font-semibold">{bp(eco.rateBp)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t.finance.stocks}</dt>
            <dd className="font-semibold">{bp(eco.stockReturnBp)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t.finance.housing}</dt>
            <dd className="font-semibold">{bp(eco.housingBp)}</dd>
          </div>
        </dl>
      </section>

      <p className="text-xs text-muted-foreground">{t.finance.note}</p>
    </div>
  );
}

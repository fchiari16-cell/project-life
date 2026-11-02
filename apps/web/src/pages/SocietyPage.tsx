import { contentBundle } from '@project-life/content';
import { PlaceholderPage } from './PlaceholderPage';
import { countryName } from '../game/describe';
import { useGame } from '../game/store';
import { t } from '../i18n/it';

const card = 'rounded-xl border border-border bg-card p-5';

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <li>
      <div className="mb-1 flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums font-semibold">{value}</span>
      </div>
      <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
      </div>
    </li>
  );
}

export function SocietyPage() {
  const game = useGame((s) => s.game);
  if (!game) return <PlaceholderPage title={t.society.title} description={t.life.noSaves} milestone="M4 (apri una vita)" />;
  const soc = game.society;
  const country = countryName;
  const party = soc.party ? (contentBundle.parties.find((p) => p.id === soc.party)?.name ?? soc.party) : null;
  const fame = soc.fame;
  const followers = fame.notoriety * fame.notoriety * 100;

  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-bold">{t.society.title}</h1>

      <section aria-labelledby="res" className={card}>
        <h2 id="res" className="mb-3 text-lg font-bold">
          {t.society.residence}
        </h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-muted-foreground">{t.society.livingIn}</dt>
            <dd className="font-semibold">{country(soc.residence.countryCode)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t.society.status}</dt>
            <dd className="font-semibold">
              {t.society.statuses[soc.residence.status]}
              {soc.residence.visaUntil !== null && ` (${t.society.visaUntil(soc.residence.visaUntil)})`}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted-foreground">{t.society.citizenships}</dt>
            <dd className="font-semibold">{soc.citizenships.map(country).join(', ')}</dd>
          </div>
          {soc.unrecognized.length > 0 && (
            <div className="col-span-2">
              <dt className="text-muted-foreground">{t.society.unrecognized}</dt>
              <dd className="font-semibold">{soc.unrecognized.map((q) => t.edu.qualification[q]).join(', ')}</dd>
            </div>
          )}
        </dl>
      </section>

      <section aria-labelledby="pol" className={card}>
        <h2 id="pol" className="mb-3 text-lg font-bold">
          {t.society.politics}
        </h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-muted-foreground">{t.society.party}</dt>
            <dd className="font-semibold">{party ?? t.society.none}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t.society.office}</dt>
            <dd className="font-semibold">{soc.office ? `${t.society.offices[soc.office]} (${t.society.since(soc.officeSince ?? 0)})` : t.society.none}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="jus" className={card}>
        <h2 id="jus" className="mb-3 text-lg font-bold">
          {t.society.justice}
        </h2>
        {soc.legal ? (
          <div className="text-sm">
            <p className="font-semibold">{t.society.stages[soc.legal.stage]}</p>
            <p className="text-muted-foreground">{soc.legal.offense === 'accusation' ? t.society.accusation : t.society.offence}</p>
            {soc.legal.stage === 'imprisoned' && soc.legal.releaseYear !== null && <p>{t.society.release(soc.legal.releaseYear)}</p>}
            <p className="mt-2 text-xs text-muted-foreground">{t.society.notGuilt}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t.society.noCase}</p>
        )}
        <p className="mt-2 text-sm">
          {t.society.record}: <strong>{soc.record ? t.society.yes : t.society.no}</strong>
        </p>
      </section>

      <section aria-labelledby="fame" className={card}>
        <h2 id="fame" className="mb-3 text-lg font-bold">
          {t.society.fame}
        </h2>
        <ul className="grid gap-3">
          <Meter label={t.society.notoriety} value={fame.notoriety} />
          <Meter label={t.society.credibility} value={fame.credibility} />
          <Meter label={t.society.influence} value={fame.influence} />
          <Meter label={t.society.reputation} value={fame.reputation} />
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">{t.society.followers(followers)}</p>
      </section>
    </div>
  );
}

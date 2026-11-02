import { PlaceholderPage } from './PlaceholderPage';
import { contentBundle } from '@project-life/content';
import { jobTitle } from '@project-life/engine';
import { formatMoney } from '../game/describe';
import { useGame } from '../game/store';
import { t } from '../i18n/it';

const card = 'rounded-xl border border-border bg-card p-5';

export function CareerPage() {
  const game = useGame((s) => s.game);
  if (!game) return <PlaceholderPage title={t.nav.career} description={t.life.noSaves} milestone="M1 (apri una vita)" />;
  const { education: e, career: c, finance } = game;
  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-bold">{t.nav.career}</h1>

      <section aria-labelledby="edu" className={card}>
        <h2 id="edu" className="mb-3 text-lg font-bold">
          {t.career.education}
        </h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-muted-foreground">{t.career.stage}</dt>
            <dd className="font-semibold">{t.edu.stage[e.stage]}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t.career.performance}</dt>
            <dd className="font-semibold">{e.performance}/100</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted-foreground">{t.career.qualifications}</dt>
            <dd className="font-semibold">
              {e.qualifications.length ? e.qualifications.map((q) => t.edu.qualification[q]).join(', ') : t.career.noQualifications}
            </dd>
          </div>
        </dl>
        {e.scholarship && <p className="mt-2 text-sm">{t.career.scholarship}</p>}
      </section>

      <section aria-labelledby="job" className={card}>
        <h2 id="job" className="mb-3 text-lg font-bold">
          {t.career.job}
        </h2>
        {c.job ? (
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div className="col-span-2">
              <dt className="sr-only">{t.career.job}</dt>
              <dd className="text-base font-semibold">{jobTitle(contentBundle, c.job)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t.career.salary}</dt>
              <dd className="font-semibold">{formatMoney(c.job.salary, finance.currency)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t.career.level}</dt>
              <dd className="font-semibold">{c.job.level}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t.career.yearsInRole}</dt>
              <dd className="font-semibold">{c.job.yearsInRole}</dd>
            </div>
          </dl>
        ) : c.retired ? (
          <p className="text-sm">
            {t.career.retired}
            {c.pension > 0 && ` — ${t.career.pension}: ${formatMoney(c.pension, finance.currency)}`}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{t.career.unemployed}</p>
        )}
      </section>
    </div>
  );
}

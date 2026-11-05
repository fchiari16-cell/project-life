import { Award, Banknote, Briefcase, GraduationCap } from 'lucide-react';
import { PlaceholderPage } from './PlaceholderPage';
import { contentBundle } from '@project-life/content';
import { jobTitle } from '@project-life/engine';
import { LifeList, LifeListItem } from '../components/life/LifeList';
import { LifeSectionHeader } from '../components/life/LifeSectionHeader';
import { formatMoney } from '../game/describe';
import { useGame } from '../game/store';
import { t } from '../i18n/it';

const card = 'rounded-xl border border-border bg-card p-5';

export function CareerPage() {
  const game = useGame((s) => s.game);
  if (!game) return <PlaceholderPage title={t.nav.career} description={t.life.noSaves} milestone="M1 (apri una vita)" />;
  const { education: e, career: c, finance } = game;
  return (
    <div className="grid gap-5" data-area="career">
      <h1 className="text-2xl font-bold">{t.nav.career}</h1>

      <section aria-labelledby="edu" className={card} data-area="education">
        <LifeSectionHeader id="edu" title={t.career.education} />
        <LifeList label={t.career.education}>
          <LifeListItem icon={GraduationCap} title={t.career.stage} value={t.edu.stage[e.stage]} progress={{ label: t.career.performance, value: e.performance, valueText: `${e.performance}/100` }} />
          <LifeListItem
            icon={Award}
            title={t.career.qualifications}
            description={e.qualifications.length ? e.qualifications.map((q) => t.edu.qualification[q]).join(', ') : t.career.noQualifications}
          />
        </LifeList>
        {e.scholarship && <p className="mt-2 text-sm">{t.career.scholarship}</p>}
      </section>

      <section aria-labelledby="job" className={card}>
        <LifeSectionHeader id="job" title={t.career.job} />
        {c.job ? (
          <LifeList label={t.career.job}>
            <LifeListItem icon={Briefcase} title={jobTitle(contentBundle, c.job)} description={`${t.career.level}: ${c.job.level} · ${t.career.yearsInRole}: ${c.job.yearsInRole}`} />
            <LifeListItem icon={Banknote} title={t.career.salary} value={formatMoney(c.job.salary, finance.currency)} />
          </LifeList>
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

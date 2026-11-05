import { ageInYears } from '@project-life/engine';
import { LifeAvatar } from '../components/life/LifeAvatar';
import { LifeSectionHeader } from '../components/life/LifeSectionHeader';
import { LifeStatList } from '../components/life/LifeStatBar';
import { PlaceholderPage } from './PlaceholderPage';
import { countryName, fmtDate, occupationLabel } from '../game/describe';
import { useGame } from '../game/store';
import { t } from '../i18n/it';

/** Full profile of the protagonist: visible facts only (hidden traits stay hidden). */
export function ProfilePage() {
  const game = useGame((s) => s.game);
  if (!game) return <PlaceholderPage title={t.profile.title} description={t.shell.noLife} milestone="UI-R1" />;
  const p = game.protagonist;
  const age = ageInYears(p.birth, p.death?.date ?? game.world.currentDate);
  const card = 'rounded-xl border border-border bg-card p-5';
  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-4">
        <LifeAvatar id={p.id} name={`${p.givenName} ${p.familyName}`} size="lg" />
        <div>
          <h1 className="text-2xl font-bold">
            {p.givenName} {p.familyName}
          </h1>
          <p className="text-sm text-muted-foreground">{t.dynasty.generation(game.dynasty.generation)}</p>
        </div>
      </div>
      <section aria-labelledby="facts" className={card}>
        <LifeSectionHeader id="facts" title={t.profile.title} />
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">{t.profile.born}</dt>
            <dd className="font-semibold">{fmtDate(p.birth)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t.life.age}</dt>
            <dd className="font-semibold">{t.life.ageUnit(age)}</dd>
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
          <div>
            <dt className="text-muted-foreground">{t.profile.citizenship}</dt>
            <dd className="font-semibold">{game.society.citizenships.map(countryName).join(', ') || '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t.profile.familyClass}</dt>
            <dd className="font-semibold">{t.family.class[game.family.class]}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted-foreground">{t.profile.qualifications}</dt>
            <dd className="font-semibold">
              {game.education.qualifications.length ? game.education.qualifications.map((q) => t.edu.qualification[q]).join(', ') : t.profile.none}
            </dd>
          </div>
        </dl>
      </section>
      <section aria-labelledby="pstats" className={card}>
        <LifeSectionHeader id="pstats" title={t.life.stats} hint={t.life.statsNote} />
        <LifeStatList stats={p.stats} />
      </section>
    </div>
  );
}

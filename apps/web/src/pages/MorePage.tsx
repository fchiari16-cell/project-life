import { useRef } from 'react';
import { ENGINE_VERSION, RULES_VERSION, CONTENT_VERSION, SCHEMA_VERSION } from '@project-life/schemas';
import { Button } from '../components/ui/button';
import { EventFeed } from '../components/EventFeed';
import { SaveList } from '../components/SaveList';
import { Globe, Landmark } from 'lucide-react';
import { LifeList, LifeListItem } from '../components/life/LifeList';
import { LifeSectionHeader } from '../components/life/LifeSectionHeader';
import { AchievementsSection } from '../components/AchievementsSection';
import { BackupSection } from '../components/BackupSection';
import { GodSection } from '../components/GodSection';
import { AiSection, CloudSection } from '../components/OptionalServices';
import { formatMoney, professionTitle } from '../game/describe';
import { useGame } from '../game/store';
import { LOCALES, type LocaleCode } from '@project-life/content';
import { localeInfo, useLocale } from '../i18n/locale';
import { useOnline, useTheme, type ThemeChoice } from '../lib/theme';
import { t } from '../i18n/it';

const themes = (): { value: ThemeChoice; label: string }[] => [
  { value: 'system', label: t.more.themeSystem },
  { value: 'light', label: t.more.themeLight },
  { value: 'dark', label: t.more.themeDark },
];

export function MorePage() {
  const THEMES = themes();
  const [theme, setTheme] = useTheme();
  const locale = useLocale((s) => s.locale);
  const setLocale = useLocale((s) => s.setLocale);
  const online = useOnline();
  const game = useGame((s) => s.game);
  const events = useGame((s) => s.events);
  const conflict = useGame((s) => s.importConflict);
  const exportCurrent = useGame((s) => s.exportCurrent);
  const importText = useGame((s) => s.importText);
  const fileRef = useRef<HTMLInputElement>(null);

  const doExport = async (): Promise<void> => {
    const text = await exportCurrent();
    if (!text || !game) return;
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `project-life-${game.protagonist.familyName}-${game.protagonist.givenName}-r${game.revision}.json`.toLowerCase();
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    await importText(await file.text());
    if (fileRef.current) fileRef.current.value = '';
  };

  const card = 'rounded-xl border border-border bg-card p-5';
  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-bold">{t.nav.more}</h1>

      <section aria-labelledby="sections" className={card}>
        <LifeSectionHeader id="sections" title={t.moreSections.title} />
        <LifeList label={t.moreSections.title}>
          <LifeListItem icon={Globe} title={t.moreSections.world} to="/mondo" />
          <LifeListItem icon={Landmark} title={t.moreSections.society} to="/societa" />
        </LifeList>
      </section>

      <section aria-labelledby="settings" className={card}>
        <h2 id="settings" className="mb-3 text-lg font-bold">
          {t.more.settings}
        </h2>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t.more.theme}</legend>
          <div className="flex flex-wrap gap-4">
            {THEMES.map((o) => (
              <label key={o.value} className="flex min-h-11 items-center gap-2 text-sm">
                <input type="radio" name="theme" className="size-5" checked={theme === o.value} onChange={() => setTheme(o.value)} />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section aria-labelledby="lang" className={card}>
        <h2 id="lang" className="mb-3 text-lg font-bold">
          {t.more.language}
        </h2>
        <select
          aria-labelledby="lang"
          className="block min-h-11 w-full rounded-lg border border-border bg-card px-3 text-base"
          value={locale}
          onChange={(e) => setLocale(e.target.value as LocaleCode)}
        >
          {LOCALES.map((l) => (
            <option key={l.code} value={l.code} lang={l.code}>
              {l.native}
              {l.status === 'machine-unverified' ? ` — ${t.more.unverified}` : ''}
            </option>
          ))}
        </select>
        {localeInfo(locale).status === 'machine-unverified' && <p className="mt-2 text-xs text-muted-foreground">{t.more.languageNote}</p>}
      </section>

      <SaveList />

      <AchievementsSection />
      <GodSection />

      {game && (
        <section aria-labelledby="chronicle" className={card}>
          <h2 id="chronicle" className="mb-1 text-lg font-bold">
            {t.dynasty.chronicle}
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            {t.dynasty.generation(game.dynasty.generation)} · {t.dynasty.origin} {game.world.originDate.year}
          </p>
          {game.dynasty.chronicle.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.dynasty.noChronicle}</p>
          ) : (
            <ol className="grid gap-3 text-sm">
              {game.dynasty.chronicle.map((c) => (
                <li key={c.personId}>
                  <p className="font-semibold">
                    {t.dynasty.generation(c.generation)}: {c.name}
                  </p>
                  <p className="text-muted-foreground">
                    {t.dynasty.lived(c.birthYear, c.deathYear)} · {t.dynasty.children}: {c.children} · {t.dynasty.estate}: {formatMoney(c.netWorth, c.currency, c.minorUnits)}
                    {c.lastProfession ? ` · ${professionTitle(c.lastProfession)}` : ''}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {game && (
        <section aria-labelledby="history" className={card}>
          <h2 id="history" className="mb-3 text-lg font-bold">
            {t.history.title}
          </h2>
          {events.length === 0 ? <p className="text-sm text-muted-foreground">{t.history.empty}</p> : <EventFeed events={events} currency={game?.finance.currency} />}
        </section>
      )}

      <section aria-labelledby="backup" className={card}>
        <h2 id="backup" className="mb-3 text-lg font-bold">
          {t.more.saves}
        </h2>
        <div className="grid gap-4">
          <div>
            <Button variant="outline" disabled={!game} onClick={() => void doExport()}>
              {t.more.export}
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">{t.more.exportHint}</p>
          </div>
          <div>
            <label htmlFor="import-file" className="mb-1 block text-sm font-medium">
              {t.more.import}
            </label>
            <input
              id="import-file"
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="block min-h-11 text-sm"
              onChange={(e) => void doImport(e.target.files?.[0])}
            />
          </div>
          {conflict && (
            <div role="alert" className="rounded-lg border border-danger p-3 text-sm">
              <p>{t.more.importConflict}</p>
              <Button className="mt-2" onClick={() => void importText(conflict.text, true)}>
                {t.more.importAsCopy}
              </Button>
            </div>
          )}
        </div>
      </section>

      <BackupSection />
      <CloudSection />
      <AiSection />

      <section aria-labelledby="about" className={card}>
        <h2 id="about" className="mb-3 text-lg font-bold">
          {t.more.about}
        </h2>
        <p className="text-sm">
          {t.more.connection}: <strong>{online ? t.more.online : t.more.offline}</strong>. {t.more.works_offline}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">{t.more.attribution}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          {t.more.versions}: engine {ENGINE_VERSION} · rules {RULES_VERSION} · content {CONTENT_VERSION} · schema {SCHEMA_VERSION}
        </p>
      </section>
    </div>
  );
}

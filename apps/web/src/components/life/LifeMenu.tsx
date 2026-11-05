import { useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useNavigate } from 'react-router';
import {
  Accessibility,
  ArrowLeftRight,
  HardDrive,
  History,
  Info,
  Languages,
  Menu,
  Network,
  Palette,
  Play,
  Plus,
  Volume2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { LOCALES, type LocaleCode } from '@project-life/content';
import { cn } from '../../lib/utils';
import { LifeDisabledAction } from './LifeDisabledAction';
import { useGame } from '../../game/store';
import { useLocale } from '../../i18n/locale';
import { useTheme, type ThemeChoice } from '../../lib/theme';
import { t } from '../../i18n/it';

const row = 'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted';

function PlannedRow({ title }: { Icon: LucideIcon; title: string }) {
  return (
    <li className="px-3 py-1">
      <LifeDisabledAction label={title} planned />
    </li>
  );
}

function ActionRow({ Icon, title, hint, onSelect, disabledReason }: { Icon: LucideIcon; title: string; hint?: string | undefined; onSelect(): void; disabledReason?: string | undefined }) {
  const disabled = disabledReason !== undefined;
  return (
    <li>
      <button type="button" className={cn(row, disabled && 'cursor-not-allowed text-muted-foreground hover:bg-transparent')} aria-disabled={disabled} onClick={() => !disabled && onSelect()}>
        <Icon aria-hidden="true" className="size-5 shrink-0" />
        <span className="flex-1">
          <span className="block font-medium">{title}</span>
          {(disabledReason ?? hint) && <span className="block text-xs text-muted-foreground">{disabledReason ?? hint}</span>}
        </span>
      </button>
    </li>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4">
      <h3 className="px-3 pb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <ul className="grid gap-0.5">{children}</ul>
    </section>
  );
}

/**
 * Settings menu, always top-left. It only contains what exists: the rows for features that are not built yet
 * are shown as "planned" and cannot be activated. There is deliberately no GOD MODE control here: that choice
 * is made when a life is created and is locked afterwards (T71).
 */
export function LifeMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const game = useGame((s) => s.game);
  const saves = useGame((s) => s.saves);
  const openSave = useGame((s) => s.openSave);
  const locale = useLocale((s) => s.locale);
  const setLocale = useLocale((s) => s.setLocale);
  const [theme, setTheme] = useTheme();

  const go = (to: string): void => {
    setOpen(false);
    void navigate(to);
  };
  const latest = saves[0];
  const themes: { value: ThemeChoice; label: string }[] = [
    { value: 'system', label: t.more.themeSystem },
    { value: 'light', label: t.more.themeLight },
    { value: 'dark', label: t.more.themeDark },
  ];

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" aria-label={t.shell.openMenu} className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-card hover:bg-muted">
          <Menu aria-hidden="true" className="size-6" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[var(--z-drawer)] bg-black/50" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-[var(--z-drawer)] flex w-[min(22rem,92vw)] flex-col overflow-y-auto border-r border-border bg-card p-4 pt-[max(1rem,env(safe-area-inset-top))] shadow-ui-3"
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-xl font-bold">{t.shell.menuTitle}</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" aria-label={t.shell.closeMenu} className="inline-flex size-11 items-center justify-center rounded-lg hover:bg-muted">
                <X aria-hidden="true" className="size-6" />
              </button>
            </Dialog.Close>
          </div>

          <Group title={t.nav.life}>
            <ActionRow
              Icon={Plus}
              title={t.shell.newLife}
              hint={game ? t.shell.newLifeHint : undefined}
              onSelect={() => go('/nuova-vita')}
            />
            <ActionRow
              Icon={Play}
              title={t.shell.continueLife}
              hint={latest ? t.shell.continueHint(latest.name) : undefined}
              disabledReason={game ? t.shell.continueOpen : latest ? undefined : t.shell.continueNone}
              onSelect={() => {
                if (latest) void openSave(latest.id);
                go('/');
              }}
            />
            <ActionRow Icon={HardDrive} title={t.shell.saves} onSelect={() => go('/altro#saves')} />
            <PlannedRow Icon={Network} title={t.shell.familyTree} />
            <ActionRow Icon={History} title={t.shell.lifeHistory} disabledReason={game ? undefined : t.shell.noLife} onSelect={() => go('/altro#chronicle')} />
          </Group>

          <Group title={t.more.settings}>
            <li className="px-3 py-1">
              <label className="flex items-center gap-3">
                <Languages aria-hidden="true" className="size-5 shrink-0" />
                <span className="sr-only">{t.shell.language}</span>
                <select
                  aria-label={t.shell.language}
                  className="min-h-11 flex-1 rounded-lg border border-border bg-card px-2"
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as LocaleCode)}
                >
                  {LOCALES.map((l) => (
                    <option key={l.code} value={l.code} lang={l.code}>
                      {l.native}
                    </option>
                  ))}
                </select>
              </label>
            </li>
            <li className="px-3 py-1">
              <fieldset>
                <legend className="mb-1 flex items-center gap-3 text-sm">
                  <Palette aria-hidden="true" className="size-5" />
                  {t.shell.theme}
                </legend>
                <div className="flex flex-wrap gap-x-4 pl-8">
                  {themes.map((o) => (
                    <label key={o.value} className="flex min-h-11 items-center gap-2 text-sm">
                      <input type="radio" name="menu-theme" className="size-5" checked={theme === o.value} onChange={() => setTheme(o.value)} />
                      {o.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            </li>
            <PlannedRow Icon={Accessibility} title={t.shell.accessibility} />
            <PlannedRow Icon={Volume2} title={t.shell.audio} />
          </Group>

          <Group title={t.more.saves}>
            <ActionRow Icon={ArrowLeftRight} title={t.shell.importExport} onSelect={() => go('/altro#backup-all')} />
            <ActionRow Icon={Info} title={t.shell.about} onSelect={() => go('/altro#about')} />
          </Group>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

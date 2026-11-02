import { Briefcase, Heart, Menu, Users, Wallet, type LucideIcon } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { cn } from '../lib/utils';
import { t } from '../i18n/it';
import { ErrorBanner } from './ErrorBanner';
import { EventCard } from './EventCard';

const items = (): { to: string; label: string; Icon: LucideIcon; end?: boolean }[] => [
  { to: '/', label: t.nav.life, Icon: Heart, end: true },
  { to: '/relazioni', label: t.nav.relationships, Icon: Users },
  { to: '/carriera', label: t.nav.career, Icon: Briefcase },
  { to: '/finanze', label: t.nav.finance, Icon: Wallet },
  { to: '/altro', label: t.nav.more, Icon: Menu },
];

export function Layout() {
  const ITEMS = items();
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        {t.skipToContent}
      </a>

      <nav
        aria-label={t.nav.main}
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]',
          'md:static md:inset-auto md:flex md:min-h-dvh md:flex-col md:border-r md:border-t-0 md:p-4',
        )}
      >
        <p className="hidden px-3 pb-6 pt-2 text-lg font-bold tracking-wide md:block">{t.appName}</p>
        <ul className="grid grid-cols-5 md:flex md:flex-col md:gap-1">
          {ITEMS.map(({ to, label, Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end ?? false}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-xs font-medium text-muted-foreground',
                    'md:min-h-11 md:flex-row md:justify-start md:gap-3 md:rounded-lg md:px-3 md:text-sm',
                    isActive && 'text-primary md:bg-muted md:text-foreground',
                  )
                }
              >
                <Icon aria-hidden="true" className="size-5" />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-3xl px-4 pb-28 pt-6 md:px-8 md:pb-10">
        <ErrorBanner />
        <Outlet />
      </main>
      <EventCard />
    </div>
  );
}

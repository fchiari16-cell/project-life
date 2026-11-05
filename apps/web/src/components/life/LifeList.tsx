import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import type { ActionAvailability } from '@project-life/schemas';
import { LifeActionMenu, type LifeMenuAction } from './LifeActionMenu';
import { LifeAvatar } from './LifeAvatar';
import { LifeDisabledAction } from './LifeDisabledAction';
import { LifeProgressIndicator } from './LifeProgressIndicator';
import { LifeStatBar } from './LifeStatBar';
import { cn } from '../../lib/utils';

/** A vertical list of interactive rows. Always a real list, so screen readers announce the number of items. */
export function LifeList({ children, label, className }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <ul aria-label={label} className={cn('grid gap-2', className)}>
      {children}
    </ul>
  );
}

/** A heading that splits a screen into categories (family, friends…). Part of the document outline (h3). */
export function LifeCategoryDivider({ title, count, className }: { title: string; count?: number; className?: string }) {
  return (
    <h3 className={cn('mb-1 mt-2 flex items-baseline justify-between gap-2 text-sm font-bold uppercase tracking-wide text-area-ink', className)}>
      <span>{title}</span>
      {count !== undefined && <span className="text-xs font-normal normal-case text-muted-foreground">{count}</span>}
    </h3>
  );
}

export interface LifeListItemProps {
  title: string;
  description?: string | undefined;
  icon?: LucideIcon | undefined;
  avatar?: { id: string; name: string } | undefined;
  /** Short value on the right (an amount, a level…). */
  value?: ReactNode;
  stat?: { key: string; value: number; label?: string; lowerIsBetter?: boolean } | undefined;
  progress?: { label: string; value: number; max?: number; valueText?: string } | undefined;
  /** Opens a subsection (a route). */
  to?: string | undefined;
  /** A direct action. */
  onSelect?: (() => void) | undefined;
  /** The engine's verdict for the row's action: when unavailable the row says why and does nothing. */
  availability?: ActionAvailability | undefined;
  /** The feature does not exist yet: shown, labelled, not operable. */
  planned?: boolean | undefined;
  menu?: LifeMenuAction[] | undefined;
  menuLabel?: string | undefined;
}

const rowClass = 'flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2 text-left';

/**
 * One row: icon or avatar, title, description, value, optional stat bar and progress, and either a link to a
 * subsection, a direct action, or neither (information). A blocked or planned row is rendered as a disabled
 * action with its reason; there is no way to press it by accident.
 */
export function LifeListItem(p: LifeListItemProps) {
  const descId = useId();
  const blocked = p.planned === true || (p.availability !== undefined && !p.availability.available);
  const body = (
    <>
      {p.avatar ? <LifeAvatar id={p.avatar.id} name={p.avatar.name} /> : p.icon ? <p.icon aria-hidden="true" className="size-6 shrink-0 text-area" /> : null}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{p.title}</span>
        {p.description && (
          <span id={descId} className="block text-sm text-muted-foreground">
            {p.description}
          </span>
        )}
      </span>
      {p.value !== undefined && <span className="shrink-0 text-right text-sm font-semibold tabular-nums">{p.value}</span>}
    </>
  );

  let main: ReactNode;
  if (blocked) {
    main = (
      <div className="min-w-0 flex-1 p-2">
        <LifeDisabledAction label={p.title} planned={p.planned === true} {...(p.availability ? { availability: p.availability } : {})} />
      </div>
    );
  } else if (p.to) {
    main = (
      <Link to={p.to} className={cn(rowClass, 'hover:bg-muted')}>
        {body}
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
      </Link>
    );
  } else if (p.onSelect) {
    main = (
      <button type="button" onClick={p.onSelect} className={cn(rowClass, 'hover:bg-muted')}>
        {body}
      </button>
    );
  } else {
    main = <div className={rowClass}>{body}</div>;
  }

  return (
    <li className="rounded-xl border border-border bg-card">
      <div className="flex items-center">
        {main}
        {p.menu && p.menu.length > 0 && <LifeActionMenu label={p.menuLabel ?? p.title} actions={p.menu} />}
      </div>
      {(p.stat || p.progress) && !blocked && (
        <div className="grid gap-2 px-3 pb-3">
          {p.stat && <LifeStatBar statKey={p.stat.key} value={p.stat.value} {...(p.stat.label ? { label: p.stat.label } : {})} {...(p.stat.lowerIsBetter !== undefined ? { lowerIsBetter: p.stat.lowerIsBetter } : {})} />}
          {p.progress && <LifeProgressIndicator label={p.progress.label} value={p.progress.value} {...(p.progress.max !== undefined ? { max: p.progress.max } : {})} {...(p.progress.valueText ? { valueText: p.progress.valueText } : {})} />}
        </div>
      )}
    </li>
  );
}

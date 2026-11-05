import { useId } from 'react';
import type { ActionAvailability } from '@project-life/schemas';
import { explainAvailability } from './availability';
import { cn } from '../../lib/utils';
import { t } from '../../i18n/it';

/**
 * An action that cannot be performed, shown as such and always with the reason. It stays focusable
 * (`aria-disabled`, not `disabled`) so keyboard and screen-reader users can reach the explanation, and it never
 * relies on colour or on reduced opacity alone. The verdict comes from the engine (`availability`), or the action
 * is marked as planned when the feature does not exist yet.
 */
export function LifeDisabledAction({ label, availability, planned = false, className }: { label: string; availability?: ActionAvailability; planned?: boolean; className?: string }) {
  const id = useId();
  const why = availability ? explainAvailability(availability) : null;
  return (
    <div className={className}>
      <button
        type="button"
        aria-disabled="true"
        aria-describedby={id}
        className={cn('inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-muted px-4 text-left text-sm font-semibold text-muted-foreground')}
        onClick={(e) => e.preventDefault()}
      >
        <span>{label}</span>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs font-normal">{planned ? t.shell.planned : t.availability.blocked}</span>
      </button>
      <p id={id} className="mt-1 text-xs text-muted-foreground">
        {planned ? t.shell.plannedReason : why?.reasons.join(' ')}
        {!planned && why && why.needs.length > 0 && (
          <>
            {' '}
            <span className="font-semibold">{t.availability.needs}:</span> {why.needs.join(' ')}
          </>
        )}
      </p>
    </div>
  );
}

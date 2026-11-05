import { cn } from '../../lib/utils';
import { t } from '../../i18n/it';

/** Progress toward a known maximum. Number and words accompany the bar; it is a real `progressbar`. */
export function LifeProgressIndicator({ label, value, max = 100, valueText, className }: { label: string; value: number; max?: number; valueText?: string; className?: string }) {
  const clamped = Math.max(0, Math.min(max, value));
  const text = valueText ?? t.lists.progress(clamped, max);
  return (
    <div className={className}>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span>{label}</span>
        <span className="tabular-nums font-semibold">{text}</span>
      </div>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={clamped} aria-valuetext={text} className="h-2.5 overflow-hidden rounded-full bg-stat-track">
        <div className={cn('h-full rounded-full bg-area transition-[width] duration-[var(--dur-base)]')} style={{ width: `${max === 0 ? 0 : (clamped / max) * 100}%` }} />
      </div>
    </div>
  );
}

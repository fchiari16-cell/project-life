import { STAT_KEYS, type Stats } from '@project-life/schemas';
import { cn } from '../../lib/utils';
import { t } from '../../i18n/it';

/** Higher is better, except stress. */
const goodness = (key: string, value: number): 'good' | 'warn' | 'bad' => {
  const v = key === 'stress' ? 100 - value : value;
  return v >= 60 ? 'good' : v >= 35 ? 'warn' : 'bad';
};
const levelOf = (value: number): 'low' | 'mid' | 'high' => (value < 34 ? 'low' : value < 67 ? 'mid' : 'high');
const FILL = { good: 'bg-stat-good', warn: 'bg-stat-warn', bad: 'bg-stat-bad' } as const;

/**
 * Horizontal statistic bar. Never colour alone: the label, the number and a word ("alto/medio/basso") all
 * carry the value, and the bar is a real `meter` for assistive technology.
 */
export function LifeStatBar({ statKey, value, className }: { statKey: string; value: number; className?: string }) {
  const label = t.stats[statKey as keyof typeof t.stats] ?? statKey;
  const level = t.shell.level[levelOf(value)];
  return (
    <div className={className}>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span>{label}</span>
        <span className="tabular-nums">
          <span className="font-semibold">{value}</span> <span className="text-muted-foreground">· {level}</span>
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={`${value} (${level})`}
        className="h-2.5 overflow-hidden rounded-full bg-stat-track"
      >
        <div className={cn('h-full rounded-full transition-[width] duration-[var(--dur-base)]', FILL[goodness(statKey, value)])} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

/** The eight visible statistics of the protagonist. */
export function LifeStatList({ stats, columns = 2 }: { stats: Stats; columns?: 1 | 2 }) {
  return (
    <ul className={cn('grid gap-3', columns === 2 && 'sm:grid-cols-2')}>
      {STAT_KEYS.map((k) => (
        <li key={k}>
          <LifeStatBar statKey={k} value={stats[k]} />
        </li>
      ))}
    </ul>
  );
}

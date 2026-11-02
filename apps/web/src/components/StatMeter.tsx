import { STAT_KEYS, type Stats } from '@project-life/schemas';
import { t } from '../i18n/it';

export function StatMeters({ stats }: { stats: Stats }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {STAT_KEYS.map((key) => {
        const value = stats[key];
        const label = t.stats[key];
        return (
          <li key={key}>
            <div className="mb-1 flex justify-between text-sm">
              <span>{label}</span>
              <span className="tabular-nums font-semibold">{value}</span>
            </div>
            <div
              role="meter"
              aria-label={label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={value}
              className="h-2.5 overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

import type { DomainEvent } from '@project-life/schemas';
import { describeEvent, fmtDate } from '../game/describe';

export function EventFeed({ events, currency = 'EUR' }: { events: DomainEvent[]; currency?: string }) {
  return (
    <ol className="grid gap-3 text-sm">
      {[...events].reverse().map((e) => {
        const d = describeEvent(e, currency);
        return (
          <li key={e.id} className="flex justify-between gap-3">
            <span>
              <span className="font-medium">{d.text}</span>
              {d.detail && <span className="block text-muted-foreground">{d.detail}</span>}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{fmtDate(e.at)}</span>
          </li>
        );
      })}
    </ol>
  );
}

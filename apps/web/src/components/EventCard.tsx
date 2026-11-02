import { useEffect, useRef } from 'react';
import { pendingChoices } from '@project-life/engine';
import { Button } from './ui/button';
import { simulationContext, useGame } from '../game/store';
import { t } from '../i18n/it';

/**
 * Blocking decision card. It reads the pending decision straight from the canonical state, so a
 * reload (or a restored save) shows the same card again. Outcomes are never previewed.
 */
export function EventCard() {
  const game = useGame((s) => s.game);
  const busy = useGame((s) => s.busy);
  const resolveEvent = useGame((s) => s.resolveEvent);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pending = game?.simulation.pending ?? null;
  const resolved = game ? pendingChoices(game, simulationContext) : null;

  useEffect(() => {
    headingRef.current?.focus();
  }, [pending?.instanceId]);

  if (!game || !pending || !resolved) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 md:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-title"
        aria-describedby="event-body"
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl"
      >
        <h2 id="event-title" ref={headingRef} tabIndex={-1} className="text-xl font-bold outline-none">
          {resolved.event.title}
        </h2>
        <p id="event-body" className="mt-2 text-base">
          {resolved.event.body}
        </p>
        <ul className="mt-5 grid gap-3">
          {resolved.choices.map((c) => (
            <li key={c.id}>
              <Button variant="outline" className="w-full justify-start text-left" disabled={busy} onClick={() => void resolveEvent(c.id)}>
                {c.label}
              </Button>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">{t.life.decisionWaiting}</p>
      </div>
    </div>
  );
}

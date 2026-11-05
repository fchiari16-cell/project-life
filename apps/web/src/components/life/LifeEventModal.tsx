import { useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { pendingChoices } from '@project-life/engine';
import { Button } from '../ui/button';
import { simulationContext, useGame } from '../../game/store';
import { t } from '../../i18n/it';

/**
 * Blocking decision window. It reads the pending decision straight from the canonical state, so a reload
 * (or a restored save) shows the same window again. A mandatory decision cannot be dismissed (no close
 * button, Esc and outside clicks are ignored); the window itself traps focus and restores it afterwards.
 * Outcomes are never previewed.
 */
export function LifeEventModal() {
  const game = useGame((s) => s.game);
  const busy = useGame((s) => s.busy);
  const resolveEvent = useGame((s) => s.resolveEvent);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const pending = game?.simulation.pending ?? null;
  const resolved = game ? pendingChoices(game, simulationContext) : null;
  if (!game || !pending || !resolved) return null;

  const keepOpen = (e: Event): void => e.preventDefault();
  return (
    <Dialog.Root open>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[var(--z-modal)] bg-black/60" />
        <Dialog.Content
          onEscapeKeyDown={keepOpen}
          onPointerDownOutside={keepOpen}
          onInteractOutside={keepOpen}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            titleRef.current?.focus();
          }}
          className="fixed inset-x-4 bottom-4 z-[var(--z-modal)] mx-auto max-h-[85dvh] max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-ui-3 md:bottom-auto md:top-1/2 md:-translate-y-1/2"
        >
          <Dialog.Title ref={titleRef} tabIndex={-1} className="text-xl font-bold outline-none">
            {resolved.event.title}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-base">{resolved.event.body}</Dialog.Description>
          <ul className="mt-5 grid gap-3">
            {resolved.choices.map((c) => (
              <li key={c.id}>
                <Button variant="outline" className="w-full justify-start whitespace-normal py-2 text-left" disabled={busy} onClick={() => void resolveEvent(c.id)}>
                  {c.label}
                </Button>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">{t.life.decisionWaiting}</p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

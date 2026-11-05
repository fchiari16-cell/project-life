import { useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Baby, Briefcase, FlaskConical, Globe, GraduationCap, HeartPulse, Landmark, Scale, Stethoscope, Trophy, Users, Wallet, Palette, type LucideIcon } from 'lucide-react';
import { actionAvailability, certainCost, pendingChoices, relationCode } from '@project-life/engine';
import { LifeAvatar } from './LifeAvatar';
import { LifeDecisionButton } from './LifeDecisionButton';
import type { Area } from '../../design/areas';
import { formatMoney } from '../../game/describe';
import { simulationContext, useGame } from '../../game/store';
import { t } from '../../i18n/it';

/** How each authored event category is presented: an icon and the colour area of the screen it belongs to. */
const CATEGORY: Record<string, { Icon: LucideIcon; area?: Area }> = {
  childhood: { Icon: Baby, area: 'relationships' },
  education: { Icon: GraduationCap, area: 'education' },
  health: { Icon: HeartPulse, area: 'health' },
  medicine: { Icon: Stethoscope, area: 'health' },
  career: { Icon: Briefcase, area: 'career' },
  family: { Icon: Users, area: 'relationships' },
  social: { Icon: Users, area: 'relationships' },
  finance: { Icon: Wallet, area: 'finance' },
  justice: { Icon: Scale },
  politics: { Icon: Landmark },
  world: { Icon: Globe },
  sport: { Icon: Trophy, area: 'career' },
  arts: { Icon: Palette, area: 'career' },
  science: { Icon: FlaskConical, area: 'education' },
};

/**
 * Blocking decision window. It reads the pending decision straight from the canonical state, so a reload
 * (or a restored save) shows the same window again. A mandatory decision cannot be dismissed (no close
 * button, Esc and outside clicks are ignored); the window itself traps focus and restores it afterwards.
 * It shows what the state and the content actually say: the kind of event, the person involved, and a cost only
 * when every possible outcome carries one. Outcomes are never previewed.
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
  const cat = CATEGORY[resolved.event.category] ?? { Icon: Globe };
  const actor = pending.actorId ? game.npcs[pending.actorId] : undefined;
  const actorAge = actor ? (actor.deathYear ?? game.world.currentDate.year) - actor.birthYear : 0;
  const verdict = actionAvailability(game, 'RESOLVE_EVENT');

  return (
    <Dialog.Root open>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[var(--z-modal)] bg-black/60" />
        <Dialog.Content
          {...(cat.area ? { 'data-area': cat.area } : {})}
          onEscapeKeyDown={keepOpen}
          onPointerDownOutside={keepOpen}
          onInteractOutside={keepOpen}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            titleRef.current?.focus();
          }}
          className="fixed inset-x-4 bottom-4 z-[var(--z-modal)] mx-auto max-h-[85dvh] max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-ui-3 md:bottom-auto md:top-1/2 md:-translate-y-1/2"
        >
          <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-area-soft px-3 py-1 text-xs font-bold text-area-ink">
            <cat.Icon aria-hidden="true" className="size-4" />
            <span className="sr-only">{t.decision.category}: </span>
            {t.eventCategory[resolved.event.category] ?? resolved.event.category}
          </p>
          <Dialog.Title ref={titleRef} tabIndex={-1} className="text-xl font-bold outline-none">
            {resolved.event.title}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-base">{resolved.event.body}</Dialog.Description>

          {actor && (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-border p-3" data-testid="event-actor">
              <LifeAvatar id={actor.id} name={`${actor.givenName} ${actor.familyName}`} />
              <p className="text-sm">
                <span className="block text-xs text-muted-foreground">{t.decision.involved}</span>
                <span className="block font-semibold">
                  {actor.givenName} {actor.familyName}
                </span>
                <span className="block text-muted-foreground">
                  {t.rel.code[relationCode(game, actor.id)]} · {t.rel.age(actorAge)}
                </span>
              </p>
            </div>
          )}

          <ul className="mt-5 grid gap-3">
            {resolved.choices.map((c) => {
              const cost = certainCost(game, simulationContext, c);
              return (
                <li key={c.id}>
                  <LifeDecisionButton
                    label={c.label}
                    cost={cost === null ? null : formatMoney(cost, game.finance.currency)}
                    availability={verdict}
                    busy={busy}
                    onChoose={() => void resolveEvent(c.id)}
                  />
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            {t.life.decisionWaiting} {t.decision.outcomesHidden}
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

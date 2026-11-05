import type { ActionAvailability } from '@project-life/schemas';
import { Button } from '../ui/button';
import { LifeDisabledAction } from './LifeDisabledAction';
import { t } from '../../i18n/it';

/**
 * One option of a decision. When the content guarantees a cost in every possible outcome it is shown (a minimum:
 * the real one may be higher); nothing else about the outcome is revealed in advance. If the engine says the
 * option cannot be chosen, it is shown as blocked with the reason.
 */
export function LifeDecisionButton({ label, cost, availability, busy, onChoose }: { label: string; cost?: string | null; availability?: ActionAvailability; busy?: boolean; onChoose(): void }) {
  if (availability && !availability.available) return <LifeDisabledAction label={label} availability={availability} />;
  return (
    <Button variant="outline" className="h-auto w-full flex-col items-start justify-start gap-0.5 whitespace-normal py-3 text-left" disabled={busy === true} onClick={onChoose}>
      <span>{label}</span>
      {cost && <span className="text-xs font-normal text-muted-foreground">{t.decision.certainCost(cost)}</span>}
    </Button>
  );
}

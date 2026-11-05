import type { ActionAvailability } from '@project-life/schemas';
import { t } from '../../i18n/it';

/** Turns the engine's stable codes into the sentences shown to the player. */
export function explainAvailability(a: ActionAvailability): { reasons: string[]; needs: string[] } {
  return {
    reasons: a.reasons.map((c) => t.availability.reason[c] ?? c),
    needs: a.requirements.map((c) => t.availability.need[c] ?? c),
  };
}

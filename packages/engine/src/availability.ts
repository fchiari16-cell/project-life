import { currentAge } from './run.js';
import { canTransition } from './machine.js';
import { godTarget } from './god.js';
import type { ActionAvailability, Choice, GameState, SimulationContext } from '@project-life/schemas';

/** Every code `actionAvailability` can return, so the interface can prove it has a sentence for each one. */
export const AVAILABILITY_REASONS = ['life_ended', 'decision_pending', 'simulation_busy', 'no_decision_pending', 'god_mode_not_chosen', 'target_unavailable', 'life_not_ended'] as const;
export const AVAILABILITY_REQUIREMENTS = ['continue_dynasty', 'answer_pending_decision', 'wait_for_simulation', 'advance_year', 'choose_god_mode_at_creation', 'living_character', 'life_must_end'] as const;

/** The actions the player can attempt today. Each one is judged by the engine, never by the interface. */
export type ActionKind = 'ADVANCE_YEAR' | 'RESOLVE_EVENT' | 'GOD_EDIT' | 'CONTINUE_DYNASTY';

const yes: ActionAvailability = { available: true, reasons: [], requirements: [] };
const no = (reasons: string[], requirements: string[]): ActionAvailability => ({ available: false, reasons, requirements });

const busy = (s: GameState): boolean => s.simulation.status === 'RUNNING' || s.simulation.status === 'RESOLVING' || s.simulation.status === 'ERROR';

/**
 * Whether an action can be performed right now, and if not why and what would change that. Reasons and
 * requirements are stable codes (the interface translates them); the same rules decide whether `simulate`
 * accepts the corresponding command, which a test checks over whole lives.
 */
export function actionAvailability(s: GameState, action: ActionKind, opts: { targetId?: string } = {}): ActionAvailability {
  switch (action) {
    case 'ADVANCE_YEAR':
      if (s.protagonist.death) return no(['life_ended'], ['continue_dynasty']);
      if (s.simulation.status === 'PAUSED_EVENT') return no(['decision_pending'], ['answer_pending_decision']);
      if (!canTransition(s.simulation.status, 'RUNNING')) return no(['simulation_busy'], ['wait_for_simulation']);
      return yes;
    case 'RESOLVE_EVENT':
      if (s.protagonist.death) return no(['life_ended'], ['continue_dynasty']);
      if (s.simulation.status !== 'PAUSED_EVENT') return no(['no_decision_pending'], ['advance_year']);
      return yes;
    case 'GOD_EDIT': {
      if (!s.config.godModeEnabled) return no(['god_mode_not_chosen'], ['choose_god_mode_at_creation']);
      if (busy(s)) return no(['simulation_busy'], ['wait_for_simulation']);
      if (opts.targetId !== undefined && !godTarget(s, opts.targetId)) return no(['target_unavailable'], ['living_character']);
      return yes;
    }
    case 'CONTINUE_DYNASTY':
      if (!s.protagonist.death) return no(['life_not_ended'], ['life_must_end']);
      return yes;
  }
}

/**
 * The money a choice is certain to cost, in the life's minor units, when the content declares a cost in every
 * possible outcome (the smallest of them: the real one may be higher). Null when some outcome costs nothing,
 * when the amounts are not known in advance, or for minors (their costs fall on the family).
 */
export function certainCost(s: GameState, ctx: SimulationContext, choice: Choice): number | null {
  if (currentAge(s) < 18) return null;
  const country = ctx.content.countries.find((c) => c.code === s.location.countryCode);
  if (!country) return null;
  const costs = choice.outcomes.map((o) => o.effects.reduce((sum, e) => (e.type === 'money' && e.ref < 0 ? sum + Math.abs(e.ref) : sum), 0));
  if (costs.length === 0 || costs.some((c) => c === 0)) return null;
  const scale = (country.fxPerEur * (0.35 + 0.65 * country.wageFactor) * s.world.priceIndex * (s.finance.minorUnits / 100)) / 10_000;
  return Math.round(Math.min(...costs) * scale);
}

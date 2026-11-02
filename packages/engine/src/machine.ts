import type { SimulationStatus } from '@project-life/schemas';

/**
 * IDLE → RUNNING → PAUSED_EVENT → RESOLVING → RUNNING → COMPLETED
 * Recoverable errors move to ERROR and may return to IDLE (rollback to last checkpoint).
 * M0 exercises IDLE/COMPLETED → RUNNING → COMPLETED; event pauses arrive with M1.
 */
const TRANSITIONS: Record<SimulationStatus, readonly SimulationStatus[]> = {
  IDLE: ['RUNNING'],
  RUNNING: ['PAUSED_EVENT', 'COMPLETED', 'ERROR'],
  PAUSED_EVENT: ['RESOLVING', 'ERROR'],
  RESOLVING: ['RUNNING', 'ERROR'],
  COMPLETED: ['RUNNING'],
  ERROR: ['IDLE'],
};

export function canTransition(from: SimulationStatus, to: SimulationStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

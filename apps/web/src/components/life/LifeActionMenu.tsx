import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MoreVertical } from 'lucide-react';
import type { ActionAvailability } from '@project-life/schemas';
import { explainAvailability } from './availability';

export interface LifeMenuAction {
  id: string;
  label: string;
  onSelect(): void;
  /** The engine's verdict; a blocked action is listed with its reason and cannot be chosen. */
  availability?: ActionAvailability | undefined;
}

/**
 * Contextual menu of a row (keyboard: open with Enter/Space, arrows to move, Esc to close, focus returns to the
 * button). It only offers actions that exist; blocked ones say why.
 */
export function LifeActionMenu({ label, actions }: { label: string; actions: LifeMenuAction[] }) {
  if (actions.length === 0) return null;
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button type="button" aria-label={label} className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-muted">
          <MoreVertical aria-hidden="true" className="size-5" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4} className="z-[var(--z-drawer)] min-w-56 rounded-xl border border-border bg-card p-1 shadow-ui-3">
          {actions.map((a) => {
            const blocked = a.availability !== undefined && !a.availability.available;
            const why = blocked && a.availability ? explainAvailability(a.availability).reasons.join(' ') : null;
            return (
              <DropdownMenu.Item
                key={a.id}
                disabled={blocked}
                onSelect={a.onSelect}
                className="flex min-h-11 cursor-pointer flex-col justify-center rounded-lg px-3 py-2 text-sm outline-none data-[disabled]:cursor-not-allowed data-[disabled]:text-muted-foreground data-[highlighted]:bg-muted"
              >
                <span className="font-medium">{a.label}</span>
                {why && <span className="text-xs">{why}</span>}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

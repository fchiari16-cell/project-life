import { netWorth } from '@project-life/engine';
import type { GameState } from '@project-life/schemas';
import { formatMoney } from '../../game/describe';
import { t } from '../../i18n/it';

/** Net worth as computed by the ledger (never a separate counter). */
export function LifeMoneyDisplay({ game, className }: { game: GameState; className?: string }) {
  return (
    <span className={className}>
      <span className="sr-only">{t.life.netWorth}: </span>
      <span className="tabular-nums font-semibold">{formatMoney(netWorth(game), game.finance.currency)}</span>
    </span>
  );
}

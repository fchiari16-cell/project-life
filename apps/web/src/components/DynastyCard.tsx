import { useMemo, useState } from 'react';
import { dynastyOptions } from '@project-life/engine';
import { Button } from './ui/button';
import { randomSeed, useGame } from '../game/store';
import { t } from '../i18n/it';

/** Shown when a life has ended: choose which living relative the next newborn is born to. */
export function DynastyCard() {
  const game = useGame((s) => s.game);
  const busy = useGame((s) => s.busy);
  const continueLife = useGame((s) => s.continueLife);
  const options = useMemo(() => (game ? dynastyOptions(game) : []), [game]);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  if (!game?.protagonist.death) return null;
  const field = 'mt-1 block min-h-11 w-full rounded-lg border border-border bg-card px-3 text-base';

  return (
    <section aria-labelledby="continue" className="rounded-xl border border-border bg-card p-5">
      <h2 id="continue" className="text-lg font-bold">
        {t.dynasty.continueTitle}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t.dynasty.continueHint}</p>
      <form
        className="mt-4 grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void continueLife({ givenName: name, seed: randomSeed(), parentId: parentId || null });
        }}
      >
        {options.length === 0 ? (
          <p className="text-sm">{t.dynasty.noHeirs}</p>
        ) : (
          <label className="text-sm font-medium">
            {t.dynasty.parent}
            <select className={field} value={parentId} onChange={(e) => setParentId(e.target.value)}>
              {options.map((o, i) => (
                <option key={o.npcId} value={i === 0 ? '' : o.npcId}>
                  {o.name} ({o.age}) · {o.lineage === 'descendant' ? t.dynasty.lineageDescendant : t.dynasty.lineageCollateral}
                  {o.partnerName ? ` · ${t.dynasty.withPartner(o.partnerName)}` : ''}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-sm font-medium">
          {t.dynasty.newName}
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} required maxLength={64} autoComplete="off" />
        </label>
        <Button type="submit" size="lg" disabled={busy}>
          {t.dynasty.continue}
        </Button>
      </form>
    </section>
  );
}

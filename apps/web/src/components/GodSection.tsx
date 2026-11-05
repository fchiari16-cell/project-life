import { useState } from 'react';
import { Button } from './ui/button';
import { GodEditor } from './GodEditor';
import { useGame } from '../game/store';
import { t } from '../i18n/it';

/**
 * GOD MODE status of the open life. It is read-only on purpose: the choice is made when the life is created
 * and is locked (T71), so there is no control to switch it here or anywhere else.
 */
export function GodSection() {
  const game = useGame((s) => s.game);
  const [editing, setEditing] = useState(false);
  const on = game?.config.godModeEnabled === true;

  return (
    <section aria-labelledby="god" className="rounded-xl border border-border bg-card p-5">
      <h2 id="god" className="mb-2 text-lg font-bold">
        {t.god.title}
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">{t.god.intro}</p>
      {!game ? (
        <p className="text-sm text-muted-foreground">{t.family.none}</p>
      ) : (
        <>
          <p className="text-sm" data-testid="god-status">
            <strong>{on ? t.god.statusOn : t.god.statusOff}</strong>
            {on && <> · {t.god.edits(game.godMode.edits)}</>}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{t.god.lockedNote}</p>
          {game.config.godModeOrigin === 'migrated-from-usage' && <p className="mt-1 text-xs text-muted-foreground">{t.god.originMigratedUsage}</p>}
          {game.config.godModeOrigin === 'migrated-no-usage' && <p className="mt-1 text-xs text-muted-foreground">{t.god.originMigratedNone}</p>}

          {!on && <p className="mt-3 text-sm">{t.god.offExplain}</p>}
          {on && game.protagonist.death === null && !editing && (
            <Button className="mt-3" variant="outline" onClick={() => setEditing(true)}>
              {t.god.editProfile}
            </Button>
          )}
          {on && editing && <GodEditor targetId={game.protagonist.id} onClose={() => setEditing(false)} />}

          {on && (
            <>
              <h3 className="mb-2 mt-5 text-sm font-bold">{t.god.log}</h3>
              {game.godMode.log.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.god.noLog}</p>
              ) : (
                <ol className="grid gap-2 text-sm">
                  {[...game.godMode.log]
                    .reverse()
                    .slice(0, 20)
                    .map((l) => (
                      <li key={`${l.revision}-${l.targetId}-${l.action}`}>
                        <span className="font-semibold">{t.god.actions[l.action]}</span> · {l.year}
                        {l.action === 'EDITED' && (
                          <>
                            {' '}
                            · {l.targetName}
                            <ul className="ml-4 list-disc text-muted-foreground">
                              {l.changes.map((c) => (
                                <li key={c.path}>
                                  {c.path}: {c.from} → {c.to}
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </li>
                    ))}
                </ol>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

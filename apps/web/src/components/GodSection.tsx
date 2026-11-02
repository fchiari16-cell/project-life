import { useState } from 'react';
import { Button } from './ui/button';
import { GodEditor } from './GodEditor';
import { useGame } from '../game/store';
import { t } from '../i18n/it';

export function GodSection() {
  const game = useGame((s) => s.game);
  const busy = useGame((s) => s.busy);
  const godToggle = useGame((s) => s.godToggle);
  const [editing, setEditing] = useState(false);
  const god = game?.godMode;

  return (
    <section aria-labelledby="god" className="rounded-xl border border-border bg-card p-5">
      <h2 id="god" className="mb-2 text-lg font-bold">
        {t.god.title}
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">{t.god.intro}</p>
      {!game || !god ? (
        <p className="text-sm text-muted-foreground">{t.family.none}</p>
      ) : (
        <>
          <p className="mb-3 text-sm">
            <strong>{god.enabled ? t.god.on : t.god.off}</strong> · {t.god.edits(god.edits)}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant={god.enabled ? 'outline' : 'default'} disabled={busy} onClick={() => void godToggle(!god.enabled)}>
              {god.enabled ? t.god.disable : t.god.enable}
            </Button>
            {god.enabled && game.protagonist.death === null && !editing && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                {t.god.editProfile}
              </Button>
            )}
          </div>
          {god.enabled && <p className="mt-2 text-xs text-muted-foreground">{t.god.offNote}</p>}
          {editing && god.enabled && <GodEditor targetId={game.protagonist.id} onClose={() => setEditing(false)} />}

          <h3 className="mb-2 mt-5 text-sm font-bold">{t.god.log}</h3>
          {god.log.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.god.noLog}</p>
          ) : (
            <ol className="grid gap-2 text-sm">
              {[...god.log]
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
    </section>
  );
}

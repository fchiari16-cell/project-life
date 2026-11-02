import { ageInYears } from '@project-life/engine';
import { Button } from './ui/button';
import { useGame } from '../game/store';
import { t } from '../i18n/it';

export function SaveList() {
  const saves = useGame((s) => s.saves);
  const busy = useGame((s) => s.busy);
  const openSave = useGame((s) => s.openSave);
  const removeSave = useGame((s) => s.removeSave);

  return (
    <section aria-labelledby="saves" className="rounded-xl border border-border bg-card p-5">
      <h2 id="saves" className="mb-3 text-lg font-bold">
        {t.life.savedLives}
      </h2>
      {saves.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.life.noSaves}</p>
      ) : (
        <ul className="grid gap-3">
          {saves.map((s) => {
            const age = ageInYears(s.state.protagonist.birth, s.state.world.currentDate);
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.dynasty.generation(s.dynasty.generation)} · {t.life.ageUnit(age)} · rev {s.revision}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" disabled={busy} onClick={() => void openSave(s.id)} aria-label={`${t.life.open} ${s.name}`}>
                    {t.life.open}
                  </Button>
                  <Button
                    variant="danger"
                    disabled={busy}
                    aria-label={`${t.life.delete} ${s.name}`}
                    onClick={() => {
                      if (confirm(t.life.confirmDelete)) void removeSave(s.id);
                    }}
                  >
                    {t.life.delete}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

import { useRef, useState } from 'react';
import type { IntegrityReport, RestoreChoice, RestoreEntry } from '@project-life/persistence';
import { Button } from './ui/button';
import { useGame } from '../game/store';
import { t } from '../i18n/it';

export function BackupSection() {
  const exportAll = useGame((s) => s.exportAll);
  const planBackup = useGame((s) => s.planBackup);
  const restoreBackupText = useGame((s) => s.restoreBackupText);
  const checkIntegrity = useGame((s) => s.checkIntegrity);
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState<string | null>(null);
  const [plan, setPlan] = useState<RestoreEntry[]>([]);
  const [choices, setChoices] = useState<Record<string, RestoreChoice>>({});
  const [note, setNote] = useState<string | null>(null);
  const [report, setReport] = useState<IntegrityReport | null>(null);

  const guard = async (fn: () => Promise<void>): Promise<void> => {
    try {
      await fn();
    } catch (e) {
      setNote(e instanceof Error ? e.message : t.errors.generic);
    }
  };

  const download = (): Promise<void> =>
    guard(async () => {
      const url = URL.createObjectURL(new Blob([await exportAll()], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-life-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

  const pick = (file: File | undefined): Promise<void> =>
    guard(async () => {
      if (!file) return;
      const body = await file.text();
      setPlan(await planBackup(body));
      setText(body);
      setChoices({});
      setNote(null);
      if (fileRef.current) fileRef.current.value = '';
    });

  const apply = (): Promise<void> =>
    guard(async () => {
      if (text === null) return;
      setNote(await restoreBackupText(text, choices));
      setText(null);
      setPlan([]);
    });

  return (
    <section aria-labelledby="backup-all" className="rounded-xl border border-border bg-card p-5">
      <h2 id="backup-all" className="mb-1 text-lg font-bold">
        {t.backup.title}
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">{t.backup.hint}</p>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => void download()}>
          {t.backup.export}
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            void guard(async () => {
              setReport(await checkIntegrity());
            })
          }
        >
          {t.backup.integrity}
        </Button>
      </div>

      <div className="mt-4">
        <label htmlFor="restore-file" className="mb-1 block text-sm font-medium">
          {t.backup.restore}
        </label>
        <input id="restore-file" ref={fileRef} type="file" accept="application/json,.json" className="block min-h-11 text-sm" onChange={(e) => void pick(e.target.files?.[0])} />
      </div>

      {text !== null && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-bold">{t.backup.plan}</h3>
          <ul className="grid gap-3 text-sm">
            {plan.map((e) => (
              <li key={e.id}>
                <p>
                  <span className="font-semibold">{e.name}</span> — {t.backup.status[e.status]} <span className="text-muted-foreground">({e.detail})</span>
                </p>
                {e.status === 'CONFLICT' && (
                  <select
                    aria-label={`${e.name}: ${t.backup.plan}`}
                    className="mt-1 block min-h-11 rounded-lg border border-border bg-card px-3"
                    value={choices[e.id] ?? 'copy'}
                    onChange={(ev) => setChoices({ ...choices, [e.id]: ev.target.value as RestoreChoice })}
                  >
                    {(Object.keys(t.backup.choose) as RestoreChoice[]).map((c) => (
                      <option key={c} value={c}>
                        {t.backup.choose[c]}
                      </option>
                    ))}
                  </select>
                )}
              </li>
            ))}
          </ul>
          <Button className="mt-3" onClick={() => void apply()}>
            {t.backup.apply}
          </Button>
        </div>
      )}

      {note && (
        <p role="status" className="mt-3 text-sm">
          {note}
        </p>
      )}
      {report && (
        <div role="status" className="mt-3 text-sm">
          {report.ok ? (
            t.backup.integrityOk
          ) : (
            <>
              <p>{t.backup.integrityBad}</p>
              <ul className="list-disc pl-5">
                {report.saves
                  .filter((s) => !s.ok)
                  .map((s) => (
                    <li key={s.id}>
                      {s.id}: {s.message}
                    </li>
                  ))}
                {report.orphanJournalRows > 0 && <li>journal: {report.orphanJournalRows}</li>}
                {report.orphanCheckpoints > 0 && <li>checkpoints: {report.orphanCheckpoints}</li>}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}

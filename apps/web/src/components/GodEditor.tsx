import { useMemo, useState } from 'react';
import { contentBundle } from '@project-life/content';
import { godTarget, planGodEdit } from '@project-life/engine';
import { GodPatchSchema, STAT_KEYS, TRAIT_KEYS, type GodPatch } from '@project-life/schemas';
import { Button } from './ui/button';
import { useGame } from '../game/store';
import { t } from '../i18n/it';

const SKILL_KEYS = ['social', 'technical', 'creative', 'physical'] as const;
const PRED_KEYS = ['longevity', 'robustness'] as const;
type Draft = Record<string, number>;

function Slider({ id, label, value, onChange }: { id: string; label: string; value: number; onChange(v: number): void }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-2 text-sm">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="range" min={0} max={100} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-11 w-full" />
      <span className="tabular-nums text-right">{value}</span>
    </div>
  );
}

function pathLabel(path: string): string {
  const [group, key = ''] = path.split('.');
  switch (group) {
    case 'givenName':
      return t.life.givenName;
    case 'familyName':
      return t.life.familyName;
    case 'stats':
      return t.stats[key as keyof typeof t.stats] ?? key;
    case 'traits':
      return t.god.traitNames[key] ?? key;
    case 'predispositions':
      return t.god.predNames[key] ?? key;
    case 'skills':
      return t.god.skillNames[key] ?? key;
    case 'talents':
      return t.god.talents.replace(/ \(.*\)/, '');
    default:
      return path;
  }
}

const talentTitle = (id: string): string => contentBundle.talents.find((x) => x.id === id)?.title ?? id;

/**
 * Edit → preview → confirm. The preview is the engine's own plan (same validation the command runs), so what
 * is shown is exactly what will be saved; nothing is written until "Conferma e salva".
 */
export function GodEditor({ targetId, onClose }: { targetId: string; onClose(): void }) {
  const game = useGame((s) => s.game);
  const busy = useGame((s) => s.busy);
  const godEdit = useGame((s) => s.godEdit);
  const target = game ? godTarget(game, targetId) : null;
  const ref = target?.ref;
  const isPlayer = target?.kind === 'protagonist';

  const [given, setGiven] = useState(ref?.givenName ?? '');
  const [family, setFamily] = useState(ref?.familyName ?? '');
  const [stats, setStats] = useState<Draft>({ ...(isPlayer ? (target.ref.stats as Draft) : {}) });
  const [traits, setTraits] = useState<Draft>({ ...(ref?.traits as Draft | undefined) });
  const [pred, setPred] = useState<Draft>({ ...(ref?.predispositions as Draft | undefined) });
  const [skills, setSkills] = useState<Draft>({ ...(isPlayer ? (target.ref.skills as Draft) : {}) });
  const [talents, setTalents] = useState<string[]>([...(ref?.talents ?? [])]);

  const patch = useMemo((): GodPatch => {
    if (!ref || !target) return {};
    const diff = (draft: Draft, base: Record<string, number>): Draft => Object.fromEntries(Object.entries(draft).filter(([k, v]) => v !== base[k]));
    const p: Record<string, unknown> = {};
    if (given !== ref.givenName) p.givenName = given;
    if (family !== ref.familyName) p.familyName = family;
    const tr = diff(traits, ref.traits as unknown as Record<string, number>);
    if (Object.keys(tr).length) p.traits = tr;
    const pr = diff(pred, ref.predispositions as unknown as Record<string, number>);
    if (Object.keys(pr).length) p.predispositions = pr;
    if (target.kind === 'protagonist') {
      const st = diff(stats, target.ref.stats as unknown as Record<string, number>);
      if (Object.keys(st).length) p.stats = st;
      const sk = diff(skills, target.ref.skills as unknown as Record<string, number>);
      if (Object.keys(sk).length) p.skills = sk;
    }
    if ([...talents].sort().join() !== [...ref.talents].sort().join()) p.talents = talents;
    return p as GodPatch;
  }, [ref, target, given, family, traits, pred, stats, skills, talents]);

  if (!game || !ref || !target) return null;
  const schemaOk = GodPatchSchema.safeParse(patch).success;
  const plan = schemaOk ? planGodEdit(game, targetId, patch, contentBundle) : null;
  const canSave = !busy && plan !== null && plan.ok && plan.changes.length > 0;
  const fieldClass = 'block min-h-11 w-full rounded-lg border border-border bg-card px-3 text-base';
  const legend = 'mb-2 text-sm font-bold';

  return (
    <form
      aria-label={t.god.editTitle(`${ref.givenName} ${ref.familyName}`)}
      className="mt-4 grid gap-5 rounded-xl border-2 border-primary bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSave) return;
        void godEdit(targetId, patch).then((ok) => ok && onClose());
      }}
    >
      <h3 className="text-lg font-bold">{t.god.editTitle(`${ref.givenName} ${ref.familyName}`)}</h3>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className={legend}>{t.god.identity}</legend>
        <label className="text-sm">
          {t.life.givenName}
          <input className={fieldClass} value={given} maxLength={64} onChange={(e) => setGiven(e.target.value)} />
        </label>
        <label className="text-sm">
          {t.life.familyName}
          <input className={fieldClass} value={family} maxLength={64} onChange={(e) => setFamily(e.target.value)} />
        </label>
      </fieldset>

      {isPlayer ? (
        <fieldset className="grid gap-1">
          <legend className={legend}>{t.god.visibleStats}</legend>
          {STAT_KEYS.map((k) => (
            <Slider key={k} id={`god-stat-${k}`} label={t.stats[k]} value={stats[k] ?? 0} onChange={(v) => setStats({ ...stats, [k]: v })} />
          ))}
        </fieldset>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t.god.cannot}: {t.god.visibleStats.toLowerCase()}, {t.god.skills.toLowerCase()}.
        </p>
      )}

      <fieldset className="grid gap-1">
        <legend className={legend}>{t.god.traits}</legend>
        {TRAIT_KEYS.map((k) => (
          <Slider key={k} id={`god-trait-${k}`} label={t.god.traitNames[k] ?? k} value={traits[k] ?? 0} onChange={(v) => setTraits({ ...traits, [k]: v })} />
        ))}
      </fieldset>

      <fieldset className="grid gap-1">
        <legend className={legend}>{t.god.predispositions}</legend>
        {PRED_KEYS.map((k) => (
          <Slider key={k} id={`god-pred-${k}`} label={t.god.predNames[k] ?? k} value={pred[k] ?? 50} onChange={(v) => setPred({ ...pred, [k]: v })} />
        ))}
      </fieldset>

      {isPlayer && (
        <fieldset className="grid gap-1">
          <legend className={legend}>{t.god.skills}</legend>
          {SKILL_KEYS.map((k) => (
            <Slider key={k} id={`god-skill-${k}`} label={t.god.skillNames[k] ?? k} value={skills[k] ?? 0} onChange={(v) => setSkills({ ...skills, [k]: v })} />
          ))}
        </fieldset>
      )}

      <fieldset>
        <legend className={legend}>{t.god.talents}</legend>
        <div className="flex flex-wrap gap-x-4">
          {contentBundle.talents.map((tal) => {
            const on = talents.includes(tal.id);
            return (
              <label key={tal.id} className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={on}
                  disabled={!on && talents.length >= 5}
                  onChange={() => setTalents(on ? talents.filter((x) => x !== tal.id) : [...talents, tal.id])}
                />
                {talentTitle(tal.id)}
              </label>
            );
          })}
        </div>
      </fieldset>

      <section aria-live="polite" aria-label={t.god.preview}>
        <h4 className={legend}>{t.god.preview}</h4>
        {!schemaOk ? (
          <p role="alert" className="text-sm text-danger">
            {t.errors.generic}
          </p>
        ) : plan && !plan.ok ? (
          <ul className="grid gap-1 text-sm text-danger">
            {plan.issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        ) : plan && plan.changes.length > 0 ? (
          <ul className="grid gap-1 text-sm">
            {plan.changes.map((c) => (
              <li key={c.path}>
                <span className="font-semibold">{pathLabel(c.path)}</span>: {c.from} → {c.to}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t.god.noChanges}</p>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={!canSave}>
          {t.god.confirm}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          {t.god.cancel}
        </Button>
      </div>
    </form>
  );
}

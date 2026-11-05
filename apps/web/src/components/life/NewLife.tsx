import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useNavigate, useSearchParams } from 'react-router';
import { contentBundle } from '@project-life/content';
import { dynastyOptions } from '@project-life/engine';
import { SUPPORTED_BIRTH_YEARS, type GameState, type GodPatch, type SimDate } from '@project-life/schemas';
import { Button } from '../ui/button';
import { GodFields, type GodDraft } from '../GodEditor';
import { LifeSectionHeader } from './LifeSectionHeader';
import { countryName } from '../../game/describe';
import { previewDynastyLife, previewNewLife, randomSeed, todayDate, useGame, type DynastyInput, type NewLifeInput } from '../../game/store';
import { localeTag } from '../../i18n/locale';
import { t } from '../../i18n/it';

type Mode = 'random' | 'custom' | 'dynasty';
const MODES: Mode[] = ['random', 'custom', 'dynasty'];
const card = 'rounded-xl border border-border bg-card p-5';
const field = 'mt-1 block min-h-11 w-full rounded-lg border border-border bg-card px-3 text-base';

const pad = (n: number): string => String(n).padStart(2, '0');
const toIso = (d: SimDate): string => `${d.year}-${pad(d.month)}-${pad(d.day)}`;
function fromIso(v: string): SimDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) } : null;
}
const NO_DRAFT: GodDraft = { patch: {}, valid: true, plan: null };

/**
 * Creation of a new life. What can be chosen depends on the mode: a random life only takes a name; a custom one
 * also takes place and birth date; a dynasty continuation takes a concluded life and an heir. Wealth and family
 * condition are never choosable. GOD MODE is chosen here and is then locked for the whole life (T71); only with
 * it can the character be customised, and the customisation is applied as part of the creation.
 */
export function NewLife() {
  const navigate = useNavigate();
  const [query] = useSearchParams();
  const saves = useGame((s) => s.saves);
  const openGame = useGame((s) => s.game);
  const busy = useGame((s) => s.busy);
  const createLife = useGame((s) => s.createLife);
  const continueLife = useGame((s) => s.continueLife);

  const concluded = useMemo(() => saves.filter((s) => s.state.protagonist.death !== null), [saves]);
  const requested = query.get('mode');
  const [mode, setMode] = useState<Mode>(requested === 'dynasty' || requested === 'random' ? requested : 'custom');
  const [givenName, setGivenName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [seed, setSeed] = useState(randomSeed);
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [birth, setBirth] = useState(() => toIso(todayDate()));
  const [godOn, setGodOn] = useState(false);
  const [draft, setDraft] = useState<GodDraft>(NO_DRAFT);
  const [confirming, setConfirming] = useState(false);
  const [dynastySeed] = useState(randomSeed);
  const [sourceId, setSourceId] = useState<string>(() => (openGame?.protagonist.death ? openGame.id : (query.get('from') ?? '')));
  const [parentId, setParentId] = useState('');

  const dynasty = mode === 'dynasty';
  const source: GameState | null = dynasty ? (concluded.find((s) => s.id === (sourceId || concluded[0]?.id))?.state ?? null) : null;
  const effectiveSourceId = dynasty ? (concluded.find((s) => s.id === (sourceId || concluded[0]?.id))?.id ?? null) : null;
  const heirs = useMemo(() => (source ? dynastyOptions(source) : []), [source]);
  const cities = useMemo(() => contentBundle.countries.find((c) => c.code === country)?.cities ?? [], [country]);
  const countries = useMemo(() => [...contentBundle.countries].sort((a, b) => countryName(a.code).localeCompare(countryName(b.code), localeTag())), []);
  const birthDate = fromIso(birth);

  const effectiveGod = godOn;
  const patch: GodPatch | undefined = effectiveGod && Object.keys(draft.patch).length > 0 ? draft.patch : undefined;
  const lifeInput: NewLifeInput = {
    givenName: givenName.trim(),
    familyName: familyName.trim(),
    seed: seed.trim(),
    countryCode: mode === 'custom' && country ? country : null,
    city: mode === 'custom' && city ? city : null,
    birthDate: mode === 'custom' ? birthDate : null,
    godModeEnabled: effectiveGod,
    initialGodPatch: patch,
  };
  const dynastyInput: Omit<DynastyInput, 'fromSaveId'> = {
    givenName: givenName.trim(),
    seed: dynastySeed,
    parentId: parentId || null,
    godModeEnabled: effectiveGod,
    initialGodPatch: patch,
  };

  // The base character of the newborn (before customising): shown only with GOD MODE, to edit from. Names do
  // not influence the draw, so placeholders are used while they are still empty.
  const baseKey = `${mode}|${seed}|${country}|${city}|${birth}|${effectiveSourceId}|${parentId}`;
  const base = useMemo(() => {
    if (!effectiveGod) return null;
    const placeholder = { givenName: 'X', familyName: 'Y' };
    if (dynasty) return source ? previewDynastyLife(source, { ...dynastyInput, givenName: 'X', initialGodPatch: undefined }) : null;
    return previewNewLife({ ...lifeInput, ...placeholder, initialGodPatch: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the inputs that change the draw (baseKey)
  }, [effectiveGod, baseKey]);

  // What the engine would create with exactly these choices: the same call that runs on confirmation.
  // Deferred as a string: a fresh object every render would never settle and would re-render forever.
  const deferredRequest = useDeferredValue(JSON.stringify({ lifeInput, dynastyInput, dynasty, effectiveSourceId }));
  const outcome = useMemo(() => {
    const req = JSON.parse(deferredRequest) as { lifeInput: NewLifeInput; dynastyInput: Omit<DynastyInput, 'fromSaveId'>; dynasty: boolean; effectiveSourceId: string | null };
    if (req.dynasty) {
      const src = concluded.find((s) => s.id === req.effectiveSourceId)?.state;
      return src ? previewDynastyLife(src, req.dynastyInput) : null;
    }
    return previewNewLife(req.lifeInput);
  }, [deferredRequest, concluded]);

  const named = dynasty ? givenName.trim().length > 0 : givenName.trim().length > 0 && familyName.trim().length > 0;
  const customisedOk = !effectiveGod || draft.valid;
  const ready = named && customisedOk && outcome?.ok === true && !(dynasty && !source);
  const problem = outcome && !outcome.ok && named ? outcome.error.message : null;

  const onDraft = useCallback((d: GodDraft) => setDraft(d), []);

  const submit = async (): Promise<void> => {
    if (dynasty) await continueLife({ ...dynastyInput, fromSaveId: effectiveSourceId });
    else await createLife(lifeInput);
    if (!useGame.getState().error) {
      setConfirming(false);
      void navigate('/');
    }
  };

  const dynastyBlocked = concluded.length === 0;
  const placeLabel = mode === 'custom' ? `${city || t.newLife.randomCity}, ${country ? countryName(country) : t.newLife.summaryRandomPlace}` : t.newLife.summaryRandomPlace;

  return (
    <div className="grid gap-5">
      <p className="text-sm text-muted-foreground">{t.newLife.hint}</p>

      <section aria-labelledby="nl-mode" className={card}>
        <LifeSectionHeader id="nl-mode" title={t.newLife.mode} />
        <div role="radiogroup" aria-labelledby="nl-mode" className="grid gap-2">
          {MODES.map((m) => {
            const blocked = m === 'dynasty' && dynastyBlocked;
            return (
              <label key={m} className="flex min-h-11 items-start gap-3 rounded-lg px-1 py-1">
                <input type="radio" name="mode" className="mt-1 size-5" checked={mode === m} disabled={blocked} onChange={() => setMode(m)} />
                <span>
                  <span className="block text-sm font-semibold">{t.newLife.modes[m]}</span>
                  <span className="block text-xs text-muted-foreground">{blocked ? t.newLife.dynastyUnavailable : t.newLife.modeHints[m]}</span>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="nl-identity" className={card}>
        <LifeSectionHeader id="nl-identity" title={t.newLife.identity} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            {dynasty ? t.dynasty.newName : t.life.givenName}
            <input className={field} value={givenName} onChange={(e) => setGivenName(e.target.value)} required maxLength={64} autoComplete="off" />
          </label>
          {!dynasty && (
            <label className="text-sm font-medium">
              {t.life.familyName}
              <input className={field} value={familyName} onChange={(e) => setFamilyName(e.target.value)} required maxLength={64} autoComplete="off" />
            </label>
          )}
        </div>
        {!dynasty && (
          <div className="mt-4">
            <label className="text-sm font-medium" htmlFor="seed">
              {t.life.seed}
            </label>
            <div className="flex gap-2">
              <input id="seed" className={field} value={seed} onChange={(e) => setSeed(e.target.value)} required autoComplete="off" />
              <Button type="button" variant="outline" className="mt-1 shrink-0" onClick={() => setSeed(randomSeed())}>
                {t.life.randomSeed}
              </Button>
            </div>
          </div>
        )}
      </section>

      {mode === 'custom' && (
        <section aria-labelledby="nl-birth" className={card}>
          <LifeSectionHeader id="nl-birth" title={t.newLife.birth} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">
              {t.life.country}
              <select
                className={field}
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  setCity('');
                }}
              >
                <option value="">{t.life.randomCountry}</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {countryName(c.code)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              {t.newLife.city}
              <select className={field} value={city} onChange={(e) => setCity(e.target.value)} disabled={!country}>
                <option value="">{t.newLife.randomCity}</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium sm:col-span-2">
              {t.newLife.birthDate}
              <input className={field} type="date" value={birth} min={`${SUPPORTED_BIRTH_YEARS.min}-01-01`} max={toIso(todayDate())} onChange={(e) => setBirth(e.target.value)} required />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">{t.newLife.birthDateHint(SUPPORTED_BIRTH_YEARS.min)}</span>
            </label>
          </div>
        </section>
      )}

      {dynasty && (
        <section aria-labelledby="nl-dyn" className={card}>
          <LifeSectionHeader id="nl-dyn" title={t.dynasty.title} />
          <div className="grid gap-4">
            <label className="text-sm font-medium">
              {t.newLife.sourceLife}
              <select className={field} value={effectiveSourceId ?? ''} onChange={(e) => { setSourceId(e.target.value); setParentId(''); }}>
                {concluded.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {t.dynasty.generation(s.dynasty.generation)}
                  </option>
                ))}
              </select>
            </label>
            {heirs.length === 0 ? (
              <p className="text-sm">{t.dynasty.noHeirs}</p>
            ) : (
              <label className="text-sm font-medium">
                {t.newLife.heir}
                <select className={field} value={parentId} onChange={(e) => setParentId(e.target.value)}>
                  {heirs.map((o, i) => (
                    <option key={o.npcId} value={i === 0 ? '' : o.npcId}>
                      {o.name} ({o.age}) · {o.lineage === 'descendant' ? t.dynasty.lineageDescendant : t.dynasty.lineageCollateral}
                      {o.partnerName ? ` · ${t.dynasty.withPartner(o.partnerName)}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </section>
      )}

      <section aria-labelledby="nl-family" className={card}>
        <LifeSectionHeader id="nl-family" title={t.newLife.familyTitle} />
        <p className="text-sm text-muted-foreground">{t.newLife.familyNote}</p>
      </section>

      <section aria-labelledby="nl-god" className={card}>
        <LifeSectionHeader id="nl-god" title={t.newLife.godLegend} hint={t.newLife.godExplain} />
        <div role="radiogroup" aria-labelledby="nl-god" className="grid gap-2 sm:grid-cols-2">
          {[
            { on: false, label: t.newLife.godOff, hint: t.newLife.godOffHint },
            { on: true, label: t.newLife.godOn, hint: t.newLife.godOnHint },
          ].map((o) => (
            <label key={o.label} className="flex min-h-11 items-start gap-3 rounded-lg border border-border px-3 py-2">
              <input type="radio" name="god" className="mt-1 size-5" checked={godOn === o.on} onChange={() => { setGodOn(o.on); setDraft(NO_DRAFT); }} />
              <span>
                <span className="block text-sm font-bold">
                  {t.newLife.godLegend}: {o.label}
                </span>
                <span className="block text-xs text-muted-foreground">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      {effectiveGod && (
        <section aria-labelledby="nl-custom" className={card}>
          <LifeSectionHeader id="nl-custom" title={t.newLife.customise} hint={t.newLife.customiseHint} />
          {base?.ok ? (
            <GodFields key={baseKey} game={base.state} targetId={base.state.protagonist.id} hideIdentity onDraft={onDraft} />
          ) : (
            <p role="status" className="text-sm text-muted-foreground">
              {base && !base.ok ? `${t.newLife.invalid} ${base.error.message}` : '…'}
            </p>
          )}
        </section>
      )}

      {problem && (
        <p role="alert" className="text-sm text-danger">
          {t.newLife.invalid} {problem}
        </p>
      )}

      <Dialog.Root open={confirming} onOpenChange={setConfirming}>
        <Button type="button" size="lg" disabled={!ready || busy} onClick={() => setConfirming(true)}>
          {t.newLife.review}
        </Button>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[var(--z-modal)] bg-black/60" />
          <Dialog.Content
            aria-describedby="nl-confirm-body"
            className="fixed inset-x-4 bottom-4 z-[var(--z-modal)] mx-auto max-h-[85dvh] max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-ui-3 md:bottom-auto md:top-1/2 md:-translate-y-1/2"
          >
            <Dialog.Title className="text-xl font-bold">{t.newLife.confirmTitle}</Dialog.Title>
            <p id="nl-confirm-body" className="mt-2 text-sm">
              {t.newLife.confirmBody}
            </p>
            <dl className="mt-4 grid gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">{t.newLife.summaryMode}</dt>
                <dd className="font-semibold">{t.newLife.modes[mode]}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t.newLife.summaryName}</dt>
                <dd className="font-semibold">{dynasty ? givenName.trim() : `${givenName.trim()} ${familyName.trim()}`}</dd>
              </div>
              {!dynasty && (
                <>
                  <div>
                    <dt className="text-muted-foreground">{t.newLife.summaryPlace}</dt>
                    <dd className="font-semibold">{placeLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t.newLife.summaryDate}</dt>
                    <dd className="font-semibold">{mode === 'custom' ? birth.split('-').reverse().join('/') : t.newLife.summaryRandomPlace}</dd>
                  </div>
                </>
              )}
              {dynasty && (
                <div>
                  <dt className="text-muted-foreground">{t.newLife.summaryParent}</dt>
                  <dd className="font-semibold">{heirs.find((h, i) => (parentId ? h.npcId === parentId : i === 0))?.name ?? t.dynasty.noHeirs}</dd>
                </div>
              )}
              {effectiveGod && (
                <div>
                  <dt className="text-muted-foreground">{t.newLife.summaryCustom}</dt>
                  <dd className="font-semibold">{draft.plan && draft.plan.changes.length > 0 ? `${draft.plan.changes.length}` : t.newLife.none}</dd>
                </div>
              )}
            </dl>
            <p className="mt-4 rounded-lg border-2 border-primary p-3 text-base font-bold" data-testid="confirm-god">
              {t.newLife.confirmGod(effectiveGod)}
              <span className="block text-xs font-normal text-muted-foreground">{t.newLife.confirmLock}</span>
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button type="button" disabled={busy} onClick={() => void submit()}>
                {busy ? t.newLife.creating : t.newLife.confirm}
              </Button>
              <Dialog.Close asChild>
                <Button type="button" variant="outline">
                  {t.newLife.back}
                </Button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

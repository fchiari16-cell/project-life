import { useRef, useState } from 'react';
import { narrate, syncOne, type CloudRecord, type ConflictDecision, type NarrativeResult } from '@project-life/services';
import { Button } from './ui/button';
import { describeEvent } from '../game/describe';
import { useGame } from '../game/store';
import { makeCloud, makeNarrator, readPref, writePref, type SignInCapable } from '../lib/services';
import { localeTag } from '../i18n/locale';
import { t } from '../i18n/it';

const input = 'block min-h-11 w-full rounded-lg border border-border bg-card px-3 text-base';
const card = 'rounded-xl border border-border bg-card p-5';

/** Cloud sync: off until enabled; a failure only shows a message and never touches the local save. */
export function CloudSection() {
  const game = useGame((s) => s.game);
  const cloudRecord = useGame((s) => s.cloudRecord);
  const adoptRemote = useGame((s) => s.adoptRemote);
  const [enabled, setEnabled] = useState(readPref('cloud-on') === '1');
  const [url, setUrl] = useState(readPref('cloud-url'));
  const [anonKey, setAnonKey] = useState(readPref('cloud-anon'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ local: CloudRecord; remote: CloudRecord } | null>(null);
  const adapter = useRef<SignInCapable | null>(null);

  const toggle = (on: boolean): void => {
    setEnabled(on);
    writePref('cloud-on', on ? '1' : '');
    if (!on) {
      adapter.current?.signOut();
      adapter.current = null;
      setSignedIn(false);
      setConflict(null);
    }
  };
  const fail = (e: unknown): void => setMessage(`${t.cloud.failed}: ${e instanceof Error ? e.message : t.errors.generic}`);

  const signIn = async (): Promise<void> => {
    try {
      writePref('cloud-url', url.trim());
      writePref('cloud-anon', anonKey.trim());
      const a = makeCloud({ url: url.trim().replace(/\/$/, ''), anonKey: anonKey.trim() });
      await a.signIn(email, password);
      adapter.current = a;
      setPassword('');
      setSignedIn(true);
      setMessage(null);
    } catch (e) {
      fail(e);
    }
  };

  const sync = async (decision?: ConflictDecision, known?: { local: CloudRecord; remote: CloudRecord }): Promise<void> => {
    const a = adapter.current;
    if (!a) return;
    try {
      const local = known?.local ?? (await cloudRecord());
      if (!local) return;
      const out = await syncOne(a, local, local.id, decision);
      if (out.status === 'CONFLICT') {
        // Both versions are kept: the cloud one is stored locally as a copy before anything else is decided.
        await adoptRemote(out.remote.payload, true);
        setConflict({ local, remote: out.remote });
        setMessage(null);
        return;
      }
      if (out.status === 'PULLED') await adoptRemote(out.payload, false);
      setConflict(null);
      setMessage(t.cloud.results[out.status === 'RETRY' ? 'RETRY' : out.status] ?? out.status);
    } catch (e) {
      fail(e);
    }
  };

  return (
    <section aria-labelledby="cloud" className={card}>
      <h2 id="cloud" className="mb-1 text-lg font-bold">
        {t.cloud.title}
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">{t.cloud.intro}</p>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" className="size-5" checked={enabled} onChange={(e) => toggle(e.target.checked)} />
        {t.cloud.enable}
      </label>
      {enabled && (
        <div className="mt-3 grid gap-3">
          {!signedIn ? (
            <>
              <label className="text-sm">
                {t.cloud.url}
                <input className={input} type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" autoComplete="off" />
              </label>
              <label className="text-sm">
                {t.cloud.anonKey}
                <input className={input} value={anonKey} onChange={(e) => setAnonKey(e.target.value)} autoComplete="off" />
              </label>
              <label className="text-sm">
                {t.cloud.email}
                <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
              </label>
              <label className="text-sm">
                {t.cloud.password}
                <input className={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              </label>
              <Button disabled={!url || !anonKey || !email || !password} onClick={() => void signIn()}>
                {t.cloud.signIn}
              </Button>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold">{t.cloud.signedIn}</span>
              <Button disabled={!game} onClick={() => void sync()}>
                {t.cloud.sync}
              </Button>
              <Button variant="outline" onClick={() => toggle(false)}>
                {t.cloud.signOut}
              </Button>
            </div>
          )}
          {conflict && (
            <div role="alert" className="rounded-lg border border-danger p-3 text-sm">
              <p>{t.cloud.conflict}</p>
              <p className="mt-1 text-muted-foreground">
                rev {conflict.local.revision} · cloud rev {conflict.remote.revision}
              </p>
              <div className="mt-2 flex flex-wrap gap-3">
                <Button onClick={() => void sync('use_local', conflict)}>{t.cloud.useLocal}</Button>
                <Button variant="outline" onClick={() => void sync('use_remote', conflict)}>
                  {t.cloud.useRemote}
                </Button>
              </div>
            </div>
          )}
          {message && (
            <p role="status" className="text-sm">
              {message}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/** Optional narration of the latest event; the text is display-only and never read back by the game. */
export function AiSection() {
  const game = useGame((s) => s.game);
  const events = useGame((s) => s.events);
  const [enabled, setEnabled] = useState(readPref('ai-on') === '1');
  const [endpoint, setEndpoint] = useState(readPref('ai-endpoint'));
  const [result, setResult] = useState<NarrativeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const last = [...events].reverse()[0];

  const run = async (): Promise<void> => {
    if (!last || !game) return;
    setBusy(true);
    writePref('ai-endpoint', endpoint.trim());
    const d = describeEvent(last, game.finance.currency);
    setResult(
      await narrate(endpoint.trim() ? makeNarrator(endpoint.trim()) : null, {
        locale: localeTag(),
        kind: last.type,
        summary: d.detail ? `${d.text}. ${d.detail}` : d.text,
        place: game.location.countryCode,
      }),
    );
    setBusy(false);
  };

  return (
    <section aria-labelledby="ai" className={card}>
      <h2 id="ai" className="mb-1 text-lg font-bold">
        {t.ai.title}
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">{t.ai.intro}</p>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-5"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            writePref('ai-on', e.target.checked ? '1' : '');
          }}
        />
        {t.ai.enable}
      </label>
      {enabled && (
        <div className="mt-3 grid gap-3">
          <label className="text-sm">
            {t.ai.endpoint}
            <input className={input} type="url" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://" autoComplete="off" />
          </label>
          <Button disabled={!last || busy} onClick={() => void run()}>
            {t.ai.narrate}
          </Button>
          {result && (
            <blockquote className="rounded-lg border border-border p-3 text-sm">
              <p>{result.text}</p>
              <footer className="mt-1 text-xs text-muted-foreground">{t.ai.source[result.source]}</footer>
            </blockquote>
          )}
        </div>
      )}
    </section>
  );
}

import { describe, expect, it, vi } from 'vitest';
import {
  HttpNarrativeAdapter,
  MemoryCloudAdapter,
  SupabaseCloudAdapter,
  narrate,
  planSync,
  sanitizeNarrative,
  syncOne,
  type CloudRecord,
  type NarrativeAdapter,
} from '../src/index';

const rec = (revision: number, checksum: string, lineage: [number, string][], payload = `p${revision}${checksum}`): CloudRecord => ({
  id: 'g1',
  name: 'Ada',
  revision,
  checksum,
  lineage: lineage.map(([r, c]) => ({ revision: r, checksum: c })),
  updatedAt: '2026-01-01T00:00:00Z',
  payload,
});

describe('planSync (history, not timestamps)', () => {
  const base = rec(3, 'c3', [[1, 'c1'], [2, 'c2'], [3, 'c3']]);
  it('pushes, pulls or does nothing when one side simply descends from the other', () => {
    const ahead = rec(5, 'c5', [[1, 'c1'], [2, 'c2'], [3, 'c3'], [4, 'c4'], [5, 'c5']]);
    expect(planSync(ahead, base)).toBe('PUSH');
    expect(planSync(base, ahead)).toBe('PULL');
    expect(planSync(base, { ...base })).toBe('NOOP');
    expect(planSync(base, null)).toBe('PUSH_NEW');
    expect(planSync(null, base)).toBe('PULL_NEW');
    expect(planSync(null, null)).toBe('NOOP');
  });
  it('reports divergence as a conflict, even when one side has a higher revision or a newer timestamp', () => {
    const other = rec(7, 'x7', [[1, 'c1'], [2, 'c2'], [3, 'x3'], [7, 'x7']]);
    expect(planSync(base, other)).toBe('CONFLICT');
    expect(planSync(other, base)).toBe('CONFLICT');
    expect(planSync(rec(3, 'y3', [[1, 'c1'], [2, 'c2'], [3, 'y3']]), base)).toBe('CONFLICT'); // same revision, different content
  });
});

describe('syncOne with a backend', () => {
  it('pushes new, pushes ahead, pulls behind', async () => {
    const cloud = new MemoryCloudAdapter();
    const v1 = rec(1, 'c1', [[1, 'c1']]);
    expect(await syncOne(cloud, v1, 'g1')).toEqual({ status: 'PUSHED' });
    const v2 = rec(2, 'c2', [[1, 'c1'], [2, 'c2']]);
    expect(await syncOne(cloud, v2, 'g1')).toEqual({ status: 'PUSHED' });
    expect(cloud.rows.get('g1')!.revision).toBe(2);
    expect(await syncOne(cloud, v1, 'g1')).toMatchObject({ status: 'PULLED', payload: v2.payload });
    expect(await syncOne(cloud, v2, 'g1')).toEqual({ status: 'NOOP' });
    expect(await syncOne(cloud, null, 'g1')).toMatchObject({ status: 'PULLED' });
  });

  it('never overwrites on a conflict without an explicit decision, and the decision picks exactly one side', async () => {
    const cloud = new MemoryCloudAdapter();
    const remote = rec(4, 'r4', [[1, 'c1'], [4, 'r4']]);
    cloud.rows.set('g1', remote);
    const local = rec(3, 'l3', [[1, 'c1'], [3, 'l3']]);

    const first = await syncOne(cloud, local, 'g1');
    expect(first).toMatchObject({ status: 'CONFLICT', remote: { checksum: 'r4' } });
    expect(cloud.rows.get('g1')).toEqual(remote); // untouched

    expect(await syncOne(cloud, local, 'g1', 'use_remote')).toMatchObject({ status: 'PULLED', payload: remote.payload });
    expect(cloud.rows.get('g1')).toEqual(remote); // still untouched
    expect(await syncOne(cloud, local, 'g1', 'use_local')).toEqual({ status: 'PUSHED' });
    expect(cloud.rows.get('g1')!.checksum).toBe('l3');
  });

  it('the compare-and-set refuses to overwrite a version changed in the meantime', async () => {
    const cloud = new MemoryCloudAdapter();
    cloud.rows.set('g1', rec(1, 'c1', [[1, 'c1']]));
    const v2 = rec(2, 'c2', [[1, 'c1'], [2, 'c2']]);
    expect(await cloud.put(v2, 'c1')).toEqual({ ok: true });
    expect(await cloud.put(rec(2, 'z2', [[1, 'c1'], [2, 'z2']]), 'c1')).toEqual({ ok: false, reason: 'STALE' });
    expect(cloud.rows.get('g1')!.checksum).toBe('c2');
    expect(await cloud.put(rec(1, 'n1', [[1, 'n1']]), null)).toEqual({ ok: false, reason: 'STALE' }); // "must not exist", but it does
  });
});

describe('SupabaseCloudAdapter (against a mocked fetch: no real server was contacted)', () => {
  const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('refuses to do anything before sign-in, keeps the token in memory and uses only anon key + user token', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      if (String(url).includes('/auth/v1/token')) return json({ access_token: 'user-jwt' });
      return json([{ id: 'g1', name: 'Ada', revision: 2, checksum: 'c2', lineage: [], updated_at: 't', payload: 'P' }]);
    }) as unknown as typeof fetch;
    const cloud = new SupabaseCloudAdapter({ url: 'https://x.supabase.co', anonKey: 'anon', fetch: f });
    await expect(cloud.list()).rejects.toThrow('not signed in');
    expect(f).not.toHaveBeenCalled();
    await cloud.signIn('a@b.c', 'pw');
    expect(cloud.signedIn).toBe(true);
    const got = await cloud.get('g1');
    expect(got).toMatchObject({ id: 'g1', revision: 2, payload: 'P' });
    const headers = calls[1]!.init.headers as Record<string, string>;
    expect(headers).toMatchObject({ apikey: 'anon', authorization: 'Bearer user-jwt' });
    expect(JSON.stringify(calls)).not.toMatch(/service_role/i);
    cloud.signOut();
    await expect(cloud.get('g1')).rejects.toThrow('not signed in');
  });

  it('maps a failed compare-and-set (no row updated, or duplicate insert) to STALE', async () => {
    let mode: 'patch0' | 'patch1' | 'dup' = 'patch0';
    const f = (async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).includes('/auth/')) return json({ access_token: 't' });
      if (init?.method === 'POST') return mode === 'dup' ? json({}, 409) : json({}, 201);
      return json(mode === 'patch1' ? [{}] : []);
    }) as typeof fetch;
    const cloud = new SupabaseCloudAdapter({ url: 'https://x.supabase.co', anonKey: 'k', fetch: f });
    await cloud.signIn('a', 'b');
    const r = rec(2, 'c2', [[2, 'c2']]);
    expect(await cloud.put(r, 'c1')).toEqual({ ok: false, reason: 'STALE' });
    mode = 'patch1';
    expect(await cloud.put(r, 'c1')).toEqual({ ok: true });
    mode = 'dup';
    expect(await cloud.put(r, null)).toEqual({ ok: false, reason: 'STALE' });
  });

  it('a network failure surfaces as an error without touching anything local', async () => {
    const f = (async () => {
      throw new TypeError('offline');
    }) as unknown as typeof fetch;
    const cloud = new SupabaseCloudAdapter({ url: 'https://x.supabase.co', anonKey: 'k', fetch: f });
    await expect(cloud.signIn('a', 'b')).rejects.toThrow('offline');
  });
});

describe('optional narrator', () => {
  const facts = { locale: 'it', kind: 'JOB', summary: 'Hai ottenuto un nuovo lavoro.' };
  const adapter = (fn: NarrativeAdapter['narrate']): NarrativeAdapter => ({ narrate: fn });

  it('without an adapter it answers instantly with the offline template', async () => {
    expect(await narrate(null, facts)).toEqual({ text: facts.summary, source: 'template' });
  });
  it('uses the AI text when it is sane, sanitised and bounded', async () => {
    const res = await narrate(adapter(async () => '<b>Un giorno</b> nuovo http://evil.example inizia.\u0007'), facts);
    expect(res).toEqual({ text: 'Un giorno nuovo inizia.', source: 'ai' });
    expect(sanitizeNarrative('x'.repeat(5000))).toHaveLength(600);
  });
  it('falls back on error, empty answer and timeout', async () => {
    expect((await narrate(adapter(async () => { throw new Error('boom'); }), facts)).source).toBe('template');
    expect((await narrate(adapter(async () => '  '), facts)).source).toBe('template');
    const slow = adapter(() => new Promise(() => undefined));
    const t0 = Date.now();
    expect((await narrate(slow, facts, { timeoutMs: 30 })).source).toBe('template');
    expect(Date.now() - t0).toBeLessThan(1000);
  });
  it('the HTTP adapter posts only the facts (no API key, no state) and rejects bad responses', async () => {
    let sent: RequestInit | undefined;
    const ok = (async (_u: string | URL | Request, init?: RequestInit) => {
      sent = init;
      return json({ text: 'Una frase abbastanza lunga.' });
    }) as typeof fetch;
    const json = (b: unknown): Response => new Response(JSON.stringify(b));
    expect(await narrate(new HttpNarrativeAdapter('https://proxy.example/n', ok), facts)).toMatchObject({ source: 'ai' });
    expect(JSON.parse(String(sent?.body))).toEqual(facts);
    expect(JSON.stringify(sent?.headers)).not.toMatch(/authorization|api-key/i);
    const bad = (async () => json({ nope: 1 })) as unknown as typeof fetch;
    expect((await narrate(new HttpNarrativeAdapter('https://proxy.example/n', bad), facts)).source).toBe('template');
  });
});

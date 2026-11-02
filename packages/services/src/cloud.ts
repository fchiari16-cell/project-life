/**
 * Optional cloud sync. Nothing here runs unless the player configures a backend; the game never depends on it.
 *
 * Rules: the server never decides which version wins. A save is only pushed over the version the client last
 * saw (compare-and-set), divergent histories are reported as CONFLICT and nothing is overwritten until the
 * player chooses explicitly, and the caller keeps the other version as a copy first.
 */

/** One point of a save's history: the checksum its state had at that revision. */
export interface LineagePoint {
  revision: number;
  checksum: string;
}

export interface CloudMeta {
  id: string;
  name: string;
  revision: number;
  checksum: string;
  lineage: LineagePoint[];
  updatedAt: string;
}
export interface CloudRecord extends CloudMeta {
  /** The exported save (same JSON as a manual export). */
  payload: string;
}

export type PutResult = { ok: true } | { ok: false; reason: 'STALE' };

export interface CloudAdapter {
  readonly name: string;
  list(): Promise<CloudMeta[]>;
  get(id: string): Promise<CloudRecord | null>;
  /** Compare-and-set: succeeds only if the stored checksum is `expectedChecksum` (null = must not exist). */
  put(record: CloudRecord, expectedChecksum: string | null): Promise<PutResult>;
}

export type SyncAction = 'NOOP' | 'PUSH_NEW' | 'PUSH' | 'PULL_NEW' | 'PULL' | 'CONFLICT';

const knows = (m: CloudMeta, p: LineagePoint): boolean =>
  (m.revision === p.revision && m.checksum === p.checksum) || m.lineage.some((x) => x.revision === p.revision && x.checksum === p.checksum);

/** Pure decision: which side is ahead, judged by history (not by timestamps, which clocks can falsify). */
export function planSync(local: CloudMeta | null, remote: CloudMeta | null): SyncAction {
  if (!local && !remote) return 'NOOP';
  if (local && !remote) return 'PUSH_NEW';
  if (!local && remote) return 'PULL_NEW';
  const l = local as CloudMeta;
  const r = remote as CloudMeta;
  if (l.revision === r.revision && l.checksum === r.checksum) return 'NOOP';
  const remoteIsAncestor = knows(l, { revision: r.revision, checksum: r.checksum });
  const localIsAncestor = knows(r, { revision: l.revision, checksum: l.checksum });
  if (remoteIsAncestor && !localIsAncestor) return 'PUSH';
  if (localIsAncestor && !remoteIsAncestor) return 'PULL';
  return 'CONFLICT';
}

export type SyncOutcome =
  | { status: 'NOOP' }
  | { status: 'PUSHED' }
  | { status: 'PULLED'; payload: string }
  /** Nothing was changed anywhere. The caller keeps `remote` as a local copy and asks the player. */
  | { status: 'CONFLICT'; remote: CloudRecord }
  | { status: 'RETRY'; reason: 'remote changed while syncing' };

export type ConflictDecision = 'use_local' | 'use_remote';

export async function syncOne(
  adapter: CloudAdapter,
  local: CloudRecord | null,
  remoteId: string,
  decision?: ConflictDecision,
): Promise<SyncOutcome> {
  const remote = await adapter.get(remoteId);
  const push = async (expected: string | null): Promise<SyncOutcome> => {
    const res = await adapter.put(local as CloudRecord, expected);
    return res.ok ? { status: 'PUSHED' } : { status: 'RETRY', reason: 'remote changed while syncing' };
  };
  switch (planSync(local, remote)) {
    case 'NOOP':
      return { status: 'NOOP' };
    case 'PUSH_NEW':
      return push(null);
    case 'PUSH':
      return push((remote as CloudRecord).checksum);
    case 'PULL_NEW':
    case 'PULL':
      return { status: 'PULLED', payload: (remote as CloudRecord).payload };
    case 'CONFLICT': {
      const r = remote as CloudRecord;
      if (decision === 'use_remote') return { status: 'PULLED', payload: r.payload };
      if (decision === 'use_local') return push(r.checksum);
      return { status: 'CONFLICT', remote: r };
    }
  }
}

/** In-memory backend: used by tests and by anyone who wants to try the flow without a server. */
export class MemoryCloudAdapter implements CloudAdapter {
  readonly name = 'memory';
  readonly rows = new Map<string, CloudRecord>();
  async list(): Promise<CloudMeta[]> {
    return [...this.rows.values()].map(({ payload: _payload, ...meta }) => meta);
  }
  async get(id: string): Promise<CloudRecord | null> {
    const r = this.rows.get(id);
    return r ? structuredClone(r) : null;
  }
  async put(record: CloudRecord, expectedChecksum: string | null): Promise<PutResult> {
    const current = this.rows.get(record.id);
    if ((current?.checksum ?? null) !== expectedChecksum) return { ok: false, reason: 'STALE' };
    this.rows.set(record.id, structuredClone(record));
    return { ok: true };
  }
}

export interface SupabaseConfig {
  /** e.g. https://abcd.supabase.co — supplied by the player at runtime, never bundled. */
  url: string;
  /** The public anon key. The service-role key must never be used here. */
  anonKey: string;
  fetch?: typeof fetch;
}

interface Row {
  id: string;
  name: string;
  revision: number;
  checksum: string;
  lineage: LineagePoint[];
  payload?: string;
  updated_at: string;
}
const toMeta = (r: Row): CloudMeta => ({ id: r.id, name: r.name, revision: r.revision, checksum: r.checksum, lineage: r.lineage ?? [], updatedAt: r.updated_at });

/**
 * Supabase through its plain REST API (no SDK, so nothing is bundled unless used). Access is limited by the
 * row-level-security policies in supabase/migrations: every row belongs to auth.uid(). The session token is
 * kept in memory only.
 */
export class SupabaseCloudAdapter implements CloudAdapter {
  readonly name = 'supabase';
  private token: string | null = null;
  private readonly f: typeof fetch;
  constructor(private readonly cfg: SupabaseConfig) {
    this.f = cfg.fetch ?? ((...a) => fetch(...a));
  }
  get signedIn(): boolean {
    return this.token !== null;
  }
  signOut(): void {
    this.token = null;
  }
  async signIn(email: string, password: string): Promise<void> {
    const res = await this.f(`${this.cfg.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: this.cfg.anonKey, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(`sign-in failed (${res.status})`);
    const body = (await res.json()) as { access_token?: string };
    if (!body.access_token) throw new Error('sign-in failed: no token');
    this.token = body.access_token;
  }
  private headers(extra: Record<string, string> = {}): Record<string, string> {
    if (!this.token) throw new Error('not signed in');
    return { apikey: this.cfg.anonKey, authorization: `Bearer ${this.token}`, 'content-type': 'application/json', ...extra };
  }
  private url(query: string): string {
    return `${this.cfg.url}/rest/v1/saves?${query}`;
  }
  async list(): Promise<CloudMeta[]> {
    const res = await this.f(this.url('select=id,name,revision,checksum,lineage,updated_at'), { headers: this.headers() });
    if (!res.ok) throw new Error(`list failed (${res.status})`);
    return ((await res.json()) as Row[]).map(toMeta);
  }
  async get(id: string): Promise<CloudRecord | null> {
    const res = await this.f(this.url(`select=*&id=eq.${encodeURIComponent(id)}`), { headers: this.headers() });
    if (!res.ok) throw new Error(`get failed (${res.status})`);
    const row = ((await res.json()) as Row[])[0];
    return row ? { ...toMeta(row), payload: row.payload ?? '' } : null;
  }
  async put(record: CloudRecord, expectedChecksum: string | null): Promise<PutResult> {
    const body = JSON.stringify({
      id: record.id,
      name: record.name,
      revision: record.revision,
      checksum: record.checksum,
      lineage: record.lineage,
      payload: record.payload,
      updated_at: new Date().toISOString(),
    });
    if (expectedChecksum === null) {
      const res = await this.f(this.url(''), { method: 'POST', headers: this.headers(), body });
      if (res.status === 409) return { ok: false, reason: 'STALE' };
      if (!res.ok) throw new Error(`put failed (${res.status})`);
      return { ok: true };
    }
    const query = `id=eq.${encodeURIComponent(record.id)}&checksum=eq.${encodeURIComponent(expectedChecksum)}`;
    const res = await this.f(this.url(query), { method: 'PATCH', headers: this.headers({ prefer: 'return=representation' }), body });
    if (!res.ok) throw new Error(`put failed (${res.status})`);
    return ((await res.json()) as unknown[]).length === 1 ? { ok: true } : { ok: false, reason: 'STALE' };
  }
}

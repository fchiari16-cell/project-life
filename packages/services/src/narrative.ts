/**
 * Optional AI narration. It only ever receives a small set of plain facts and only ever returns text:
 * it has no access to GameState and no way to change it. Canonical state is decided by the engine alone.
 * Without a configured adapter (or when it fails, times out or answers nonsense) the built-in offline
 * template is used, so the game reads the same offline as online, just less varied.
 */
export interface NarrativeFacts {
  locale: string;
  kind: string;
  /** Plain, already-localised sentence the game itself would show. */
  summary: string;
  age?: number;
  place?: string;
}

export interface NarrativeAdapter {
  narrate(facts: NarrativeFacts, signal: AbortSignal): Promise<string>;
}

export type NarrativeResult = { text: string; source: 'template' | 'ai' };

const MAX_LEN = 600;

/** Removes markup, control characters and anything that looks like a link; caps the length. */
export function sanitizeNarrative(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/https?:\/\/\S+/gi, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LEN);
}

export const templateNarrative = (facts: NarrativeFacts): string => facts.summary;

export async function narrate(
  adapter: NarrativeAdapter | null,
  facts: NarrativeFacts,
  opts: { timeoutMs?: number } = {},
): Promise<NarrativeResult> {
  const fallback: NarrativeResult = { text: templateNarrative(facts), source: 'template' };
  if (!adapter) return fallback;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 4000);
  try {
    const raw = await Promise.race([
      adapter.narrate({ ...facts }, ctl.signal),
      new Promise<never>((_, reject) => ctl.signal.addEventListener('abort', () => reject(new Error('timeout')))),
    ]);
    const text = sanitizeNarrative(raw);
    return text.length >= 10 ? { text, source: 'ai' } : fallback;
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Calls a proxy endpoint run by the player (or their host). The proxy holds the model API key; the
 * client never sees or sends one.
 */
export class HttpNarrativeAdapter implements NarrativeAdapter {
  constructor(
    private readonly endpoint: string,
    private readonly f: typeof fetch = (...a) => fetch(...a),
  ) {}
  async narrate(facts: NarrativeFacts, signal: AbortSignal): Promise<string> {
    const res = await this.f(this.endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(facts), signal });
    if (!res.ok) throw new Error(`narrator ${res.status}`);
    const body = (await res.json()) as { text?: unknown };
    if (typeof body.text !== 'string') throw new Error('narrator: bad response');
    return body.text;
  }
}

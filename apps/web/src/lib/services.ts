import { HttpNarrativeAdapter, SupabaseCloudAdapter, type CloudAdapter, type NarrativeAdapter } from '@project-life/services';

/**
 * Optional services are created on demand from what the player typed in. Everything is off by default, so a
 * fresh install makes no network request. The factories can be replaced (tests, other backends).
 */
export interface CloudConfig {
  url: string;
  anonKey: string;
}
export interface SignInCapable extends CloudAdapter {
  signIn(email: string, password: string): Promise<void>;
  signOut(): void;
  readonly signedIn: boolean;
}

let cloudFactory: (cfg: CloudConfig) => SignInCapable = (cfg) => new SupabaseCloudAdapter(cfg);
let narratorFactory: (endpoint: string) => NarrativeAdapter = (endpoint) => new HttpNarrativeAdapter(endpoint);

export const makeCloud = (cfg: CloudConfig): SignInCapable => cloudFactory(cfg);
export const makeNarrator = (endpoint: string): NarrativeAdapter => narratorFactory(endpoint);
export function setServiceFactories(f: { cloud?: typeof cloudFactory; narrator?: typeof narratorFactory }): void {
  if (f.cloud) cloudFactory = f.cloud;
  if (f.narrator) narratorFactory = f.narrator;
}

/** Non-secret preferences only (passwords and tokens are never stored). */
export function readPref(key: string): string {
  try {
    return localStorage.getItem(`pl-${key}`) ?? '';
  } catch {
    return '';
  }
}
export function writePref(key: string, value: string): void {
  try {
    if (value) localStorage.setItem(`pl-${key}`, value);
    else localStorage.removeItem(`pl-${key}`);
  } catch {
    /* preference not persisted */
  }
}

import { create } from 'zustand';
import { CORE_KEYS, LOCALES, translations, type LocaleCode, type LocaleInfo } from '@project-life/content';
import { t } from './it';

const KEY = 'pl-locale';

type Tree = { [k: string]: string | Tree };

const getPath = (obj: unknown, path: string): string | undefined => {
  let cur: unknown = obj;
  for (const part of path.split('.')) {
    if (typeof cur !== 'object' || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === 'string' ? cur : undefined;
};

const setPath = (obj: Tree, path: string, value: string): void => {
  const parts = path.split('.');
  let cur: Tree = obj;
  for (const part of parts.slice(0, -1)) cur = cur[part] as Tree;
  cur[parts[parts.length - 1] as string] = value;
};

/** The Italian source strings for the core keys, captured before any overlay is applied. */
const SOURCE: Record<string, string> = Object.fromEntries(CORE_KEYS.map((k) => [k, getPath(t, k) ?? '']));

export const localeInfo = (code: LocaleCode): LocaleInfo => LOCALES.find((l) => l.code === code) ?? (LOCALES[0] as LocaleInfo);

function readStored(): LocaleCode {
  try {
    const v = localStorage.getItem(KEY);
    if (v && LOCALES.some((l) => l.code === v)) return v as LocaleCode;
  } catch {
    /* storage unavailable: fall back to the source language */
  }
  return 'it';
}

/**
 * Overlays the core interface strings of a language onto the shared string table, so that every component
 * keeps reading `t.…`. Strings without a translation keep their Italian text (documented fallback).
 * The interface language is independent from the character's nationality.
 */
export function applyLocale(code: LocaleCode): void {
  const info = localeInfo(code);
  for (const k of CORE_KEYS) {
    const value = code === 'it' ? SOURCE[k] : (translations[code][k] ?? SOURCE[k]);
    setPath(t as unknown as Tree, k, value ?? '');
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = info.code;
    document.documentElement.dir = info.dir;
  }
}

interface LocaleStore {
  locale: LocaleCode;
  setLocale(code: LocaleCode): void;
}

export const useLocale = create<LocaleStore>((set) => ({
  locale: 'it',
  setLocale(code) {
    applyLocale(code);
    try {
      localStorage.setItem(KEY, code);
    } catch {
      /* the choice just will not persist */
    }
    set({ locale: code });
  },
}));

/** Applies the stored language before the first render. */
export function initLocale(): void {
  const code = readStored();
  applyLocale(code);
  useLocale.setState({ locale: code });
}

export const localeTag = (): string => localeInfo(useLocale.getState().locale).tag;

/** Country names come from the platform's region names in the interface language; GeoNames' English name is the fallback. */
export function regionName(code: string, fallback: string): string {
  try {
    return new Intl.DisplayNames([localeTag()], { type: 'region' }).of(code) ?? fallback;
  } catch {
    return fallback;
  }
}

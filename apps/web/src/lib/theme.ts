import { useEffect, useState, useSyncExternalStore } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';
const KEY = 'pl-theme';
const QUERY = '(prefers-color-scheme: dark)';

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

const systemPrefersDark = (): boolean => typeof matchMedia === 'function' && matchMedia(QUERY).matches;

function apply(choice: ThemeChoice): void {
  const dark = choice === 'dark' || (choice === 'system' && systemPrefersDark());
  document.documentElement.classList.toggle('dark', dark);
}

/**
 * The theme is app-wide state, not tied to any screen: one shared choice, and one operating-system
 * listener installed once, so "system" keeps following the OS whichever page is open.
 */
let choice: ThemeChoice = read();
const subscribers = new Set<() => void>();

if (typeof document !== 'undefined') {
  apply(choice);
  if (typeof matchMedia === 'function') {
    matchMedia(QUERY).addEventListener('change', () => {
      if (choice === 'system') apply('system');
    });
  }
}

function setChoice(next: ThemeChoice): void {
  try {
    if (next === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch {
    /* preference just won't persist */
  }
  choice = next;
  apply(next);
  subscribers.forEach((fn) => fn());
}

const subscribe = (fn: () => void): (() => void) => {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
};

export function useTheme(): [ThemeChoice, (c: ThemeChoice) => void] {
  return [useSyncExternalStore(subscribe, () => choice), setChoice];
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const up = (): void => setOnline(true);
    const down = (): void => setOnline(false);
    addEventListener('online', up);
    addEventListener('offline', down);
    return () => {
      removeEventListener('online', up);
      removeEventListener('offline', down);
    };
  }, []);
  return online;
}

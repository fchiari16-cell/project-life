import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** A controllable stand-in for the operating-system colour scheme (jsdom has no matchMedia). */
function fakeSystem(initialDark: boolean) {
  let dark = initialDark;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return dark;
    },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  }));
  return {
    set(next: boolean) {
      dark = next;
      listeners.forEach((fn) => fn());
    },
  };
}
const isDark = (): boolean => document.documentElement.classList.contains('dark');

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
  vi.resetModules();
});
afterEach(() => vi.unstubAllGlobals());

describe('theme', () => {
  it('"system" follows the operating system app-wide, with no component mounted', async () => {
    const os = fakeSystem(false);
    await import('./theme');
    expect(isDark()).toBe(false);
    os.set(true);
    expect(isDark()).toBe(true);
    os.set(false);
    expect(isDark()).toBe(false);
  });

  it('an explicit choice wins over the system, is remembered, and "system" is restored on request', async () => {
    const os = fakeSystem(false);
    const { useTheme } = await import('./theme');
    const { renderHook, act } = await import('@testing-library/react');
    const { result } = renderHook(() => useTheme());
    act(() => result.current[1]('dark'));
    expect(isDark()).toBe(true);
    expect(localStorage.getItem('pl-theme')).toBe('dark');
    os.set(false);
    expect(isDark()).toBe(true); // an explicit choice is not overridden by the OS
    act(() => result.current[1]('light'));
    expect(isDark()).toBe(false);
    act(() => result.current[1]('system'));
    expect(localStorage.getItem('pl-theme')).toBeNull();
    os.set(true);
    expect(isDark()).toBe(true);
    expect(result.current[0]).toBe('system');
  });

  it('every component using the hook sees the same choice', async () => {
    fakeSystem(false);
    const { useTheme } = await import('./theme');
    const { renderHook, act } = await import('@testing-library/react');
    const a = renderHook(() => useTheme());
    const b = renderHook(() => useTheme());
    act(() => a.result.current[1]('dark'));
    expect(b.result.current[0]).toBe('dark');
  });

  it('starts from the stored choice', async () => {
    fakeSystem(false);
    localStorage.setItem('pl-theme', 'dark');
    await import('./theme');
    expect(isDark()).toBe(true);
  });
});

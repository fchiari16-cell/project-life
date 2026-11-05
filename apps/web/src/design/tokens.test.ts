import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AREAS } from './areas';

const dir = __dirname;
const tokensCss = readFileSync(join(dir, 'tokens.css'), 'utf8');
const indexCss = readFileSync(join(dir, '..', 'index.css'), 'utf8');

type Vars = Record<string, string>;

/** Variables declared in the first rule whose selector is exactly `selector`. */
function block(css: string, selector: string): Vars {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(?:^|\\n)${esc}\\s*\\{([^}]*)\\}`).exec(css);
  if (!m) throw new Error(`rule not found: ${selector}`);
  const vars: Vars = {};
  for (const d of (m[1] ?? '').matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars[d[1]!] = d[2]!.trim();
  return vars;
}

const hex = (v: string): [number, number, number] => {
  const m = /^#([0-9a-f]{6})$/i.exec(v);
  if (!m) throw new Error(`not a #rrggbb colour: ${v}`);
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lum = ([r, g, b]: [number, number, number]): number => {
  const f = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
export const contrast = (a: string, b: string): number => {
  const [hi, lo] = [lum(hex(a)), lum(hex(b))].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

describe('contrast helper', () => {
  it('matches known WCAG values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
  });
});

for (const mode of ['light', 'dark'] as const) {
  describe(`PROJECT LIFE UI SYSTEM tokens (${mode})`, () => {
    const base: Vars = { ...block(indexCss, ':root'), ...(mode === 'dark' ? block(indexCss, '.dark') : {}) };
    const extra: Vars = { ...block(tokensCss, ':root'), ...(mode === 'dark' ? block(tokensCss, '.dark') : {}) };
    const all = { ...base, ...extra };
    const resolve = (v: string): string => {
      const ref = /^var\((--[\w-]+)\)$/.exec(v);
      return ref ? resolve(all[ref[1]!]!) : v;
    };
    const get = (name: string): string => resolve(all[name] ?? (() => { throw new Error(`missing ${name}`); })());

    it('base text pairs reach WCAG AA (4.5:1)', () => {
      for (const [fg, bg] of [
        ['--foreground', '--background'],
        ['--foreground', '--card'],
        ['--muted-foreground', '--card'],
        ['--muted-foreground', '--muted'],
        ['--primary-foreground', '--primary'],
        ['--primary', '--card'],
        ['--danger', '--card'],
        ['--success', '--card'],
        ['--stat-good', '--card'],
        ['--stat-warn', '--card'],
        ['--stat-bad', '--card'],
        ['--foreground', '--surface-2'],
        ['--foreground', '--surface-3'],
        ['--muted-foreground', '--surface-2'],
      ] as const) {
        expect(contrast(get(fg), get(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('focus ring is visible against every surface (≥ 3:1, WCAG 1.4.11)', () => {
      for (const bg of ['--background', '--card', '--surface-2']) expect(contrast(get('--ring'), get(bg)), bg).toBeGreaterThanOrEqual(3);
    });

    for (const area of AREAS) {
      it(`area "${area}": accent, ink and on-accent colours are all readable`, () => {
        const a = block(tokensCss, mode === 'dark' ? `.dark [data-area='${area}']` : `[data-area='${area}']`);
        const v = (n: string): string => resolve(a[n] ?? get(n));
        expect(contrast(v('--area'), get('--card')), 'accent text/icon on card').toBeGreaterThanOrEqual(4.5);
        expect(contrast(v('--area'), get('--background')), 'accent text/icon on page').toBeGreaterThanOrEqual(4.5);
        expect(contrast(v('--area-ink'), v('--area-soft')), 'ink on soft surface').toBeGreaterThanOrEqual(4.5);
        expect(contrast(v('--on-area'), v('--area')), 'text on solid accent').toBeGreaterThanOrEqual(4.5);
        expect(contrast(get('--foreground'), v('--area-soft')), 'body text on soft surface').toBeGreaterThanOrEqual(4.5);
      });
    }
  });
}

describe('token completeness', () => {
  it('every declared area exists in the CSS for light and dark, and nothing undeclared is themed', () => {
    const declared = [...tokensCss.matchAll(/^(?:\.dark )?\[data-area='([\w-]+)'\]/gm)].map((m) => m[1]!);
    expect([...new Set(declared)].sort()).toEqual([...AREAS].sort());
    for (const a of AREAS) {
      expect(tokensCss).toContain(`\n[data-area='${a}']`);
      expect(tokensCss).toContain(`\n.dark [data-area='${a}']`);
    }
  });

  it('defines the scales every component needs', () => {
    const t = block(tokensCss, ':root');
    for (const k of ['--text-base', '--space-4', '--radius-md', '--shadow-2', '--dur-base', '--target-min', '--z-modal']) expect(t[k], k).toBeDefined();
    expect(t['--target-min']).toBe('2.75rem');
  });

  it('keeps the reduced-motion override', () => {
    expect(indexCss).toContain('prefers-reduced-motion: reduce');
  });
});

import { describe, expect, it } from 'vitest';
import { Rng } from '../src/index';

describe('Rng', () => {
  it('is deterministic for the same seed', () => {
    const a = Rng.fromSeed('alpha');
    const b = Rng.fromSeed('alpha');
    expect(Array.from({ length: 50 }, () => a.nextU32())).toEqual(Array.from({ length: 50 }, () => b.nextU32()));
  });

  it('diverges for different seeds', () => {
    expect(Rng.fromSeed('alpha').nextU32()).not.toBe(Rng.fromSeed('beta').nextU32());
  });

  it('resumes the exact sequence from a serialised state', () => {
    const a = Rng.fromSeed('resume');
    for (let i = 0; i < 10; i++) a.nextU32();
    const restored = new Rng(JSON.parse(JSON.stringify(a.state())));
    expect(Array.from({ length: 20 }, () => restored.nextU32())).toEqual(Array.from({ length: 20 }, () => a.nextU32()));
  });

  it('keeps float in [0,1) and int within bounds', () => {
    const r = Rng.fromSeed('bounds');
    for (let i = 0; i < 5000; i++) {
      const f = r.float();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = r.int(-3, 4);
      expect(n).toBeGreaterThanOrEqual(-3);
      expect(n).toBeLessThanOrEqual(4);
    }
  });

  it('covers every value of a small range roughly uniformly', () => {
    const r = Rng.fromSeed('uniform');
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 8000; i++) counts[r.int(0, 3)]!++;
    for (const c of counts) expect(c).toBeGreaterThan(1700);
  });

  it('rejects invalid ranges', () => {
    expect(() => Rng.fromSeed('x').int(5, 1)).toThrow(RangeError);
    expect(() => Rng.fromSeed('x').pick([])).toThrow(RangeError);
  });
});

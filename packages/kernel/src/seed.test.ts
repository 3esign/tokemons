import { describe, expect, it } from 'vitest';
import { cellSeed, seedToFloat } from './seed.js';
import { sampleCell } from './sample-cell.js';
import { makeContext } from './context.js';

describe('seed', () => {
  it('is deterministic for same inputs', () => {
    const a = cellSeed(42, 1, 2, 3, 4, 0);
    const b = cellSeed(42, 1, 2, 3, 4, 0);
    expect(a).toBe(b);
  });

  it('differs when cell coords change', () => {
    expect(cellSeed(42, 1, 2, 3, 4)).not.toBe(cellSeed(42, 1, 2, 3, 5));
  });

  it('seedToFloat stays in unit range', () => {
    for (let i = 0; i < 100; i++) {
      const f = seedToFloat(cellSeed(1, i, 0, 0, 0));
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });
});

describe('sampleCell', () => {
  it('returns stable biome for fixed world position', () => {
    const ctx = makeContext(12345, 0, 0, 10, 10, 32);
    expect(sampleCell(ctx).biomeId).toBe(sampleCell(ctx).biomeId);
  });
});

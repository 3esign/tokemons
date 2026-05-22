/**
 * Deterministic seeds for world cells and procedural rolls.
 * Every spatial sample must derive from these - never unseeded Math.random().
 */

export function murmur64(
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f = 0
): number {
  let h = (a ^ (b << 13) ^ (c << 7) ^ (d << 17) ^ (e << 5) ^ (f << 9)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export function cellSeed(
  worldSeed: number,
  chunkX: number,
  chunkY: number,
  localX: number,
  localY: number,
  salt = 0
): number {
  return murmur64(worldSeed, chunkX, chunkY, localX, localY, salt);
}

/** Unit float in [0, 1) from integer seed */
export function seedToFloat(seed: number): number {
  return (seed >>> 0) / 0x1_0000_0000;
}

/** Integer in [min, max] inclusive */
export function seedToInt(seed: number, min: number, max: number): number {
  const t = seedToFloat(seed);
  return min + Math.floor(t * (max - min + 1));
}

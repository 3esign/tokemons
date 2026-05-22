import { cellSeed, seedToFloat } from './seed.js';

/** Lightweight value noise for biome fields (replace with Perlin in Phase 1) */
export function valueNoise2D(
  worldSeed: number,
  x: number,
  y: number,
  frequency: number
): number {
  const fx = Math.floor(x * frequency);
  const fy = Math.floor(y * frequency);
  const tx = x * frequency - fx;
  const ty = y * frequency - fy;

  const s00 = seedToFloat(cellSeed(worldSeed, fx, fy, 0, 0, 1));
  const s10 = seedToFloat(cellSeed(worldSeed, fx + 1, fy, 0, 0, 1));
  const s01 = seedToFloat(cellSeed(worldSeed, fx, fy + 1, 0, 0, 1));
  const s11 = seedToFloat(cellSeed(worldSeed, fx + 1, fy + 1, 0, 0, 1));

  const ux = tx * tx * (3 - 2 * tx);
  const uy = ty * ty * (3 - 2 * ty);
  const a = s00 + (s10 - s00) * ux;
  const b = s01 + (s11 - s01) * ux;
  return a + (b - a) * uy;
}

export function fbm2D(
  worldSeed: number,
  x: number,
  y: number,
  octaves: number,
  frequency: number,
  lacunarity = 2,
  gain = 0.5
): number {
  let amp = 1;
  let freq = frequency;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise2D(worldSeed, x, y, freq) * amp;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

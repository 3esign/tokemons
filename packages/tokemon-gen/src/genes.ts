import { seedToFloat, seedToInt } from '@tokemons/kernel';

export type BodyPlan =
  | 'biped'
  | 'quadruped'
  | 'serpent'
  | 'floating'
  | 'plant'
  | 'crystal'
  | 'blob'
  | 'insect'
  | 'avian'
  | 'fungal'
  | 'mech'
  | 'spectral'
  | 'crustacean';

export type TailType = 'none' | 'stub' | 'long' | 'fan' | 'spike' | 'club' | 'split' | 'feathered';
export type Pattern = 'solid' | 'spots' | 'stripes' | 'rings' | 'checkers' | 'gradient' | 'zigzag' | 'fractal' | 'camo';
export type Surface = 'smooth' | 'fluffy' | 'crystalline' | 'scaled' | 'void' | 'slimy' | 'metallic' | 'armored';

export interface TokemonGenes {
  seed: number;
  bodyPlan: BodyPlan;
  mass: number;
  elongation: number;
  roundness: number;
  limbCount: number;
  limbLength: number;
  symmetry: 'bilateral' | 'radial' | 'asymmetric';
  surface: Surface;
  paletteHue: number;
  paletteWarm: boolean;
  pattern: Pattern;
  hornCount: number;
  hornLength: number;
  tailType: TailType;
  wingSpan: number;
  eyeCount: number;
  eyeSize: number;
  hasShell: boolean;
  antennaCount: number;
  spikeCount: number;
  crownSize: number;
  offsetX: number;
  offsetY: number;
  aura: number;
  evolutionStage: number;
}

const PLANS: BodyPlan[] = [
  'biped',
  'quadruped',
  'serpent',
  'floating',
  'plant',
  'crystal',
  'blob',
  'insect',
  'avian',
  'fungal',
  'mech',
  'spectral',
  'crustacean',
];
const SURFACES: Surface[] = ['smooth', 'fluffy', 'crystalline', 'scaled', 'void', 'slimy', 'metallic', 'armored'];
const PATTERNS: Pattern[] = ['solid', 'spots', 'stripes', 'rings', 'checkers', 'gradient', 'zigzag', 'fractal', 'camo'];
const TAILS: TailType[] = ['none', 'stub', 'long', 'fan', 'spike', 'club', 'split', 'feathered'];

function hashSeed(seed: number, salt: number): number {
  let h = (seed ^ salt) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export function rollGenes(seed: number): TokemonGenes {
  const symRoll = seedToFloat(hashSeed(seed, 0x44));
  return {
    seed,
    bodyPlan: PLANS[seedToInt(hashSeed(seed, 0x11), 0, PLANS.length - 1)]!,
    mass: seedToFloat(hashSeed(seed, 0x22)),
    elongation: seedToFloat(hashSeed(seed, 0x23)),
    roundness: seedToFloat(hashSeed(seed, 0x24)),
    limbCount: seedToInt(hashSeed(seed, 0x33), 0, 8),
    limbLength: seedToFloat(hashSeed(seed, 0x34)),
    symmetry:
      symRoll > 0.92 ? 'asymmetric' : symRoll > 0.75 ? 'radial' : 'bilateral',
    surface: SURFACES[seedToInt(hashSeed(seed, 0x55), 0, SURFACES.length - 1)]!,
    paletteHue: seedToFloat(hashSeed(seed, 0x66)),
    paletteWarm: seedToFloat(hashSeed(seed, 0x67)) > 0.5,
    pattern: PATTERNS[seedToInt(hashSeed(seed, 0x77), 0, PATTERNS.length - 1)]!,
    hornCount: seedToInt(hashSeed(seed, 0x88), 0, 3),
    hornLength: seedToFloat(hashSeed(seed, 0x89)),
    tailType: TAILS[seedToInt(hashSeed(seed, 0x9a), 0, TAILS.length - 1)]!,
    wingSpan: seedToFloat(hashSeed(seed, 0x9b)),
    eyeCount: seedToInt(hashSeed(seed, 0x9c), 1, 3),
    eyeSize: 0.5 + seedToFloat(hashSeed(seed, 0x9d)) * 0.5,
    hasShell: seedToFloat(hashSeed(seed, 0x9e)) > 0.72,
    antennaCount: seedToInt(hashSeed(seed, 0x9f), 0, 4),
    spikeCount: seedToInt(hashSeed(seed, 0xa0), 0, 6),
    crownSize: seedToFloat(hashSeed(seed, 0xa1)),
    offsetX: (seedToFloat(hashSeed(seed, 0xa2)) - 0.5) * 0.4,
    offsetY: (seedToFloat(hashSeed(seed, 0xa3)) - 0.5) * 0.3,
    aura: seedToFloat(hashSeed(seed, 0xa4)) * 0.5,
    evolutionStage: 0,
  };
}

/** Fix saves created before expanded gene schema */
export function ensureGenes(partial: Partial<TokemonGenes> & { seed?: number }): TokemonGenes {
  const seed = partial.seed ?? 42;
  return { ...rollGenes(seed), ...partial, seed };
}

export function morphScale(stage: number): number {
  return 1 + stage * 0.08;
}

export function geneFingerprint(g: TokemonGenes): string {
  return [
    g.bodyPlan,
    g.pattern,
    g.surface,
    g.tailType,
    g.hornCount,
    g.eyeCount,
    Math.round(g.paletteHue * 9),
  ].join('-');
}

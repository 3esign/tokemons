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
  | 'fungal';

export type TailType = 'none' | 'stub' | 'long' | 'fan' | 'spike';
export type Pattern = 'solid' | 'spots' | 'stripes' | 'rings' | 'checkers' | 'gradient';
export type Surface = 'smooth' | 'fluffy' | 'crystalline' | 'scaled' | 'void';

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
];
const SURFACES: Surface[] = ['smooth', 'fluffy', 'crystalline', 'scaled', 'void'];
const PATTERNS: Pattern[] = ['solid', 'spots', 'stripes', 'rings', 'checkers', 'gradient'];
const TAILS: TailType[] = ['none', 'stub', 'long', 'fan', 'spike'];

export function rollGenes(seed: number): TokemonGenes {
  const symRoll = seedToFloat(seed ^ 0x44);
  return {
    seed,
    bodyPlan: PLANS[seedToInt(seed ^ 0x11, 0, PLANS.length - 1)]!,
    mass: seedToFloat(seed ^ 0x22),
    elongation: seedToFloat(seed ^ 0x23),
    roundness: seedToFloat(seed ^ 0x24),
    limbCount: seedToInt(seed ^ 0x33, 0, 8),
    limbLength: seedToFloat(seed ^ 0x34),
    symmetry:
      symRoll > 0.92 ? 'asymmetric' : symRoll > 0.75 ? 'radial' : 'bilateral',
    surface: SURFACES[seedToInt(seed ^ 0x55, 0, SURFACES.length - 1)]!,
    paletteHue: seedToFloat(seed ^ 0x66),
    paletteWarm: seedToFloat(seed ^ 0x67) > 0.5,
    pattern: PATTERNS[seedToInt(seed ^ 0x77, 0, PATTERNS.length - 1)]!,
    hornCount: seedToInt(seed ^ 0x88, 0, 3),
    hornLength: seedToFloat(seed ^ 0x89),
    tailType: TAILS[seedToInt(seed ^ 0x9a, 0, TAILS.length - 1)]!,
    wingSpan: seedToFloat(seed ^ 0x9b),
    eyeCount: seedToInt(seed ^ 0x9c, 1, 3),
    eyeSize: 0.5 + seedToFloat(seed ^ 0x9d) * 0.5,
    hasShell: seedToFloat(seed ^ 0x9e) > 0.72,
    antennaCount: seedToInt(seed ^ 0x9f, 0, 4),
    spikeCount: seedToInt(seed ^ 0xa0, 0, 6),
    crownSize: seedToFloat(seed ^ 0xa1),
    offsetX: (seedToFloat(seed ^ 0xa2) - 0.5) * 0.4,
    offsetY: (seedToFloat(seed ^ 0xa3) - 0.5) * 0.3,
    aura: seedToFloat(seed ^ 0xa4) * 0.5,
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

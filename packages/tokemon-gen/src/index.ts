export * from './genes.js';
export { ensureGenes } from './genes.js';
export * from './names.js';
export * from './bake-sprite.js';

export interface TokemonInstance {
  genes: import('./genes.js').TokemonGenes;
  name: string;
  description: string;
}

import { rollGenes } from './genes.js';
import { generateDescription, generateName } from './names.js';

export function createTokemon(seed: number): TokemonInstance {
  const genes = rollGenes(seed);
  return {
    genes,
    name: generateName(seed),
    description: generateDescription(genes),
  };
}

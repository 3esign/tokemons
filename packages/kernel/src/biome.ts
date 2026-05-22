export type BiomeId =
  | 'ocean'
  | 'coast'
  | 'meadow'
  | 'deep_forest'
  | 'mountain'
  | 'wetland'
  | 'desert'
  | 'snowfield'
  | 'crystal_fields'
  | 'ancient_ruins'
  | 'urban_fringe'
  | 'town_core';

export interface ClimateSample {
  elevation: number;
  moisture: number;
  temperature: number;
}

export function classifyBiome(c: ClimateSample): BiomeId {
  if (c.elevation < 0.35) return 'ocean';
  if (c.elevation < 0.42) return 'coast';
  if (c.elevation > 0.84 && c.temperature < 0.42) return 'snowfield';
  if (c.elevation > 0.82 && c.moisture < 0.42) return 'crystal_fields';
  if (c.temperature > 0.72 && c.moisture < 0.34) return 'desert';
  if (c.moisture > 0.7 && c.temperature > 0.45) return 'deep_forest';
  if (c.moisture > 0.55 && c.temperature < 0.4) return 'wetland';
  if (c.elevation > 0.78) return 'mountain';
  if (c.temperature > 0.6 && c.moisture < 0.35) return 'urban_fringe';
  return 'meadow';
}

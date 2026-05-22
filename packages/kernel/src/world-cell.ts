import type { BiomeId } from './biome.js';

export type TerrainStyle =
  | 'meadow'
  | 'deep_forest'
  | 'coast'
  | 'mountain'
  | 'wetland'
  | 'desert'
  | 'snowfield'
  | 'crystal_fields'
  | 'ancient_ruins'
  | 'urban_fringe'
  | 'town_core';

export type PropId =
  | 'none'
  | 'grass'
  | 'flower'
  | 'tree'
  | 'rock'
  | 'sign'
  | 'reeds'
  | 'mushroom'
  | 'cactus'
  | 'crystal'
  | 'ruin'
  | 'lamp'
  | 'snowdrift'
  | 'shell'
  | 'tall_grass'
  | 'fern'
  | 'bush'
  | 'berry_bush'
  | 'vine'
  | 'lily'
  | 'scrub'
  | 'pine'
  | 'blossom'
  | 'flower_patch'
  | 'rune_stone'
  | 'obelisk'
  | 'fountain';

export interface WorldCell {
  elevation: number;
  moisture: number;
  temperature: number;
  vegetation: number;
  weirdness: number;
  settlement: number;
  road: boolean;
  biomeId: BiomeId;
  terrainStyle: TerrainStyle;
  groundTileId: number;
  propId: PropId;
  walkable: boolean;
}

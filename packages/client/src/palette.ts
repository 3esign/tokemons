import type { PropId } from '@tokemons/kernel';

/** Game Boy DMG + Yellow warm tint (4 shades) */
export const GB = {
  lightest: 0xe8f0d0,
  light: 0x9bbc0f,
  dark: 0x306230,
  darkest: 0x0f380f,
} as const;

export const BIOME_COLORS: Record<string, number> = {
  ocean: GB.darkest,
  coast: GB.dark,
  meadow: GB.light,
  deep_forest: GB.darkest,
  mountain: GB.dark,
  wetland: GB.dark,
  desert: GB.lightest,
  snowfield: GB.lightest,
  crystal_fields: GB.lightest,
  ancient_ruins: GB.dark,
  urban_fringe: GB.light,
  town_core: GB.lightest,
};

export const PROP_COLORS: Record<PropId, number | null> = {
  none: null,
  grass: GB.dark,
  flower: GB.lightest,
  tree: GB.darkest,
  rock: GB.dark,
  sign: GB.darkest,
  reeds: GB.dark,
  mushroom: GB.lightest,
  cactus: GB.dark,
  crystal: GB.lightest,
  ruin: GB.darkest,
  lamp: GB.lightest,
  snowdrift: GB.lightest,
  shell: GB.lightest,
  tall_grass: GB.dark,
  fern: GB.darkest,
  bush: GB.dark,
  berry_bush: GB.darkest,
  vine: GB.darkest,
  lily: GB.lightest,
  scrub: GB.dark,
  pine: GB.darkest,
  blossom: GB.lightest,
  flower_patch: GB.lightest,
  rune_stone: GB.darkest,
  obelisk: GB.darkest,
  fountain: GB.lightest,
};

export const TILE_VARIANTS = [0, 1, 2, 3];

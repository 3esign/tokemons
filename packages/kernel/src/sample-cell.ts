import { classifyBiome } from './biome.js';
import type { EvalContext } from './context.js';
import { fbm2D } from './noise.js';
import { cellSeed, seedToFloat, seedToInt } from './seed.js';
import type { PropId, TerrainStyle, WorldCell } from './world-cell.js';
import type { BiomeId } from './biome.js';

function terrainStyleForBiome(b: BiomeId): TerrainStyle {
  if (b === 'town_core' || b === 'urban_fringe') return b;
  if (b === 'deep_forest') return 'deep_forest';
  if (b === 'coast' || b === 'ocean') return 'coast';
  if (b === 'mountain') return 'mountain';
  if (b === 'wetland') return 'wetland';
  if (b === 'desert') return 'desert';
  if (b === 'snowfield') return 'snowfield';
  if (b === 'crystal_fields') return 'crystal_fields';
  if (b === 'ancient_ruins') return 'ancient_ruins';
  return 'meadow';
}

function rollProp(
  worldSeed: number,
  ctx: EvalContext,
  biomeId: BiomeId,
  moisture: number,
  vegetation: number
): PropId {
  const s = cellSeed(worldSeed, ctx.chunkX, ctx.chunkY, ctx.localX, ctx.localY, 7);
  const r = seedToFloat(s);
  if (biomeId === 'ocean') return 'none';
  if (biomeId === 'coast' && r > 0.9) return 'shell';
  if (biomeId === 'town_core' && r > 0.88) return r > 0.97 ? 'fountain' : r > 0.94 ? 'lamp' : 'sign';
  if (biomeId === 'urban_fringe' && r > 0.86) return r > 0.95 ? 'fountain' : r > 0.9 ? 'lamp' : 'sign';
  if (biomeId === 'ancient_ruins' && r > 0.64) return r > 0.92 ? 'obelisk' : r > 0.84 ? 'rune_stone' : r > 0.74 ? 'crystal' : 'ruin';
  if (biomeId === 'crystal_fields' && r > 0.66) return r > 0.93 ? 'obelisk' : 'crystal';
  if (biomeId === 'desert' && r > 0.76) return r > 0.94 ? 'rock' : r > 0.86 ? 'cactus' : 'scrub';
  if (biomeId === 'snowfield' && r > 0.76) return r > 0.94 ? 'pine' : r > 0.86 ? 'rock' : 'snowdrift';
  if (biomeId === 'wetland' && r > 0.58 + vegetation * 0.18) return r > 0.88 ? 'lily' : 'reeds';
  if (biomeId === 'mountain' && r > 0.88) return 'rock';
  if (biomeId === 'deep_forest' && r > 0.46 + vegetation * 0.2) {
    if (r > 0.94) return 'mushroom';
    if (r > 0.84) return 'tree';
    if (r > 0.74) return 'fern';
    if (r > 0.64) return 'vine';
    return 'bush';
  }
  if (biomeId === 'meadow' && r > 0.62 + vegetation * 0.16) {
    if (r > 0.96) return 'flower_patch';
    if (r > 0.94) return 'flower';
    if (r > 0.86) return 'blossom';
    if (r > 0.76) return 'berry_bush';
    return 'tall_grass';
  }
  if (moisture > 0.55 && r > 0.78) return vegetation > 0.62 ? 'fern' : 'grass';
  if (r > 0.97) return 'flower';
  return 'none';
}

/** MVP cell sampler - will be driven by .tokemongh graphs later */
export function sampleCell(ctx: EvalContext): WorldCell {
  const { worldSeed, worldX, worldY } = ctx;
  const elevation = fbm2D(worldSeed, worldX, worldY, 5, 0.008);
  const moisture = fbm2D(worldSeed, worldX + 999, worldY, 4, 0.012);
  const weirdness = fbm2D(worldSeed, worldX - 701, worldY + 317, 4, 0.01);
  const settlement = fbm2D(worldSeed, worldX + 4050, worldY - 2130, 3, 0.018);
  const vegetation = fbm2D(worldSeed, worldX - 2200, worldY + 810, 5, 0.055);
  const temperature =
    1 -
    Math.abs(worldY * 0.002) * 0.3 +
    fbm2D(worldSeed, worldX, worldY + 500, 3, 0.015) * 0.4;

  let biomeId = classifyBiome({
    elevation,
    moisture,
    temperature: Math.max(0, Math.min(1, temperature)),
  });

  const roadPhaseX = (((worldX + Math.floor(worldY * 0.23)) % 31) + 31) % 31;
  const roadPhaseY = (((worldY - Math.floor(worldX * 0.17)) % 37) + 37) % 37;
  const road = settlement > 0.66 && (roadPhaseX === 15 || roadPhaseY === 18);
  if (biomeId !== 'ocean' && elevation > 0.46 && weirdness > 0.72) biomeId = 'ancient_ruins';
  if (biomeId !== 'ocean' && elevation > 0.43 && settlement > 0.78) {
    biomeId = road || settlement > 0.86 ? 'town_core' : 'urban_fringe';
  }

  const terrainStyle = terrainStyleForBiome(biomeId);
  const groundTileId = road && biomeId !== 'ocean'
    ? 5
    : seedToInt(
        cellSeed(worldSeed, ctx.chunkX, ctx.chunkY, ctx.localX, ctx.localY, 3),
        0,
        5
      );
  const propId = road ? 'none' : rollProp(worldSeed, ctx, biomeId, moisture, vegetation);
  const walkable =
    biomeId !== 'ocean' &&
    propId !== 'tree' &&
    propId !== 'rock' &&
    propId !== 'crystal' &&
    propId !== 'cactus' &&
    propId !== 'ruin' &&
    propId !== 'rune_stone' &&
    propId !== 'obelisk' &&
    propId !== 'fountain' &&
    propId !== 'pine';

  return {
    elevation,
    moisture,
    temperature: Math.max(0, Math.min(1, temperature)),
    vegetation,
    weirdness,
    settlement,
    road,
    biomeId,
    terrainStyle,
    groundTileId,
    propId,
    walkable,
  };
}

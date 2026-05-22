import Phaser from 'phaser';
import { makeContext, sampleCell, cellSeed, seedToFloat } from '@tokemons/kernel';
import type { WorldCell } from '@tokemons/kernel';
import { PROP_COLORS } from '../palette.js';
import type { GameRuntime } from './state.js';
import { blockKey } from './state.js';

// Modular Renderer Imports
import { drawGroundTile } from './render/ground.js';
import { drawGroundDetails } from './render/details.js';
import { drawProp } from './render/props.js';
import { drawDreamOverlays } from './render/dream.js';
import { getBuildPart } from './build-catalog.js';
import { drawBuildBlock } from './render/buildings.js';

const CHUNK = 32;

export function getCell(rt: GameRuntime, wx: number, wy: number): WorldCell {
  const chunkX = Math.floor(wx / CHUNK);
  const chunkY = Math.floor(wy / CHUNK);
  const localX = ((wx % CHUNK) + CHUNK) % CHUNK;
  const localY = ((wy % CHUNK) + CHUNK) % CHUNK;
  return sampleCell(
    makeContext(rt.worldSeed, chunkX, chunkY, localX, localY, CHUNK)
  );
}

export function findNearestWalkable(rt: GameRuntime, startX: number = 0, startY: number = 0): { x: number; y: number } {
  const startCell = getCell(rt, startX, startY);
  if (startCell.biomeId !== 'ocean' && startCell.walkable) {
    return { x: startX, y: startY };
  }
  for (let r = 1; r <= 200; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const wx = startX + dx;
        const wy = startY + dy;
        const cell = getCell(rt, wx, wy);
        if (cell.biomeId !== 'ocean' && cell.walkable) {
          return { x: wx, y: wy };
        }
      }
    }
  }
  return { x: startX, y: startY };
}


export function drawWorld(
  g: Phaser.GameObjects.Graphics,
  rt: GameRuntime,
  camX: number,
  camY: number,
  viewW: number,
  viewH: number,
  tilePx: number,
  timeMs: number
): WorldCell {
  g.clear();

  // =========================================================================
  // SUB-TILE SMOOTH SCROLLING COMPUTATIONS
  // =========================================================================
  const camFloorX = Math.floor(camX);
  const camFloorY = Math.floor(camY);
  const fracX = camX - camFloorX;
  const fracY = camY - camFloorY;

  // Render an extra 1-cell padding margin on all sides to prevent pop-in during movement
  const startX = camFloorX - Math.floor(viewW / 2) - 1;
  const startY = camFloorY - Math.floor(viewH / 2) - 1;
  const drawCellsW = viewW + 2;
  const drawCellsH = viewH + 2;
  const cellCache = new Map<string, WorldCell>();
  const cellAt = (wx: number, wy: number): WorldCell => {
    const key = blockKey(wx, wy);
    let cell = cellCache.get(key);
    if (!cell) {
      cell = getCell(rt, wx, wy);
      cellCache.set(key, cell);
    }
    return cell;
  };
  const rollAt = (wx: number, wy: number, salt: number): number => {
    const chunkX = Math.floor(wx / CHUNK);
    const chunkY = Math.floor(wy / CHUNK);
    const localX = ((wx % CHUNK) + CHUNK) % CHUNK;
    const localY = ((wy % CHUNK) + CHUNK) % CHUNK;
    return seedToFloat(cellSeed(rt.worldSeed, chunkX, chunkY, localX, localY, salt));
  };

  let centerCell = cellAt(camFloorX, camFloorY);

  for (let ty = 0; ty < drawCellsH; ty++) {
    for (let tx = 0; tx < drawCellsW; tx++) {
      const wx = startX + tx;
      const wy = startY + ty;
      
      // Calculate smooth pixel coordinates with fractional sub-tile offsets
      const drawX = (tx - 1 - fracX) * tilePx;
      const drawY = (ty - 1 - fracY) * tilePx;

      const cell = cellAt(wx, wy);
      
      // Track center viewport coordinate cell for state checks
      if (wx === camFloorX && wy === camFloorY) {
        centerCell = cell;
      }

      // Retrieve neighbor cell data for 3D stepped relief shadow borders
      const cellEast = cellAt(wx + 1, wy);
      const cellSouth = cellAt(wx, wy + 1);
      const cellWest = cellAt(wx - 1, wy);
      const cellNorth = cellAt(wx, wy - 1);

      // =========================================================================
      // MODULE 1: Ground Tiles & 3D Cliff Elevation Shadows
      // =========================================================================
      drawGroundTile(g, cell, drawX, drawY, tilePx, cellEast, cellSouth, cellWest, cellNorth);

      // =========================================================================
      // MODULE 2: Ground Noise & Micro-textures Details
      // =========================================================================
      const cellRand1 = rollAt(wx, wy, 9);
      const cellRand2 = rollAt(wx, wy, 17);
      const cellRand3 = rollAt(wx, wy, 25);

      drawGroundDetails(g, cell, drawX, drawY, tilePx, cellRand1, cellRand2, cellRand3, timeMs);

      // =========================================================================
      // MODULE 3: Environment Decorative Props (Dynamic sway)
      // =========================================================================
      const propColor = PROP_COLORS[cell.propId];
      if (propColor != null && cell.propId !== 'none') {
        drawProp(g, cell, drawX, drawY, tilePx, propColor, timeMs);
      }

      // =========================================================================
      // Placed Blocks Overlay
      // =========================================================================
      const bk = blockKey(wx, wy);
      const blockId = rt.placedBlocks.get(bk);
      if (blockId != null) {
        drawBuildBlock(g, blockId, drawX, drawY, tilePx, timeMs);
      }
    }
  }

  // =========================================================================
  // MODULE 4: Floating Dream Wisps & Windy Currents (Dream Overlay)
  // =========================================================================
  drawDreamOverlays(g, rt, camX, camY, viewW, viewH, tilePx, timeMs);

  return centerCell;
}

export function isWalkable(rt: GameRuntime, wx: number, wy: number): boolean {
  const blockId = rt.placedBlocks.get(blockKey(wx, wy));
  if (blockId != null) return getBuildPart(blockId).walkable;
  return getCell(rt, wx, wy).walkable;
}

import Phaser from 'phaser';
import type { WorldCell } from '@tokemons/kernel';
import { BIOME_COLORS, GB, TILE_VARIANTS } from '../../palette.js';

export const DMG_SHADES = [GB.lightest, GB.light, GB.dark, GB.darkest];

export function stepShade(baseColor: number, step: number): number {
  let idx = 0;
  let minDiff = Infinity;
  const baseC = Phaser.Display.Color.ValueToColor(baseColor);
  
  for (let i = 0; i < DMG_SHADES.length; i++) {
    const sC = Phaser.Display.Color.ValueToColor(DMG_SHADES[i]);
    const diff =
      Math.abs(baseC.red - sC.red) +
      Math.abs(baseC.green - sC.green) +
      Math.abs(baseC.blue - sC.blue);
    if (diff < minDiff) {
      minDiff = diff;
      idx = i;
    }
  }
  
  const targetIdx = Math.max(0, Math.min(3, idx + step));
  return DMG_SHADES[targetIdx];
}

export function drawGroundTile(
  g: Phaser.GameObjects.Graphics,
  cell: WorldCell,
  drawX: number,
  drawY: number,
  tilePx: number,
  cellEast: WorldCell | null,
  cellSouth: WorldCell | null,
  cellWest: WorldCell | null,
  cellNorth: WorldCell | null
): void {
  const base = BIOME_COLORS[cell.biomeId] ?? GB.light;
  const variant = TILE_VARIANTS[cell.groundTileId] ?? 0;
  const shade = cell.groundTileId === 5 ? GB.dark : stepShade(base, variant);

  // Fill base tile rectangle - note the + 0.5 overlap to eliminate sub-pixel seams
  g.fillStyle(shade, 1);
  g.fillRect(drawX, drawY, tilePx + 0.5, tilePx + 0.5);

  // Helper to retrieve neighbor biome base color
  const getNeighborColor = (n: WorldCell | null): number | null => {
    if (!n) return null;
    return n.groundTileId === 5 ? GB.dark : (BIOME_COLORS[n.biomeId] ?? GB.light);
  };

  // Helper to draw a beautiful 2x2 retro pixel checkerboard dither transition
  const drawDither = (nx: number, ny: number, width: number, height: number, color: number, pattern: 'N' | 'S' | 'W' | 'E') => {
    g.fillStyle(color, 1);
    const pxSize = 2; // 2x2 screen pixels matches our trainer sprite retro scale
    for (let py = 0; py < height; py += pxSize) {
      for (let px = 0; px < width; px += pxSize) {
        const rx = px / pxSize;
        const ry = py / pxSize;
        let shouldDraw = false;
        
        if (pattern === 'N') {
          // North border: blend from top (py=0 dense) to bottom (py=height sparse)
          if (ry === 0) shouldDraw = (rx % 2 === 0);
          else if (ry === 1) shouldDraw = (rx % 2 === 1);
        } else if (pattern === 'S') {
          // South border: blend from bottom (py=1 dense) to top (py=0 sparse)
          if (ry === 1) shouldDraw = (rx % 2 === 0);
          else if (ry === 0) shouldDraw = (rx % 2 === 1);
        } else if (pattern === 'W') {
          // West border: blend from left (px=0 dense) to right (px=1 sparse)
          if (rx === 0) shouldDraw = (ry % 2 === 0);
          else if (rx === 1) shouldDraw = (ry % 2 === 1);
        } else if (pattern === 'E') {
          // East border: blend from right (px=1 dense) to left (px=0 sparse)
          if (rx === 1) shouldDraw = (ry % 2 === 0);
          else if (rx === 0) shouldDraw = (ry % 2 === 1);
        }
        
        if (shouldDraw) {
          g.fillRect(nx + px, ny + py, pxSize, pxSize);
        }
      }
    }
  };

  // =========================================================================
  // ORGANIC BIOME TRANSITIONS (Checkerboard Dithering)
  // =========================================================================
  const colorN = getNeighborColor(cellNorth);
  if (colorN !== null && cellNorth && (cellNorth.biomeId !== cell.biomeId || (cellNorth.groundTileId === 5) !== (cell.groundTileId === 5))) {
    drawDither(drawX, drawY, tilePx, 4, colorN, 'N');
  }

  const colorS = getNeighborColor(cellSouth);
  if (colorS !== null && cellSouth && (cellSouth.biomeId !== cell.biomeId || (cellSouth.groundTileId === 5) !== (cell.groundTileId === 5))) {
    drawDither(drawX, drawY + tilePx - 4, tilePx, 4, colorS, 'S');
  }

  const colorW = getNeighborColor(cellWest);
  if (colorW !== null && cellWest && (cellWest.biomeId !== cell.biomeId || (cellWest.groundTileId === 5) !== (cell.groundTileId === 5))) {
    drawDither(drawX, drawY, 4, tilePx, colorW, 'W');
  }

  const colorE = getNeighborColor(cellEast);
  if (colorE !== null && cellEast && (cellEast.biomeId !== cell.biomeId || (cellEast.groundTileId === 5) !== (cell.groundTileId === 5))) {
    drawDither(drawX + tilePx - 4, drawY, 4, tilePx, colorE, 'E');
  }

  // Draw uniform path overlays Snapped to strict GB DMG shades
  if (cell.groundTileId === 5) {
    g.fillStyle(GB.dark, 1);
    g.fillRect(drawX, drawY + Math.floor(tilePx / 2), tilePx + 0.5, 1);
  }

  // =========================================================================
  // 3D Height Relief & Cliff Shadow Ledges - Removed to eliminate grid lines as requested by the user
  // =========================================================================
}

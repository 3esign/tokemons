import Phaser from 'phaser';
import type { WorldCell } from '@tokemons/kernel';
import { stepShade } from './ground.js';
import { BIOME_COLORS, GB } from '../../palette.js';

export function drawGroundDetails(
  g: Phaser.GameObjects.Graphics,
  cell: WorldCell,
  drawX: number,
  drawY: number,
  tilePx: number,
  cellRand1: number,
  cellRand2: number,
  cellRand3: number,
  timeMs: number
): void {
  const base = BIOME_COLORS[cell.biomeId] ?? GB.light;

  if (
    cell.biomeId === 'meadow' ||
    cell.biomeId === 'deep_forest' ||
    cell.biomeId === 'wetland' ||
    cell.biomeId === 'town_core' ||
    cell.biomeId === 'urban_fringe' ||
    cell.biomeId === 'ancient_ruins'
  ) {
    if (cellRand1 > 0.45) {
      // Lush grass cluster drawn in strict stepped DMG shade
      const grassColor = stepShade(base, 1);
      g.fillStyle(grassColor, 1);
      const px = 2 + Math.floor(cellRand2 * (tilePx - 6));
      const py = 3 + Math.floor(cellRand3 * (tilePx - 7));
      g.fillRect(drawX + px, drawY + py, 1, 4);
      g.fillRect(drawX + px - 1, drawY + py + 1, 1, 3);
      g.fillRect(drawX + px + 1, drawY + py + 2, 1, 2);
    }
  } else if (cell.biomeId === 'desert' || cell.biomeId === 'coast') {
    if (cellRand1 > 0.5) {
      // Fine sand ripple segment drawn in strict stepped DMG shade
      const rippleColor = stepShade(base, 1);
      g.fillStyle(rippleColor, 1);
      const px = 1 + Math.floor(cellRand2 * (tilePx - 6));
      const py = 2 + Math.floor(cellRand3 * (tilePx - 4));
      g.fillRect(drawX + px, drawY + py, 3, 1);
      g.fillRect(drawX + px + 1, drawY + py + 1, 2, 1);
    }
  } else if (cell.biomeId === 'snowfield') {
    if (cellRand1 > 0.5) {
      // Tiny shimmery snowflake sparkle
      const shimmerColor = stepShade(base, cellRand1 > 0.75 ? 1 : 2);
      const shimmerAlpha = 0.4 + 0.6 * Math.abs(Math.sin(timeMs * 0.003 + cellRand1 * 10));
      
      g.fillStyle(shimmerColor, shimmerAlpha);
      const px = 2 + Math.floor(cellRand2 * (tilePx - 4));
      const py = 2 + Math.floor(cellRand3 * (tilePx - 4));
      g.fillRect(drawX + px, drawY + py, 1, 1);
      g.fillRect(drawX + px - 1, drawY + py, 3, 1);
      g.fillRect(drawX + px, drawY + py - 1, 1, 3);
    }
  } else if (cell.biomeId === 'ocean') {
    if (cellRand1 > 0.6) {
      // Water wave ripple drawn in strict stepped DMG shade (steps up to lighter green)
      const waveColor = stepShade(base, -1);
      g.fillStyle(waveColor, 0.85);
      const px = 2 + Math.floor(cellRand2 * (tilePx - 7));
      const py = 2 + Math.floor(cellRand3 * (tilePx - 5));
      const swayOffset = Math.sin(timeMs * 0.002 + cellRand1 * 6) * 1.5;
      const animX = drawX + px + swayOffset;

      g.fillRect(animX, drawY + py, 2, 1);
      g.fillRect(animX + 2, drawY + py + 1, 3, 1);
      g.fillRect(animX + 5, drawY + py, 2, 1);
    }
  }
}


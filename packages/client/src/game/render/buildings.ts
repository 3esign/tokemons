import Phaser from 'phaser';
import { GB } from '../../palette.js';
import { getBuildPart } from '../build-catalog.js';

export function drawBuildBlock(
  g: Phaser.GameObjects.Graphics,
  blockId: number,
  drawX: number,
  drawY: number,
  tilePx: number,
  timeMs: number
): void {
  const part = getBuildPart(blockId);
  const bigKeys = new Set(['cottage', 'hall', 'tower', 'shrine', 'well']);
  const scale = bigKeys.has(part.key) ? 1.45 : part.key === 'fence' ? 1.2 : 1;
  const originX = drawX + tilePx / 2;
  const baseY = drawY + tilePx;
  const x = originX - (tilePx * scale) / 2;
  const y = baseY - tilePx * scale;
  const size = tilePx * scale;
  drawPlacedShadow(g, drawX, drawY, tilePx);

  switch (part.key) {
    case 'path':
      drawPath(g, drawX, drawY, tilePx);
      break;
    case 'plaza':
      drawPlaza(g, drawX, drawY, tilePx);
      break;
    case 'cottage':
      drawCottage(g, x, y, size);
      break;
    case 'hall':
      drawHall(g, x, y, size);
      break;
    case 'tower':
      drawTower(g, x, y, size);
      break;
    case 'shrine':
      drawShrine(g, x, y, size, timeMs);
      break;
    case 'farm':
      drawFarm(g, drawX, drawY, tilePx, timeMs);
      break;
    case 'fence':
      drawFence(g, x, y + size - tilePx * scale, size);
      break;
    case 'well':
      drawWell(g, x, y, size, timeMs);
      break;
    default:
      drawPath(g, drawX, drawY, tilePx);
      break;
  }
}

function drawPlacedShadow(g: Phaser.GameObjects.Graphics, x: number, y: number, tilePx: number): void {
  g.fillStyle(GB.darkest, 0.25);
  g.fillRect(x + 1, y + tilePx - 3, tilePx - 2, 3);
}

function drawPath(g: Phaser.GameObjects.Graphics, x: number, y: number, tilePx: number): void {
  g.fillStyle(GB.dark, 1);
  g.fillRect(x, y + 5, tilePx, 6);
  g.fillStyle(GB.light, 1);
  g.fillRect(x + 2, y + 6, 3, 2);
  g.fillRect(x + 8, y + 8, 4, 2);
  g.fillRect(x + 13, y + 6, 2, 2);
}

function drawPlaza(g: Phaser.GameObjects.Graphics, x: number, y: number, tilePx: number): void {
  g.fillStyle(GB.dark, 1);
  g.fillRect(x, y + 1, tilePx, tilePx - 2);
  g.fillStyle(GB.light, 1);
  for (let py = 2; py < tilePx - 2; py += 5) {
    g.fillRect(x + 1, y + py, tilePx - 2, 1);
  }
  for (let px = 4; px < tilePx; px += 5) {
    g.fillRect(x + px, y + 2, 1, tilePx - 4);
  }
}

function drawCottage(g: Phaser.GameObjects.Graphics, x: number, y: number, tilePx: number): void {
  const s = tilePx / 16;
  const top = y - 5 * s;
  g.fillStyle(GB.darkest, 1);
  g.fillTriangle(x, y + 4 * s, x + tilePx / 2, top, x + tilePx, y + 4 * s);
  g.fillStyle(GB.dark, 1);
  g.fillRect(x + 2 * s, y + 4 * s, tilePx - 4 * s, 11 * s);
  g.fillStyle(GB.light, 1);
  g.fillTriangle(x + 2 * s, y + 4 * s, x + tilePx / 2, top + 3 * s, x + tilePx - 2 * s, y + 4 * s);
  g.fillStyle(GB.darkest, 1);
  g.fillRect(x + 7 * s, y + 9 * s, 3 * s, 6 * s);
  g.fillRect(x + 3 * s, y + 7 * s, 3 * s, 3 * s);
  g.fillRect(x + 11 * s, y + 7 * s, 2 * s, 3 * s);
}

function drawHall(g: Phaser.GameObjects.Graphics, x: number, y: number, tilePx: number): void {
  const s = tilePx / 16;
  const top = y - 7 * s;
  g.fillStyle(GB.darkest, 1);
  g.fillRect(x + s, y + 4 * s, tilePx - 2 * s, 11 * s);
  g.fillTriangle(x - s, y + 4 * s, x + tilePx / 2, top, x + tilePx + s, y + 4 * s);
  g.fillStyle(GB.light, 1);
  g.fillTriangle(x + s, y + 4 * s, x + tilePx / 2, top + 2 * s, x + tilePx - s, y + 4 * s);
  g.fillStyle(GB.dark, 1);
  g.fillRect(x + 2 * s, y + 5 * s, tilePx - 4 * s, 9 * s);
  g.fillStyle(GB.darkest, 1);
  g.fillRect(x + 6 * s, y + 8 * s, 4 * s, 6 * s);
  g.fillRect(x + 3 * s, y + 7 * s, 2 * s, 2 * s);
  g.fillRect(x + 11 * s, y + 7 * s, 2 * s, 2 * s);
}

function drawTower(g: Phaser.GameObjects.Graphics, x: number, y: number, tilePx: number): void {
  const s = tilePx / 16;
  const top = y - 10 * s;
  g.fillStyle(GB.darkest, 1);
  g.fillRect(x + 4 * s, y - 2 * s, 8 * s, 17 * s);
  g.fillTriangle(x + 2 * s, y - 2 * s, x + tilePx / 2, top, x + tilePx - 2 * s, y - 2 * s);
  g.fillStyle(GB.dark, 1);
  g.fillRect(x + 5 * s, y - s, 6 * s, 15 * s);
  g.fillStyle(GB.light, 1);
  g.fillTriangle(x + 4 * s, y - 2 * s, x + tilePx / 2, top + 3 * s, x + tilePx - 4 * s, y - 2 * s);
  g.fillStyle(GB.darkest, 1);
  g.fillRect(x + 7 * s, y + 3 * s, 2 * s, 3 * s);
  g.fillRect(x + 7 * s, y + 10 * s, 2 * s, 5 * s);
}

function drawShrine(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  tilePx: number,
  timeMs: number
): void {
  const s = tilePx / 16;
  const pulse = Math.sin(timeMs * 0.006) > 0 ? 1 : 0;
  g.fillStyle(GB.darkest, 1);
  g.fillRect(x + 3 * s, y + s, 10 * s, 14 * s);
  g.fillStyle(GB.dark, 1);
  g.fillRect(x + 5 * s, y + 4 * s, 6 * s, 11 * s);
  g.fillStyle(GB.light, 1);
  g.fillRect(x + 4 * s, y + s, 8 * s, 3 * s);
  g.fillStyle(GB.lightest, 0.85);
  g.fillRect(x + 7 * s, y + 6 * s - pulse, 2 * s, 2 * s);
  g.fillRect(x + 6 * s, y + 10 * s, 4 * s, s);
}

function drawFarm(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  tilePx: number,
  timeMs: number
): void {
  const sway = Math.sin(timeMs * 0.004 + x + y) * 0.6;
  g.fillStyle(GB.dark, 1);
  g.fillRect(x + 1, y + 2, tilePx - 2, tilePx - 3);
  g.fillStyle(GB.darkest, 1);
  g.fillRect(x + 2, y + 5, tilePx - 4, 1);
  g.fillRect(x + 2, y + 10, tilePx - 4, 1);
  g.fillStyle(GB.light, 1);
  for (let px = 3; px < tilePx - 2; px += 4) {
    g.fillRect(x + px + sway, y + 3, 1, 10);
    g.fillRect(x + px - 1 + sway, y + 6, 3, 1);
  }
}

function drawFence(g: Phaser.GameObjects.Graphics, x: number, y: number, tilePx: number): void {
  g.fillStyle(GB.darkest, 1);
  g.fillRect(x + 1, y + 6, tilePx - 2, 2);
  g.fillRect(x + 1, y + 11, tilePx - 2, 2);
  for (let px = 2; px < tilePx; px += 5) {
    g.fillRect(x + px, y + 3, 2, 12);
  }
  g.fillStyle(GB.light, 1);
  g.fillRect(x + 2, y + 4, tilePx - 4, 1);
}

function drawWell(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  tilePx: number,
  timeMs: number
): void {
  const s = tilePx / 16;
  const glint = Math.sin(timeMs * 0.008) > 0 ? GB.lightest : GB.light;
  g.fillStyle(GB.darkest, 1);
  g.fillTriangle(x + 2 * s, y + 4 * s, x + tilePx / 2, y - 3 * s, x + tilePx - 2 * s, y + 4 * s);
  g.fillRect(x + 3 * s, y + 5 * s, tilePx - 6 * s, 9 * s);
  g.fillStyle(GB.dark, 1);
  g.fillRect(x + 4 * s, y + 6 * s, tilePx - 8 * s, 7 * s);
  g.fillStyle(GB.light, 1);
  g.fillTriangle(x + 4 * s, y + 4 * s, x + tilePx / 2, y, x + tilePx - 4 * s, y + 4 * s);
  g.fillStyle(glint, 1);
  g.fillRect(x + 6 * s, y + 8 * s, 4 * s, 2 * s);
}

import Phaser from 'phaser';
import type { WorldCell } from '@tokemons/kernel';
import { GB } from '../../palette.js';
import { stepShade } from './ground.js';

export function drawProp(
  g: Phaser.GameObjects.Graphics,
  cell: WorldCell,
  drawX: number,
  drawY: number,
  tilePx: number,
  propColor: number,
  timeMs: number
): void {
  // Compute deterministic plant sway based on game time and cell grid position
  const windSway = Math.sin(timeMs * 0.002 + drawX * 0.07 + drawY * 0.03) * 0.65;

  if (cell.propId === 'tree') {
    const cx = drawX + tilePx / 2;
    const cy = drawY + tilePx / 2;
    
    // Trunk root base (static)
    g.fillStyle(GB.darkest, 1);
    g.fillRect(cx - 1, cy + 2, 2, 6);
    g.fillRect(cx - 2, cy + 6, 4, 2);
    
    // Wind swayed leafy canopy (dynamic)
    const swayedCx = cx + windSway;

    // Shaded leafy canopy layer 1 (shadow base)
    g.fillStyle(stepShade(propColor, 1), 1);
    g.fillCircle(swayedCx, cy - 2, 6);
    g.fillCircle(swayedCx - 3, cy + 1, 4);
    g.fillCircle(swayedCx + 3, cy + 1, 4);
    
    // Canopy layer 2 (midtone)
    g.fillStyle(propColor, 1);
    g.fillCircle(swayedCx, cy - 3, 5);
    g.fillCircle(swayedCx - 2.5, cy, 3.5);
    g.fillCircle(swayedCx + 2.5, cy, 3.5);

    // Canopy highlight (light top-left)
    g.fillStyle(stepShade(propColor, -1), 1);
    g.fillCircle(swayedCx - 1.5, cy - 4.5, 3.2);
    g.fillCircle(swayedCx - 3.5, cy - 1.5, 1.8);
  } else if (cell.propId === 'rock') {
    const rx = drawX + 2;
    const ry = drawY + 4;
    const rw = tilePx - 4;
    const rh = tilePx - 7;
    
    // Dark border/outline base
    g.fillStyle(GB.darkest, 1);
    g.fillRect(rx, ry, rw, rh + 1);

    // Dark shadow facet (right)
    g.fillStyle(stepShade(propColor, 1), 1);
    g.fillTriangle(rx + rw / 2, ry + 1, rx + rw - 1, ry + rh - 1, rx + rw / 2, ry + rh - 1);

    // Midtone facet (left)
    g.fillStyle(propColor, 1);
    g.fillTriangle(rx + rw / 2, ry + 1, rx + 1, ry + rh - 1, rx + rw / 2, ry + rh - 1);

    // Top highlight edge (left side)
    g.fillStyle(stepShade(propColor, -1), 1);
    g.fillRect(rx + 1, ry + rh - 3, rw / 2, 1);
    g.fillRect(rx + rw / 2 - 1, ry + 2, 2, 2);
  } else if (cell.propId === 'crystal') {
    const cx = drawX + tilePx / 2;
    const cy = drawY + tilePx / 2;
    const r = tilePx / 2 - 1;
    
    // Shaded left crystal facet
    g.fillStyle(stepShade(propColor, 1), 1);
    g.fillTriangle(cx, cy - r, cx - r + 1, cy + r - 2, cx, cy + r - 2);

    // Shaded right crystal facet
    g.fillStyle(propColor, 1);
    g.fillTriangle(cx, cy - r, cx + r - 1, cy + r - 2, cx, cy + r - 2);

    // Brilliant crystal spine highlight (c0)
    g.fillStyle(GB.lightest, 1);
    g.fillRect(cx - 0.5, cy - r + 3, 1, r * 2 - 5);
    g.fillRect(cx - 2, cy, 4, 1);
  } else if (cell.propId === 'cactus') {
    const cx = drawX + tilePx / 2;
    const cy = drawY + 2;
    
    // Main trunk with slight wind lean
    const sway = windSway * 0.6;
    g.fillStyle(propColor, 1);
    g.fillRect(cx - 1, cy, 3, tilePx - 4); // trunk
    
    // Branches (left/right jointed arms)
    g.fillRect(cx - 4 + sway, cy + 4, 3, 2); // left arm joint
    g.fillRect(cx - 4 + sway, cy + 1, 2, 4); // left arm upright
    g.fillRect(cx + 2 + sway, cy + 6, 3, 2); // right arm joint
    g.fillRect(cx + 4 + sway, cy + 3, 2, 4); // right arm upright

    // Darker needles and rib lines
    g.fillStyle(GB.darkest, 1);
    g.fillRect(cx, cy + 1, 1, tilePx - 6); // trunk rib line
    g.fillRect(cx - 3 + sway, cy + 2, 1, 2); // left branch needles
    g.fillRect(cx + 4 + sway, cy + 4, 1, 2); // right branch needles
  } else if (cell.propId === 'ruin') {
    const rx = drawX + 1;
    const ry = drawY + 2;
    const rw = tilePx - 2;
    const rh = tilePx - 4;
    
    // Base block
    g.fillStyle(propColor, 1);
    g.fillRect(rx, ry, rw, rh);

    // Engraved line designs (c3)
    g.fillStyle(GB.darkest, 1);
    g.fillRect(rx, ry + 2, rw, 1); // horizontal engraving
    g.fillRect(rx, ry + rh - 3, rw, 1);
    
    // Cracked cracks
    g.fillRect(rx + 4, ry + 3, 1, 3);
    g.fillRect(rx + 5, ry + 5, 2, 1);
    
    // Top highlight edge (c0)
    g.fillStyle(GB.lightest, 0.7);
    g.fillRect(rx, ry, rw, 1);
  } else if (cell.propId === 'reeds') {
    g.fillStyle(propColor, 1);
    for (let i = 2; i < tilePx - 1; i += 4) {
      const rh = 6 + (i % 3) * 2;
      const reedSway = windSway * (rh / 8); // more sway at the top of taller reeds
      
      g.fillRect(drawX + i + reedSway, drawY + tilePx - rh, 1.2, rh); // stalks
      
      // Leafy blades branching out
      g.fillStyle(stepShade(propColor, -1), 1);
      g.fillRect(drawX + i + 1 + reedSway, drawY + tilePx - rh + 2, 1, 1);
      g.fillRect(drawX + i - 1 + reedSway, drawY + tilePx - rh + 4, 1, 1);
      g.fillStyle(propColor, 1);
    }
  } else if (cell.propId === 'lamp') {
    const cx = drawX + tilePx / 2;
    
    // Post (c3)
    g.fillStyle(GB.darkest, 1);
    g.fillRect(cx - 0.5, drawY + 5, 1.2, tilePx - 5);
    
    // Glass lamp housing
    g.fillStyle(propColor, 1);
    g.fillRect(cx - 2, drawY + 2, 5, 3);
    
    // Lamp cap/top
    g.fillStyle(GB.darkest, 1);
    g.fillRect(cx - 3, drawY + 1, 7, 1);

    // Bulb core with dynamic glinting glow
    const glowColor = Math.sin(timeMs * 0.005) > 0 ? GB.lightest : 0xffffff;
    g.fillStyle(glowColor, 1);
    g.fillRect(cx - 1, drawY + 3, 3, 2);
  } else if (cell.propId === 'snowdrift') {
    const sx = drawX;
    const sy = drawY + 6;
    
    // Soft white snow drift slope
    g.fillStyle(0xffffff, 0.8);
    g.fillRect(sx + 1, sy + 1, tilePx - 2, 3);
    
    // Shadow slope edge
    g.fillStyle(stepShade(propColor, 1), 0.85);
    g.fillRect(sx + 2, sy + 4, tilePx - 4, 1);
    g.fillRect(sx + 4, sy + 5, tilePx - 8, 1);
  } else if (cell.propId === 'mushroom') {
    const cx = drawX + tilePx / 2;
    const cy = drawY + 4;
    
    // White stalk base
    g.fillStyle(GB.lightest, 1);
    g.fillRect(cx - 1, cy + 4, 3, 4);

    // Mushroom cap (c2/shade)
    g.fillStyle(propColor, 1);
    g.fillCircle(cx, cy + 2, 4);
    
    // Cap spots (c0)
    g.fillStyle(GB.lightest, 1);
    g.fillRect(cx - 1, cy + 1, 1, 1);
    g.fillRect(cx + 2, cy + 2, 1, 1);
  } else if (cell.propId === 'shell') {
    const sx = drawX + 3;
    const sy = drawY + 6;
    
    // Spiral shell contours
    g.fillStyle(propColor, 1);
    g.fillRect(sx + 1, sy + 1, 6, 3);
    g.fillStyle(stepShade(propColor, -1), 1);
    g.fillRect(sx + 3, sy + 1, 2, 2);
    g.fillStyle(GB.darkest, 1);
    g.fillRect(sx, sy + 2, 1, 2);
  } else if (cell.propId === 'tall_grass') {
    g.fillStyle(propColor, 1);
    for (let i = 1; i < tilePx - 1; i += 3) {
      const gh = 5 + (i % 3) * 2;
      const grassSway = windSway * (gh / 6);
      g.fillRect(drawX + i + grassSway, drawY + tilePx - gh, 1, gh); // main blade
      
      // Blade tip shade (lighter highlight)
      g.fillStyle(stepShade(propColor, -1), 1);
      g.fillRect(drawX + i + grassSway, drawY + tilePx - gh, 1, 1);
      g.fillStyle(propColor, 1);
    }
  } else if (cell.propId === 'fern') {
    const cx = drawX + tilePx / 2;
    const cy = drawY + 4;
    
    // Stalk with gentle wind sway lean
    g.fillStyle(propColor, 1);
    g.fillRect(cx - 0.5 + windSway * 0.3, cy + 2, 1.2, 7);
    
    // Left leaves (waving)
    g.fillStyle(stepShade(propColor, 1), 1);
    g.fillRect(cx - 3 + windSway * 0.6, cy + 3, 3, 1);
    g.fillRect(cx - 4 + windSway * 0.6, cy + 5, 4, 1);
    g.fillRect(cx - 5 + windSway * 0.6, cy + 7, 5, 1);

    // Right leaves (waving)
    g.fillStyle(propColor, 1);
    g.fillRect(cx + 1 + windSway * 0.6, cy + 2, 3, 1);
    g.fillRect(cx + 1 + windSway * 0.6, cy + 4, 4, 1);
    g.fillRect(cx + 1 + windSway * 0.6, cy + 6, 5, 1);
  } else if (cell.propId === 'bush' || cell.propId === 'berry_bush') {
    const cx = drawX + tilePx / 2;
    const cy = drawY + tilePx / 2 + 1;
    
    // Dense shaded bush base (c2 shadow) swayed by wind
    const swayedCx = cx + windSway * 0.7;
    
    g.fillStyle(stepShade(propColor, 1), 1);
    g.fillCircle(swayedCx, cy, 6);
    g.fillCircle(swayedCx - 3, cy + 2, 4);
    g.fillCircle(swayedCx + 3, cy + 2, 4);

    // Bush midtone (c1)
    g.fillStyle(propColor, 1);
    g.fillCircle(swayedCx, cy - 1, 5);
    g.fillCircle(swayedCx - 2, cy + 1, 3.5);
    g.fillCircle(swayedCx + 2, cy + 1, 3.5);

    if (cell.propId === 'berry_bush') {
      // Bright red berries (c0)
      g.fillStyle(GB.lightest, 1);
      g.fillRect(swayedCx - 2, cy - 2, 1.2, 1.2);
      g.fillRect(swayedCx + 2, cy, 1.2, 1.2);
      g.fillRect(swayedCx - 1, cy + 2, 1.2, 1.2);
    }
  } else if (cell.propId === 'vine') {
    g.fillRect(drawX + 2, drawY + 2, 2, 9);
    g.fillRect(drawX + 6, drawY + 1, 2, 8);
    g.fillRect(drawX + 10, drawY + 4, 1, 7);
  } else if (cell.propId === 'lily') {
    g.fillRect(drawX + 3, drawY + 7, 6, 2);
    g.fillStyle(GB.light, 1);
    g.fillRect(drawX + 6, drawY + 5, 2, 2);
  } else if (cell.propId === 'scrub') {
    g.fillRect(drawX + 3, drawY + 7, 7, 3);
    g.fillStyle(GB.dark, 1);
    g.fillRect(drawX + 5, drawY + 5, 1, 2);
    g.fillRect(drawX + 8, drawY + 5, 1, 2);
  } else if (cell.propId === 'pine') {
    const cx = drawX + tilePx / 2;
    
    // Pine trunk (c3)
    g.fillStyle(GB.darkest, 1);
    g.fillRect(cx - 1, drawY + 8, 2.2, 6);
    
    // Evergreen layers swayed by wind
    const swayedCx = cx + windSway * 0.8;
    
    // Tier 1 (bottom shadow)
    g.fillStyle(stepShade(propColor, 1), 1);
    g.fillTriangle(swayedCx, drawY + 1, swayedCx + 7, drawY + 10, swayedCx - 7, drawY + 10);
    
    // Tier 2 (midtone)
    g.fillStyle(propColor, 1);
    g.fillTriangle(swayedCx, drawY + 2, swayedCx + 5, drawY + 8, swayedCx - 5, drawY + 8);

    // Tier 3 (highlight cap)
    g.fillStyle(stepShade(propColor, -1), 1);
    g.fillTriangle(swayedCx, drawY + 1, swayedCx + 3, drawY + 5, swayedCx - 3, drawY + 5);
  } else if (cell.propId === 'blossom') {
    const cx = drawX + tilePx / 2;
    const cy = drawY + tilePx / 2;
    
    // Stem (c3)
    g.fillStyle(GB.darkest, 1);
    g.fillRect(cx - 1, cy, 2, 7);
    
    // Blossom petals swayed by wind
    const swayedCx = cx + windSway;
    
    g.fillStyle(propColor, 1);
    g.fillCircle(swayedCx - 2, cy - 2, 4);
    g.fillCircle(swayedCx + 2, cy - 1, 4.5);
    g.fillCircle(swayedCx, cy + 1, 3.5);

    // Highlights on top of petals (c0)
    g.fillStyle(GB.lightest, 1);
    g.fillCircle(swayedCx - 1, cy - 3, 2.2);
    g.fillCircle(swayedCx + 2, cy - 2, 2.2);
  } else if (cell.propId === 'flower_patch') {
    const cx = drawX + tilePx / 2;
    const cy = drawY + tilePx / 2 + 2;
    const swayedCx = cx + windSway * 0.8;

    g.fillStyle(GB.dark, 1);
    g.fillRect(swayedCx - 5, cy + 2, 10, 2);
    g.fillRect(swayedCx - 3, cy, 6, 4);

    g.fillStyle(propColor, 1);
    g.fillCircle(swayedCx - 4, cy - 1, 2);
    g.fillCircle(swayedCx, cy - 3, 2);
    g.fillCircle(swayedCx + 4, cy - 1, 2);
  } else if (cell.propId === 'rune_stone') {
    const rx = drawX + 3;
    const ry = drawY + 2;
    const rw = tilePx - 6;
    const rh = tilePx - 4;

    g.fillStyle(propColor, 1);
    g.fillRect(rx, ry + 2, rw, rh - 2);
    g.fillStyle(stepShade(propColor, -1), 1);
    g.fillRect(rx + 1, ry + 2, rw - 2, 1);
    g.fillStyle(GB.lightest, 0.9);
    g.fillRect(rx + 4, ry + 5, 2, 1);
    g.fillRect(rx + 6, ry + 6, 1, 3);
    g.fillRect(rx + 3, ry + 10, rw - 6, 1);
  } else if (cell.propId === 'obelisk') {
    const cx = drawX + tilePx / 2;
    const top = drawY + 1;
    const bottom = drawY + tilePx - 1;

    g.fillStyle(GB.darkest, 1);
    g.fillTriangle(cx, top, cx - 5, top + 6, cx + 5, top + 6);
    g.fillRect(cx - 4, top + 6, 8, bottom - top - 7);
    g.fillStyle(stepShade(propColor, -1), 1);
    g.fillRect(cx - 3, top + 7, 2, bottom - top - 10);
    g.fillStyle(GB.lightest, 0.8);
    g.fillRect(cx - 1, top + 10, 2, 2);
  } else if (cell.propId === 'fountain') {
    const cx = drawX + tilePx / 2;
    const cy = drawY + tilePx / 2;
    const pulse = Math.sin(timeMs * 0.006) > 0 ? 1 : 0;

    g.fillStyle(GB.darkest, 1);
    g.fillRect(cx - 6, cy + 3, 12, 4);
    g.fillStyle(GB.dark, 1);
    g.fillRect(cx - 5, cy + 1, 10, 4);
    g.fillStyle(propColor, 0.9);
    g.fillRect(cx - 3, cy, 6, 2);
    g.fillRect(cx - 1, cy - 5 - pulse, 2, 5);
    g.fillRect(cx - 4, cy - 2, 1, 3);
    g.fillRect(cx + 3, cy - 2, 1, 3);
  } else {
    g.fillStyle(propColor, 1);
    g.fillRect(drawX + 3, drawY + 5, 2, 2);
  }
}

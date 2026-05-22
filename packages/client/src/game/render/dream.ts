import Phaser from 'phaser';
import type { GameRuntime } from '../state.js';
import { seedToFloat } from '@tokemons/kernel';

export function drawDreamOverlays(
  g: Phaser.GameObjects.Graphics,
  rt: GameRuntime,
  _camX: number,
  _camY: number,
  viewW: number,
  viewH: number,
  tilePx: number,
  timeMs: number
): void {
  const pixelW = viewW * tilePx;
  const pixelH = viewH * tilePx;

  // Render 14 floating dream wisps that drift diagonally
  for (let i = 0; i < 14; i++) {
    const seedVal = rt.worldSeed ^ (i * 12347);
    const rnd1 = seedToFloat(seedVal);
    const rnd2 = seedToFloat(seedVal ^ 8873);
    const rnd3 = seedToFloat(seedVal ^ 55431);

    // Speed details (pixels per second)
    const speedX = 14 + rnd1 * 20; 
    const speedY = -10 - rnd2 * 15; // float upward and rightward

    const startPx = rnd1 * pixelW;
    const startPy = rnd2 * pixelH;

    // Continuous smooth coordinate wrapping
    const driftX = (startPx + (timeMs * 0.001 * speedX)) % (pixelW + 40) - 20;
    const driftY = ((startPy + (timeMs * 0.001 * speedY)) % (pixelH + 40) + (pixelH + 40)) % (pixelH + 40) - 20;

    // Glowing wisp radius and pulse
    const size = (2 + rnd3 * 3) + Math.sin(timeMs * 0.002 + i) * 0.8;
    const alpha = (0.2 + rnd1 * 0.25) + Math.sin(timeMs * 0.001 + i) * 0.1;

    // Outer glow (using Game Boy lightest palette tint / cream)
    g.fillStyle(0xe8f0d0, alpha);
    g.fillCircle(driftX, driftY, size);

    // Inner bright core
    g.fillStyle(0xffffff, alpha * 1.4);
    g.fillCircle(driftX, driftY, Math.max(0.6, size * 0.35));

    // Dynamic wind swirl lines (Layer 2 templates)
    if (i < 3 && rnd1 > 0.45) {
      g.fillStyle(0xe8f0d0, alpha * 0.25);
      g.fillRect(driftX - size * 2.5, driftY, size * 5, 0.75);
    }
  }
}

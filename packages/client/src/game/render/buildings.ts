import Phaser from 'phaser';
import { GB } from '../../palette.js';
import { getBuildPart } from '../build-catalog.js';

export function drawBuildBlock(
  g: Phaser.GameObjects.Graphics,
  blockId: number,
  drawX: number,
  drawY: number,
  tilePx: number,
  timeMs: number,
  wx = 0,
  wy = 0,
  worldSeed = 0
): void {
  const part = getBuildPart(blockId);
  const bigKeys = new Set(['cottage', 'hall', 'tower', 'shrine', 'well']);
  const scale = bigKeys.has(part.key) ? 2.4 : part.key === 'fence' ? 1.2 : 1;
  const originX = drawX + tilePx / 2;
  const baseY = drawY + tilePx;
  const x = originX - (tilePx * scale) / 2;
  const y = baseY - tilePx * scale;
  const size = tilePx * scale;

  drawPlacedShadow(g, drawX, drawY, tilePx, scale);

  const vars = getProceduralVars(wx, wy, worldSeed);

  switch (part.key) {
    case 'path':
      drawPath(g, drawX, drawY, tilePx, vars);
      break;
    case 'plaza':
      drawPlaza(g, drawX, drawY, tilePx, vars);
      break;
    case 'cottage':
      drawCottage(g, x, y, size, vars, timeMs);
      break;
    case 'hall':
      drawHall(g, x, y, size, vars, timeMs);
      break;
    case 'tower':
      drawTower(g, x, y, size, vars, timeMs);
      break;
    case 'shrine':
      drawShrine(g, x, y, size, vars, timeMs);
      break;
    case 'farm':
      drawFarm(g, drawX, drawY, tilePx, timeMs, vars);
      break;
    case 'fence':
      drawFence(g, x, y + size - tilePx * scale, size, vars);
      break;
    case 'well':
      drawWell(g, x, y, size, vars, timeMs);
      break;
    default:
      drawPath(g, drawX, drawY, tilePx, vars);
      break;
  }
}

function getProceduralVars(wx: number, wy: number, seed: number): number[] {
  const vars: number[] = [];
  for (let i = 1; i <= 12; i++) {
    const val = Math.abs(Math.sin((wx * 12.9898 + wy * 78.233 + seed * 43.123 + i * 29.543)) * 43758.5453) % 1;
    vars.push(val);
  }
  return vars;
}

function getDMGPalette(varVal: number) {
  const cycle = Math.floor(varVal * 4);
  if (cycle === 1) {
    return { cDarkest: GB.darkest, cDark: GB.light, cLight: GB.dark, cLightest: GB.lightest };
  } else if (cycle === 2) {
    return { cDarkest: GB.darkest, cDark: GB.darkest, cLight: GB.light, cLightest: GB.lightest };
  } else if (cycle === 3) {
    return { cDarkest: GB.dark, cDark: GB.darkest, cLight: GB.light, cLightest: GB.lightest };
  }
  return { cDarkest: GB.darkest, cDark: GB.dark, cLight: GB.light, cLightest: GB.lightest };
}

function drawPlacedShadow(g: Phaser.GameObjects.Graphics, x: number, y: number, tilePx: number, scale: number): void {
  g.fillStyle(GB.darkest, 0.28);
  const w = tilePx * scale;
  const shadowX = x + tilePx / 2 - w / 2 + 2;
  g.fillRoundedRect(shadowX, y + tilePx - 4, w - 4, 4, 1);
}

function drawPath(g: Phaser.GameObjects.Graphics, x: number, y: number, tilePx: number, vars: number[]): void {
  const { cDark, cLight } = getDMGPalette(vars[0]);
  g.fillStyle(cDark, 1);
  g.fillRect(x, y + 4, tilePx, 7);
  g.fillStyle(cLight, 1);
  
  // Procedural stone placement based on vars
  const p1 = Math.floor(vars[1] * (tilePx - 4));
  const p2 = Math.floor(vars[2] * (tilePx - 4));
  g.fillRect(x + p1, y + 5, 3, 2);
  g.fillRect(x + p2, y + 8, 4, 2);
  g.fillRect(x + ((p1 + 8) % tilePx), y + 6, 2, 2);
}

function drawPlaza(g: Phaser.GameObjects.Graphics, x: number, y: number, tilePx: number, vars: number[]): void {
  const { cDark, cLight, cDarkest } = getDMGPalette(vars[0]);
  g.fillStyle(cDark, 1);
  g.fillRect(x, y + 1, tilePx, tilePx - 2);
  
  g.fillStyle(cLight, 1);
  // Grid layout with procedural details
  for (let py = 2; py < tilePx - 2; py += 5) {
    g.fillRect(x + 1, y + py, tilePx - 2, 1);
  }
  for (let px = 4; px < tilePx; px += 5) {
    g.fillRect(x + px, y + 2, 1, tilePx - 4);
  }

  // Center crest decoration based on var1
  g.fillStyle(cDarkest, 1);
  if (vars[1] < 0.5) {
    g.fillRect(x + tilePx / 2 - 2, y + tilePx / 2 - 2, 4, 4);
  } else {
    g.fillCircle(x + tilePx / 2, y + tilePx / 2, 2.5);
  }
}

function drawCottage(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  tilePx: number,
  vars: number[],
  timeMs: number
): void {
  const s = tilePx / 16;
  const { cDarkest, cDark, cLight, cLightest } = getDMGPalette(vars[0]);

  // Procedural Chimney
  const hasChimney = vars[4] < 0.7;
  const chimneyOnLeft = vars[4] < 0.35;
  const chimneyX = chimneyOnLeft ? x + 2.5 * s : x + tilePx - 4.5 * s;
  
  if (hasChimney) {
    g.fillStyle(cDarkest, 1);
    g.fillRect(chimneyX, y - 2 * s, 2 * s, 8 * s);
    g.fillStyle(cDark, 1);
    g.fillRect(chimneyX + 0.5 * s, y - 1.5 * s, 1 * s, 7 * s);
    
    // Animate rising smoke puffs
    const smokeTimer = (timeMs * 0.015) % 6;
    g.fillStyle(cLightest, 0.65);
    g.fillRect(chimneyX + 0.5 * s, y - 3.5 * s - smokeTimer, 1.2 * s, 1.2 * s);
    g.fillRect(chimneyX + 1.2 * s, y - 6 * s - ((smokeTimer + 3) % 6), 0.8 * s, 0.8 * s);
  }

  // Cottage Main Frame & Procedural Roof Angle
  const peakHeight = 4.5 + vars[1] * 4;
  const top = y - peakHeight * s;
  
  g.fillStyle(cDarkest, 1);
  // Roof Triangle Outline
  g.fillTriangle(x, y + 4 * s, x + tilePx / 2, top, x + tilePx, y + 4 * s);
  
  // Base Wall
  g.fillRect(x + 2 * s, y + 4 * s, tilePx - 4 * s, 11 * s);
  
  // Roof Interior Coloring
  g.fillStyle(cLight, 1);
  g.fillTriangle(x + 1.5 * s, y + 4 * s, x + tilePx / 2, top + 1.5 * s, x + tilePx - 1.5 * s, y + 4 * s);

  // Roof Slat Pattern based on vars[6]
  g.fillStyle(cDark, 1);
  if (vars[6] < 0.5) {
    for (let rx = 3 * s; rx < tilePx - 3 * s; rx += 3 * s) {
      g.fillRect(x + rx, y + 3.8 * s, 0.8 * s, 1.5 * s);
    }
  }

  // Base Wall Detailing
  g.fillStyle(cDark, 1);
  g.fillRect(x + 2.5 * s, y + 4.5 * s, tilePx - 5 * s, 10 * s);

  // Procedural Door Position
  const doorStyle = Math.floor(vars[2] * 3);
  let doorX = x + tilePx / 2 - 2 * s;
  if (doorStyle === 0) doorX = x + 3.5 * s;
  else if (doorStyle === 2) doorX = x + tilePx - 6.5 * s;

  g.fillStyle(cDarkest, 1);
  g.fillRect(doorX, y + 9 * s, 3.2 * s, 6 * s);
  g.fillStyle(cLight, 1);
  g.fillRect(doorX + 0.6 * s, y + 9.6 * s, 2 * s, 5.2 * s);
  
  // Doorknob
  g.fillStyle(cDarkest, 1);
  g.fillRect(doorX + 1.8 * s, y + 12 * s, 0.5 * s, 0.5 * s);

  // Procedural Windows
  const windowStyle = vars[3] < 0.5 ? 'round' : 'arched';
  const leftWinX = x + 4 * s;
  const rightWinX = x + tilePx - 7 * s;

  const drawWindowAt = (wx: number) => {
    // Avoid drawing window over the door
    if (Math.abs(wx - doorX) < 2.5 * s) return;
    g.fillStyle(cDarkest, 1);
    
    // Window Light Glow based on var10
    const glowing = vars[9] < 0.7;
    const glassColor = glowing ? cLightest : cDark;

    if (windowStyle === 'round') {
      g.fillCircle(wx + 1.5 * s, y + 7 * s, 1.8 * s);
      g.fillStyle(glassColor, 1);
      g.fillCircle(wx + 1.5 * s, y + 7 * s, 1.2 * s);
    } else {
      g.fillRect(wx, y + 6.5 * s, 2.5 * s, 3 * s);
      g.fillTriangle(wx, y + 6.5 * s, wx + 1.25 * s, y + 5 * s, wx + 2.5 * s, y + 6.5 * s);
      g.fillStyle(glassColor, 1);
      g.fillRect(wx + 0.5 * s, y + 7 * s, 1.5 * s, 2.2 * s);
    }
  };

  drawWindowAt(leftWinX);
  drawWindowAt(rightWinX);

  // Procedural Ivy Vine climbing based on var5
  if (vars[5] < 0.45) {
    g.fillStyle(cLight, 0.85);
    const leafCount = Math.floor(6 + vars[5] * 8);
    for (let li = 0; li < leafCount; li++) {
      const ly = y + 14 * s - li * 1.5 * s;
      const lx = x + 2 * s + Math.sin(li * 1.2) * 1.2 * s;
      g.fillRect(lx, ly, 0.9 * s, 0.9 * s);
    }
  }
}

function drawHall(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  tilePx: number,
  vars: number[],
  timeMs: number
): void {
  const s = tilePx / 16;
  const { cDarkest, cDark, cLight, cLightest } = getDMGPalette(vars[0]);
  const peakHeight = 6 + vars[1] * 3;
  const top = y - peakHeight * s;

  // Foundation base stones
  g.fillStyle(cDarkest, 1);
  g.fillRect(x, y + 14 * s, tilePx, 2 * s);
  
  // Draw main building columns
  g.fillRect(x + 1 * s, y + 4 * s, tilePx - 2 * s, 11 * s);
  
  // Roof Structure
  g.fillTriangle(x - s, y + 4 * s, x + tilePx / 2, top, x + tilePx + s, y + 4 * s);
  
  g.fillStyle(cLight, 1);
  g.fillTriangle(x + s, y + 4 * s, x + tilePx / 2, top + 1.8 * s, x + tilePx - s, y + 4 * s);

  // Pillars & Walls
  g.fillStyle(cDark, 1);
  g.fillRect(x + 2 * s, y + 4.5 * s, tilePx - 4 * s, 9.5 * s);

  // Pillars details (arched entryway frame)
  g.fillStyle(cDarkest, 1);
  g.fillRect(x + 2 * s, y + 4.5 * s, 1.2 * s, 9.5 * s);
  g.fillRect(x + tilePx - 3.2 * s, y + 4.5 * s, 1.2 * s, 9.5 * s);
  
  // Main Grand Entry Arch
  g.fillRect(x + tilePx / 2 - 3 * s, y + 6.5 * s, 6 * s, 8 * s);
  g.fillCircle(x + tilePx / 2, y + 6.5 * s, 3 * s);
  
  g.fillStyle(cDark, 1);
  g.fillRect(x + tilePx / 2 - 2 * s, y + 7.5 * s, 4 * s, 7 * s);
  g.fillCircle(x + tilePx / 2, y + 7.5 * s, 2 * s);

  // Double Arched Windows
  const windowGlow = vars[9] < 0.85 ? cLightest : cDarkest;
  g.fillStyle(cDarkest, 1);
  g.fillRect(x + 4 * s, y + 6 * s, 1.6 * s, 2.5 * s);
  g.fillRect(x + tilePx - 5.6 * s, y + 6 * s, 1.6 * s, 2.5 * s);
  g.fillStyle(windowGlow, 1);
  g.fillRect(x + 4.3 * s, y + 6.3 * s, 1.0 * s, 2.0 * s);
  g.fillRect(x + tilePx - 5.3 * s, y + 6.3 * s, 1.0 * s, 2.0 * s);

  // Procedural Guild Banner based on vars[8]
  const bannerType = Math.floor(vars[8] * 3);
  if (bannerType > 0) {
    const bColor = bannerType === 1 ? cLight : cLightest;
    const wave = Math.sin(timeMs * 0.005 + x) * 0.5 * s;
    g.fillStyle(cDarkest, 1);
    g.fillRect(x + tilePx / 2 - 0.5 * s, y - s, 1.0 * s, 6 * s); // Pole
    
    g.fillStyle(bColor, 1);
    // Banner cloth waving
    g.fillRect(x + tilePx / 2 + 0.5 * s, y + s, 2.5 * s + wave, 2.8 * s);
    g.fillStyle(cDarkest, 1);
    g.fillRect(x + tilePx / 2 + 1.2 * s, y + 1.8 * s, 0.9 * s, 0.9 * s); // Guild logo crest
  }
}

function drawTower(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  tilePx: number,
  vars: number[],
  timeMs: number
): void {
  const s = tilePx / 16;
  const { cDarkest, cDark, cLight, cLightest } = getDMGPalette(vars[0]);
  const peakHeight = 8 + vars[1] * 5;
  const top = y - peakHeight * s;

  // Base Foundation
  g.fillStyle(cDarkest, 1);
  g.fillRect(x + 2 * s, y - 2 * s, 12 * s, 18 * s);
  g.fillStyle(cDark, 1);
  g.fillRect(x + 3 * s, y - s, 10 * s, 16 * s);

  // Brick Lines procedurally scattered
  g.fillStyle(cDarkest, 1);
  if (vars[7] < 0.6) {
    g.fillRect(x + 4 * s, y + 4 * s, 2 * s, 0.6 * s);
    g.fillRect(x + 9 * s, y + 9 * s, 2.5 * s, 0.6 * s);
    g.fillRect(x + 5 * s, y + 12 * s, 1.8 * s, 0.6 * s);
  }

  // Spire / Top Battlements style based on vars[10]
  const isPointySpire = vars[10] < 0.5;
  if (isPointySpire) {
    g.fillStyle(cDarkest, 1);
    g.fillTriangle(x + s, y - 2 * s, x + tilePx / 2, top, x + tilePx - s, y - 2 * s);
    g.fillStyle(cLight, 1);
    g.fillTriangle(x + 2.5 * s, y - 2 * s, x + tilePx / 2, top + 2.5 * s, x + tilePx - 2.5 * s, y - 2 * s);
  } else {
    // Castle parapet style
    g.fillStyle(cDarkest, 1);
    g.fillRect(x + s, y - 4 * s, 14 * s, 3 * s);
    // Cutouts
    g.fillStyle(cLight, 1);
    g.fillRect(x + 3 * s, y - 3.5 * s, 2 * s, 2.5 * s);
    g.fillRect(x + 7 * s, y - 3.5 * s, 2 * s, 2.5 * s);
    g.fillRect(x + 11 * s, y - 3.5 * s, 2 * s, 2.5 * s);
  }

  // Waving Flag on spire based on vars[8]
  const hasFlag = vars[8] < 0.7;
  if (hasFlag) {
    const flagWave = Math.sin(timeMs * 0.007 + x) * 0.8 * s;
    const poleTop = isPointySpire ? top : y - 4 * s;
    g.fillStyle(cDarkest, 1);
    g.fillRect(x + tilePx / 2 - 0.3 * s, poleTop - 3.5 * s, 0.6 * s, 4 * s);
    g.fillStyle(cLightest, 1);
    g.fillRect(x + tilePx / 2 + 0.3 * s, poleTop - 3.3 * s, 2.2 * s + flagWave, 1.5 * s);
    g.fillStyle(cDark, 1);
    g.fillRect(x + tilePx / 2 + 0.3 * s, poleTop - 2.8 * s, 1.0 * s, 0.5 * s);
  }

  // Windows and Door
  const glow = vars[9] < 0.75 ? cLightest : cDarkest;
  g.fillStyle(cDarkest, 1);
  // High observation slit windows
  g.fillRect(x + 5 * s, y + 2 * s, 1.8 * s, 3 * s);
  g.fillRect(x + 9 * s, y + 2 * s, 1.8 * s, 3 * s);
  
  g.fillStyle(glow, 1);
  g.fillRect(x + 5.5 * s, y + 2.5 * s, 0.8 * s, 2 * s);
  g.fillRect(x + 9.5 * s, y + 2.5 * s, 0.8 * s, 2 * s);

  // Tower Doorway
  g.fillStyle(cDarkest, 1);
  g.fillRect(x + 6.5 * s, y + 10 * s, 3 * s, 6 * s);
  g.fillStyle(cDark, 1);
  g.fillRect(x + 7 * s, y + 10.5 * s, 2 * s, 5.5 * s);
}

function drawShrine(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  tilePx: number,
  vars: number[],
  timeMs: number
): void {
  const s = tilePx / 16;
  const pulse = Math.sin(timeMs * 0.007 + x * 2.5) > 0 ? 1 : 0;
  const { cDarkest, cDark, cLight, cLightest } = getDMGPalette(vars[0]);

  // Base Pedestal tiers based on vars[10]
  const baseTiers = vars[10] < 0.5 ? 2 : 3;
  g.fillStyle(cDarkest, 1);
  g.fillRect(x + 1 * s, y + 13 * s, tilePx - 2 * s, 3 * s);
  if (baseTiers === 3) {
    g.fillRect(x + 2 * s, y + 10 * s, tilePx - 4 * s, 3 * s);
  }

  // Main Arch Pillar
  g.fillRect(x + 3 * s, y + s, 10 * s, 13 * s);
  g.fillStyle(cDark, 1);
  g.fillRect(x + 4 * s, y + 2 * s, 8 * s, 11 * s);
  
  // Ancient lintel canopy
  g.fillStyle(cLight, 1);
  g.fillRect(x + 3 * s, y + s, 10 * s, 2 * s);

  // Glowing Crystal Sigil Glyph (Pulse) based on vars[11]
  const glyphIndex = Math.floor(vars[11] * 4);
  g.fillStyle(cLightest, 0.95);
  const sigilY = y + 5 * s - pulse * 0.5 * s;
  
  if (glyphIndex === 0) {
    // Cross star
    g.fillRect(x + 7.5 * s, sigilY, 1.0 * s, 3 * s);
    g.fillRect(x + 6.5 * s, sigilY + s, 3 * s, 1.0 * s);
  } else if (glyphIndex === 1) {
    // Diamond rune
    g.fillTriangle(x + 8 * s, sigilY, x + 6.5 * s, sigilY + 1.5 * s, x + 9.5 * s, sigilY + 1.5 * s);
    g.fillTriangle(x + 8 * s, sigilY + 3 * s, x + 6.5 * s, sigilY + 1.5 * s, x + 9.5 * s, sigilY + 1.5 * s);
  } else {
    // Circle orb wisp
    g.fillCircle(x + 8 * s, sigilY + 1.5 * s, 1.5 * s);
  }

  // Altar Base Steps details
  g.fillStyle(cDarkest, 1);
  g.fillRect(x + 5 * s, y + 10 * s, 6 * s, 1 * s);

  // Floating Dream Wisps particles generated dynamically using timeMs & coordinate seeds
  g.fillStyle(cLightest, 0.7);
  const wispY = y - ((timeMs * 0.015 + x) % (6 * s));
  const wispX = x + tilePx / 2 - 2 * s + Math.sin(timeMs * 0.005 + y) * 3 * s;
  g.fillRect(wispX, wispY, 0.8 * s, 0.8 * s);
  g.fillRect(wispX + 3 * s, wispY - 3 * s, 0.5 * s, 0.5 * s);
}

function drawFarm(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  tilePx: number,
  timeMs: number,
  vars: number[]
): void {
  const sway = Math.sin(timeMs * 0.005 + x + y) * 0.8;
  const { cDark, cDarkest, cLight } = getDMGPalette(vars[0]);
  
  g.fillStyle(cDark, 1);
  g.fillRect(x + 1, y + 2, tilePx - 2, tilePx - 3);
  g.fillStyle(cDarkest, 1);
  g.fillRect(x + 2, y + 5, tilePx - 4, 1);
  g.fillRect(x + 2, y + 10, tilePx - 4, 1);
  
  g.fillStyle(cLight, 1);
  // Procedural crops variance based on vars[4]
  const cropSway = vars[4] > 0.5 ? sway : -sway;
  for (let px = 3; px < tilePx - 2; px += 4) {
    g.fillRect(x + px + cropSway, y + 3, 1, 10);
    g.fillRect(x + px - 1 + cropSway, y + 6, 3, 1);
  }
}

function drawFence(g: Phaser.GameObjects.Graphics, x: number, y: number, tilePx: number, vars: number[]): void {
  const { cDarkest, cLight } = getDMGPalette(vars[0]);
  g.fillStyle(cDarkest, 1);
  g.fillRect(x + 1, y + 6, tilePx - 2, 2);
  g.fillRect(x + 1, y + 11, tilePx - 2, 2);
  
  // Custom posts density
  const postStep = vars[1] < 0.5 ? 5 : 4;
  for (let px = 2; px < tilePx; px += postStep) {
    g.fillRect(x + px, y + 3, 2, 12);
  }
  g.fillStyle(cLight, 1);
  g.fillRect(x + 2, y + 4, tilePx - 4, 1);
}

function drawWell(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  tilePx: number,
  vars: number[],
  timeMs: number
): void {
  const s = tilePx / 16;
  const glint = Math.sin(timeMs * 0.008) > 0 ? GB.lightest : GB.light;
  const { cDarkest, cDark, cLight } = getDMGPalette(vars[0]);

  // Procedural Well Canopy Roof style based on vars[1]
  const isTiledRoof = vars[1] < 0.55;
  g.fillStyle(cDarkest, 1);
  g.fillTriangle(x + 2 * s, y + 4 * s, x + tilePx / 2, y - 3 * s, x + tilePx - 2 * s, y + 4 * s);
  
  g.fillStyle(cLight, 1);
  g.fillTriangle(x + 3.2 * s, y + 3.8 * s, x + tilePx / 2, y + 0.2 * s, x + tilePx - 3.2 * s, y + 3.8 * s);

  if (isTiledRoof) {
    g.fillStyle(cDark, 1);
    // Draw tiles lines on the roof
    g.fillRect(x + tilePx / 2 - 0.5 * s, y, 1 * s, 3.5 * s);
    g.fillRect(x + tilePx / 2 - 3.5 * s, y + 2 * s, 1 * s, 1.8 * s);
    g.fillRect(x + tilePx / 2 + 2.5 * s, y + 2 * s, 1 * s, 1.8 * s);
  }

  // Supporting structural posts
  g.fillStyle(cDarkest, 1);
  g.fillRect(x + 3.5 * s, y + 4 * s, 1 * s, 10 * s);
  g.fillRect(x + tilePx - 4.5 * s, y + 4 * s, 1 * s, 10 * s);

  // Well tub base
  g.fillStyle(cDarkest, 1);
  g.fillRect(x + 3 * s, y + 8 * s, tilePx - 6 * s, 8 * s);
  g.fillStyle(cDark, 1);
  g.fillRect(x + 4 * s, y + 9 * s, tilePx - 8 * s, 6 * s);

  // Water Glint & rope bucket procedurally aligned using vars[3]
  g.fillStyle(glint, 1);
  g.fillRect(x + 5.5 * s, y + 10 * s, 5 * s, 1.8 * s);
  
  // Hanging Bucket Rope based on vars[3]
  const bucketOffset = vars[3] < 0.5 ? 1.5 * s : 3.0 * s;
  g.fillStyle(cDarkest, 1);
  g.fillRect(x + tilePx / 2 - 0.3 * s, y + 3 * s, 0.6 * s, 4 * s + bucketOffset);
  // Bucket
  g.fillRect(x + tilePx / 2 - 1.5 * s, y + 7 * s + bucketOffset, 3 * s, 2 * s);
  g.fillStyle(cLight, 1);
  g.fillRect(x + tilePx / 2 - 1 * s, y + 7.5 * s + bucketOffset, 2 * s, 1.2 * s);
}


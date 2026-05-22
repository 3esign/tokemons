import type { TokemonGenes } from './genes.js';
import { morphScale } from './genes.js';
import { seedToFloat } from '@tokemons/kernel';

export function paletteForGenes(genes: TokemonGenes): [string, string, string, string] {
  const h = genes.paletteHue;
  if (genes.paletteWarm) {
    const warm: [string, string, string, string][] = [
      ['#f8f0d8', '#e8c878', '#a87830', '#402810'],
      ['#f0e8c8', '#c4a574', '#7a5030', '#281808'],
      ['#ffe8d0', '#d4a060', '#8b5028', '#301810'],
      ['#fff0e0', '#e09060', '#904020', '#401008'], // Sunset Red-Orange
      ['#fff8d0', '#ffd060', '#c08020', '#503000'], // Golden Yellow
      ['#f8e0d0', '#d88870', '#884030', '#381010'], // Terracotta
      ['#fffaf0', '#f0a080', '#a05040', '#401818'], // Desert Rose
      ['#ffeed0', '#e0a050', '#a06020', '#402000'], // Bronze/Amber
    ];
    return warm[Math.floor(h * warm.length) % warm.length]!;
  }
  const cool: [string, string, string, string][] = [
    ['#e8f0d0', '#9bbc0f', '#306230', '#0f380f'],
    ['#d8e8f8', '#7aacd8', '#284868', '#0c1830'],
    ['#e8d8f0', '#a88bc0', '#503060', '#200828'],
    ['#d8f0e8', '#60b890', '#286048', '#0c2818'],
    ['#f0e8e8', '#c09090', '#684040', '#281010'],
    ['#e8e8c8', '#a0a070', '#505028', '#181808'],
    ['#d0f0f0', '#70b0b0', '#306060', '#102020'],
    ['#f0d8e0', '#c080a0', '#603048', '#200818'],
    ['#e0f8cf', '#86c06c', '#306850', '#071821'], // Forest DMG
    ['#e0f8f8', '#90c0c0', '#306068', '#081820'], // Teal-Ocean
    ['#f8e8f8', '#d0a0d0', '#784878', '#281028'], // Lilac Purple
    ['#e8f8ff', '#80b8e0', '#306090', '#081830'], // Sky Blue
    ['#e0ffe0', '#78d078', '#207038', '#002808'], // Bright Mint
    ['#e8ffd8', '#98d870', '#387820', '#103008'], // Olive/Sage
  ];
  return cool[Math.floor(h * cool.length) % cool.length]!;
}

function fill(ctx: CanvasRenderingContext2D, c: string) {
  ctx.fillStyle = c;
}

function rf(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.max(1, Math.floor(w)), Math.max(1, Math.floor(h)));
}

function drawPattern(
  ctx: CanvasRenderingContext2D,
  genes: TokemonGenes,
  px: number,
  c2: string,
  c3: string
) {
  fill(ctx, genes.pattern === 'gradient' ? c3 : c2);
  if (genes.pattern === 'spots') {
    const count = 4 + (genes.seed % 8);
    for (let i = 0; i < count; i++) {
      const sx = Math.floor(seedToFloat(genes.seed ^ (i * 12)) * (px - 4)) + 2;
      const sy = Math.floor(seedToFloat(genes.seed ^ (i * 37)) * (px - 4)) + 2;
      const sz = 1 + (i % 3);
      rf(ctx, sx, sy, sz, sz);
    }
  } else if (genes.pattern === 'stripes') {
    for (let y = 2; y < px; y += 4) rf(ctx, 1, y, px - 2, 2);
  } else if (genes.pattern === 'rings') {
    fill(ctx, c3);
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(px / 2, px / 2, px * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (genes.pattern === 'checkers') {
    for (let y = 0; y < px; y += 4)
      for (let x = (y / 4) % 2 === 0 ? 0 : 2; x < px; x += 4) rf(ctx, x, y, 2, 2);
  } else if (genes.pattern === 'gradient') {
    for (let y = 0; y < px; y++) {
      ctx.globalAlpha = y / px;
      rf(ctx, 0, y, px, 1);
    }
    ctx.globalAlpha = 1;
  }
}

function drawMouth(
  ctx: CanvasRenderingContext2D,
  genes: TokemonGenes,
  cx: number,
  cy: number,
  c3: string
) {
  const plan = genes.bodyPlan;
  if (plan === 'crystal' || plan === 'plant' || plan === 'fungal') return;
  fill(ctx, c3);
  const style = Math.floor(seedToFloat(genes.seed ^ 0x99) * 3);
  if (style === 0) {
    ctx.strokeStyle = c3;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 1.5, cy);
    ctx.quadraticCurveTo(cx, cy + 1, cx + 1.5, cy);
    ctx.stroke();
  } else if (style === 1) {
    rf(ctx, cx - 1, cy, 2, 1);
    rf(ctx, cx, cy + 1, 1, 1);
  } else {
    rf(ctx, cx - 1, cy, 2, 1);
  }
}

function drawEyes(
  ctx: CanvasRenderingContext2D,
  genes: TokemonGenes,
  cx: number,
  cy: number,
  c3: string,
  spread: number
) {
  fill(ctx, c3);
  const es = Math.max(1, Math.floor(genes.eyeSize * 3));
  for (let e = 0; e < genes.eyeCount; e++) {
    const ox = (e - (genes.eyeCount - 1) / 2) * spread;
    rf(ctx, cx + ox - es / 2, cy - es / 2, es, es);
    fill(ctx, '#0f380f');
    rf(ctx, cx + ox, cy, 1, 1);
  }
}

function drawHorns(
  ctx: CanvasRenderingContext2D,
  genes: TokemonGenes,
  cx: number,
  top: number,
  c2: string
) {
  if (genes.hornCount === 0) return;
  fill(ctx, c2);
  const hl = 2 + Math.floor(genes.hornLength * 8);
  for (let h = 0; h < genes.hornCount; h++) {
    const ox = (h - (genes.hornCount - 1) / 2) * 5;
    // Draw tapered horns (triangle path) instead of flat blocks
    ctx.beginPath();
    ctx.moveTo(cx + ox - 1.5, top);
    ctx.lineTo(cx + ox, top - hl);
    ctx.lineTo(cx + ox + 1.5, top);
    ctx.closePath();
    ctx.fill();
  }
}

function drawTail(
  ctx: CanvasRenderingContext2D,
  genes: TokemonGenes,
  cx: number,
  cy: number,
  c1: string,
  c2: string
) {
  if (genes.tailType === 'none') return;
  fill(ctx, c1);
  if (genes.tailType === 'stub') {
    // Draw a small diamond stub tail
    ctx.beginPath();
    ctx.moveTo(cx, cy + 2);
    ctx.lineTo(cx + 2.5, cy + 4.5);
    ctx.lineTo(cx, cy + 7);
    ctx.lineTo(cx - 2.5, cy + 4.5);
    ctx.closePath();
    ctx.fill();
  } else if (genes.tailType === 'long') {
    // Draw a tapered, curved tail
    ctx.beginPath();
    ctx.moveTo(cx - 1, cy + 2);
    ctx.quadraticCurveTo(cx - 3, cy + 6, cx + 1, cy + 12);
    ctx.lineTo(cx + 2, cy + 12);
    ctx.quadraticCurveTo(cx - 1, cy + 6, cx + 1, cy + 2);
    ctx.closePath();
    ctx.fill();
  } else if (genes.tailType === 'fan') {
    fill(ctx, c2);
    // Draw a beautiful fan tail path
    ctx.beginPath();
    ctx.moveTo(cx - 2, cy + 3);
    ctx.lineTo(cx - 7, cy + 8);
    ctx.lineTo(cx + 7, cy + 8);
    ctx.lineTo(cx + 2, cy + 3);
    ctx.closePath();
    ctx.fill();
  } else if (genes.tailType === 'spike') {
    fill(ctx, c2);
    // Draw a barbed spike tail
    ctx.beginPath();
    ctx.moveTo(cx - 1.5, cy + 2);
    ctx.lineTo(cx - 0.5, cy + 8);
    ctx.lineTo(cx - 3, cy + 10);
    ctx.lineTo(cx, cy + 12);
    ctx.lineTo(cx + 3, cy + 10);
    ctx.lineTo(cx + 0.5, cy + 8);
    ctx.lineTo(cx + 1.5, cy + 2);
    ctx.closePath();
    ctx.fill();
  }
}

function drawWings(
  ctx: CanvasRenderingContext2D,
  genes: TokemonGenes,
  cx: number,
  cy: number,
  c0: string
) {
  if (genes.wingSpan < 0.25) return;
  const w = Math.floor(6 + genes.wingSpan * 10);
  fill(ctx, c0);

  // Left wing (curved organic path)
  ctx.beginPath();
  ctx.moveTo(cx - 3, cy - 2);
  ctx.quadraticCurveTo(cx - 3 - w * 0.6, cy - 6, cx - 3 - w, cy - 2);
  ctx.quadraticCurveTo(cx - 3 - w * 0.5, cy + 3, cx - 3, cy + 1);
  ctx.closePath();
  ctx.fill();

  // Right wing (symmetrical curved organic path)
  ctx.beginPath();
  ctx.moveTo(cx + 3, cy - 2);
  ctx.quadraticCurveTo(cx + 3 + w * 0.6, cy - 6, cx + 3 + w, cy - 2);
  ctx.quadraticCurveTo(cx + 3 + w * 0.5, cy + 3, cx + 3, cy + 1);
  ctx.closePath();
  ctx.fill();

  // Wing texture detail layer (subtle feather dots)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  rf(ctx, cx - 3 - w * 0.45, cy - 1, 1.5, 1.5);
  rf(ctx, cx + 3 + w * 0.45 - 1.5, cy - 1, 1.5, 1.5);
}

export function bakeTokemonCanvas(genes: TokemonGenes, size = 32): HTMLCanvasElement {
  const canvas = document.createElement('canvas');

  // =========================================================================
  // LAYER 7: Interaction & Environment State (Dynamic Response)
  // Scale overall sprite size dynamically based on evolutionary morph stage
  // =========================================================================
  const px = Math.floor(size * morphScale(genes.evolutionStage));
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d')!;

  // =========================================================================
  // LAYER 4: Biome / Material / Colors (Harmonious Palettes)
  // Map genes to a beautiful, cohesive retro Game Boy color palette
  // =========================================================================
  const [c0, c1, c2, c3] = paletteForGenes(genes);

  // =========================================================================
  // LAYER 1: Point (Base Coordinates)
  // Determine anchor point center from canvas size and dynamic genetic offsets
  // =========================================================================
  const cx = px / 2 + genes.offsetX * px * 0.3;
  const cy = px / 2 + genes.offsetY * px * 0.2;

  // =========================================================================
  // LAYER 2: Point to Line / Grid / Circle (Geometric Templates)
  // Calculate raw body dimensions, elliptical parameters, and body plan paths
  // =========================================================================
  const bodyW = Math.floor(px * (0.22 + genes.mass * 0.28) * (1 + genes.elongation * 0.3));
  const bodyH = Math.floor(px * (0.2 + genes.mass * 0.22) * (1 + genes.roundness * 0.25));
  const plan = genes.bodyPlan;

  // =========================================================================
  // LAYER 6: Entity / Structure Composition (Depth-Sorted Assembly)
  // Drawing Layer: 1. Background wing attachments
  // =========================================================================
  drawWings(ctx, genes, cx, cy, c0);

  // =========================================================================
  // LAYER 3: Objects on Instances (Appendages & scattered micro-objects)
  // Position limbs underneath the body core for correct layered depth
  // =========================================================================
  if (plan === 'quadruped') {
    fill(ctx, c2);
    rf(ctx, cx - bodyW / 2 - 3, cy + 2, 4, 5);
    rf(ctx, cx + bodyW / 2 - 1, cy + 2, 4, 5);
    rf(ctx, cx - bodyW / 2 + 1, cy - 2, 4, 5);
    rf(ctx, cx + bodyW / 2 - 3, cy - 2, 4, 5);
  }
  
  if (genes.limbCount > 0 && plan === 'biped') {
    fill(ctx, c2);
    const ll = 3 + Math.floor(genes.limbLength * 6);
    rf(ctx, cx - bodyW / 2 - 2, cy + bodyH / 2, 3, ll);
    rf(ctx, cx + bodyW / 2 - 1, cy + bodyH / 2, 3, ll);
    if (genes.limbCount > 2) {
      rf(ctx, cx - bodyW - 3, cy - 2, 3, ll - 2);
      rf(ctx, cx + bodyW, cy - 2, 3, ll - 2);
    }
  }

  // =========================================================================
  // LAYER 6: Entity / Structure Composition (Depth-Sorted Assembly)
  // Drawing Layer: 2. Core body templates and geometry rendering
  // =========================================================================
  if (plan === 'blob') {
    // Base shape path
    const drawBlob = () => {
      ctx.ellipse(cx, cy, bodyW * 0.75, bodyH * 0.7, 0, 0, Math.PI * 2);
    };
    
    // Fill background shadow
    ctx.beginPath();
    drawBlob();
    fill(ctx, c1);
    ctx.fill();

    // 3D Shadow Crescent (at bottom right)
    ctx.save();
    ctx.beginPath();
    drawBlob();
    ctx.clip(); // clip to blob shape
    fill(ctx, c2);
    ctx.beginPath();
    ctx.ellipse(cx + bodyW * 0.15, cy + bodyH * 0.15, bodyW * 0.75, bodyH * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Glossy Top Highlight (bubble reflection at top left)
    fill(ctx, c0);
    ctx.beginPath();
    ctx.ellipse(cx - bodyW * 0.25, cy - bodyH * 0.25, bodyW * 0.25, bodyH * 0.22, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Outer Outline
    ctx.strokeStyle = c3;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    drawBlob();
    ctx.stroke();

    // =========================================================================
    // LAYER 5: Noise & Modulations (Organic Texture & Patterns)
    // Modulate outer perimeter with fluffy spikes/tufts if specified by surface gene
    // =========================================================================
    if (genes.surface === 'fluffy') {
      fill(ctx, c0);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        rf(ctx, cx + Math.cos(a) * bodyW * 0.8, cy + Math.sin(a) * bodyH * 0.75, 2, 2);
      }
    }
  } else if (plan === 'crystal') {
    // Outlined crystal diamond path
    const drawCrystal = () => {
      ctx.moveTo(cx, cy - bodyH);
      ctx.lineTo(cx + bodyW, cy);
      ctx.lineTo(cx, cy + bodyH);
      ctx.lineTo(cx - bodyW, cy);
      ctx.closePath();
    };

    // Draw left facet (shaded darker)
    fill(ctx, c2);
    ctx.beginPath();
    ctx.moveTo(cx, cy - bodyH);
    ctx.lineTo(cx - bodyW, cy);
    ctx.lineTo(cx, cy + bodyH);
    ctx.closePath();
    ctx.fill();

    // Draw right facet (lighter)
    fill(ctx, c1);
    ctx.beginPath();
    ctx.moveTo(cx, cy - bodyH);
    ctx.lineTo(cx + bodyW, cy);
    ctx.lineTo(cx, cy + bodyH);
    ctx.closePath();
    ctx.fill();

    // 3D Inner facet highlight (c0) on the left side
    fill(ctx, c0);
    ctx.beginPath();
    ctx.moveTo(cx, cy - bodyH + 3);
    ctx.lineTo(cx - bodyW * 0.4, cy);
    ctx.lineTo(cx, cy + bodyH - 3);
    ctx.closePath();
    ctx.fill();

    // Dark outline
    ctx.strokeStyle = c3;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    drawCrystal();
    ctx.stroke();

    // Inner dividing ridge line
    ctx.strokeStyle = c3;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - bodyH);
    ctx.lineTo(cx, cy + bodyH);
    ctx.stroke();
  } else if (plan === 'serpent') {
    const segs = 6 + Math.floor(genes.elongation * 5);
    for (let s = segs - 1; s >= 0; s--) {
      const t = s / (segs - 1);
      const sx = cx - bodyW * 0.8 + t * bodyW * 1.6;
      const sy = cy + Math.sin(t * Math.PI * 2.5 + genes.seed * 0.05) * bodyH * 0.3;
      const r = Math.max(3, bodyH * 0.4 * (1 - t * 0.35));
      
      // Segment body
      fill(ctx, s % 2 === 0 ? c1 : c2);
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();

      // Highlight dot
      fill(ctx, c0);
      rf(ctx, sx - r * 0.3, sy - r * 0.3, Math.max(1, r * 0.4), Math.max(1, r * 0.4));

      // Segment outline
      ctx.strokeStyle = c3;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Draw distinct head
    const hx = cx + bodyW * 0.8;
    const hy = cy + Math.sin(Math.PI * 2.5 + genes.seed * 0.05) * bodyH * 0.3;
    const hr = bodyH * 0.45;
    fill(ctx, c1);
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    ctx.fill();

    // Glossy head highlight
    fill(ctx, c0);
    ctx.beginPath();
    ctx.arc(hx - hr * 0.2, hy - hr * 0.2, hr * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Head outline
    ctx.strokeStyle = c3;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    ctx.stroke();
  } else if (plan === 'floating') {
    // Cap dome path
    const drawCap = () => {
      ctx.arc(cx, cy - bodyH * 0.1, bodyW * 0.65, Math.PI, 0);
      ctx.lineTo(cx + bodyW * 0.65, cy + bodyH * 0.1);
      ctx.quadraticCurveTo(cx, cy + bodyH * 0.25, cx - bodyW * 0.65, cy + bodyH * 0.1);
      ctx.closePath();
    };

    // Cap fill
    fill(ctx, c1);
    ctx.beginPath();
    drawCap();
    ctx.fill();

    // Shadow crescent inside cap
    ctx.save();
    ctx.beginPath();
    drawCap();
    ctx.clip();
    fill(ctx, c2);
    ctx.beginPath();
    ctx.arc(cx + bodyW * 0.1, cy - bodyH * 0.05, bodyW * 0.65, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Dome cap highlight
    fill(ctx, c0);
    ctx.beginPath();
    ctx.ellipse(cx - bodyW * 0.25, cy - bodyH * 0.2, bodyW * 0.2, bodyH * 0.1, -Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();

    // Cap outline
    ctx.strokeStyle = c3;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    drawCap();
    ctx.stroke();

    // Floating tentacles (dangling down)
    ctx.strokeStyle = c2;
    ctx.lineWidth = 1.2;
    for (let i = -2; i <= 2; i++) {
      const tx_offset = i * (bodyW * 0.2);
      ctx.beginPath();
      ctx.moveTo(cx + tx_offset, cy + bodyH * 0.15);
      ctx.quadraticCurveTo(
        cx + tx_offset + Math.sin(genes.seed + i) * 3, 
        cy + bodyH * 0.6, 
        cx + tx_offset + i * 2, 
        cy + bodyH * 1.1
      );
      ctx.stroke();
      
      // Fine bead on end of tentacle
      fill(ctx, c0);
      rf(ctx, cx + tx_offset + i * 2 - 1, cy + bodyH * 1.1, 2, 2);
    }

    // =========================================================================
    // LAYER 7: Interaction & Environment State (Dynamic Response)
    // Render dynamic glowing aura around floating life forms
    // =========================================================================
    if (genes.aura > 0.2) {
      fill(ctx, c0);
      ctx.globalAlpha = 0.25 + genes.aura * 0.3;
      ctx.beginPath();
      ctx.arc(cx, cy, bodyW * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  } else if (plan === 'insect') {
    // Head Segment
    const hx = cx;
    const hy = cy - bodyH * 0.55;
    const hr = Math.max(3, bodyW * 0.3);
    fill(ctx, c1);
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = c3;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Thorax Segment
    const tx_size = bodyW * 0.45;
    const ty_size = bodyH * 0.35;
    fill(ctx, c2);
    ctx.beginPath();
    ctx.ellipse(cx, cy - bodyH * 0.1, tx_size, ty_size, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Abdomen Segment (tapered and striped)
    const ax_size = bodyW * 0.4;
    const ay_size = bodyH * 0.55;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy + bodyH * 0.45, ax_size, ay_size, 0, 0, Math.PI * 2);
    fill(ctx, c1);
    ctx.fill();
    ctx.clip();
    
    // Abdomen stripes
    fill(ctx, c3);
    for (let sy = cy + bodyH * 0.1; sy < cy + bodyH * 1.1; sy += 4) {
      rf(ctx, cx - bodyW, sy, bodyW * 2, 1.5);
    }
    ctx.restore();

    // Abdomen outline
    ctx.beginPath();
    ctx.ellipse(cx, cy + bodyH * 0.45, ax_size, ay_size, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Jointed legs
    ctx.strokeStyle = c3;
    ctx.lineWidth = 1.2;
    const legs = Math.max(3, genes.limbCount);
    for (let i = 0; i < legs; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const lx = cx + side * (tx_size * 0.8);
      const ly = cy - bodyH * 0.1 + (i - (legs - 1) / 2) * (ty_size * 0.8);
      
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      // Femur
      const fx = lx + side * (bodyW * 0.5);
      const fy = ly - bodyH * 0.2;
      ctx.lineTo(fx, fy);
      // Tibia (pointing down)
      const tx_leg = fx + side * (bodyW * 0.25);
      const ty_leg = fy + bodyH * 0.5;
      ctx.lineTo(tx_leg, ty_leg);
      ctx.stroke();
    }
  } else if (plan === 'avian') {
    // Head sphere
    const hx = cx - bodyW * 0.3;
    const hy = cy - bodyH * 0.45;
    const hr = bodyW * 0.4;
    
    // Teardrop Body
    const drawAvianBody = () => {
      ctx.ellipse(cx + bodyW * 0.15, cy + bodyH * 0.1, bodyW * 0.65, bodyH * 0.55, -Math.PI / 10, 0, Math.PI * 2);
    };

    fill(ctx, c1);
    ctx.beginPath();
    drawAvianBody();
    ctx.fill();

    // Shadow on bottom of body
    ctx.save();
    ctx.beginPath();
    drawAvianBody();
    ctx.clip();
    fill(ctx, c2);
    ctx.beginPath();
    ctx.ellipse(cx + bodyW * 0.2, cy + bodyH * 0.2, bodyW * 0.65, bodyH * 0.55, -Math.PI / 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Body Outline
    ctx.strokeStyle = c3;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    drawAvianBody();
    ctx.stroke();

    // Draw Head
    fill(ctx, c1);
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    ctx.stroke();

    // Draw beak (c0 pointed)
    fill(ctx, c0);
    ctx.beginPath();
    ctx.moveTo(hx - hr * 0.8, hy - hr * 0.2);
    ctx.lineTo(hx - hr * 1.5, hy);
    ctx.lineTo(hx - hr * 0.5, hy + hr * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = c3;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Highlight on head
    fill(ctx, c0);
    ctx.beginPath();
    ctx.arc(hx - hr * 0.2, hy - hr * 0.3, hr * 0.3, 0, Math.PI * 2);
    ctx.fill();

    drawWings(ctx, genes, cx, cy - 2, c0);
  } else if (plan === 'fungal') {
    // Cap dome path
    const drawCap = () => {
      ctx.arc(cx, cy - bodyH * 0.1, bodyW * 0.75, Math.PI, 0);
      ctx.quadraticCurveTo(cx, cy, cx - bodyW * 0.75, cy - bodyH * 0.1);
      ctx.closePath();
    };

    // Cap fill
    fill(ctx, c2);
    ctx.beginPath();
    drawCap();
    ctx.fill();

    // Cap bottom shadow overlay
    ctx.save();
    ctx.beginPath();
    drawCap();
    ctx.clip();
    fill(ctx, c3);
    ctx.beginPath();
    ctx.rect(cx - bodyW, cy - bodyH * 0.2, bodyW * 2, bodyH * 0.2);
    ctx.fill();
    ctx.restore();

    // Cap spots
    fill(ctx, c0);
    for (let i = 0; i < 5; i++) {
      const sx = cx + (seedToFloat(genes.seed ^ i) - 0.5) * bodyW * 1.1;
      const sy = cy - bodyH * 0.4 + (seedToFloat(genes.seed ^ (i * 9)) - 0.5) * bodyH * 0.3;
      const sr = 2.5 + (i % 2);
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = c3;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // Cap outline
    ctx.strokeStyle = c3;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    drawCap();
    ctx.stroke();

    // Stalk
    const stalkW = Math.max(4, bodyW * 0.35);
    const stalkH = bodyH * 0.95;
    fill(ctx, c1);
    ctx.beginPath();
    ctx.rect(cx - stalkW / 2, cy - bodyH * 0.05, stalkW, stalkH);
    ctx.fill();

    // Stalk texture fiber lines
    ctx.strokeStyle = c2;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - stalkW * 0.25, cy);
    ctx.lineTo(cx - stalkW * 0.25, cy + stalkH - 2);
    ctx.moveTo(cx + stalkW * 0.25, cy + 2);
    ctx.lineTo(cx + stalkW * 0.25, cy + stalkH - 1);
    ctx.stroke();

    // Stalk outline
    ctx.strokeStyle = c3;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.rect(cx - stalkW / 2, cy - bodyH * 0.05, stalkW, stalkH);
    ctx.stroke();
  } else if (plan === 'plant') {
    // Drawing detailed leafy stem
    const stemW = Math.max(3, bodyW * 0.2);
    const stemH = bodyH * 0.9;
    fill(ctx, c2);
    ctx.beginPath();
    ctx.rect(cx - stemW / 2, cy, stemW, stemH);
    ctx.fill();
    ctx.strokeStyle = c3;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Dynamic stem leaves
    fill(ctx, c2);
    ctx.beginPath();
    ctx.ellipse(cx - stemW, cy + stemH * 0.4, stemW * 2, stemW, -Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx + stemW, cy + stemH * 0.6, stemW * 2, stemW, Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Blossoming flower petals (8-directional petals in layers)
    const petCount = 8;
    const petR = bodyW * 0.55;
    ctx.strokeStyle = c3;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < petCount; i++) {
      const a = (i / petCount) * Math.PI * 2;
      const px_pet = cx + Math.cos(a) * petR * 0.75;
      const py_pet = cy - bodyH * 0.25 + Math.sin(a) * petR * 0.75;
      
      fill(ctx, i % 2 === 0 ? c0 : c1);
      ctx.beginPath();
      ctx.arc(px_pet, py_pet, petR * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Central flower pistil/bulb
    fill(ctx, c2);
    ctx.beginPath();
    ctx.arc(cx, cy - bodyH * 0.25, petR * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner pistil seeds/details
    fill(ctx, c0);
    rf(ctx, cx - 1, cy - bodyH * 0.25 - 1, 2, 2);
  } else {
    // Default Biped/Quadruped chunky core outline & shading
    const drawDefault = () => {
      ctx.rect(cx - bodyW / 2, cy - bodyH / 2, bodyW, bodyH);
    };

    fill(ctx, c1);
    ctx.beginPath();
    drawDefault();
    ctx.fill();

    // Bottom shadow
    ctx.save();
    ctx.beginPath();
    drawDefault();
    ctx.clip();
    fill(ctx, c2);
    ctx.beginPath();
    ctx.rect(cx - bodyW / 2, cy + bodyH * 0.1, bodyW, bodyH * 0.4);
    ctx.fill();
    ctx.restore();

    // Outline
    ctx.strokeStyle = c3;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    drawDefault();
    ctx.stroke();
  }

  if (genes.symmetry === 'radial' && genes.limbCount > 2) {
    fill(ctx, c2);
    for (let i = 0; i < genes.limbCount; i++) {
      const a = (i / genes.limbCount) * Math.PI * 2;
      rf(ctx, cx + Math.cos(a) * bodyW * 0.55, cy + Math.sin(a) * bodyH * 0.45, 3, 3);
    }
  }

  if (genes.hasShell) {
    fill(ctx, c3);
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 2, bodyW * 0.55, bodyH * 0.45, 0, Math.PI, 0);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // =========================================================================
  // LAYER 5: Noise & Modulations (Organic Texture & Patterns)
  // Mask patterns (spots, stripes, rings, checkers, gradients) to body template
  // =========================================================================
  ctx.globalCompositeOperation = 'source-atop';
  drawPattern(ctx, genes, px, c2, c3);
  ctx.globalCompositeOperation = 'source-over';

  // =========================================================================
  // LAYER 6: Entity / Structure Composition (Depth-Sorted Assembly)
  // Drawing Layer: 3. Foreground attachments and facial overlays
  // =========================================================================
  drawTail(ctx, genes, cx, cy, c1, c2);

  // =========================================================================
  // LAYER 3: Objects on Instances (Appendages & scattered micro-objects)
  // Overlay secondary decorative structures (antennae, spikes, crown, horns, eyes)
  // =========================================================================
  if (genes.antennaCount > 0) {
    fill(ctx, c2);
    for (let a = 0; a < genes.antennaCount; a++) {
      const ox = (a - (genes.antennaCount - 1) / 2) * 4;
      rf(ctx, cx + ox, cy - bodyH - 8, 1, 7);
      rf(ctx, cx + ox - 1, cy - bodyH - 10, 3, 2);
    }
  }

  if (genes.spikeCount > 0) {
    fill(ctx, c3);
    for (let s = 0; s < genes.spikeCount; s++) {
      const ang = (s / genes.spikeCount) * Math.PI * 2 + seedToFloat(genes.seed ^ s) * 0.5;
      rf(
        ctx,
        cx + Math.cos(ang) * bodyW * 0.45,
        cy + Math.sin(ang) * bodyH * 0.4,
        2,
        3
      );
    }
  }

  if (genes.crownSize > 0.35) {
    fill(ctx, c0);
    const ch = 3 + Math.floor(genes.crownSize * 6);
    rf(ctx, cx - 4, cy - bodyH - ch - 4, 8, ch);
    rf(ctx, cx - 6, cy - bodyH - ch - 2, 2, 3);
    rf(ctx, cx + 4, cy - bodyH - ch - 2, 2, 3);
  }

  drawHorns(ctx, genes, cx, cy - bodyH / 2 - 4, c2);
  drawEyes(ctx, genes, cx, cy - bodyH / 4, c3, genes.eyeCount > 1 ? 5 : 0);
  drawMouth(ctx, genes, cx, cy - bodyH / 4 + 3, c3);

  // =========================================================================
  // LAYER 7: Interaction & Environment State (Dynamic Response)
  // Render high-evolution stage environmental status aura glow
  // =========================================================================
  if (genes.evolutionStage >= 4) {
    fill(ctx, c0);
    ctx.globalAlpha = 0.2 + genes.evolutionStage * 0.05;
    ctx.beginPath();
    ctx.arc(cx, cy, bodyW * 0.95, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  return canvas;
}

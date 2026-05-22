import Phaser from 'phaser';
import { GB } from '../palette.js';
import { drawWorld } from '../game/world-draw.js';
import { createGenesisMemory } from '../game/memory.js';
import { createTokemon } from '@tokemons/tokemon-gen';
import type { GameRuntime } from '../game/state.js';
import { TILE, viewSize } from '../config.js';

export class BootScene extends Phaser.Scene {
  private worldGfx!: Phaser.GameObjects.Graphics;
  private loadGfx!: Phaser.GameObjects.Graphics;
  private panX = 0;
  private previewRt!: GameRuntime;
  private loadProgress = 0;
  private subText!: Phaser.GameObjects.Text;
  private done = false;

  constructor() {
    super({ key: 'Boot' });
  }

  create(): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    try {
      const tokemon = createTokemon(88_888);
      this.previewRt = {
        worldSeed: 88_888,
        playerX: 0,
        playerY: 0,
        tokemon,
        placedBlocks: new Map(),
        mood: 0.5,
        memory: createGenesisMemory(tokemon, 88_888),
        lastBiome: null,
        buildMode: false,
        selectedBlock: 1,
      };

      this.worldGfx = this.add.graphics();
      this.loadGfx = this.add.graphics().setDepth(5);
      this.add.rectangle(cx, cy, this.scale.width, this.scale.height, GB.darkest, 0.35).setDepth(1);
      this.redrawWorld();

      this.time.addEvent({
        delay: 100,
        loop: true,
        callback: () => {
          this.panX += 0.05;
          this.redrawWorld();
        },
      });
    } catch (e) {
      console.error('Boot preview failed', e);
    }

    this.add
      .text(cx, cy - 32, 'TOKEMONS', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '36px',
        color: '#e8f0d0',
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.subText = this.add
      .text(cx, cy + 8, 'PRESS ENTER TO CREATE', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '14px',
        color: '#9bbc0f',
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.add
      .text(cx, cy + 56, 'P = AI settings', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '12px',
        color: '#8bac0f',
      })
      .setOrigin(0.5)
      .setDepth(10);

    const loadState = { p: 0 };
    this.tweens.add({
      targets: loadState,
      p: 1,
      duration: 1200,
      ease: 'Linear',
      onUpdate: () => {
        this.loadProgress = loadState.p;
        this.drawLoadBar(cx, cy + 28);
      },
      onComplete: () => this.goNext(),
    });

    this.input.keyboard?.on('keydown-ENTER', () => this.goNext());
    this.input.keyboard?.on('keydown-SPACE', () => this.goNext());
    this.input.on('pointerdown', () => this.goNext());

    this.time.delayedCall(1500, () => this.goNext());
  }

  goNext(): void {
    if (this.done) return;
    this.done = true;

    this.scene.start('Create');
  }

  private redrawWorld(): void {
    if (!this.previewRt || !this.worldGfx) return;
    const { viewW, viewH } = viewSize(this.scale.width, this.scale.height);
    const offsetX = Math.floor(Math.sin(this.panX) * 10);
    const offsetY = Math.floor(Math.cos(this.panX * 0.7) * 5);
    drawWorld(this.worldGfx, this.previewRt, offsetX, offsetY, viewW, viewH, TILE, this.time.now);
  }

  private drawLoadBar(cx: number, cy: number): void {
    const g = this.loadGfx;
    g.clear();
    const barW = 280;
    const barH = 16;
    const x = cx - barW / 2;
    g.fillStyle(GB.dark, 1);
    g.fillRect(x, cy, barW, barH);
    g.fillStyle(GB.light, 1);
    g.fillRect(x + 2, cy + 2, Math.max(0, (barW - 4) * this.loadProgress), barH - 4);
    if (this.loadProgress >= 1) this.subText?.setText('starting...');
  }
}

import Phaser from 'phaser';
import { bakeTokemonCanvas, createTokemon } from '@tokemons/tokemon-gen';
import { enrichTokemonDescriptionBackground } from '../lib/api.js';
import { makeContext, sampleCell } from '@tokemons/kernel';
import { GB } from '../palette.js';
import {
  clearSave,
  loadGame,
  newRuntime,
  runtimeFromSave,
  saveGame,
} from '../game/state.js';
import { recordEpisode } from '../game/memory.js';
import { ensureGenes } from '@tokemons/tokemon-gen';

export class CreateScene extends Phaser.Scene {
  private tokemonSeed = ((Date.now() * 2654435761) >>> 0) as number;
  private previewKey = 'tokemon_preview';
  private beginning = false;
  private hasSave = false;
  private controls!: Phaser.GameObjects.Text;
  private backdrop?: Phaser.GameObjects.Graphics;
  private stage?: Phaser.GameObjects.Graphics;
  private copyPanels?: Phaser.GameObjects.Graphics;
  private clouds: { graphics: Phaser.GameObjects.Graphics; x: number; y: number; speed: number; scale: number }[] = [];
  private rings: { graphics: Phaser.GameObjects.Graphics; radius: number; alpha: number }[] = [];
  
  private titleText!: Phaser.GameObjects.Text;
  private titleShadow!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private previewSprite?: Phaser.GameObjects.Image;
  private timeElapsed = 0;

  constructor() {
    super({ key: 'Create' });
  }

  create(): void {
    this.beginning = false;
    this.previewSprite = undefined;
    this.timeElapsed = 0;
    this.clouds = [];
    this.rings = [];
    
    this.input.keyboard?.removeAllListeners();
    this.cameras.main.setBackgroundColor(GB.darkest);
    
    this.hasSave = loadGame() != null;
    this.drawBackdrop();

    const { width, height } = this.scale;
    const cx = width / 2;
    
    const titleY = Math.max(24, height * 0.1);
    
    this.titleShadow = this.add
      .text(cx + 2, titleY + 2, 'CREATE TOKEMON', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '20px',
        color: '#0f380f',
      })
      .setOrigin(0.5, 0);

    this.titleText = this.add
      .text(cx, titleY, 'CREATE TOKEMON', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '20px',
        color: '#e8f0d0',
      })
      .setOrigin(0.5, 0);

    const hintY = height * 0.7;

    this.hint = this.add
      .text(cx, hintY, '', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '12px',
        color: '#e8f0d0',
        stroke: '#0f380f',
        strokeThickness: 4,
        align: 'center',
        wordWrap: { width: Math.min(720, width - 80) },
      })
      .setDepth(2)
      .setOrigin(0.5, 0);

    this.refreshPreview();

    const controlsY = height * 0.9;

    this.controls = this.add
      .text(cx, controlsY, this.controlsText(), {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '12px',
        color: '#e8f0d0',
        stroke: '#0f380f',
        strokeThickness: 4,
      })
      .setDepth(2)
      .setOrigin(0.5, 0);

    this.input.keyboard?.on('keydown-R', () => {
      if (this.beginning) return;
      this.tokemonSeed = (Math.random() * 0x7fffffff) | 0;
      this.refreshPreview();
    });
    this.input.keyboard?.on('keydown-ENTER', () => this.begin());
    this.input.keyboard?.on('keydown-C', () => this.continueSaved());
    this.input.keyboard?.on('keydown-L', () => {
      clearSave();
      this.hasSave = false;
      this.controls.setText(this.controlsText());
      this.hint.setText('Save cleared.');
    });

    this.scale.on('resize', this.handleResize, this);
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.cameras.resize(gameSize.width, gameSize.height);
    this.drawBackdrop();
    
    const { width, height } = gameSize;
    const cx = width / 2;
    
    const titleY = Math.max(24, height * 0.1);
    this.titleShadow.setPosition(cx + 2, titleY + 2);
    this.titleText.setPosition(cx, titleY);
    
    const hintY = height * 0.7;
    this.hint.setPosition(cx, hintY);
    this.hint.setStyle({ wordWrap: { width: Math.min(720, width - 80) }});
    
    const controlsY = height * 0.9;
    this.controls.setPosition(cx, controlsY);
    
    const previewY = height * 0.4;
    if (this.previewSprite) {
      this.previewSprite.setPosition(cx, previewY);
    }
  }

  update(_time: number, delta: number): void {
    this.timeElapsed += delta;
    const { width, height } = this.scale;
    const cx = width / 2;
    const previewY = height * 0.4;

    // Floating sprite
    if (this.previewSprite) {
      const floatOffset = Math.sin(this.timeElapsed / 500) * 8;
      this.previewSprite.y = previewY + floatOffset;
    }

    // Move clouds
    for (const cloud of this.clouds) {
      cloud.x += cloud.speed * (delta / 16);
      if (cloud.x > width + 100) {
        cloud.x = -100;
        cloud.y = Math.random() * height * 0.5;
      }
      cloud.graphics.setPosition(cloud.x, cloud.y);
    }

    // Expanding rings
    for (const ring of this.rings) {
      ring.radius += delta * 0.05;
      ring.alpha -= delta * 0.0005;
      
      if (ring.alpha <= 0 || ring.radius > 200) {
        ring.radius = 50;
        ring.alpha = 0.6;
      }
      
      ring.graphics.clear();
      ring.graphics.lineStyle(2, 0xe8f0d0, ring.alpha);
      ring.graphics.strokeCircle(cx, previewY, ring.radius);
    }
  }

  private drawBackdrop(): void {
    this.backdrop?.destroy();
    this.stage?.destroy();
    this.copyPanels?.destroy();
    
    // Clear old rings and clouds graphics
    this.clouds.forEach(c => c.graphics.destroy());
    this.rings.forEach(r => r.graphics.destroy());
    this.clouds = [];
    this.rings = [];

    const { width, height } = this.scale;
    const cx = width / 2;
    
    const titleY = Math.max(24, height * 0.1);
    const previewY = height * 0.4;
    const platformY = previewY + 74;

    const g = this.add.graphics().setDepth(-10);
    this.backdrop = g;

    g.fillStyle(0x0f380f, 1).fillRect(0, 0, width, height);
    g.fillStyle(0x1f4d2a, 1).fillRect(0, 0, width, height);
    g.fillStyle(0x2f5f37, 1).fillRect(0, height * 0.45, width, height * 0.55);
    g.fillStyle(0x132f24, 1).fillRect(0, height * 0.7, width, height * 0.3);

    g.fillStyle(GB.lightest, 1).fillCircle(width - 126, titleY + 54, 34);
    g.fillStyle(0x9bbc0f, 1).fillCircle(width - 126, titleY + 54, 22);

    g.fillStyle(0x0f380f, 1);
    g.fillTriangle(0, height * 0.48, width * 0.18, height * 0.22, width * 0.38, height * 0.48);
    g.fillTriangle(width * 0.22, height * 0.48, width * 0.46, height * 0.18, width * 0.72, height * 0.48);
    g.fillTriangle(width * 0.58, height * 0.48, width * 0.82, height * 0.24, width, height * 0.48);

    g.fillStyle(0x306230, 1);
    g.fillTriangle(0, height * 0.56, width * 0.26, height * 0.34, width * 0.55, height * 0.56);
    g.fillTriangle(width * 0.45, height * 0.56, width * 0.7, height * 0.31, width, height * 0.56);

    g.lineStyle(1, 0x8bac0f, 0.16);
    for (let x = 0; x < width; x += 32) g.lineBetween(x, height * 0.7, x - 78, height);
    for (let y = height * 0.72; y < height; y += 26) g.lineBetween(0, y, width, y);

    for (let x = 24; x < width; x += 64) {
      const y = height - 52 - ((x / 64) % 3) * 12;
      g.fillStyle(0x9bbc0f, 0.5).fillRect(x, y, 16, 16);
      g.fillStyle(0x0f380f, 1).fillRect(x + 6, y + 6, 4, 22);
    }

    // Clouds
    for (let i = 0; i < 4; i++) {
      const cg = this.add.graphics().setDepth(-9);
      cg.fillStyle(0xe8f0d0, 0.3);
      cg.fillCircle(0, 0, 20);
      cg.fillCircle(15, -10, 25);
      cg.fillCircle(30, 0, 20);
      cg.fillCircle(15, 10, 15);
      
      const cx_cloud = Math.random() * width;
      const cy_cloud = Math.random() * height * 0.4;
      cg.setPosition(cx_cloud, cy_cloud);
      
      this.clouds.push({
        graphics: cg,
        x: cx_cloud,
        y: cy_cloud,
        speed: 0.2 + Math.random() * 0.5,
        scale: 0.5 + Math.random() * 0.5
      });
      cg.setScale(this.clouds[this.clouds.length-1].scale);
    }

    const s = this.add.graphics().setDepth(-1);
    this.stage = s;
    s.fillStyle(0x0f380f, 0.45).fillRoundedRect(cx - 150, previewY - 78, 300, 205, 8);
    s.lineStyle(2, 0xe8f0d0, 0.65).strokeRoundedRect(cx - 150, previewY - 78, 300, 205, 8);
    s.lineStyle(1, 0x9bbc0f, 0.35).strokeRoundedRect(cx - 138, previewY - 66, 276, 181, 4);
    s.fillStyle(0xe8f0d0, 0.16).fillCircle(cx, previewY, 86);
    s.fillStyle(0x9bbc0f, 0.18).fillCircle(cx, previewY, 58);
    s.fillStyle(0x0f380f, 0.55).fillEllipse(cx, platformY, 176, 30);
    s.fillStyle(0xe8f0d0, 0.42).fillEllipse(cx, platformY - 3, 122, 16);

    // Initial rings
    for (let i = 0; i < 2; i++) {
      const rg = this.add.graphics().setDepth(0);
      this.rings.push({
        graphics: rg,
        radius: 50 + i * 75,
        alpha: 0.6 - i * 0.3
      });
    }

    const hintY = height * 0.7;
    const controlsY = height * 0.9;
    const p = this.add.graphics().setDepth(1);
    this.copyPanels = p;
    p.fillStyle(0x0f380f, 0.72).fillRoundedRect(cx - 390, hintY - 14, 780, 100, 8);
    p.lineStyle(1, 0xe8f0d0, 0.45).strokeRoundedRect(cx - 390, hintY - 14, 780, 100, 8);
    p.fillStyle(0x0f380f, 0.82).fillRoundedRect(cx - 430, controlsY - 10, 860, 36, 6);
    p.lineStyle(1, 0x9bbc0f, 0.5).strokeRoundedRect(cx - 430, controlsY - 10, 860, 36, 6);
  }

  private refreshPreview(): void {
    const cx = this.scale.width / 2;
    const previewY = this.scale.height * 0.4;
    const tokemon = createTokemon(this.tokemonSeed);
    
    if (this.textures.exists(this.previewKey)) this.textures.remove(this.previewKey);
    try {
      const canvas = bakeTokemonCanvas(tokemon.genes, 72);
      this.textures.addCanvas(this.previewKey, canvas);
      if (!this.previewSprite) {
        this.previewSprite = this.add.image(cx, previewY, this.previewKey).setOrigin(0.5);
      } else {
        this.previewSprite.setTexture(this.previewKey);
      }
    } catch (e) {
      console.warn('Preview sprite failed', e);
    }
    this.hint?.setText(`${tokemon.name}\n${tokemon.description}`);
  }

  private begin(): void {
    if (this.beginning) return;
    this.beginning = true;

    const tokemon = createTokemon(this.tokemonSeed);
    const rt = newRuntime(tokemon);
    const cell = sampleCell(makeContext(rt.worldSeed, 0, 0, 0, 0, 32));

    recordEpisode(rt.memory, {
      kind: 'awakening',
      text: `Chosen form locked. Entering world at ${cell.biomeId}.`,
      biome: cell.biomeId,
    });

    saveGame(rt);
    this.scene.start('Play', { runtime: rt, fresh: true });

    enrichTokemonDescriptionBackground(
      tokemon.name,
      tokemon.description,
      cell.biomeId,
      (text) => {
        tokemon.description = text;
        recordEpisode(rt.memory, {
          kind: 'discovery',
          text: `Self-image refined: ${text}`,
          biome: cell.biomeId,
        });
        saveGame(rt);
      }
    );
  }

  private continueSaved(): void {
    if (this.beginning || !this.hasSave) return;
    this.beginning = true;
    const save = loadGame();
    if (!save) {
      this.beginning = false;
      this.hasSave = false;
      this.hint.setText('No saved Tokemon found.');
      return;
    }
    try {
      const rt = runtimeFromSave(save);
      rt.tokemon.genes = ensureGenes(rt.tokemon.genes);
      this.scene.start('Play', { runtime: rt, fresh: false });
    } catch (e) {
      console.warn('Invalid save, clearing it', e);
      clearSave();
      this.beginning = false;
      this.hasSave = false;
      this.hint.setText('Old save was invalid. Roll a new Tokemon.');
    }
  }

  private controlsText(): string {
    return this.hasSave
      ? 'R reroll  ENTER new  C continue  L reset memory'
      : 'R reroll  ENTER begin  L reset memory';
  }
}

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

  constructor() {
    super({ key: 'Create' });
  }

  create(): void {
    this.beginning = false;
    this.previewSprite = undefined;
    this.input.keyboard?.removeAllListeners();
    this.cameras.main.setBackgroundColor(GB.darkest);
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    this.hasSave = loadGame() != null;
    this.drawBackdrop();

    this.add
      .text(cx + 2, Math.max(24, cy - 230) + 2, 'CREATE TOKEMON', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '20px',
        color: '#0f380f',
      })
      .setOrigin(0.5, 0);

    this.add
      .text(cx, Math.max(24, cy - 230), 'CREATE TOKEMON', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '20px',
        color: '#e8f0d0',
      })
      .setOrigin(0.5, 0);

    this.hint = this.add
      .text(cx, Math.max(180, cy - 8), '', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '12px',
        color: '#e8f0d0',
        stroke: '#0f380f',
        strokeThickness: 4,
        align: 'center',
        wordWrap: { width: Math.min(720, this.scale.width - 80) },
      })
      .setDepth(2)
      .setOrigin(0.5, 0);

    this.refreshPreview();

    this.controls = this.add
      .text(cx, Math.min(this.scale.height - 36, cy + 220), this.controlsText(), {
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
  }

  private hint!: Phaser.GameObjects.Text;
  private previewSprite?: Phaser.GameObjects.Image;

  private drawBackdrop(): void {
    this.backdrop?.destroy();
    this.stage?.destroy();
    this.copyPanels?.destroy();

    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    const titleY = Math.max(24, cy - 230);
    const previewY = Math.max(96, cy - 120);
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

    const s = this.add.graphics().setDepth(-1);
    this.stage = s;
    s.fillStyle(0x0f380f, 0.45).fillRoundedRect(cx - 150, previewY - 78, 300, 205, 8);
    s.lineStyle(2, 0xe8f0d0, 0.65).strokeRoundedRect(cx - 150, previewY - 78, 300, 205, 8);
    s.lineStyle(1, 0x9bbc0f, 0.35).strokeRoundedRect(cx - 138, previewY - 66, 276, 181, 4);
    s.fillStyle(0xe8f0d0, 0.16).fillCircle(cx, previewY, 86);
    s.fillStyle(0x9bbc0f, 0.18).fillCircle(cx, previewY, 58);
    s.fillStyle(0x0f380f, 0.55).fillEllipse(cx, platformY, 176, 30);
    s.fillStyle(0xe8f0d0, 0.42).fillEllipse(cx, platformY - 3, 122, 16);

    const hintY = Math.max(174, cy - 14);
    const controlsY = Math.min(height - 46, cy + 210);
    const p = this.add.graphics().setDepth(1);
    this.copyPanels = p;
    p.fillStyle(0x0f380f, 0.72).fillRoundedRect(cx - 390, hintY, 780, 88, 8);
    p.lineStyle(1, 0xe8f0d0, 0.45).strokeRoundedRect(cx - 390, hintY, 780, 88, 8);
    p.fillStyle(0x0f380f, 0.82).fillRoundedRect(cx - 430, controlsY, 860, 36, 6);
    p.lineStyle(1, 0x9bbc0f, 0.5).strokeRoundedRect(cx - 430, controlsY, 860, 36, 6);
  }

  private refreshPreview(): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const tokemon = createTokemon(this.tokemonSeed);
    if (this.textures.exists(this.previewKey)) this.textures.remove(this.previewKey);
    try {
      if (this.textures.exists(this.previewKey)) this.textures.remove(this.previewKey);
      const canvas = bakeTokemonCanvas(tokemon.genes, 72);
      this.textures.addCanvas(this.previewKey, canvas);
      if (!this.previewSprite) {
        this.previewSprite = this.add.image(cx, Math.max(96, cy - 120), this.previewKey).setOrigin(0.5);
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

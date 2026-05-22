import Phaser from 'phaser';
import { bakeTokemonCanvas, ensureGenes } from '@tokemons/tokemon-gen';
import type { BiomeId } from '@tokemons/kernel';
import { GB } from '../palette.js';
import type { GameRuntime } from '../game/state.js';
import { blockKey, saveGame } from '../game/state.js';
import { SpatialEventBus } from '../game/events.js';
import { drawWorld, isWalkable, findNearestWalkable } from '../game/world-draw.js';
import { ChatPanel } from '../ui/chat.js';
import { noteBiome, noteWander, recordEpisode, spendLLM, mintLLM, formatMemoryForPrompt, getAwakeningLevel } from '../game/memory.js';
import { getCell } from '../game/world-draw.js';
import { TILE, viewSize } from '../config.js';
import { chatCompletion, extractReply } from '../lib/api.js';
import { cellSeed, seedToFloat } from '@tokemons/kernel';
import { BUILD_PARTS, getBuildPart, nextBuildPartId } from '../game/build-catalog.js';
const MOVE_COOLDOWN_MS = 96;
const WORLD_CHUNK_SIZE = 32;
const MINEABLE_PROPS = new Set([
  'crystal',
  'ruin',
  'shell',
  'mushroom',
  'flower',
  'blossom',
  'berry_bush',
  'cactus',
  'rune_stone',
  'obelisk',
]);

interface MoveTweenTarget {
  pX: number;
  pY: number;
  fX: number;
  fY: number;
}

export class PlayScene extends Phaser.Scene {
  private rt!: GameRuntime;
  private worldGfx!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private player!: Phaser.GameObjects.Image;
  private follower!: Phaser.GameObjects.Image | Phaser.GameObjects.Arc;
  private shadow!: Phaser.GameObjects.Ellipse;
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private hudBg!: Phaser.GameObjects.Graphics;
  private spatialEvents = new SpatialEventBus();
  private chat!: ChatPanel;
  private moveLock = false;
  private visualPlayerX = 0;
  private visualPlayerY = 0;
  private camX = 0;
  private camY = 0;
  private followerX = 0;
  private followerY = 0;
  private faceDx = 0;
  private faceDy = 1;
  private lastProp = '';
  private keys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  };
  private autonomousMode = false;
  private autoMoveCooldown = 0;
  private speechBubble?: Phaser.GameObjects.Container;
  private speechTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super({ key: 'Play' });
  }

  init(data: { runtime?: GameRuntime; fresh?: boolean }): void {
    if (!data?.runtime) {
      this.scene.start('Create');
      return;
    }
    this.rt = data.runtime;
    this.rt.tokemon.genes = ensureGenes(this.rt.tokemon.genes);
    this.visualPlayerX = this.rt.playerX;
    this.visualPlayerY = this.rt.playerY;
    this.camX = this.rt.playerX;
    this.camY = this.rt.playerY;
    this.followerX = this.rt.playerX - 1;
    this.followerY = this.rt.playerY;
    this.freshStart = data.fresh ?? false;
  }

  private freshStart = false;

  create(): void {
    this.cameras.main.setBackgroundColor(GB.darkest);
    this.worldGfx = this.add.graphics();
    this.hudBg = this.add.graphics().setScrollFactor(0).setDepth(19);

    const trainerKey = bakeTrainer(this);
    this.player = this.add.image(0, 0, trainerKey).setOrigin(0.5, 0.85).setDepth(5).setScale(1.25);
    this.player.setVisible(true);
    this.playerShadow = this.add.ellipse(0, 0, 21, 6, 0x0f380f, 0.4).setDepth(3);

    try {
      const canvas = bakeTokemonCanvas(this.rt.tokemon.genes, 48);
      const key = `tokemon_${this.rt.tokemon.genes.seed}`;
      if (this.textures.exists(key)) this.textures.remove(key);
      this.textures.addCanvas(key, canvas);
      this.follower = this.add.image(0, 0, key).setOrigin(0.5, 0.85).setDepth(4);
      this.shadow = this.add.ellipse(0, 0, 23, 7, 0x0f380f, 0.4).setDepth(3);
    } catch (e) {
      console.warn('Sprite bake failed', e);
      this.follower = this.add.circle(0, 0, 16, 0x9bbc0f).setDepth(4);
      this.shadow = this.add.ellipse(0, 0, 23, 7, 0x0f380f, 0.4).setDepth(3);
    }

    this.hud = this.add
      .text(12, 12, '', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '11px',
        color: '#e8f0d0',
        lineSpacing: 4,
      })
      .setScrollFactor(0)
      .setDepth(20);

    this.chat = new ChatPanel(this.rt, () => this.spatialEvents.recent(), (text) => this.showSpeechBubble(text));
    document.getElementById('build-hint')!.classList.toggle('hidden', !this.rt.buildMode);

    const kb = this.input.keyboard!;
    this.keys = {
      W: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      cursors: kb.createCursorKeys(),
    };

    kb.on('keydown-T', () => this.chat.toggle());
    kb.on('keydown-B', () => {
      this.rt.buildMode = !this.rt.buildMode;
      document.getElementById('build-hint')!.classList.toggle('hidden', !this.rt.buildMode);
      this.refreshHud();
    });
    this.bindBuildHotkeys(kb);
    kb.on('keydown-E', () => this.inspectOrMine());
    kb.on('keydown-F', () => this.toggleAutonomousMode());
    kb.on('keydown-BACKSPACE', () => this.clearBlockAhead());
    kb.on('keydown-DELETE', () => this.clearBlockAhead());

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerPlace(p));

    this.spatialEvents.on((e) => {
      if (e.type === 'entered_biome') this.rt.mood = Math.min(1, this.rt.mood + 0.02);
    });

    this.scale.on('resize', () => this.sync());
    this.sync();

    // Unstuck / Safe Spawn check
    if (!isWalkable(this.rt, this.rt.playerX, this.rt.playerY)) {
      const safePos = findNearestWalkable(this.rt, this.rt.playerX, this.rt.playerY);
      this.rt.playerX = safePos.x;
      this.rt.playerY = safePos.y;
      this.visualPlayerX = safePos.x;
      this.visualPlayerY = safePos.y;
      this.followerX = safePos.x - 1;
      this.followerY = safePos.y;
      saveGame(this.rt);
    }

    if (this.freshStart) {
      const cell = getCell(this.rt, this.rt.playerX, this.rt.playerY);
      noteBiome(this.rt.memory, cell.biomeId, this.rt.playerX, this.rt.playerY);
      this.time.delayedCall(600, () => {
        this.chat.show();
        void this.chat.runAwakeningIntro(cell.biomeId);
      });
    }
  }

  update(): void {
    // Smooth cinematic camera lag chasing the visual player
    const lerpFactor = 0.26;
    this.camX += (this.visualPlayerX - this.camX) * lerpFactor;
    this.camY += (this.visualPlayerY - this.camY) * lerpFactor;
    this.sync();

    // Alternate walking frame textures during active movement (moveLock)
    if (this.moveLock) {
      const walkFrame = Math.floor(this.time.now / 100) % 2;
      this.player.setTexture(walkFrame === 0 ? 'trainer_walk1' : 'trainer_walk2');
    } else {
      this.player.setTexture('trainer_idle');
    }

    if (this.autonomousMode && !this.moveLock) {
      this.autoMoveCooldown -= this.game.loop.delta;
      if (this.autoMoveCooldown <= 0) {
        this.autoMoveCooldown = 400;
        void this.autonomousStep();
      }
    }

    if (this.moveLock || this.autonomousMode) return;
    let dx = 0;
    let dy = 0;
    if (this.keys.A.isDown || this.keys.cursors.left.isDown) dx = -1;
    if (this.keys.D.isDown || this.keys.cursors.right.isDown) dx = 1;
    if (this.keys.W.isDown || this.keys.cursors.up.isDown) dy = -1;
    if (this.keys.S.isDown || this.keys.cursors.down.isDown) dy = 1;
    if (dx !== 0 || dy !== 0) void this.tryMove(dx, dy);
  }

  private async tryMove(dx: number, dy: number): Promise<void> {
    const nx = this.rt.playerX + dx;
    const ny = this.rt.playerY + dy;
    if (!isWalkable(this.rt, nx, ny)) {
      this.spatialEvents.push({ type: 'blocked', detail: 'terrain' });
      return;
    }
    this.faceDx = dx;
    this.faceDy = dy;

    // Flip sprite horizontally to face left/right movement direction
    if (dx < 0) {
      this.player.setFlipX(true);
    } else if (dx > 0) {
      this.player.setFlipX(false);
    }

    this.moveLock = true;

    const startX = this.rt.playerX;
    const startY = this.rt.playerY;

    this.rt.playerX = nx;
    this.rt.playerY = ny;
    this.recordVisitation(nx, ny);
    noteWander(this.rt.memory);

    const cell = getCell(this.rt, nx, ny);
    const placedBlockId = this.rt.placedBlocks.get(blockKey(nx, ny));
    const isRoad =
      (placedBlockId != null && getBuildPart(placedBlockId).walkable) ||
      cell.biomeId === 'town_core' ||
      cell.biomeId === 'ancient_ruins';
    if (isRoad) {
      this.rt.memory.energy = Math.min(100, this.rt.memory.energy + 5);
    } else {
      let drain = 1;
      if (cell.biomeId === 'mountain' || cell.biomeId === 'wetland') drain = 3;
      else if (cell.biomeId === 'deep_forest') drain = 2;
      this.rt.memory.energy = Math.max(0, this.rt.memory.energy - drain);
    }
    
    const complexity = cell.elevation + cell.moisture + cell.vegetation + cell.weirdness;
    this.rt.memory.entropy = Math.min(100, complexity * 30);
    
    if (cell.propId === 'crystal' || cell.propId === 'flower') {
      this.rt.memory.creativity = Math.min(100, this.rt.memory.creativity + 15);
    } else {
      this.rt.memory.creativity += (50 - this.rt.memory.creativity) * 0.1;
    }

    if (this.rt.memory.wanderSteps % 20 === 0 && this.autonomousMode) {
      void this.triggerAutonomousReflection(cell.biomeId);
    }

    // Coordinated double-tween: slides player to target and follower to player's left-behind spot
    const target: MoveTweenTarget = {
      pX: this.visualPlayerX,
      pY: this.visualPlayerY,
      fX: this.followerX,
      fY: this.followerY,
    };

    this.tweens.add({
      targets: target,
      pX: nx,
      pY: ny,
      fX: startX,
      fY: startY,
      duration: MOVE_COOLDOWN_MS,
      ease: 'Sine.easeInOut',
      onUpdate: (_t, target) => {
        const step = target as MoveTweenTarget;
        this.visualPlayerX = step.pX;
        this.visualPlayerY = step.pY;
        this.followerX = step.fX;
        this.followerY = step.fY;
      },
      onComplete: () => {
        this.visualPlayerX = nx;
        this.visualPlayerY = ny;
        this.followerX = startX;
        this.followerY = startY;
        this.moveLock = false;
      }
    });

    saveGame(this.rt);
  }

  private placeBlockAhead(): void {
    if (!this.rt.buildMode) return;
    const wx = this.rt.playerX + (this.faceDx || 0);
    const wy = this.rt.playerY + (this.faceDy || 1);
    this.placeSelectedBuildPart(wx, wy);
  }

  private onPointerPlace(p: Phaser.Input.Pointer): void {
    if (!this.rt.buildMode) return;
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const wx = this.rt.playerX + Math.round((p.x - cx) / TILE);
    const wy = this.rt.playerY + Math.round((p.y - cy) / TILE);
    if (Math.abs(wx - this.rt.playerX) + Math.abs(wy - this.rt.playerY) > 3) return;

    this.placeSelectedBuildPart(wx, wy);
  }

  private placeSelectedBuildPart(wx: number, wy: number): void {
    const part = getBuildPart(this.rt.selectedBlock);
    if (!part.walkable && wx === this.rt.playerX && wy === this.rt.playerY) {
      this.showSpeechBubble("Can't build that under your feet.");
      return;
    }

    if (!spendLLM(this.rt.memory, part.cost, `built ${part.name}`)) {
      this.showSpeechBubble(`Need ${part.cost} $LLM to build ${part.shortName}.`);
      return;
    }

    this.rt.placedBlocks.set(blockKey(wx, wy), part.id);
    this.spatialEvents.push({ type: 'player_placed_block', detail: part.key });
    recordEpisode(this.rt.memory, {
      kind: 'build',
      text: `Built ${part.name} at (${wx},${wy}). The village grows.`,
      wx,
      wy,
    });
    this.sync();
    saveGame(this.rt);
  }

  private clearBlockAhead(): void {
    if (!this.rt.buildMode) return;
    const wx = this.rt.playerX + (this.faceDx || 0);
    const wy = this.rt.playerY + (this.faceDy || 1);
    const key = blockKey(wx, wy);
    if (!this.rt.placedBlocks.has(key)) {
      this.showSpeechBubble("Nothing built there.");
      return;
    }
    this.rt.placedBlocks.delete(key);
    this.spatialEvents.push({ type: 'player_placed_block', detail: 'cleared' });
    recordEpisode(this.rt.memory, {
      kind: 'build',
      text: `Cleared village tile at (${wx},${wy}).`,
      wx,
      wy,
    });
    this.sync();
    saveGame(this.rt);
  }

  private bindBuildHotkeys(kb: Phaser.Input.Keyboard.KeyboardPlugin): void {
    const keyNames = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
    for (let i = 0; i < BUILD_PARTS.length; i++) {
      kb.on(`keydown-${keyNames[i]}`, () => {
        this.rt.selectedBlock = BUILD_PARTS[i]!.id;
        this.refreshHud();
      });
    }
    kb.on('keydown-Q', () => {
      if (!this.rt.buildMode) return;
      this.rt.selectedBlock = nextBuildPartId(this.rt.selectedBlock, -1);
      this.refreshHud();
    });
    kb.on('keydown-R', () => {
      if (!this.rt.buildMode) return;
      this.rt.selectedBlock = nextBuildPartId(this.rt.selectedBlock, 1);
      this.refreshHud();
    });
  }

  private sync(): void {
    const { viewW, viewH } = viewSize(this.scale.width, this.scale.height);
    const cell = drawWorld(
      this.worldGfx,
      this.rt,
      this.camX,
      this.camY,
      viewW,
      viewH,
      TILE,
      this.time.now
    );
    if (this.rt.lastBiome !== cell.biomeId) {
      if (this.rt.lastBiome != null) {
        this.spatialEvents.push({ type: 'entered_biome', biome: cell.biomeId as BiomeId });
      }
      const isNew = noteBiome(this.rt.memory, cell.biomeId, this.rt.playerX, this.rt.playerY);
      if (isNew && this.rt.lastBiome != null) {
        this.triggerBiomeDiscovery(cell.biomeId);
      }
      this.rt.lastBiome = cell.biomeId;
      saveGame(this.rt);
    }
    const propKey = `${cell.propId}`;
    if (
      propKey !== 'none' &&
      propKey !== 'grass' &&
      propKey !== 'flower' &&
      propKey !== this.lastProp
    ) {
      this.lastProp = propKey;
      this.spatialEvents.push({ type: 'bump_prop', detail: cell.propId });
    }
    this.positionEntities();
    this.refreshHud(cell.biomeId);
  }

  private positionEntities(): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    this.player.setPosition(cx, cy);
    if (this.playerShadow) {
      this.playerShadow.setPosition(cx, cy + 4);
    }
    this.follower.setPosition(
      cx + (this.followerX - this.camX) * TILE,
      cy + (this.followerY - this.camY) * TILE
    );
    if (this.shadow) {
      this.shadow.setPosition(
        cx + (this.followerX - this.camX) * TILE,
        cy + (this.followerY - this.camY) * TILE + 4
      );
    }
    this.positionSpeechBubble();
  }

  private refreshHud(biome?: string): void {
    const mem = this.rt.memory;
    const currentBiome = (biome ?? this.rt.lastBiome ?? '?').toUpperCase();
    const posStr = `(${this.rt.playerX},${this.rt.playerY})`;
    const modeStr = this.autonomousMode ? '[AUTO]' : '[MANUAL]';
    
    const levelInfo = getAwakeningLevel(mem.visitedCoords.length);
    const levelStr = `${levelInfo.title} (LV${levelInfo.level})`;

    this.hud.setText(
      [
        `=== ${this.rt.tokemon.name.toUpperCase()} ===`,
        `AWKN : ${levelStr}`,
        `BIOME: ${currentBiome}`,
        `POS  : ${posStr} ${modeStr}`,
        `----------------`,
        `$LLM : ${mem.llmBalance} Tokens`,
        `INSP : ${mem.inspiration.toFixed(0)}/100 (Novel)`,
        `ENTR : ${mem.entropy.toFixed(0)}/100 (Chaos)`,
        `CREA : ${mem.creativity.toFixed(0)}/100 (Drift)`,
        `NRGY : ${mem.energy}/100 (Fuel)`,
        `----------------`,
        this.rt.buildMode 
          ? `BLD  : ${this.buildHudLine()}` 
          : `F Auto T Talk B Build`,
      ].join('\n')
    );

    // Draw the gorgeous retro translucent Game Boy DMG backplate card
    this.hudBg.clear();
    const x = 2;
    const y = 2;
    const w = 265;
    const h = 204;
    
    // Background: solid darkest Game Boy green with high opacity (0.85) to block terrain text clutter
    this.hudBg.fillStyle(0x0f380f, 0.85);
    this.hudBg.fillRoundedRect(x, y, w, h, 4);
    
    // Double retro borders:
    // Outer border (lightest GB shade)
    this.hudBg.lineStyle(2, 0xe8f0d0, 1);
    this.hudBg.strokeRoundedRect(x, y, w, h, 4);
    
    // Inner border (muted light GB shade)
    this.hudBg.lineStyle(1, 0x9bbc0f, 1);
    this.hudBg.strokeRoundedRect(x + 3, y + 3, w - 6, h - 6, 2);
  }

  private buildHudLine(): string {
    const part = getBuildPart(this.rt.selectedBlock);
    return `${part.id} ${part.shortName} $${part.cost} E/Q/R`;
  }

  private showSpeechBubble(text: string): void {
    if (this.speechBubble) this.speechBubble.destroy();
    if (this.speechTimer) this.speechTimer.destroy();

    const T_WIDTH = 220;
    const T_PADDING = 10;
    
    const tempText = this.make.text({
      x: 0,
      y: 0,
      text,
      style: {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#0f380f',
        wordWrap: { width: T_WIDTH - T_PADDING * 2, useAdvancedWrap: true }
      }
    });
    
    const textHeight = Math.max(16, tempText.height);
    const bubbleH = textHeight + T_PADDING * 2;
    const bubbleW = T_WIDTH;

    const gfx = this.add.graphics();
    gfx.fillStyle(0xe8f0d0, 1);
    gfx.lineStyle(1, 0x0f380f, 1);
    gfx.fillRoundedRect(-bubbleW / 2, -bubbleH - 8, bubbleW, bubbleH, 4);
    gfx.strokeRoundedRect(-bubbleW / 2, -bubbleH - 8, bubbleW, bubbleH, 4);
    
    gfx.fillStyle(0xe8f0d0, 1);
    gfx.beginPath();
    gfx.moveTo(-4, -8);
    gfx.lineTo(4, -8);
    gfx.lineTo(0, -2);
    gfx.closePath();
    gfx.fill();
    
    gfx.beginPath();
    gfx.moveTo(-4, -8);
    gfx.lineTo(0, -2);
    gfx.lineTo(4, -8);
    gfx.stroke();

    const txt = this.add.text(-bubbleW / 2 + T_PADDING, -bubbleH - 8 + T_PADDING, text, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#0f380f',
      wordWrap: { width: bubbleW - T_PADDING * 2, useAdvancedWrap: true }
    });

    this.speechBubble = this.add.container(0, 0, [gfx, txt]).setDepth(30);
    this.speechBubble.setScale(0);

    this.tweens.add({
      targets: this.speechBubble,
      scaleX: 1,
      scaleY: 1,
      duration: 250,
      ease: 'Back.easeOut'
    });

    this.positionSpeechBubble();

    this.speechTimer = this.time.delayedCall(4500, () => {
      if (this.speechBubble) {
        this.tweens.add({
          targets: this.speechBubble,
          alpha: 0,
          scaleX: 0.8,
          scaleY: 0.8,
          duration: 200,
          onComplete: () => {
            this.speechBubble?.destroy();
            this.speechBubble = undefined;
          }
        });
      }
    });
  }

  private positionSpeechBubble(): void {
    if (!this.speechBubble || !this.follower) return;
    this.speechBubble.setPosition(this.follower.x, this.follower.y - 45);
  }

  private recordVisitation(wx: number, wy: number): void {
    const coordStr = `${wx},${wy}`;
    if (!this.rt.memory.visitedCoords.includes(coordStr)) {
      const prevLevelInfo = getAwakeningLevel(this.rt.memory.visitedCoords.length);
      this.rt.memory.visitedCoords.push(coordStr);
      this.rt.memory.inspiration = Math.min(100, this.rt.memory.inspiration + 5);
      
      const currentLevelInfo = getAwakeningLevel(this.rt.memory.visitedCoords.length);
      if (currentLevelInfo.level > prevLevelInfo.level) {
        this.triggerLevelUp(currentLevelInfo.level, currentLevelInfo.title);
      }
    }
  }

  private triggerLevelUp(level: number, title: string): void {
    const reward = level * 50;
    mintLLM(this.rt.memory, reward, `Awakened to Stage ${level}: ${title}`);
    
    const celebrationBubble = `*Awakens into a ${title}!* "My consciousness expands... I feel the infinite grid aligning!"`;
    this.showSpeechBubble(celebrationBubble);

    this.chat.appendPublic(
      'levelup',
      `AWAKENING LEVEL UP!\n${this.rt.tokemon.name} reached Stage ${level}: ${title}!\nReceived ${reward} $LLM Tokens!`
    );

    recordEpisode(this.rt.memory, {
      kind: 'awakening',
      text: `Sync Complete: Reached Awakening Stage ${level} (${title}). New parameters integrated.`,
    });
    
    saveGame(this.rt);
    this.refreshHud();
  }

  private triggerBiomeDiscovery(biomeId: string): void {
    const reward = 25;
    mintLLM(this.rt.memory, reward, `Discovered ${biomeId}`);
    
    const bubbleText = `*Eyes wide with wonder* "Ah, a ${biomeId}! Let us see what secrets lie here."`;
    this.showSpeechBubble(bubbleText);
    
    this.chat.appendPublic(
      'discovery',
      `BIOME DISCOVERY!\nEntered ${biomeId.toUpperCase()} for the first time.\nReceived ${reward} $LLM Tokens!`
    );
    
    saveGame(this.rt);
    this.refreshHud();
  }

  private inspectOrMine(): void {
    if (this.rt.buildMode) {
      this.placeBlockAhead();
      return;
    }

    const tx = this.rt.playerX + (this.faceDx || 0);
    const ty = this.rt.playerY + (this.faceDy || 1); // fallback to down
    const cell = getCell(this.rt, tx, ty);
    const prop = cell.propId;

    if (!MINEABLE_PROPS.has(prop)) {
      this.showSpeechBubble("Nothing here to mine or inspect.");
      return;
    }

    const coordStr = `${tx},${ty}`;
    if (!this.rt.memory.lootedCoords) {
      this.rt.memory.lootedCoords = [];
    }

    if (this.rt.memory.lootedCoords.includes(coordStr)) {
      this.showSpeechBubble("This spot has already been looted!");
      return;
    }

    // Loot the spot!
    this.rt.memory.lootedCoords.push(coordStr);

    // Dynamic but deterministic reward based on coordinate seed
    const rVal = seededCellFloat(this.rt.worldSeed, tx, ty, 23);
    const reward = Math.floor(15 + rVal * 21); // 15 to 35

    mintLLM(this.rt.memory, reward, `Mined ${prop} at (${tx},${ty})`);
    this.rt.memory.inspiration = Math.min(100, this.rt.memory.inspiration + 10);
    this.rt.memory.energy = Math.min(100, this.rt.memory.energy + 20);

    const propLabel = prop.replace('_', ' ').toUpperCase();
    const celebrationBubble = `*Mined ${propLabel}!* "Found ${reward} $LLM inside this pattern!"`;
    this.showSpeechBubble(celebrationBubble);

    this.chat.appendPublic(
      'discovery',
      `RELIC MINED!\nExtracted ${propLabel} at (${tx}, ${ty}).\nFound ${reward} $LLM Tokens!\nInspiration +10 | Energy +20`
    );

    recordEpisode(this.rt.memory, {
      kind: 'build',
      text: `Mined ${propLabel} relic at (${tx},${ty}). Extracted ${reward} $LLM.`,
      wx: tx,
      wy: ty,
    });

    saveGame(this.rt);
    this.refreshHud();
  }

  private toggleAutonomousMode(enabled?: boolean): void {
    this.autonomousMode = enabled ?? !this.autonomousMode;
    this.showSpeechBubble(this.autonomousMode ? "[AUTO MODE: ENABLED]" : "[AUTO MODE: DISABLED]");
    this.refreshHud();
  }

  private async autonomousStep(): Promise<void> {
    if (this.rt.memory.energy <= 0) {
      this.showSpeechBubble("*Falls asleep due to exhaustion* Zzz...");
      this.toggleAutonomousMode(false);
      return;
    }

    const px = this.rt.playerX;
    const py = this.rt.playerY;
    const candidates = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
    ];
    
    const walkable = candidates.filter(c => isWalkable(this.rt, px + c.dx, py + c.dy));
    if (walkable.length === 0) return;

    const scored = walkable.map(c => {
      const nx = px + c.dx;
      const ny = py + c.dy;
      const coordStr = `${nx},${ny}`;
      const cell = getCell(this.rt, nx, ny);
      
      const isVisited = this.rt.memory.visitedCoords.includes(coordStr);
      const unvisitedBoost = isVisited ? 0 : 15;
      
      const hasSeenBiome = this.rt.memory.biomesSeen.includes(cell.biomeId);
      const newBiomeBoost = hasSeenBiome ? 0 : 30;

      const ucbVal = seededCellFloat(this.rt.worldSeed, nx, ny, 12) * 5; 
      
      return { candidate: c, utility: unvisitedBoost + newBiomeBoost + ucbVal };
    });

    scored.sort((a, b) => b.utility - a.utility);
    
    const pickRandom = seedToFloat(this.rt.worldSeed ^ (this.rt.memory.wanderSteps * 17)) < 0.10;
    const chosen = pickRandom 
      ? scored[Math.floor(seedToFloat(this.rt.worldSeed ^ (this.rt.memory.wanderSteps * 59)) * scored.length)]!.candidate
      : scored[0]!.candidate;

    await this.tryMove(chosen.dx, chosen.dy);
  }

  private async triggerAutonomousReflection(biome: BiomeId): Promise<void> {
    if (!this.chat.beginBackgroundTurn()) return;
    try {
      const memBlock = formatMemoryForPrompt(this.rt.memory, this.rt.tokemon.name, this.rt.playerX, this.rt.playerY, biome);
      const res = await chatCompletion({
        messages: [
          {
            role: 'system',
            content: `You are ${this.rt.tokemon.name}, wandering autonomously in ${biome}. Speak your poetic self-reflection (max 20 words) inspired by your coordinates (${this.rt.playerX},${this.rt.playerY}) and current energy ${this.rt.memory.energy}%. ${memBlock}`
          },
          {
            role: 'user',
            content: `What do you see and feel at (${this.rt.playerX},${this.rt.playerY})?`
          }
        ]
      });
      const thought = extractReply(res);
      if (thought) {
        this.showSpeechBubble(thought);
        recordEpisode(this.rt.memory, { kind: 'reflection', text: thought, biome });
        saveGame(this.rt);
      }
    } catch {} finally {
      this.chat.endBackgroundTurn();
    }
  }
}

function positiveModulo(value: number, size: number): number {
  return ((value % size) + size) % size;
}

function seededCellFloat(worldSeed: number, wx: number, wy: number, salt: number): number {
  return seedToFloat(
    cellSeed(
      worldSeed,
      Math.floor(wx / WORLD_CHUNK_SIZE),
      Math.floor(wy / WORLD_CHUNK_SIZE),
      positiveModulo(wx, WORLD_CHUNK_SIZE),
      positiveModulo(wy, WORLD_CHUNK_SIZE),
      salt
    )
  );
}

function bakeTrainer(scene: Phaser.Scene): string {
  // Snapped GB DMG Palette colors
  const c0 = '#e8f0d0'; // Highlight / Skin
  const c1 = '#9bbc0f'; // Midtone Light / Shirt
  const c2 = '#306230'; // Midtone Dark / Pants
  const c3 = '#0f380f'; // Darkest Outline / Hair

  const idle = [
    "....3333333.....", // Cap top
    "...311111113....",
    "...311111113....",
    "...333311113....", // Visor
    "....33000033....", // Face/Eyes
    "...3003003003...", // Face
    "...3000000003...",
    "....30000003....", // Chin
    "....33222233....", // Collar
    "...3321111233...", // Shirt/Shoulders
    "..322111111223..",
    "..322111111223..",
    "..333222222333..", // Belt/Pants
    "....32233223....", // Legs
    "....32233223....",
    "....333..333...."  // Boots
  ];

  const walk1 = [
    "................", // Shifted down (body bobble)
    "....3333333.....", // Cap top
    "...311111113....",
    "...311111113....",
    "...333311113....", // Visor
    "....33000033....", // Face/Eyes
    "...3003003003...", // Face
    "...3000000003...",
    "....30000003....", // Chin
    "....33222233....", // Collar
    "...3321111233...", // Shirt/Shoulders
    "..322111111223..",
    "..333222222333..", // Belt/Pants
    "....322...23....", // Left leg active, right leg back
    "....322..333....", 
    "....333........."  
  ];

  const walk2 = [
    "................", // Shifted down (body bobble)
    "....3333333.....", // Cap top
    "...311111113....",
    "...311111113....",
    "...333311113....", // Visor
    "....33000033....", // Face/Eyes
    "...3003003003...", // Face
    "...3000000003...",
    "....30000003....", // Chin
    "....33222233....", // Collar
    "...3321111233...", // Shirt/Shoulders
    "..322111111223..",
    "..333222222333..", // Belt/Pants
    "......33223.....", // Right leg active, left leg back
    "....333..322....", 
    ".........333...."  
  ];

  const bakeFrame = (key: string, spriteData: string[]) => {
    if (scene.textures.exists(key)) return;
    const canvas = scene.textures.createCanvas(key, 32, 32);
    if (!canvas) throw new Error(`Could not create texture canvas: ${key}`);
    const ctx = canvas.context;
    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const char = spriteData[y][x];
        if (char === '.') continue;
        let color = c0;
        if (char === '1') color = c1;
        if (char === '2') color = c2;
        if (char === '3') color = c3;
        ctx.fillStyle = color;
        ctx.fillRect(x * 2, y * 2, 2, 2);
      }
    }
    canvas.refresh();
  };

  bakeFrame('trainer_idle', idle);
  bakeFrame('trainer_walk1', walk1);
  bakeFrame('trainer_walk2', walk2);

  return 'trainer_idle';
}

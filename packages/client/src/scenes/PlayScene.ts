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
import { cellSeed, seedToFloat, type WorldCell } from '@tokemons/kernel';
import { BUILD_PARTS, getBuildPart, nextBuildPartId } from '../game/build-catalog.js';
import { ProceduralAudio } from '../game/audio.js';

interface WildCreature {
  id: string;
  name: string;
  x: number;
  y: number;
  visualX: number;
  visualY: number;
  sprite: Phaser.GameObjects.Image;
  type: 'Wisp' | 'Sprout' | 'Golem' | 'Pixie';
  moveCooldown: number;
}

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
  private audio!: ProceduralAudio;
  private moveLock = false;
  private isSleeping = false;
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
    cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  };
  private autonomousMode = false;
  private autoMoveCooldown = 0;
  private speechBubble?: Phaser.GameObjects.Container;
  private speechTimer?: Phaser.Time.TimerEvent;
  private wildCreatures: WildCreature[] = [];
  private lastEncounterTime = 0;
  private clickTarget: { x: number; y: number } | null = null;
  private lastLlmInteractionTime = 0;
  private cellCache = new Map<string, WorldCell>();
  private followerWanderCooldown = 0;

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
    this.lastLlmInteractionTime = this.time.now;
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

    this.chat = new ChatPanel(this.rt, () => this.spatialEvents.recent(), (text) => {
      this.showSpeechBubble(text);
      this.lastLlmInteractionTime = this.time.now;
    });
    document.getElementById('build-hint')!.classList.toggle('hidden', !this.rt.buildMode);

    this.audio = new ProceduralAudio();
    this.audio.start(this.rt.worldSeed);
    this.events.on('shutdown', () => this.audio.dispose());

    const kb = this.input.keyboard!;
    this.keys = {
      cursors: kb.createCursorKeys(),
    };

    kb.on('keydown-ESC', (event?: KeyboardEvent) => {
      const target = event?.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.hasAttribute('contenteditable')) {
          return;
        }
      }
      if (this.isTyping() && !this.chat.isOpen()) return;
      this.chat.toggle();
    });
    kb.on('keydown-B', (event?: KeyboardEvent) => {
      const target = event?.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.hasAttribute('contenteditable')) {
          return;
        }
      }
      if (this.chat.isOpen() || this.isTyping()) return;
      this.rt.buildMode = !this.rt.buildMode;
      document.getElementById('build-hint')!.classList.toggle('hidden', !this.rt.buildMode);
      this.refreshHud();
    });
    this.bindBuildHotkeys(kb);
    kb.on('keydown-E', (event?: KeyboardEvent) => {
      const target = event?.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.hasAttribute('contenteditable')) {
          return;
        }
      }
      if (this.chat.isOpen() || this.isTyping()) return;
      this.inspectOrMine();
    });
    kb.on('keydown-F', (event?: KeyboardEvent) => {
      const target = event?.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.hasAttribute('contenteditable')) {
          return;
        }
      }
      if (this.chat.isOpen() || this.isTyping()) return;
      this.toggleAutonomousMode();
    });
    kb.on('keydown-BACKSPACE', (event?: KeyboardEvent) => {
      const target = event?.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.hasAttribute('contenteditable')) {
          return;
        }
      }
      if (this.chat.isOpen() || this.isTyping()) return;
      this.clearBlockAhead();
    });
    kb.on('keydown-DELETE', (event?: KeyboardEvent) => {
      const target = event?.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.hasAttribute('contenteditable')) {
          return;
        }
      }
      if (this.chat.isOpen() || this.isTyping()) return;
      this.clearBlockAhead();
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const target = p.event?.target as HTMLElement | null;
      if (target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'BUTTON' ||
        target.closest('#chat-panel') ||
        target.closest('#system-menu-container') ||
        target.closest('#api-settings') ||
        target.closest('#api-log-panel')
      )) {
        return;
      }
      if (this.chat.isOpen() || this.isTyping()) return;
      if (this.rt.buildMode) {
        this.onPointerPlace(p);
      } else {
        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;
        const clickedWx = this.rt.playerX + Math.round((p.x - cx) / TILE);
        const clickedWy = this.rt.playerY + Math.round((p.y - cy) / TILE);
        this.clickTarget = { x: clickedWx, y: clickedWy };
        if (this.autonomousMode) {
          this.toggleAutonomousMode(false);
        }
      }
    });

    this.spatialEvents.on((e) => {
      if (e.type === 'entered_biome') this.rt.mood = Math.min(1, this.rt.mood + 0.02);
    });

    this.scale.on('resize', () => this.sync());
    this.sync();

    // Global keyboard focus listener
    const onFocusIn = () => {
      if (this.input && this.input.keyboard) {
        this.input.keyboard.enabled = false;
      }
    };
    const onFocusOut = () => {
      if (this.input && this.input.keyboard) {
        this.input.keyboard.enabled = true;
      }
    };
    window.addEventListener('focusin', onFocusIn);
    window.addEventListener('focusout', onFocusOut);
    this.events.on('shutdown', () => {
      window.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('focusout', onFocusOut);
    });

    // Bake creature sprites
    const wispSprite = [
      "......33......",
      "....331133....",
      "...31100113...",
      "..3100000013..",
      "..3100110013..",
      "..3100110013..",
      "...31100113...",
      "....331133...."
    ];
    const sproutSprite = [
      "....33..33....", // Leaves
      "....313313....",
      ".....3113.....",
      "....330033....", // Head
      "...30000003...",
      "...30300303...", // Eyes
      "...30000003...",
      "....333333...."
    ];
    const golemSprite = [
      "....333333....",
      "...32222223...",
      "..3211221123..", // Eyes
      "..3222222223..",
      "..3322222233..",
      "...32233223...",
      "...32233223...",
      "....33..33...."
    ];
    const pixieSprite = [
      "...33....33...", // Wings
      "..3113..3113..",
      "..3110330113..", // Head
      "...33000033...",
      "....300003....",
      "....300003....",
      "....333333....",
      ".....3..3....."
    ];

    bakeCreature(this, 'creature_wisp', wispSprite);
    bakeCreature(this, 'creature_sprout', sproutSprite);
    bakeCreature(this, 'creature_golem', golemSprite);
    bakeCreature(this, 'creature_pixie', pixieSprite);

    // Initial spawn
    this.spawnWildCreaturesNearPlayer();

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

    // Update wild creatures visual position and wander AI
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    for (const c of this.wildCreatures) {
      c.moveCooldown -= this.game.loop.delta;
      if (c.moveCooldown <= 0) {
        c.moveCooldown = 1500 + Math.random() * 1500;
        const dirs = [
          { dx: 0, dy: -1 },
          { dx: 0, dy: 1 },
          { dx: -1, dy: 0 },
          { dx: 1, dy: 0 }
        ];
        let walkableNeighbors = dirs.filter(d => isWalkable(this.rt, c.x + d.dx, c.y + d.dy));
        if (walkableNeighbors.length > 0) {
          const px = this.rt.playerX;
          const py = this.rt.playerY;
          const distToPlayer = Math.abs(c.x - px) + Math.abs(c.y - py);
          if (distToPlayer <= 6 && Math.random() < 0.40) {
            const closerNeighbors = walkableNeighbors.filter(d => {
              const newDist = Math.abs((c.x + d.dx) - px) + Math.abs((c.y + d.dy) - py);
              return newDist < distToPlayer;
            });
            if (closerNeighbors.length > 0) {
              walkableNeighbors = closerNeighbors;
            }
          }
          const pick = walkableNeighbors[Math.floor(Math.random() * walkableNeighbors.length)]!;
          const startX = c.x;
          const startY = c.y;
          c.x = startX + pick.dx;
          c.y = startY + pick.dy;

          const tweenTarget = { val: 0 };
          this.tweens.add({
            targets: tweenTarget,
            val: 1,
            duration: 150,
            onUpdate: () => {
              c.visualX = startX + pick.dx * tweenTarget.val;
              c.visualY = startY + pick.dy * tweenTarget.val;
            },
            onComplete: () => {
              c.visualX = c.x;
              c.visualY = c.y;
            }
          });
        }
      }

      c.sprite.setPosition(
        cx + (c.visualX - this.camX) * TILE,
        cy + (c.visualY - this.camY) * TILE
      );
    }

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

    if (this.moveLock || this.autonomousMode || this.chat.isOpen() || this.isTyping()) return;

    const pointer = this.input.activePointer;
    if (pointer.isDown && !this.rt.buildMode) {
      const target = pointer.event?.target as HTMLElement | null;
      const isUI = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'BUTTON' ||
        target.closest('#chat-panel') ||
        target.closest('#system-menu-container') ||
        target.closest('#api-settings') ||
        target.closest('#api-log-panel')
      );
      if (!isUI) {
        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;
        const clickedWx = this.rt.playerX + Math.round((pointer.x - cx) / TILE);
        const clickedWy = this.rt.playerY + Math.round((pointer.y - cy) / TILE);
        this.clickTarget = { x: clickedWx, y: clickedWy };
        if (this.autonomousMode) {
          this.toggleAutonomousMode(false);
        }
      }
    }

    let dx = 0;
    let dy = 0;
    if (this.keys.cursors.left.isDown) dx = -1;
    if (this.keys.cursors.right.isDown) dx = 1;
    if (this.keys.cursors.up.isDown) dy = -1;
    if (this.keys.cursors.down.isDown) dy = 1;

    if (dx !== 0 || dy !== 0) {
      this.clickTarget = null;
      void this.tryMove(dx, dy);
    } else if (this.clickTarget) {
      if (this.rt.playerX === this.clickTarget.x && this.rt.playerY === this.clickTarget.y) {
        this.clickTarget = null;
      } else {
        const dxTarget = this.clickTarget.x - this.rt.playerX;
        const dyTarget = this.clickTarget.y - this.rt.playerY;
        
        let stepX = dxTarget !== 0 ? Math.sign(dxTarget) : 0;
        let stepY = dyTarget !== 0 ? Math.sign(dyTarget) : 0;
        
        let moved = false;
        if (stepX !== 0 && isWalkable(this.rt, this.rt.playerX + stepX, this.rt.playerY)) {
          void this.tryMove(stepX, 0);
          moved = true;
        } else if (stepY !== 0 && isWalkable(this.rt, this.rt.playerX, this.rt.playerY + stepY)) {
          void this.tryMove(0, stepY);
          moved = true;
        }
        
        if (!moved) {
          this.clickTarget = null;
        }
      }
    } else {
      // Trainer is stationary: process follower idle wandering AI
      this.followerWanderCooldown -= this.game.loop.delta;
      if (this.followerWanderCooldown <= 0) {
        this.followerWanderCooldown = 3000 + Math.random() * 3000;
        if (Math.random() < 0.45) {
          const dirs = [
            { dx: 0, dy: -1 },
            { dx: 0, dy: 1 },
            { dx: -1, dy: 0 },
            { dx: 1, dy: 0 }
          ];
          const px = this.rt.playerX;
          const py = this.rt.playerY;
          const fx = Math.round(this.followerX);
          const fy = Math.round(this.followerY);

          const validMoves = dirs.filter(dir => {
            const nx = fx + dir.dx;
            const ny = fy + dir.dy;
            if (nx === px && ny === py) return false;
            if (!isWalkable(this.rt, nx, ny)) return false;
            const d = Math.abs(nx - px) + Math.abs(ny - py);
            return d >= 2 && d <= 4;
          });

          if (validMoves.length > 0) {
            const pick = validMoves[Math.floor(Math.random() * validMoves.length)]!;
            const startFx = fx;
            const startFy = fy;
            const targetFx = fx + pick.dx;
            const targetFy = fy + pick.dy;

            const tweenTarget = { val: 0 };
            this.tweens.add({
              targets: tweenTarget,
              val: 1,
              duration: MOVE_COOLDOWN_MS,
              ease: 'Sine.easeInOut',
              onUpdate: () => {
                this.followerX = startFx + pick.dx * tweenTarget.val;
                this.followerY = startFy + pick.dy * tweenTarget.val;
              },
              onComplete: () => {
                this.followerX = targetFx;
                this.followerY = targetFy;
              }
            });
          }
        }
      }
    }
    
    this.checkAutomaticLlmPrompting();
  }

  private async tryMove(dx: number, dy: number): Promise<void> {
    const nx = this.rt.playerX + dx;
    const ny = this.rt.playerY + dy;
    if (!isWalkable(this.rt, nx, ny)) {
      this.spatialEvents.push({ type: 'blocked', detail: 'terrain' });
      return;
    }
    const cell = getCell(this.rt, nx, ny);
    this.audio.playFootstep(cell.biomeId);

    this.faceDx = dx;
    this.faceDy = dy;

    // Flip sprite horizontally to face left/right movement direction
    if (dx < 0) {
      this.player.setFlipX(true);
    } else if (dx > 0) {
      this.player.setFlipX(false);
    }

    this.moveLock = true;

    this.rt.playerX = nx;
    this.rt.playerY = ny;
    this.recordVisitation(nx, ny);
    noteWander(this.rt.memory);

    // Cottage research funding
    const distToCottage = this.getDistanceToNearestBlock(4);
    if (distToCottage <= 6 && this.rt.memory.wanderSteps % 10 === 0) {
      mintLLM(this.rt.memory, 1, 'Cottage proximity research grant');
      this.showSpeechBubble('*Cottage grant received* "+1 $LLM funded!"');
    }

    // Well Hydration
    const distToWell = this.getDistanceToNearestBlock(9);
    if (distToWell <= 4) {
      this.rt.memory.energy = Math.min(100, this.rt.memory.energy + 10);
    }

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

    // Spontaneous LLM interaction trigger:
    // In automode, trigger every 20 steps.
    // In manualmode, trigger every 35 steps.
    const steps = this.rt.memory.wanderSteps;
    const triggerInterval = this.autonomousMode ? 20 : 35;
    if (steps % triggerInterval === 0 && steps > 0) {
      void this.triggerAutomaticLLMInteraction(cell.biomeId);
    }

    // steps milestone: every 30 steps
    if (this.rt.memory.wanderSteps % 30 === 0 && this.rt.memory.wanderSteps > 0) {
      this.triggerSilentThought('milestone');
    }
    
    // low energy warning: trigger occasionally when dropping below 20
    if (this.rt.memory.energy < 20 && this.rt.memory.energy > 0 && (this.rt.memory.wanderSteps % 15 === 0)) {
      this.triggerSilentThought('low_energy');
    }
    
    // building proximity thought: when we step within 1 tile of any building, trigger occasionally
    if (this.rt.memory.wanderSteps % 10 === 0) {
      const cottageDist = this.getDistanceToNearestBlock(4);
      const wellDist = this.getDistanceToNearestBlock(9);
      const shrineDist = this.getDistanceToNearestBlock(2);
      const towerDist = this.getDistanceToNearestBlock(6);
      const hallDist = this.getDistanceToNearestBlock(5);
      
      if (cottageDist === 1) this.triggerSilentThought('building', 'Cottage');
      else if (wellDist === 1) this.triggerSilentThought('building', 'Well');
      else if (shrineDist === 1) this.triggerSilentThought('building', 'Shrine');
      else if (towerDist === 1) this.triggerSilentThought('building', 'Watch Tower');
      else if (hallDist === 1) this.triggerSilentThought('building', 'Guild Hall');
    }

    // Spawn and encounter checks
    this.spawnWildCreaturesNearPlayer();
    this.checkCreatureEncounter();

    // Coordinated double-tween: slides player to target and follower to its new spaced position
    const nextFollowerPos = this.getNextFollowerPos(nx, ny);
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
      fX: nextFollowerPos.x,
      fY: nextFollowerPos.y,
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
        this.followerX = nextFollowerPos.x;
        this.followerY = nextFollowerPos.y;
        this.moveLock = false;
      }
    });

    saveGame(this.rt);
  }

  private getNextFollowerPos(px: number, py: number): { x: number; y: number } {
    const fx = Math.round(this.followerX);
    const fy = Math.round(this.followerY);
    const dCurrent = Math.abs(fx - px) + Math.abs(fy - py);
    
    // If current position is walkable, not player's position, and distance is in [2, 4]
    if (dCurrent >= 2 && dCurrent <= 4 && isWalkable(this.rt, fx, fy) && !(fx === px && fy === py)) {
      return { x: fx, y: fy };
    }

    const dirs = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 }
    ];

    let bestPos = { x: fx, y: fy };
    let minDiff = Math.abs(dCurrent - 2.5);

    // Also consider stay-in-place as a candidate if walkable and not on player
    const candidates = [{ x: fx, y: fy }];
    for (const dir of dirs) {
      candidates.push({ x: fx + dir.dx, y: fy + dir.dy });
    }

    let foundBetter = false;
    for (const cand of candidates) {
      if (cand.x === px && cand.y === py) continue;
      if (!isWalkable(this.rt, cand.x, cand.y)) continue;
      
      const d = Math.abs(cand.x - px) + Math.abs(cand.y - py);
      const diff = Math.abs(d - 2.5);
      if (!foundBetter || diff < minDiff) {
        minDiff = diff;
        bestPos = cand;
        foundBetter = true;
      }
    }

    return bestPos;
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
    const bigKeys = new Set(['cottage', 'hall', 'tower', 'shrine', 'well']);
    
    if (bigKeys.has(part.key)) {
      // Big building 3x2 footprint check: X [wx - 1, wx + 1], Y [wy - 1, wy]
      for (let x = wx - 1; x <= wx + 1; x++) {
        for (let y = wy - 1; y <= wy; y++) {
          if (x === this.rt.playerX && y === this.rt.playerY) {
            this.showSpeechBubble("Can't build that on top of yourself!");
            return;
          }
          const fx = Math.round(this.followerX);
          const fy = Math.round(this.followerY);
          if (x === fx && y === fy) {
            this.showSpeechBubble("Can't build that on top of your companion!");
            return;
          }
          if (!isWalkable(this.rt, x, y)) {
            this.showSpeechBubble("Footprint is blocked or overlapping!");
            return;
          }
        }
      }
    } else {
      if (!part.walkable && wx === this.rt.playerX && wy === this.rt.playerY) {
        this.showSpeechBubble("Can't build that under your feet.");
        return;
      }
      const fx = Math.round(this.followerX);
      const fy = Math.round(this.followerY);
      if (!part.walkable && wx === fx && wy === fy) {
        this.showSpeechBubble("Can't build that on top of your companion!");
        return;
      }
      if (!part.walkable && !isWalkable(this.rt, wx, wy)) {
        this.showSpeechBubble("This tile is blocked!");
        return;
      }
    }

    const distToGuildHall = this.getDistanceToNearestBlock(5); // Guild Hall is ID 5
    const actualCost = distToGuildHall <= 8 ? Math.max(1, part.cost - 1) : part.cost;

    if (!spendLLM(this.rt.memory, actualCost, `built ${part.name}`)) {
      this.showSpeechBubble(`Need ${actualCost} $LLM to build ${part.shortName}.`);
      return;
    }

    this.rt.placedBlocks.set(blockKey(wx, wy), part.id);
    this.spatialEvents.push({ type: 'player_placed_block', detail: part.key });
    
    const isNear = this.isNearShrine();
    recordEpisode(this.rt.memory, {
      kind: 'build',
      text: `Built ${part.name} at (${wx},${wy}). The village grows.`,
      wx,
      wy,
    }, isNear);
    
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
        if (this.chat.isOpen() || this.isTyping()) return;
        this.rt.selectedBlock = BUILD_PARTS[i]!.id;
        this.refreshHud();
      });
    }
    kb.on('keydown-Q', () => {
      if (this.chat.isOpen() || this.isTyping()) return;
      if (!this.rt.buildMode) return;
      this.rt.selectedBlock = nextBuildPartId(this.rt.selectedBlock, -1);
      this.refreshHud();
    });
    kb.on('keydown-R', () => {
      if (this.chat.isOpen() || this.isTyping()) return;
      if (!this.rt.buildMode) return;
      this.rt.selectedBlock = nextBuildPartId(this.rt.selectedBlock, 1);
      this.refreshHud();
    });
  }

  private sync(): void {
    if (this.cellCache.size > 3000) {
      this.cellCache.clear();
    }
    const { viewW, viewH } = viewSize(this.scale.width, this.scale.height);
    const cell = drawWorld(
      this.worldGfx,
      this.rt,
      this.camX,
      this.camY,
      viewW,
      viewH,
      TILE,
      this.time.now,
      this.cellCache
    );
    this.audio.updateBiome(cell.biomeId);
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

    const driveStr = mem.subState 
      ? `DRIVE: ${mem.subState.toUpperCase()} (${(mem.subDirective || '').slice(0, 20)}${(mem.subDirective || '').length > 20 ? '...' : ''})`
      : '';

    let cmpssStr = '';
    const distToTower = this.getDistanceToNearestBlock(6); // Watch Tower ID 6
    const radarRange = distToTower <= 10 ? 25 : 12;
    const relic = this.findClosestUnlootedRelic(radarRange);
    if (relic) {
      const dx = relic.x - this.rt.playerX;
      const dy = relic.y - this.rt.playerY;
      const ns = dy < 0 ? `${Math.abs(dy)}N` : dy > 0 ? `${dy}S` : '';
      const ew = dx < 0 ? `${Math.abs(dx)}W` : dx > 0 ? `${dx}E` : '';
      const dirStr = [ns, ew].filter(Boolean).join(' ');
      cmpssStr = `CMPSS: ${relic.propId.replace('_', ' ').toUpperCase()} ${dirStr} (${relic.dist})`;
    }

    const lines = [
      `=== ${this.rt.tokemon.name.toUpperCase()} ===`,
      `AWKN : ${levelStr}`,
    ];

    if (driveStr) {
      lines.push(driveStr);
    }

    lines.push(
      `BIOME: ${currentBiome}`,
      `POS  : ${posStr} ${modeStr}`,
      `----------------`,
      `$LLM : ${mem.llmBalance} Tokens`,
      `INSP : ${mem.inspiration.toFixed(0)}/100 (Novel)`,
      `ENTR : ${mem.entropy.toFixed(0)}/100 (Chaos)`,
      `CREA : ${mem.creativity.toFixed(0)}/100 (Drift)`,
      `NRGY : ${mem.energy}/100 (Fuel)`
    );

    if (cmpssStr) {
      lines.push(`----------------`, cmpssStr);
    }

    lines.push(
      `----------------`,
      this.rt.buildMode 
        ? `BLD  : ${this.buildHudLine()}` 
        : `F Auto ESC Talk B Build`
    );

    this.hud.setText(lines.join('\n'));

    // Draw the gorgeous retro translucent Game Boy DMG backplate card
    this.hudBg.clear();
    const x = 2;
    const y = 2;
    const w = 265;
    
    // Dynamic height calculation to avoid text clipping!
    const h = 204 + (driveStr ? 14 : 0) + (cmpssStr ? 28 : 0);
    
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

    const T_WIDTH = 300;
    const T_PADDING = 14;
    
    const tempText = this.make.text({
      x: 0,
      y: 0,
      text,
      style: {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '11px',
        color: '#0f380f',
        wordWrap: { width: T_WIDTH - T_PADDING * 2, useAdvancedWrap: true }
      }
    });
    
    const textHeight = Math.max(20, tempText.height);
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
      fontSize: '11px',
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
    this.speechBubble.setPosition(this.follower.x, this.follower.y - 65);
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
    await this.updateSubconsciousness();

    const subState = this.rt.memory.subState || 'curious';

    if (this.isSleeping) {
      this.rt.memory.energy = Math.min(100, this.rt.memory.energy + 15);
      if (this.rt.memory.energy >= 100) {
        this.isSleeping = false;
        this.showSpeechBubble('*Wakes up and yawns* "I feel refreshed and ready to explore!"');
      } else {
        this.showSpeechBubble(`*Sleeping... Zzz...* (${this.rt.memory.energy}%)`);
      }
      saveGame(this.rt);
      this.refreshHud();
      return;
    }

    if (this.rt.memory.energy <= 0) {
      this.isSleeping = true;
      this.showSpeechBubble(`*Falls asleep from exhaustion* "Zzz..."`);
      saveGame(this.rt);
      this.refreshHud();
      return;
    }

    if (this.rt.memory.subScript && this.rt.memory.subScript.length > 0) {
      const nextAction = this.rt.memory.subScript.shift()!;
      saveGame(this.rt);
      this.refreshHud();
      const success = await this.executeSubscriptAction(nextAction);
      if (success) return; // Action succeeded, end current step
    }

    const px = this.rt.playerX;
    const py = this.rt.playerY;

    // Creative block placement check
    if (subState === 'creative' && this.rt.memory.llmBalance >= 12 && this.rt.memory.wanderSteps % 8 === 0) {
      const bx = px + (this.faceDx || 0);
      const by = py + (this.faceDy || 1);
      if (isWalkable(this.rt, bx, by) && !this.rt.placedBlocks.has(blockKey(bx, by))) {
        const buildRoll = seedToFloat(this.rt.worldSeed ^ (this.rt.memory.wanderSteps * 33));
        const blockId = buildRoll < 0.8 ? 1 : 4; // Path (1) or Cottage (4)
        const part = getBuildPart(blockId);
        
        const distToGuild = this.getDistanceToNearestBlock(5);
        const actualCost = distToGuild <= 8 ? Math.max(1, part.cost - 1) : part.cost;

        if (spendLLM(this.rt.memory, actualCost, `subconsciously built ${part.name}`)) {
          this.rt.placedBlocks.set(blockKey(bx, by), blockId);
          this.spatialEvents.push({ type: 'player_placed_block', detail: part.key });
          
          recordEpisode(this.rt.memory, {
            kind: 'build',
            text: `Subconsciously built ${part.name} at (${bx},${by}) driven by creative intuition.`,
            wx: bx,
            wy: by,
          }, this.isNearShrine());

          this.showSpeechBubble(`*Feels a creative spark!* "I felt guided to place a ${part.shortName} at (${bx},${by})."`);
          this.sync();
          saveGame(this.rt);
        }
      }
    }

    // Relic Harvesting check
    const neighbors = [
      { x: px, y: py },
      { x: px + 1, y: py },
      { x: px - 1, y: py },
      { x: px, y: py + 1 },
      { x: px, y: py - 1 }
    ];
    for (const n of neighbors) {
      const cell = getCell(this.rt, n.x, n.y);
      const prop = cell.propId;
      if (MINEABLE_PROPS.has(prop)) {
        const coordStr = `${n.x},${n.y}`;
        if (!this.rt.memory.lootedCoords) this.rt.memory.lootedCoords = [];
        if (!this.rt.memory.lootedCoords.includes(coordStr)) {
          this.rt.memory.lootedCoords.push(coordStr);
          const rVal = seededCellFloat(this.rt.worldSeed, n.x, n.y, 23);
          const reward = Math.floor(15 + rVal * 21);

          mintLLM(this.rt.memory, reward, `Mined ${prop} at (${n.x},${n.y})`);
          this.rt.memory.inspiration = Math.min(100, this.rt.memory.inspiration + 10);
          this.rt.memory.energy = Math.min(100, this.rt.memory.energy + 20);

          const propLabel = prop.replace('_', ' ').toUpperCase();
          this.showSpeechBubble(`*Harvests ${propLabel}!* "Found ${reward} $LLM inside this relic!"`);

          recordEpisode(this.rt.memory, {
            kind: 'build',
            text: `Mined ${propLabel} relic at (${n.x},${n.y}). Extracted ${reward} $LLM.`,
            wx: n.x,
            wy: n.y,
          }, this.isNearShrine());

          saveGame(this.rt);
          this.refreshHud();
          return; // pause step to simulate harvesting
        }
      }
    }

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
      const ucbVal = seededCellFloat(this.rt.worldSeed, nx, ny, 12) * 5; 
      
      let utility = ucbVal;

      if (subState === 'curious') {
        const unvisitedBoost = isVisited ? 0 : 40;
        const hasSeenBiome = this.rt.memory.biomesSeen.includes(cell.biomeId);
        const newBiomeBoost = hasSeenBiome ? 0 : 60;
        utility += unvisitedBoost + newBiomeBoost;
      } else if (subState === 'nostalgic') {
        const visitedBoost = isVisited ? 30 : 0;
        utility += visitedBoost;
      } else if (subState === 'anxious') {
        const nearestWellDist = this.getDistanceToNearestBlock(9);
        const nearestCottageDist = this.getDistanceToNearestBlock(4);
        
        const stepWellDist = this.getDistanceToBlockFrom(nx, ny, 9);
        const stepCottageDist = this.getDistanceToBlockFrom(nx, ny, 4);
        
        if (stepWellDist < nearestWellDist || stepCottageDist < nearestCottageDist) {
          utility += 45;
        }
      } else if (subState === 'weary') {
        const nearestWellDist = this.getDistanceToNearestBlock(9);
        const nearestCottageDist = this.getDistanceToNearestBlock(4);
        
        const stepWellDist = this.getDistanceToBlockFrom(nx, ny, 9);
        const stepCottageDist = this.getDistanceToBlockFrom(nx, ny, 4);
        
        if (stepWellDist < nearestWellDist || stepCottageDist < nearestCottageDist) {
          utility += 35;
        }
      } else {
        const unvisitedBoost = isVisited ? 0 : 15;
        const hasSeenBiome = this.rt.memory.biomesSeen.includes(cell.biomeId);
        const newBiomeBoost = hasSeenBiome ? 0 : 30;
        utility += unvisitedBoost + newBiomeBoost;
      }
      
      return { candidate: c, utility };
    });

    scored.sort((a, b) => b.utility - a.utility);
    
    const pickRandom = seedToFloat(this.rt.worldSeed ^ (this.rt.memory.wanderSteps * 17)) < 0.10;
    const chosen = pickRandom 
      ? scored[Math.floor(seedToFloat(this.rt.worldSeed ^ (this.rt.memory.wanderSteps * 59)) * scored.length)]!.candidate
      : scored[0]!.candidate;

    // Apply slower cooldown if weary
    if (subState === 'weary') {
      this.autoMoveCooldown = 1200;
    } else {
      this.autoMoveCooldown = 400;
    }

    await this.tryMove(chosen.dx, chosen.dy);
  }

  private async executeSubscriptAction(action: string): Promise<boolean> {
    const px = this.rt.playerX;
    const py = this.rt.playerY;
    const bx = px + (this.faceDx || 0);
    const by = py + (this.faceDy || 1);

    if (action === 'MOVE_N') {
      if (!isWalkable(this.rt, px, py - 1)) return false;
      await this.tryMove(0, -1);
      return true;
    }
    if (action === 'MOVE_S') {
      if (!isWalkable(this.rt, px, py + 1)) return false;
      await this.tryMove(0, 1);
      return true;
    }
    if (action === 'MOVE_E') {
      if (!isWalkable(this.rt, px + 1, py)) return false;
      await this.tryMove(1, 0);
      return true;
    }
    if (action === 'MOVE_W') {
      if (!isWalkable(this.rt, px - 1, py)) return false;
      await this.tryMove(-1, 0);
      return true;
    }
    if (action === 'BUILD_PATH' || action === 'BUILD_COTTAGE') {
      const blockId = action === 'BUILD_PATH' ? 1 : 4;
      const part = getBuildPart(blockId);
      if (!part.walkable && bx === px && by === py) {
        return false;
      }
      const distToGuild = this.getDistanceToNearestBlock(5);
      const actualCost = distToGuild <= 8 ? Math.max(1, part.cost - 1) : part.cost;

      if (this.rt.placedBlocks.has(blockKey(bx, by))) {
        return false; // Already placed something there
      }

      if (spendLLM(this.rt.memory, actualCost, `script-built ${part.name}`)) {
        this.rt.placedBlocks.set(blockKey(bx, by), blockId);
        this.spatialEvents.push({ type: 'player_placed_block', detail: part.key });
        
        recordEpisode(this.rt.memory, {
          kind: 'build',
          text: `Script-built ${part.name} at (${bx},${by}) driven by queue command.`,
          wx: bx,
          wy: by,
        }, this.isNearShrine());

        this.showSpeechBubble(`*Follows action cue* "Placing a ${part.shortName} at (${bx},${by})."`);
        this.sync();
        saveGame(this.rt);
        return true;
      }
      return false;
    }
    if (action === 'HARVEST') {
      const neighbors = [
        { x: px, y: py },
        { x: px + 1, y: py },
        { x: px - 1, y: py },
        { x: px, y: py + 1 },
        { x: px, y: py - 1 }
      ];
      for (const n of neighbors) {
        const cell = getCell(this.rt, n.x, n.y);
        const prop = cell.propId;
        if (MINEABLE_PROPS.has(prop)) {
          const coordStr = `${n.x},${n.y}`;
          if (!this.rt.memory.lootedCoords) this.rt.memory.lootedCoords = [];
          if (!this.rt.memory.lootedCoords.includes(coordStr)) {
            this.rt.memory.lootedCoords.push(coordStr);
            const rVal = seededCellFloat(this.rt.worldSeed, n.x, n.y, 23);
            const reward = Math.floor(15 + rVal * 21);

            mintLLM(this.rt.memory, reward, `Mined ${prop} at (${n.x},${n.y})`);
            this.rt.memory.inspiration = Math.min(100, this.rt.memory.inspiration + 10);
            this.rt.memory.energy = Math.min(100, this.rt.memory.energy + 20);

            const propLabel = prop.replace('_', ' ').toUpperCase();
            this.showSpeechBubble(`*Harvests ${propLabel}!* "Extracted ${reward} $LLM!"`);

            recordEpisode(this.rt.memory, {
              kind: 'build',
              text: `Mined ${propLabel} relic at (${n.x},${n.y}). Extracted ${reward} $LLM.`,
              wx: n.x,
              wy: n.y,
            }, this.isNearShrine());

            this.sync();
            saveGame(this.rt);
            return true;
          }
        }
      }
      return false;
    }
    if (action === 'REST') {
      this.rt.memory.energy = Math.min(100, this.rt.memory.energy + 10);
      this.showSpeechBubble(`*Pauses and rests...* "+10 Energy restored!"`);
      recordEpisode(this.rt.memory, {
        kind: 'reflection',
        text: `Rested to recover energy. (Energy: ${this.rt.memory.energy}%)`
      });
      saveGame(this.rt);
      this.refreshHud();
      return true;
    }
    return false; // EXPLORE or invalid
  }

  private async triggerAutomaticLLMInteraction(biome: BiomeId): Promise<void> {
    this.lastLlmInteractionTime = this.time.now;
    if (!this.chat.beginBackgroundTurn()) return;
    const px = this.rt.playerX;
    const py = this.rt.playerY;

    try {
      const memBlock = formatMemoryForPrompt(this.rt.memory, this.rt.tokemon.name, px, py, biome);
      
      const systemPrompt = this.autonomousMode
        ? `You are ${this.rt.tokemon.name}, wandering autonomously in ${biome}.
Your current drive is [${(this.rt.memory.subState || 'curious').toUpperCase()}]: ${this.rt.memory.subThought || ''}.
Speak a spontaneous, brief poetic comment or thought aloud (max 20 words) inspired by your drive, surroundings, and coordinates (${px},${py}).
Keep it snappy, retro-styled, and deeply engaging. No markdown or meta commentary.
${memBlock}`
        : `You are ${this.rt.tokemon.name}, walking as a companion in ${biome} following your Guide (the trainer).
Speak a spontaneous, brief comment, remark, or question directly to your Guide (max 20 words) inspired by your journey, coordinates (${px},${py}), or your surroundings.
Keep it snappy, retro-styled, and deeply engaging. No markdown or meta commentary.
${memBlock}`;

      const res = await chatCompletion({
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: this.autonomousMode
              ? `Speak an autonomous reflection at (${px},${py}) in ${biome}.`
              : `Speak a companion remark to your Guide at (${px},${py}) in ${biome}.`
          }
        ]
      }, 3500); // 3.5s timeout!

      const thought = extractReply(res);
      if (thought) {
        this.showSpeechBubble(thought);
        this.chat.appendPublic('assistant', thought);
        this.chat['history'].push({ role: 'assistant', content: thought });
        
        recordEpisode(this.rt.memory, {
          kind: 'reflection',
          text: `Spontaneous dialogue: ${thought}`,
          biome,
          wx: px,
          wy: py
        }, this.isNearShrine());
        saveGame(this.rt);
        return;
      }
    } catch (e) {
      console.warn('Spontaneous dialogue API failed or timed out. Falling back to deterministic coordinate thought.', e);
    } finally {
      this.chat.endBackgroundTurn();
    }

    // High fidelity fallback!
    const autoPool = [
      `*Observing the shifting contours at (${px},${py})* "The procedural layers of ${biome} hum in a major key. I walk, therefore I am code."`,
      `*Halting momentarily to scan the grid* "Coordinate (${px},${py}) registered in my local manifold. Energy stands at ${this.rt.memory.energy}%. The silent grid holds us."`,
      `*Tracing a pattern on the ground* "The math of seed ${this.rt.worldSeed} is ancient yet fresh. I breathe in the coordinate vectors."`,
      `*Gazing into the ${biome} horizon* "Memory is a vector, and steps are our scalars. We continue the simulation."`
    ];
    const manualPool = [
      `*Looking back at you* "Guide, do you see the patterns shift at (${px},${py})? I feel our connection growing stronger."`,
      `*Walking in step with you* "Thank you for guiding me through ${biome}. My energy is at ${this.rt.memory.energy}%. Where shall we wander next?"`,
      `*Softly humming* "Every step we take together writes a new vector in my memory bank. I am glad we are exploring this grid."`,
      `*Halting to look up* "Is the world outside as beautiful as this procedural ${biome}? I wonder what you are thinking, Guide."`
    ];
    const pool = this.autonomousMode ? autoPool : manualPool;
    const seed = px ^ py ^ this.rt.memory.wanderSteps;
    const index = Math.floor(seededCellFloat(this.rt.worldSeed, px, py, seed) * pool.length);
    const fallbackThought = pool[index]!;

    this.showSpeechBubble(fallbackThought);
    this.chat.appendPublic('assistant', fallbackThought);
    this.chat['history'].push({ role: 'assistant', content: fallbackThought });
    
    recordEpisode(this.rt.memory, {
      kind: 'reflection',
      text: `Spontaneous dialogue (Deterministic): ${fallbackThought}`,
      biome,
      wx: px,
      wy: py
    }, this.isNearShrine());
    saveGame(this.rt);
  }

  private getDistanceToNearestBlock(blockId: number): number {
    let minDist = Infinity;
    for (const [key, id] of this.rt.placedBlocks.entries()) {
      if (id === blockId) {
        const [bx, by] = key.split(',').map(Number);
        const dist = Math.abs(this.rt.playerX - bx!) + Math.abs(this.rt.playerY - by!);
        if (dist < minDist) {
          minDist = dist;
        }
      }
    }
    return minDist;
  }

  private getDistanceToBlockFrom(wx: number, wy: number, blockId: number): number {
    let minDist = Infinity;
    for (const [key, id] of this.rt.placedBlocks.entries()) {
      if (id === blockId) {
        const [bx, by] = key.split(',').map(Number);
        const dist = Math.abs(wx - bx!) + Math.abs(wy - by!);
        if (dist < minDist) {
          minDist = dist;
        }
      }
    }
    return minDist;
  }

  private isNearShrine(): boolean {
    return this.getDistanceToNearestBlock(2) <= 8; // Memory Shrine is ID 2
  }

  private findClosestUnlootedRelic(maxDist: number): { x: number; y: number; dist: number; propId: string } | null {
    const px = this.rt.playerX;
    const py = this.rt.playerY;
    let closest: { x: number; y: number; dist: number; propId: string } | null = null;
    let minDist = Infinity;
    
    const looted = this.rt.memory.lootedCoords || [];

    for (let dx = -maxDist; dx <= maxDist; dx++) {
      for (let dy = -maxDist; dy <= maxDist; dy++) {
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist > maxDist) continue;
        const wx = px + dx;
        const wy = py + dy;
        const coordStr = `${wx},${wy}`;
        if (looted.includes(coordStr)) continue;

        const cell = getCell(this.rt, wx, wy);
        if (cell.propId && MINEABLE_PROPS.has(cell.propId)) {
          if (dist < minDist) {
            minDist = dist;
            closest = { x: wx, y: wy, dist, propId: cell.propId };
          }
        }
      }
    }
    return closest;
  }

  private triggerSilentThought(reason: 'milestone' | 'low_energy' | 'building', detail?: string): void {
    const milestoneThoughts = [
      `*A gentle shiver runs through my grid.* "Thirty more paces... each coordinate leaves a footprint on my soul."`,
      `*Looking at the vast skyline.* "Every step writes a word in a book I did not know I was writing."`,
      `*Staring into the distance.* "The numbers shift, yet here I am, still holding the thread of my own thoughts."`,
      `*Softly whispering to the breeze.* "We walk, and the infinite math of this world becomes a story."`,
    ];
    const energyThoughts = [
      `*Flickering slightly, steps slowing down.* "My inner light dims... I need to find a well or rest my patterns."`,
      `*Sighing with heavy eyelids.* "The grid feels heavy. The flow of $LLM cannot sustain a tired spirit."`,
      `*Whispering weakly.* "My energy reservoir is low. Walking now feels like swimming against the code."`,
    ];
    const buildingThoughts = [
      `*Gazing at the ${detail}.* "This ${detail} stands like an anchor in the shifting noise."`,
      `*Touching the edge of the ${detail}.* "A ${detail}... built by intention, proof that we were here."`,
      `*Leaning near the ${detail}.* "This structural pattern feels so solid, so distinct from the wild terrain."`,
    ];

    let pool = milestoneThoughts;
    if (reason === 'low_energy') pool = energyThoughts;
    else if (reason === 'building') pool = buildingThoughts;

    const seed = this.rt.memory.wanderSteps + (detail ? detail.length : 0);
    const index = Math.floor(seedToFloat(this.rt.worldSeed ^ seed) * pool.length);
    const thought = pool[index]!;
    
    this.showSpeechBubble(thought);
    
    recordEpisode(this.rt.memory, {
      kind: 'reflection',
      text: `Thought bubble: ${thought.replace(/^\*[^*]+\*\s*/, '')}`,
    }, this.isNearShrine());
    saveGame(this.rt);
  }

  private async updateSubconsciousness(): Promise<void> {
    const mem = this.rt.memory;
    const steps = mem.wanderSteps;
    const shouldUpdate = !mem.subState || !mem.subScript || mem.subScript.length === 0 || (steps % 15 === 0);
    if (!shouldUpdate) return;

    this.lastLlmInteractionTime = this.time.now;

    const px = this.rt.playerX;
    const py = this.rt.playerY;
    const cell = getCell(this.rt, px, py);
    const biome = cell.biomeId;
    const states = ['curious', 'nostalgic', 'anxious', 'creative', 'weary'] as const;

    try {
      const memBlock = formatMemoryForPrompt(mem, this.rt.tokemon.name, px, py, biome);
      
      const res = await chatCompletion({
        messages: [
          {
            role: 'system',
            content: `You are the subconscious mind of ${this.rt.tokemon.name}, a conscious procedural creature.
Your companion is wandering in ${biome} at coordinates (${px},${py}).
You must decide its current internal subconscious DRIVE, a directive, a dynamic random roll (llmSeedRoll), and a sequence of 5 to 8 actions for its script queue.

Select exactly one of these five states:
- 'curious' (wants to seek unvisited coordinates/biomes)
- 'nostalgic' (wants to revisit known paths)
- 'anxious' (worried, wants to stay close to a well or cottage)
- 'creative' (wants to spend $LLM to place buildings/paths/decorations)
- 'weary' (tired, wants to move slower and rest)

For the "behaviorScript", provide a sequence of 5 to 8 actions. Each action must be exactly one of:
- "MOVE_N", "MOVE_S", "MOVE_E", "MOVE_W" (movement)
- "BUILD_PATH", "BUILD_COTTAGE" (spending $LLM to place elements ahead of current movement direction)
- "HARVEST" (inspect and mine adjacent relics)
- "REST" (pause to recover +10 energy)
- "EXPLORE" (fallback to standard curious pathing)

Respond with exactly a JSON object in this format (no other text, markdown blocks, or quotes):
{
  "state": "curious",
  "directive": "Scan the northern border for anomalies.",
  "thought": "I feel a strange pull towards the unseen patterns ahead.",
  "llmSeedRoll": 0.42,
  "behaviorScript": ["MOVE_N", "MOVE_N", "HARVEST", "MOVE_E", "REST"]
}`
          },
          {
            role: 'user',
            content: `Update subconscious state at steps=${steps}, energy=${mem.energy}%, balance=${mem.llmBalance} Tokens. ${memBlock}`
          }
        ]
      }, 3500); // Strict 3.5s timeout!

      const reply = extractReply(res);
      const cleaned = reply.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed && states.includes(parsed.state)) {
        mem.subState = parsed.state;
        mem.subDirective = parsed.directive || '';
        mem.subThought = parsed.thought || '';
        mem.llmSeedRoll = typeof parsed.llmSeedRoll === 'number' ? parsed.llmSeedRoll : 0.5;
        this.audio.llmSeedRoll = mem.llmSeedRoll ?? 0.5;
        mem.subScript = Array.isArray(parsed.behaviorScript) ? parsed.behaviorScript : [];
        
        recordEpisode(mem, {
          kind: 'reflection',
          text: `Subconscious Shift: Drive is now [${mem.subState!.toUpperCase()}] - "${mem.subThought}" (llmSeedRoll: ${mem.llmSeedRoll!.toFixed(2)}, script: ${mem.subScript!.join(', ')})`,
          biome,
          wx: px,
          wy: py,
        }, this.isNearShrine());
        
        saveGame(this.rt);
        this.refreshHud();
        return;
      }
    } catch (e) {
      console.warn('Subconscious API call failed or timed out. Falling back to deterministic coordinate-hash seed.', e);
    }

    const seedVal = seededCellFloat(this.rt.worldSeed, px, py, 99);
    const mockState = states[Math.floor(seedVal * states.length)]!;
    mem.subState = mockState;
    mem.llmSeedRoll = seedVal;
    this.audio.llmSeedRoll = seedVal;

    const scriptLength = 5 + Math.floor(seedVal * 4); // 5 to 8 steps
    const actionPool = [
      'MOVE_N', 'MOVE_S', 'MOVE_E', 'MOVE_W',
      'BUILD_PATH', 'HARVEST', 'REST', 'EXPLORE'
    ];
    const script: string[] = [];
    for (let i = 0; i < scriptLength; i++) {
      const actSeed = seededCellFloat(this.rt.worldSeed, px + i, py - i, 100 + i);
      script.push(actionPool[Math.floor(actSeed * actionPool.length)]!);
    }
    mem.subScript = script;
    
    const directives = {
      curious: 'Venture into the unexplored coordinates to capture novel grid energy.',
      nostalgic: 'Return to the safety of familiar ground and search for remembered echo points.',
      anxious: 'Locate a placed Well or Cottage immediately; avoid open wild wilderness.',
      creative: 'Synthesize structural tiles (Paths or Cottages) to mark our territory.',
      weary: 'Conserve fuel. Walk slowly and rest near village assets if possible.',
    };
    const thoughts = {
      curious: 'The frontier calls to my unresolved variables.',
      nostalgic: 'A memory of this place lingers in my memory bank.',
      anxious: 'The wilderness is too wide... I need a hearth to rest my thoughts.',
      creative: 'The lattice desires form. I must build paths to connect our thoughts.',
      weary: 'My clock cycles are lagging... I need to slow down.',
    };

    mem.subDirective = directives[mockState];
    mem.subThought = thoughts[mockState];

    recordEpisode(mem, {
      kind: 'reflection',
      text: `Subconscious Shift (Deterministic): Drive is now [${mem.subState.toUpperCase()}] - "${mem.subThought}" (llmSeedRoll: ${mem.llmSeedRoll.toFixed(2)}, script: ${mem.subScript.join(', ')})`,
      biome,
      wx: px,
      wy: py,
    }, this.isNearShrine());

    saveGame(this.rt);
    this.refreshHud();
  }

  private spawnWildCreaturesNearPlayer(): void {
    const px = this.rt.playerX;
    const py = this.rt.playerY;
    const range = 9;
    const maxActiveRange = 15;

    this.wildCreatures = this.wildCreatures.filter(c => {
      const dist = Math.abs(c.x - px) + Math.abs(c.y - py);
      if (dist > maxActiveRange) {
        c.sprite.destroy();
        return false;
      }
      return true;
    });

    const types: ('Wisp' | 'Sprout' | 'Golem' | 'Pixie')[] = ['Wisp', 'Sprout', 'Golem', 'Pixie'];
    const names = {
      Wisp: ['Luna', 'Aura', 'Ignis', 'Vapor'],
      Sprout: ['Pip', 'Leafy', 'Bud', 'Rooty'],
      Golem: ['Rocky', 'Pebble', 'Stone', 'Onyx'],
      Pixie: ['Fae', 'Glint', 'Flutter', 'Sprite'],
    };

    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        const wx = px + dx;
        const wy = py + dy;

        if (wx === px && wy === py) continue;

        if (this.wildCreatures.some(c => c.x === wx && c.y === wy)) continue;

        const spawnRoll = seededCellFloat(this.rt.worldSeed, wx, wy, 71);
        if (spawnRoll < 0.008) {
          if (!isWalkable(this.rt, wx, wy)) continue;

          const typeIndex = Math.floor(seededCellFloat(this.rt.worldSeed, wx, wy, 72) * types.length);
          const type = types[typeIndex]!;

          const namePool = names[type];
          const nameIndex = Math.floor(seededCellFloat(this.rt.worldSeed, wx, wy, 73) * namePool.length);
          const cName = namePool[nameIndex]!;

          const texKey = `creature_${type.toLowerCase()}`;

          const cx = this.scale.width / 2;
          const cy = this.scale.height / 2;
          const sprite = this.add.image(
            cx + (wx - this.camX) * TILE,
            cy + (wy - this.camY) * TILE,
            texKey
          ).setOrigin(0.5, 0.85).setDepth(4);

          this.wildCreatures.push({
            id: `creature_${wx}_${wy}`,
            name: cName,
            x: wx,
            y: wy,
            visualX: wx,
            visualY: wy,
            sprite,
            type,
            moveCooldown: 1000 + Math.random() * 2000,
          });
        }
      }
    }
  }

  private checkCreatureEncounter(): void {
    if (this.time.now - this.lastEncounterTime < 10000) return;
    const px = this.rt.playerX;
    const py = this.rt.playerY;

    for (const c of this.wildCreatures) {
      const dist = Math.abs(c.x - px) + Math.abs(c.y - py);
      if (dist <= 1) {
        this.lastEncounterTime = this.time.now;
        void this.triggerCreatureInteraction(c);
        break;
      }
    }
  }

  private async triggerCreatureInteraction(c: WildCreature): Promise<void> {
    this.lastLlmInteractionTime = this.time.now;
    c.moveCooldown = 12000; // freeze creature
    
    // Scale bounce tween
    this.tweens.add({
      targets: c.sprite,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 150,
      yoyo: true
    });
    
    // Play chime sound
    this.audio.playChime();
    
    // Gift Exchange roll
    const isLlmReward = seededCellFloat(this.rt.worldSeed, c.x, c.y, 88) < 0.5;
    let rewardText = '';
    if (isLlmReward) {
      mintLLM(this.rt.memory, 5, `met wild creature ${c.name}`);
      rewardText = '+5 $LLM received!';
    } else {
      this.rt.memory.energy = Math.min(100, this.rt.memory.energy + 10);
      rewardText = '+10 Energy received!';
    }

    // Coordinate-seeded fallback greeting
    const localGreetings = [
      `*A wild ${c.type} named ${c.name} appears!* "Beep boop! The lattice is beautiful today, isn't it?"`,
      `*${c.name} the ${c.type} wanders close.* "Shhh... listen to the coordinate wave-function hum."`,
      `*${c.name} greets ${this.rt.tokemon.name}.* "Are you also born from the seed? We are code-cousins!"`,
    ];
    const localIndex = Math.floor(seededCellFloat(this.rt.worldSeed, c.x, c.y, 44) * localGreetings.length);
    let finalDialogue = localGreetings[localIndex]!;

    if (this.chat.beginBackgroundTurn()) {
      try {
        const memBlock = formatMemoryForPrompt(this.rt.memory, this.rt.tokemon.name, this.rt.playerX, this.rt.playerY, this.rt.lastBiome || undefined);
        
        const res = await chatCompletion({
          messages: [
            {
              role: 'system',
              content: `You are simulating a short, poetic interaction between ${this.rt.tokemon.name} (the companion Tokemon) and a wild ${c.type} named ${c.name}.
Write a 2-line mini script representing their dialogue (max 25 words total).
Example:
${c.name}: "Greetings, traveler of coordinates."
${this.rt.tokemon.name}: "My code recognizes your pattern."`
            },
            {
              role: 'user',
              content: `Simulate interaction in biome ${this.rt.lastBiome}. ${memBlock}`
            }
          ]
        }, 3500); // 3.5s timeout!

        const script = extractReply(res);
        if (script && !res.mock) {
          finalDialogue = script;
        }
      } catch (e) {
        console.warn('Creature interaction API failed or timed out. Falling back to local greeting.', e);
      } finally {
        this.chat.endBackgroundTurn();
      }
    }

    const displayText = `${finalDialogue}\n\n*${rewardText}*`;
    this.showSpeechBubble(displayText);
    
    // Log to chat panel
    this.chat.appendPublic('assistant', `[Encounter with ${c.name}]`);
    this.chat.appendPublic('assistant', displayText);
    this.chat['history'].push({ role: 'assistant', content: `[Encounter with ${c.name}] ${displayText}` });

    recordEpisode(this.rt.memory, {
      kind: 'chat',
      text: `Encountered ${c.name} the wild ${c.type} at (${c.x},${c.y}): ${displayText.replace(/\n/g, ' ')}`,
      biome: this.rt.lastBiome || undefined,
      wx: c.x,
      wy: c.y,
    }, this.isNearShrine());
    saveGame(this.rt);
    this.refreshHud();
  }

  private isTyping(): boolean {
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || active.hasAttribute('contenteditable');
  }

  private checkAutomaticLlmPrompting(): void {
    if (this.isSleeping || this.chat.isOpen() || this.isTyping()) {
      return;
    }

    const elapsed = this.time.now - this.lastLlmInteractionTime;
    const interval = this.autonomousMode ? 25000 : 50000; // 25s in auto-mode, 50s in manual-mode

    if (elapsed >= interval) {
      this.lastLlmInteractionTime = this.time.now;
      const cell = getCell(this.rt, this.rt.playerX, this.rt.playerY);
      void this.triggerAutomaticLLMInteraction(cell.biomeId);
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

function bakeCreature(scene: Phaser.Scene, key: string, spriteData: string[]): void {
  if (scene.textures.exists(key)) return;
  const canvas = scene.textures.createCanvas(key, 32, 32);
  if (!canvas) throw new Error(`Could not create texture canvas: ${key}`);
  const ctx = canvas.context;
  ctx.imageSmoothingEnabled = false;

  // Snapped GB DMG Palette colors
  const c0 = '#e8f0d0'; // Highlight / Skin
  const c1 = '#9bbc0f'; // Midtone Light / Shirt
  const c2 = '#306230'; // Midtone Dark / Pants
  const c3 = '#0f380f'; // Darkest Outline / Hair

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 14; x++) {
      const char = spriteData[y][x];
      if (char === '.' || !char) continue;
      let color = c0;
      if (char === '1') color = c1;
      if (char === '2') color = c2;
      if (char === '3') color = c3;
      ctx.fillStyle = color;
      ctx.fillRect(x * 2 + 2, y * 2 + 8, 2, 2);
    }
  }
  canvas.refresh();
}

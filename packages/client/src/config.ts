import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { CreateScene } from './scenes/CreateScene.js';
import { PlayScene } from './scenes/PlayScene.js';
import { GB } from './palette.js';

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const TILE = 16;

export function viewSize(width: number, height: number): { viewW: number; viewH: number } {
  return {
    viewW: Math.ceil(width / TILE) + 1,
    viewH: Math.ceil(height / TILE) + 1,
  };
}

export const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-root',
  backgroundColor: GB.darkest,
  pixelArt: true,
  roundPixels: false,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  scene: [BootScene, CreateScene, PlayScene],
};

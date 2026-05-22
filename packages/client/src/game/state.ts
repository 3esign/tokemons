import type { TokemonInstance } from '@tokemons/tokemon-gen';
import type { BiomeId } from '@tokemons/kernel';
import {
  createGenesisMemory,
  type TokemonMemory,
} from './memory.js';

export interface PlacedBlock {
  wx: number;
  wy: number;
  blockId: number;
}

export interface SaveData {
  version: 2;
  worldSeed: number;
  playerX: number;
  playerY: number;
  tokemon: TokemonInstance;
  placedBlocks: PlacedBlock[];
  mood: number;
  memory: TokemonMemory;
}

export interface GameRuntime {
  worldSeed: number;
  playerX: number;
  playerY: number;
  tokemon: TokemonInstance;
  placedBlocks: Map<string, number>;
  mood: number;
  memory: TokemonMemory;
  lastBiome: BiomeId | null;
  buildMode: boolean;
  selectedBlock: number;
}

const SAVE_KEY = 'tokemons_save_v2';

export function blockKey(wx: number, wy: number): string {
  return `${wx},${wy}`;
}

export function newRuntime(tokemon: TokemonInstance, worldSeed?: number): GameRuntime {
  const seed = worldSeed ?? ((Date.now() ^ (Math.random() * 1e9)) | 0) >>> 0;
  return {
    worldSeed: seed,
    playerX: 0,
    playerY: 0,
    tokemon,
    placedBlocks: new Map(),
    mood: 0.5,
    memory: createGenesisMemory(tokemon, seed),
    lastBiome: null,
    buildMode: false,
    selectedBlock: 1,
  };
}

export function saveGame(rt: GameRuntime): void {
  const data: SaveData = {
    version: 2,
    worldSeed: rt.worldSeed,
    playerX: rt.playerX,
    playerY: rt.playerY,
    tokemon: rt.tokemon,
    placedBlocks: [...rt.placedBlocks.entries()].map(([k, blockId]) => {
      const [wx, wy] = k.split(',').map(Number);
      return { wx: wx!, wy: wy!, blockId };
    }),
    mood: rt.mood,
    memory: rt.memory,
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

function migrateV1(raw: Record<string, unknown>): SaveData | null {
  if (!raw.tokemon || typeof raw.worldSeed !== 'number') return null;
  const tokemon = raw.tokemon as TokemonInstance;
  const worldSeed = raw.worldSeed as number;
  return {
    version: 2,
    worldSeed,
    playerX: (raw.playerX as number) ?? 0,
    playerY: (raw.playerY as number) ?? 0,
    tokemon,
    placedBlocks: (raw.placedBlocks as PlacedBlock[]) ?? [],
    mood: (raw.mood as number) ?? 0.5,
    memory: createGenesisMemory(tokemon, worldSeed),
  };
}

export function loadGame(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as SaveData;
      if (data.memory) {
        if (data.memory.llmBalance === undefined) data.memory.llmBalance = 100;
        if (data.memory.inspiration === undefined) data.memory.inspiration = 50;
        if (data.memory.entropy === undefined) data.memory.entropy = 0;
        if (data.memory.creativity === undefined) data.memory.creativity = 50;
        if (data.memory.energy === undefined) data.memory.energy = 100;
        if (data.memory.visitedCoords === undefined) data.memory.visitedCoords = ['0,0'];
        if (data.memory.lootedCoords === undefined) data.memory.lootedCoords = [];
        return data;
      }
      return migrateV1(data as unknown as Record<string, unknown>);
    }
    const legacy = localStorage.getItem('tokemons_save_v1');
    if (legacy) {
      const data = migrateV1(JSON.parse(legacy) as Record<string, unknown>);
      if (data) {
        saveGame(runtimeFromSave(data));
        localStorage.removeItem('tokemons_save_v1');
      }
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

export function runtimeFromSave(data: SaveData): GameRuntime {
  const placedBlocks = new Map<string, number>();
  for (const b of data.placedBlocks) {
    placedBlocks.set(blockKey(b.wx, b.wy), b.blockId);
  }
  return {
    worldSeed: data.worldSeed,
    playerX: data.playerX,
    playerY: data.playerY,
    tokemon: data.tokemon,
    placedBlocks,
    mood: data.mood,
    memory: data.memory,
    lastBiome: null,
    buildMode: false,
    selectedBlock: 1,
  };
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem('tokemons_save_v1');
}

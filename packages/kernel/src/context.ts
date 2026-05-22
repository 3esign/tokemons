export interface EvalContext {
  worldSeed: number;
  chunkX: number;
  chunkY: number;
  localX: number;
  localY: number;
  /** World tile coordinates */
  worldX: number;
  worldY: number;
}

export function makeContext(
  worldSeed: number,
  chunkX: number,
  chunkY: number,
  localX: number,
  localY: number,
  chunkSize: number
): EvalContext {
  return {
    worldSeed,
    chunkX,
    chunkY,
    localX,
    localY,
    worldX: chunkX * chunkSize + localX,
    worldY: chunkY * chunkSize + localY,
  };
}

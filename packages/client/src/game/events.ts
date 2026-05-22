import type { BiomeId } from '@tokemons/kernel';

export type SpatialEventType =
  | 'entered_biome'
  | 'blocked'
  | 'rested'
  | 'player_placed_block'
  | 'bump_prop';

export interface SpatialEvent {
  type: SpatialEventType;
  t: number;
  biome?: BiomeId;
  detail?: string;
}

const MAX = 12;

export class SpatialEventBus {
  private events: SpatialEvent[] = [];
  private listeners: ((e: SpatialEvent) => void)[] = [];

  push(event: Omit<SpatialEvent, 't'>): void {
    const e: SpatialEvent = { ...event, t: Date.now() };
    this.events.push(e);
    if (this.events.length > MAX) this.events.shift();
    for (const fn of this.listeners) fn(e);
  }

  on(fn: (e: SpatialEvent) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((x) => x !== fn);
    };
  }

  recent(): SpatialEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events = [];
  }
}

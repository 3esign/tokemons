export interface BuildPart {
  id: number;
  key: string;
  name: string;
  shortName: string;
  cost: number;
  walkable: boolean;
}

export const BUILD_PARTS: BuildPart[] = [
  { id: 1, key: 'path', name: 'Stone Path', shortName: 'PATH', cost: 1, walkable: true },
  { id: 2, key: 'shrine', name: 'Memory Shrine', shortName: 'SHRINE', cost: 7, walkable: false },
  { id: 3, key: 'plaza', name: 'Village Plaza', shortName: 'PLAZA', cost: 2, walkable: true },
  { id: 4, key: 'cottage', name: 'Cottage', shortName: 'COTTAGE', cost: 6, walkable: false },
  { id: 5, key: 'hall', name: 'Guild Hall', shortName: 'HALL', cost: 8, walkable: false },
  { id: 6, key: 'tower', name: 'Watch Tower', shortName: 'TOWER', cost: 8, walkable: false },
  { id: 7, key: 'farm', name: 'Sprout Farm', shortName: 'FARM', cost: 3, walkable: true },
  { id: 8, key: 'fence', name: 'Fence', shortName: 'FENCE', cost: 1, walkable: false },
  { id: 9, key: 'well', name: 'Village Well', shortName: 'WELL', cost: 5, walkable: false },
];

const BUILD_PART_BY_ID = new Map(BUILD_PARTS.map((part) => [part.id, part]));

export function getBuildPart(id: number): BuildPart {
  return BUILD_PART_BY_ID.get(id) ?? BUILD_PARTS[0]!;
}

export function nextBuildPartId(currentId: number, direction: 1 | -1): number {
  const index = BUILD_PARTS.findIndex((part) => part.id === currentId);
  const safeIndex = index >= 0 ? index : 0;
  return BUILD_PARTS[(safeIndex + direction + BUILD_PARTS.length) % BUILD_PARTS.length]!.id;
}

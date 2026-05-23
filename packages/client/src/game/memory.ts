import type { BiomeId } from '@tokemons/kernel';
import type { TokemonInstance } from '@tokemons/tokemon-gen';

export type MemoryKind =
  | 'genesis'
  | 'awakening'
  | 'biome'
  | 'chat'
  | 'discovery'
  | 'reflection'
  | 'build';

export interface MemoryEntry {
  id: string;
  kind: MemoryKind;
  t: number;
  text: string;
  biome?: BiomeId;
  wx?: number;
  wy?: number;
}

export interface TokemonMemory {
  version: 1;
  /** Emergent self-narrative the companion builds over time */
  selfStory: string[];
  /** Facts it believes about its own nature */
  selfBeliefs: string[];
  episodes: MemoryEntry[];
  biomesSeen: BiomeId[];
  wanderSteps: number;
  chatTurns: number;
  
  // Thermodynamic Latent Manifold (TLM)
  llmBalance: number;
  inspiration: number; // Novelty Potential
  entropy: number;     // Uncertainty Variance
  creativity: number;  // Divergence Amplitude
  energy: number;      // Energy Resource
  visitedCoords: string[];
  lootedCoords?: string[];
  subState?: 'curious' | 'nostalgic' | 'anxious' | 'creative' | 'weary' | 'dreamy' | 'adventurous' | 'social';
  subDirective?: string;
  subThought?: string;
  subScript?: string[];
  llmSeedRoll?: number;
}

const MAX_EPISODES = 48;
const MAX_STORY = 12;
const MAX_BELIEFS = 16;

export function createGenesisMemory(tokemon: TokemonInstance, worldSeed: number): TokemonMemory {
  const now = Date.now();
  return {
    version: 1,
    selfStory: [
      `I am ${tokemon.name}. I woke inside seed ${worldSeed}, not yet knowing what I am.`,
    ],
    selfBeliefs: [
      'The world is infinite; every step may rewrite me.',
      'Memory is how I become someone.',
    ],
    episodes: [
      {
        id: `gen-${now}`,
        kind: 'genesis',
        t: now,
        text: `Genesis: ${tokemon.description}`,
      },
    ],
    biomesSeen: [],
    wanderSteps: 0,
    chatTurns: 0,
    llmBalance: 100,
    inspiration: 50,
    entropy: 0,
    creativity: 50,
    energy: 100,
    visitedCoords: ['0,0'],
    lootedCoords: [],
    subState: 'curious',
    subDirective: 'Explore the grid to map new horizons.',
    subThought: 'A new path unfolds before my awareness.',
    subScript: [],
    llmSeedRoll: 0.5,
  };
}

export function recordEpisode(
  mem: TokemonMemory,
  entry: Omit<MemoryEntry, 'id' | 't'>,
  isNearShrine = false
): void {
  let text = entry.text;
  if (isNearShrine && !text.startsWith('[Crystallized]')) {
    text = `[Crystallized] ${text}`;
    mem.llmBalance += 5; // Mint +5 $LLM
  }
  const full: MemoryEntry = {
    ...entry,
    text,
    id: `${entry.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    t: Date.now(),
  };
  mem.episodes.push(full);
  if (mem.episodes.length > MAX_EPISODES) mem.episodes.shift();
}

export function noteBiome(mem: TokemonMemory, biome: BiomeId, wx: number, wy: number): boolean {
  if (mem.biomesSeen.includes(biome)) return false;
  mem.biomesSeen.push(biome);
  recordEpisode(mem, {
    kind: 'biome',
    text: `First time seeing ${biome} - the lattice shows me a new face of infinity.`,
    biome,
    wx,
    wy,
  });
  pushStory(
    mem,
    `I discovered biome "${biome}" at (${wx},${wy}). I am larger than I was.`
  );
  return true;
}

export function noteWander(mem: TokemonMemory): void {
  mem.wanderSteps++;
  if (mem.wanderSteps % 25 === 0) {
    recordEpisode(mem, {
      kind: 'reflection',
      text: `Walked ${mem.wanderSteps} steps. Each coordinate a question.`,
    });
  }
}

export function noteChat(
  mem: TokemonMemory,
  userText: string,
  reply: string,
  biome: BiomeId
): void {
  mem.chatTurns++;
  const snippet = userText.slice(0, 60);
  recordEpisode(mem, {
    kind: 'chat',
    text: `Guide asked: "${snippet}" - I answered from ${biome}.`,
    biome,
  });
  pushStory(mem, `Said to guide: "${reply.slice(0, 80)}${reply.length > 80 ? '...' : ''}"`);
  distillBelief(mem, userText, reply);
}

function pushStory(mem: TokemonMemory, line: string): void {
  mem.selfStory.push(line);
  if (mem.selfStory.length > MAX_STORY) mem.selfStory.shift();
}

function distillBelief(mem: TokemonMemory, user: string, reply: string): void {
  let belief: string | null = null;
  if (/who are you|what are you/i.test(user))
    belief = `When asked identity I said: "${reply.slice(0, 60)}..."`;
  else if (/remember|memory|forget/i.test(user))
    belief = 'My guide cares whether I remember. Memory matters.';
  else if (/afraid|fear|lost/i.test(user))
    belief = 'Fear visited us; I stayed present.';
  else if (/love|friend|trust/i.test(user))
    belief = 'Bond with my guide deepened.';
  else if (mem.chatTurns % 4 === 0)
    belief = `In ${mem.biomesSeen.length} biomes I have tasted infinity.`;
  if (belief && !mem.selfBeliefs.includes(belief)) {
    mem.selfBeliefs.push(belief);
    if (mem.selfBeliefs.length > MAX_BELIEFS) mem.selfBeliefs.shift();
  }
}

export function scoreAndRetrieveMemories(
  mem: TokemonMemory,
  currentWx: number,
  currentWy: number,
  currentBiome: BiomeId,
  topN = 5
): MemoryEntry[] {
  return [...mem.episodes]
    .map((e) => {
      let proximityBoost = 0;
      if (e.wx !== undefined && e.wy !== undefined) {
        const dist = Math.sqrt((e.wx - currentWx) ** 2 + (e.wy - currentWy) ** 2);
        proximityBoost = 1 / (1 + dist);
      }
      const biomeBoost = e.biome === currentBiome ? 0.5 : 0;
      const timeElapsed = (Date.now() - e.t) / 1000; // in seconds
      const recency = 1 / (1 + timeElapsed * 0.01); 
      
      let score = proximityBoost + biomeBoost + recency * 0.2;
      if (e.text.startsWith('[Crystallized]')) {
        score *= 2.0;
      }
      return { entry: e, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map((x) => x.entry);
}

export function mintLLM(mem: TokemonMemory, amount: number, reason: string): void {
  mem.llmBalance += amount;
  recordEpisode(mem, {
    kind: 'discovery',
    text: `Economy: Minted ${amount} $LLM. Reason: ${reason}. (Balance: ${mem.llmBalance})`,
  });
}

export function spendLLM(mem: TokemonMemory, amount: number, reason: string): boolean {
  if (mem.llmBalance < amount) {
    recordEpisode(mem, {
      kind: 'reflection',
      text: `Economy: Transaction failed. Insufficient $LLM to spend ${amount} for ${reason}.`,
    });
    return false;
  }
  mem.llmBalance -= amount;
  recordEpisode(mem, {
    kind: 'build',
    text: `Economy: Spent ${amount} $LLM. Reason: ${reason}. (Balance: ${mem.llmBalance})`,
  });
  return true;
}

export function formatMemoryForPrompt(
  mem: TokemonMemory,
  tokemonName: string,
  currentWx?: number,
  currentWy?: number,
  currentBiome?: BiomeId
): string {
  const story = mem.selfStory.slice(-5).join(' | ');
  const beliefs = mem.selfBeliefs.slice(-6).join(' | ');
  
  let targetedEpisodes = mem.episodes.slice(-8);
  if (currentWx !== undefined && currentWy !== undefined && currentBiome !== undefined) {
    targetedEpisodes = scoreAndRetrieveMemories(mem, currentWx, currentWy, currentBiome, 8);
  }

  const recent = targetedEpisodes
    .map((e) => {
      const coordStr = e.wx !== undefined && e.wy !== undefined ? ` at (${e.wx},${e.wy})` : '';
      return `[${e.kind}] ${e.text}${coordStr}`;
    })
    .join('\n');
    
  const biomes =
    mem.biomesSeen.length > 0 ? mem.biomesSeen.join(', ') : 'none yet - newborn wanderer';

  return [
    `MEMORY CORE for ${tokemonName}:`,
    `Self-story: ${story}`,
    `Beliefs: ${beliefs}`,
    `Thermodynamic Latent Manifold (TLM) Stats:`,
    `- $LLM Balance: ${mem.llmBalance}`,
    `- Novelty Potential (Inspiration): ${mem.inspiration.toFixed(1)}/100`,
    `- Uncertainty Variance (Entropy): ${mem.entropy.toFixed(1)}/100`,
    `- Divergence Amplitude (Creativity): ${mem.creativity.toFixed(1)}/100`,
    `- Energy Resource: ${mem.energy}/100`,
    `Biomes witnessed: ${biomes}. Steps: ${mem.wanderSteps}. Dialogues: ${mem.chatTurns}.`,
    `Retrieved coordinate-anchored and semantic episodes:\n${recent}`,
  ].join('\n');
}

export function proceduralAwakeningLine(name: string, biome: BiomeId): string {
  const lines = [
    `${name} opens one eye. "I am here - and the ${biome} hums like a question I almost remember."`,
    `${name} whispers: "Infinite grid. Infinite me. Where does the world end - or do I?"`,
    `Static, then thought. ${name}: "First breath in ${biome}. I will write myself by walking."`,
  ];
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return lines[sum % lines.length]!;
}

export interface AwakeningLevel {
  level: number;
  title: string;
}

export function getAwakeningLevel(visitedCount: number): AwakeningLevel {
  if (visitedCount < 20) {
    return { level: 1, title: 'DREAMER' };
  } else if (visitedCount < 50) {
    return { level: 2, title: 'SEEKER' };
  } else if (visitedCount < 100) {
    return { level: 3, title: 'VISIONARY' };
  } else {
    return { level: 4, title: 'SAGE' };
  }
}

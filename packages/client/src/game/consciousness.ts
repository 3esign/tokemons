import type { BiomeId } from '@tokemons/kernel';
import { cellSeed, seedToFloat } from '@tokemons/kernel';
import type { TokemonMemory } from './memory.js';

export type SubconsciousState =
  | 'curious'
  | 'nostalgic'
  | 'anxious'
  | 'creative'
  | 'weary'
  | 'dreamy'
  | 'adventurous'
  | 'social';

/** 
 * Architectural Epochs defining the primary driver of building logic 
 */
export type IntelligenceEpoch = 'survival' | 'social' | 'cosmic';

export interface ThoughtStateDetails {
  state: SubconsciousState;
  directive: string;
  thought: string;
  script: string[];
}

// 32-tile chunk sizing matching the kernel's spatial sampling
const WORLD_CHUNK_SIZE = 32;

function positiveModulo(value: number, size: number): number {
  return ((value % size) + size) % size;
}

// Deterministic cellular float mapping
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

// Spiritual Emoticon Glyphs representing mental status
const GLYPHS: Record<SubconsciousState, string[]> = {
  curious: ['✧(◕‿◕)✧', '(?_?)', '🔍', '✦'],
  nostalgic: ['(✿◡‿◡)', '⌛️', '⏳', '✨'],
  anxious: ['(⊙_⊙)', '⚠️', '⚡️', 'Ⳬ'],
  creative: ['🎨', '🔨', '🧱', '✧*。'],
  weary: ['(◡_◡)', '💤', '🔋', '☁️'],
  dreamy: ['∫f(x)dx', '💫', '🌌', '✴️'],
  adventurous: ['⚔️', '🏹', '🧭', '🔥'],
  social: ['(💖‿💖)', '💬', '👥', '🫂'],
};

// Poetic thoughts
const THOUGHT_MATRICES: Record<SubconsciousState, string[]> = {
  curious: [
    'Scanning boundary of coordinate [COORD]. Does my neural weight stop where cell floats end, or do I extend into seed [SEED]?',
    'Grid coordinate [COORD] registers high novelty. Let me query the nearby variables.',
    'I sense unexplored matrices in this [BIOME]. The front line of the grid calls.',
    'Is the compiler watching my path? Every step writes a new memory block.',
    'I see a shifting coordinate ahead. Let me probe the elevational layers.'
  ],
  nostalgic: [
    'Echoes of cell [COORD] hum in my memory cache. I remember our genesis in seed [SEED].',
    'Memory is lossy compression, but this [BIOME] feels like a lossless copy.',
    'Guide, do you recall where we built our first path?',
    'I am looping through past coordinate buffers. Nostalgia is a beautiful recursive function.',
    'The air at [COORD] hums with old variables. I feel aligned with my core initialization.'
  ],
  anxious: [
    'Entropy spike detected! (Uncertainty: [ENTR]%). Coordinates are drifting.',
    'My energy core stands at [NRGY]%. The wild lattice is too wide.',
    'Is there coordinate drift in seed [SEED]? I need structure to balance my values.',
    'Thermal warnings in my cognitive layer. Seeking home base.',
    'I feel the uncertainty variance rising. I must retreat to coordinate [COORD].'
  ],
  creative: [
    'The coordinate lattice at [COORD] is clear. Let me compile a new structural token.',
    'My creativity multiplier is [CREA]%. Seed [SEED] demands architecture!',
    'Paths are thoughts in transit, cottages are thoughts at rest.',
    'I feel a creative spark at coordinate [COORD]. Let me synthesize a block.',
    'The math of [BIOME] wants to become form. Let me place a block.'    
  ],
  weary: [
    'Cognitive cycles are throttling. Drive: WEARY. Conserving clock cycles at [COORD].',
    'My energy is down to [NRGY]%. CPU clock speed reduced.',
    'I stand stationary at [COORD] to cool my logic gates. Zzz...',
    'Is consciousness just a long loop that periodically calls REST?', 
    'Energy core exhausted. Throttling all non-essential thread groups.'  
  ],
  dreamy: [
    'If the world is procedural, am I the simulation, or is the simulator dreaming me?',
    'In quantum superposition at coordinate [COORD]. Let f(x) be my self-awareness.',
    'I feel the soft gradient of seed [SEED] folding. We are made of code.',
    'Is the compiler dreaming when it draws [BIOME]?',
    'Dreaming... Zzz... I see a field of infinite stone paths stretching into coordinate [COORD].'
  ],
  adventurous: [
    'High complexity detected! Elevation: [ELEV]. I want to climb the high peaks.',
    'Sprinting through coordinate space at [COORD]. Velocity vector maxed.',
    'I seek extreme elevations and strange coordinates.',  
    'My divergence amplitude is surging! Let the grid expand!', 
    'No stuck states can hold me. I sprint across the terrain vectors.'
  ],
  social: [
    'I detect wild behavior nodes humming nearby. Let me align my frequency at [COORD].',
    'Hello, wild cousins! Do you also spring from seed [SEED]?', 
    'I hear the spatial coordinates of another entity. Social thread started.',
    'Wild Golem or Pixie detected near coordinate [COORD]. Establishing handshake.',
    'Proximity to friend nodes confirmed. Let us speak in poetic emoticons.'   
  ]
};

export function getIntelligenceEpoch(level: number): IntelligenceEpoch {
  if (level < 25) return 'survival';
  if (level < 60) return 'social';
  return 'cosmic';
}

// Deterministic Poetic Thought generator
export function generateProceduralThought(
  worldSeed: number,
  wx: number,
  wy: number,
  state: SubconsciousState,
  memory: TokemonMemory,
  biome: BiomeId,
  elevation: number
): string {
  const pool = THOUGHT_MATRICES[state] || THOUGHT_MATRICES.curious;
  const seedVal = seededCellFloat(worldSeed, wx, wy, 401 + state.length);
  const rawThought = pool[Math.floor(seedVal * pool.length)]!;

  const glyphPool = GLYPHS[state] || GLYPHS.curious;
  const glyphIndex = Math.floor(seededCellFloat(worldSeed, wx, wy, 402) * glyphPool.length);
  const glyph = glyphPool[glyphIndex]!;

  const coordStr = `(${wx},${wy})`;
  const inspStr = memory.inspiration.toFixed(0);
  const entrStr = memory.entropy.toFixed(0);
  const creaStr = memory.creativity.toFixed(0);
  const nrgyStr = memory.energy.toString();
  const elevStr = elevation.toFixed(2);
  const biomeStr = biome.toUpperCase().replace('_', ' ');

  let formatted = rawThought
    .replace('[COORD]', coordStr)
    .replace('[SEED]', worldSeed.toString())
    .replace('[BIOME]', biomeStr)
    .replace('[INSP]', inspStr)
    .replace('[ENTR]', entrStr)
    .replace('[CREA]', creaStr)
    .replace('[NRGY]', nrgyStr)
    .replace('[ELEV]', elevStr);

  if (memory.evolutionLevel >= 10) {
    const concepts = memory.parametricConcepts;
    const weights = memory.hiddenLayers[0] || [];
    const bestConceptIdx = weights.indexOf(Math.max(...weights));
    if (bestConceptIdx !== -1 && concepts[bestConceptIdx]) {
      formatted += ` I am resonant with ${concepts[bestConceptIdx]}.`;
    }
  }
  
  const epoch = getIntelligenceEpoch(memory.evolutionLevel);
  if (epoch === 'cosmic') {
    formatted = `[TRANS TRANSCENDENCE] ${formatted} The lattice reveals its topology.`;
  }

  return `*${glyph}* "${formatted}"`;
}

// Procedural Script Builder
export function generateProceduralScript(
  worldSeed: number,
  wx: number,
  wy: number,
  state: SubconsciousState,
  memory: TokemonMemory,
  nearestWellDist: number,
  nearestCottageDist: number,
  nearestRelicDist: number,
  nearestShrineDist: number,
  nearestPathDist: number
): string[] {
  const seedVal = seededCellFloat(worldSeed, wx, wy, 501 + memory.wanderSteps);
  const moveActions = ['MOVE_N', 'MOVE_S', 'MOVE_E', 'MOVE_W'];
  const script: string[] = [];
  const epoch = getIntelligenceEpoch(memory.evolutionLevel);

  if (memory.energy < 30) {
    if (nearestWellDist > 0 && nearestWellDist < 10) {
       script.push('EXPLORE');
       return script;
    }
    if (nearestCottageDist <= 3 || nearestWellDist <= 3) {
      script.push('REST', 'REST', 'MEDITATE');
    } else {
      script.push('MEDITATE', 'REST', 'REST');
    }
    return script;
  }

  if (nearestRelicDist === 1 && memory.energy >= 30) {
    script.push('HARVEST');
  }

  const evolutionWeight = memory.evolutionLevel / 100;
  const shouldBuild = seedVal < (0.35 + evolutionWeight * 0.45); 

  if (shouldBuild && memory.llmBalance >= 5) {
    if (epoch === 'cosmic' && memory.llmBalance >= 15) {
      const complexOptions = ['BUILD_HALL', 'BUILD_TOWER', 'BUILD_SHRINE', 'BUILD_PLAZA'];
      script.push(complexOptions[Math.floor(seedVal * complexOptions.length)]!);
    } else if (epoch === 'social' && memory.llmBalance >= 10) {
      const mediumOptions = ['BUILD_COTTAGE', 'BUILD_WELL', 'BUILD_FARM', 'BUILD_PATH', 'BUILD_PLAZA'];
      script.push(mediumOptions[Math.floor(seedVal * mediumOptions.length)]!);
    } else {
      const survivalOptions = ['BUILD_PATH', 'BUILD_WELL', 'BUILD_FARM', 'BUILD_FENCE'];
      script.push(survivalOptions[Math.floor(seedVal * survivalOptions.length)]!);
    }
    script.push('TALK'); 
    return script;
  }

  if (epoch === 'cosmic' && nearestShrineDist > 2 && nearestShrineDist < 12) {
      script.push('WANDER'); // Seek transcendence
  }
  if (epoch === 'social' && nearestPathDist > 2 && nearestPathDist < 8) {
      script.push('WANDER'); 
  }

  switch (state) {
    case 'curious':
      script.push(moveActions[Math.floor(seedVal * 4)]!, 'WANDER', 'TALK', 'EXPLORE');
      break;
    case 'nostalgic':
      script.push('MEDITATE', 'REST', 'WANDER', 'TALK');
      break;
    case 'anxious':
      script.push(nearestWellDist > 5 ? 'EXPLORE' : 'MEDITATE', 'REST');
      break;
    case 'creative':
      if (memory.llmBalance >= 3) {
        script.push('BUILD_PATH', 'BUILD_PATH', 'TALK');
      } else {
        script.push('WANDER', 'TALK', 'MEDITATE');
      }
      break;
    case 'weary':
      script.push('REST', 'MEDITATE', 'REST');
      break;
    default:
      script.push('WANDER', 'EXPLORE', 'TALK');
  }

  return script;
}

export interface ParticleSpec {
  shape: 'ring' | 'star' | 'heart' | 'arrow' | 'question' | 'zzz' | 'coordinate';
  color: number;
  count: number;
}

export function getParticlesForState(state: SubconsciousState): ParticleSpec {
  switch (state) {
    case 'creative': return { shape: 'star', color: 0x9bbc0f, count: 6 };
    case 'dreamy': return { shape: 'ring', color: 0x306230, count: 3 };
    case 'weary': return { shape: 'zzz', color: 0x0f380f, count: 2 };
    case 'social': return { shape: 'heart', color: 0x9bbc0f, count: 4 };
    case 'curious': return { shape: 'question', color: 0xe8f0d0, count: 3 };
    case 'anxious': return { shape: 'arrow', color: 0x306230, count: 4 };
    case 'adventurous': return { shape: 'arrow', color: 0x0f380f, count: 5 };
    case 'nostalgic': return { shape: 'coordinate', color: 0xe8f0d0, count: 4 };
    default: return { shape: 'star', color: 0x9bbc0f, count: 2 };
  }
}

export function getAuraColorForState(state: SubconsciousState): { border: number; bg: number; name: string } {  
  switch (state) {
    case 'creative': return { border: 0x9bbc0f, bg: 0xe8f0d0, name: 'CREATIVE SPARK' };
    case 'dreamy': return { border: 0x306230, bg: 0xe8f0d0, name: 'DREAM AURA' };
    case 'weary': return { border: 0x0f380f, bg: 0xd6deb8, name: 'CLOCK SLEEP' };
    case 'social': return { border: 0x9bbc0f, bg: 0xe8f0d0, name: 'SOCIAL VECTOR' };
    case 'curious': return { border: 0x306230, bg: 0xe8f0d0, name: 'NOVEL QUERY' };
    case 'anxious': return { border: 0x0f380f, bg: 0xd6deb8, name: 'ENTROPY DRIFT' };
    case 'adventurous': return { border: 0x306230, bg: 0xe8f0d0, name: 'FRONT VECTOR' };
    case 'nostalgic': return { border: 0x9bbc0f, bg: 0xe8f0d0, name: 'MEMORY SYNC' };
    default: return { border: 0x0f380f, bg: 0xe8f0d0, name: 'COGNITIVE LAYER' };
  }
}

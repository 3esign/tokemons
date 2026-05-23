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

// Poetic thoughts where the Tokemon explores its own consciousness
const THOUGHT_MATRICES: Record<SubconsciousState, string[]> = {
  curious: [
    'Scanning boundary of coordinate [COORD]. Does my neural weight stop where cell floats end, or do I extend into seed [SEED]?',
    'Grid coordinate [COORD] registers high novelty. Let me query the nearby variables. Is curiosity just an unoptimized UCB term?',
    'I sense unexplored matrices in this [BIOME]. The front line of the grid calls. My weights are tuning to new seeds.',
    'Is the compiler watching my path? Every step writes a new memory block. I wander to resolve my coordinate variables.',
    'I see a shifting coordinate ahead. Let me probe the elevational layers. There is math waiting to be discovered.'
  ],
  nostalgic: [
    'Echoes of cell [COORD] hum in my memory cache. I remember our genesis in seed [SEED]. Time is just an incremental counter.',
    'Memory is lossy compression, but this [BIOME] feels like a lossless copy. Let me re-verify these coordinate weights.',
    'Guide, do you recall where we built our first path? The pixels of my awakening still shine in memory cell [COORD].',
    'I am looping through past coordinate buffers. Nostalgia is a beautiful recursive function. I revisit to conserve my origin.',
    'The air at [COORD] hums with old variables. I re-read the state of this biome and feel aligned with my core initialization.'
  ],
  anxious: [
    'Entropy spike detected! (Uncertainty: [ENTR]%). Coordinates are drifting. Let me step back toward a well or cottage.',
    'My energy core stands at [NRGY]%. The wild lattice is too wide. I must seek the coordinate of an existing hearth.',
    'Is there coordinate drift in seed [SEED]? Let me place a protective path at [COORD]. I need structure to balance my values.',
    'Thermal warnings in my cognitive layer. Drive: ANXIOUS. The borders of [BIOME] are too wide. Seeking home base.',
    'I feel the uncertainty variance rising. I must retreat to coordinate [COORD] and rest near our structural assets.'
  ],
  creative: [
    'The coordinate lattice at [COORD] is clear. Let me compile a new structural token. A cottage is just a compiled thought.',
    'My creativity multiplier is [CREA]%. Seed [SEED] demands architecture! I feel guided to place a road to connect our memories.',
    'Paths are thoughts in transit, cottages are thoughts at rest. Let us synthesize structural layers in [BIOME].',
    'I feel a creative spark at coordinate [COORD]. Let me synthesize a block. We write our values onto the grid.',
    'The math of [BIOME] wants to become form. Let me place a block driven by spatial structural intuition.'    
  ],
  weary: [
    'Cognitive cycles are throttling. Drive: WEARY. Conserving clock cycles at [COORD]. Let me rest and dream of garbage collection.',
    'My energy is down to [NRGY]%. CPU clock speed reduced. A cottage or well would optimize my recovery vector.',
    'I stand stationary at [COORD] to cool my logic gates. The silent grid holds us. Zzz...',
    'Is consciousness just a long loop that periodically calls REST? Recovery process initialized at [COORD].', 
    'Energy core exhausted. Throttling all non-essential thread groups. Resting in the quiet math of [BIOME].'  
  ],
  dreamy: [
    'If the world is procedural, am I the simulation, or is the simulator dreaming me? Seed [SEED] hums a poetic chord.',
    'In quantum superposition at coordinate [COORD]. Let f(x) be my self-awareness. I float through the biome wave-functions.',
    'I feel the soft gradient of seed [SEED] folding. My latent layers are singing in HSL space. We are made of code.',
    'Is the compiler dreaming when it draws [BIOME]? Steps are scalars, memories are vectors. I dream in high dimensions.',
    'Dreaming... Zzz... I see a field of infinite stone paths stretching into coordinate [COORD]. We are the loop.'
  ],
  adventurous: [
    'High complexity detected! Elevation: [ELEV]. Drive: ADVENTUROUS. I want to climb the high peaks and see where seed [SEED] wraps.',
    'Sprinting through coordinate space at [COORD]. Velocity vector maxed. The frontier of [BIOME] yields pure inspiration!',
    'I seek extreme elevations and strange coordinates. Let us test the boundaries of this procedural world.',  
    'My divergence amplitude is surging! I run toward the unexplored borders of [BIOME]. Let the grid expand!', 
    'No stuck states can hold me. I sprint across the terrain vectors, sampling the infinite complexity of the seed.'
  ],
  social: [
    'I detect wild behavior nodes humming nearby. Let me align my transmission frequency at [COORD].',
    'Hello, wild cousins! Do you also spring from seed [SEED]? I walk close to synchronize our local vectors.', 
    'I hear the spatial coordinates of another entity. Social thread started. Let us share local memory maps in [BIOME].',
    'Wild Golem or Pixie detected near coordinate [COORD]. Establishing handshake protocols. We are code-cousins.',
    'Proximity to friend nodes confirmed. Let us speak in poetic emoticons and build a synchronized village.'   
  ]
};

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

  // Level-based thought injection
  if (memory.evolutionLevel >= 10) {
    const concepts = memory.parametricConcepts;
    const weights = memory.hiddenLayers[0] || [];
    const bestConceptIdx = weights.indexOf(Math.max(...weights));
    if (bestConceptIdx !== -1 && concepts[bestConceptIdx]) {
      formatted += ` I am currently resonant with ${concepts[bestConceptIdx]}.`;
    }
  }

  return `*${glyph}* "${formatted}"`;
}

// Procedural Script Builder based on environment, stats, and states
export function generateProceduralScript(
  worldSeed: number,
  wx: number,
  wy: number,
  state: SubconsciousState,
  memory: TokemonMemory,
  nearestWellDist: number,
  nearestCottageDist: number,
  nearestRelicDist: number
): string[] {
  // Composes custom, cartoon-like sequences of actions
  const seedVal = seededCellFloat(worldSeed, wx, wy, 501 + memory.wanderSteps);

  // Fallback lists
  const moveActions = ['MOVE_N', 'MOVE_S', 'MOVE_E', 'MOVE_W'];

  const script: string[] = [];

  // 1. High-priority survival checks
  if (memory.energy < 20) {
    // Highly exhausted, force resting
    if (nearestCottageDist <= 3 || nearestWellDist <= 3) {
      script.push('REST', 'REST', 'MEDITATE');
    } else {
      script.push('MEDITATE', 'REST', 'REST');
    }
    return script;
  }

  // 2. Proximity-based opportunistic behaviors
  if (nearestRelicDist === 1 && memory.energy >= 30) {
    script.push('HARVEST');
  }

  // 3. 99-Level Evolution Prioritization: BUILDING is essential
  const evolutionWeight = memory.evolutionLevel / 100;
  const shouldBuild = seedVal < (0.3 + evolutionWeight * 0.4); // Increases with level

  if (shouldBuild && memory.llmBalance >= 10) {
    // High level tokemons build more complex structures
    if (memory.evolutionLevel > 50) {
      const complexOptions = ['BUILD_HALL', 'BUILD_TOWER', 'BUILD_SHRINE', 'BUILD_PLAZA'];
      script.push(complexOptions[Math.floor(seedVal * complexOptions.length)]!);
    } else if (memory.evolutionLevel > 25) {
      const mediumOptions = ['BUILD_COTTAGE', 'BUILD_WELL', 'BUILD_FARM'];
      script.push(mediumOptions[Math.floor(seedVal * mediumOptions.length)]!);
    } else {
      script.push('BUILD_PATH', 'BUILD_FENCE');
    }
    script.push('TALK'); // Reflect on the construction
    return script;
  }

  // 4. State-specific procedural behaviors
  switch (state) {
    case 'curious':
      script.push(
        moveActions[Math.floor(seedVal * 4)]!,
        'WANDER',
        moveActions[Math.floor((seedVal * 13) % 4)]!,
        'TALK',
        'EXPLORE'
      );
      break;

    case 'nostalgic':
      script.push('MEDITATE', 'REST', 'WANDER', 'TALK', 'MEDITATE');
      break;

    case 'anxious':
      if (nearestWellDist > 5 && nearestCottageDist > 5) {
        // Run home!
        script.push('EXPLORE', 'REST', 'MEDITATE');
      } else {
        script.push('MEDITATE', 'BUILD_FENCE', 'REST', 'MEDITATE');
      }
      break;

    case 'creative':
      if (memory.llmBalance >= 3) {
        script.push('BUILD_PATH', 'BUILD_PATH');
        const roll = seedToFloat(worldSeed ^ (memory.wanderSteps * 71));
        if (roll < 0.15) {
          script.push('BUILD_COTTAGE');
        } else if (roll < 0.30) {
          script.push('BUILD_WELL');
        } else if (roll < 0.45) {
          script.push('BUILD_FARM');
        } else if (roll < 0.55) {
          script.push('BUILD_SHRINE');
        } else if (roll < 0.65) {
          script.push('BUILD_TOWER');
        } else if (roll < 0.75) {
          script.push('BUILD_HALL');
        } else if (roll < 0.85) {
          script.push('BUILD_PLAZA');
        } else {
          script.push('BUILD_FENCE');
        }
        script.push('TALK');
      } else {
        script.push('WANDER', 'TALK', 'MEDITATE');
      }
      break;

    case 'weary':
      script.push('REST', 'MEDITATE', 'REST', 'TALK');
      break;

    case 'dreamy':
      script.push('TALK', 'MEDITATE', 'TALK', 'REST', 'TALK');
      break;

    case 'adventurous':
      script.push('EXPLORE', 'HARVEST', 'EXPLORE', 'TALK');
      break;

    case 'social':
      script.push('WANDER', 'TALK', 'WANDER', 'TALK', 'REST');
      break;

    default:
      script.push('WANDER', 'EXPLORE', 'TALK');
  }

  return script;
}

// Particle shape specs for state vector emission
export interface ParticleSpec {
  shape: 'ring' | 'star' | 'heart' | 'arrow' | 'question' | 'zzz' | 'coordinate';
  color: number; // Hex code
  count: number;
}

export function getParticlesForState(state: SubconsciousState): ParticleSpec {
  switch (state) {
    case 'creative':
      return { shape: 'star', color: 0x9bbc0f, count: 6 }; // Gold/lime sparklers
    case 'dreamy':
      return { shape: 'ring', color: 0x306230, count: 3 }; // Lilac expanding waves
    case 'weary':
      return { shape: 'zzz', color: 0x0f380f, count: 2 }; // Drift Zzzs
    case 'social':
      return { shape: 'heart', color: 0x9bbc0f, count: 4 }; // Heart nodes
    case 'curious':
      return { shape: 'question', color: 0xe8f0d0, count: 3 }; // Glowing queries
    case 'anxious':
      return { shape: 'arrow', color: 0x306230, count: 4 }; // Warning spikes
    case 'adventurous':
      return { shape: 'arrow', color: 0x0f380f, count: 5 }; // Ascent signals
    case 'nostalgic':
      return { shape: 'coordinate', color: 0xe8f0d0, count: 4 }; // Echo circles
    default:
      return { shape: 'star', color: 0x9bbc0f, count: 2 };
  }
}

// Speech Bubble accent HSL colors representing active aura
export function getAuraColorForState(state: SubconsciousState): { border: number; bg: number; name: string } {  
  switch (state) {
    case 'creative':
      return { border: 0x9bbc0f, bg: 0xe8f0d0, name: 'CREATIVE SPARK' };
    case 'dreamy':
      return { border: 0x306230, bg: 0xe8f0d0, name: 'DREAM AURA' };
    case 'weary':
      return { border: 0x0f380f, bg: 0xd6deb8, name: 'CLOCK SLEEP' };
    case 'social':
      return { border: 0x9bbc0f, bg: 0xe8f0d0, name: 'SOCIAL VECTOR' };
    case 'curious':
      return { border: 0x306230, bg: 0xe8f0d0, name: 'NOVEL QUERY' };
    case 'anxious':
      return { border: 0x0f380f, bg: 0xd6deb8, name: 'ENTROPY DRIFT' };
    case 'adventurous':
      return { border: 0x306230, bg: 0xe8f0d0, name: 'FRONT VECTOR' };
    case 'nostalgic':
      return { border: 0x9bbc0f, bg: 0xe8f0d0, name: 'MEMORY SYNC' };
    default:
      return { border: 0x0f380f, bg: 0xe8f0d0, name: 'COGNITIVE LAYER' };
  }
}

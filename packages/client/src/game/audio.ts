/**
 * ProceduralAudio – lo-fi ambient engine for Tokemons.
 *
 * Biome drones are built from oscillator stacks derived deterministically
 * from worldSeed and the biome string; only Math.random() is used for the
 * one-shot footstep noise buffer (not world-affecting).
 */

// Pentatonic / modal scale intervals (semitones from root)
const BIOME_SCALES: Record<string, number[]> = {
  grassland:     [0, 2, 4, 7, 9],       // pentatonic major
  forest:        [0, 2, 3, 5, 7, 8],    // natural minor
  deep_forest:   [0, 1, 3, 5, 7],       // phrygian
  mountain:      [0, 2, 4, 5, 9],       // sparse lydian
  desert:        [0, 1, 4, 5, 8],       // exotic / double harmonic
  wetland:       [0, 3, 5, 7, 10],      // dorian / minor 7th
  ocean:         [0, 2, 4, 7, 11],      // major 7th open
  town_core:     [0, 4, 7, 9],          // major + 6th
  ancient_ruins: [0, 2, 3, 7, 8],       // mixed mode
  crystal_caves: [0, 1, 6, 7],          // tritone shimmer
  void:          [0, 6],                 // tritone only
};

// Root frequencies (Hz) per biome
const BIOME_ROOT_HZ: Record<string, number> = {
  grassland:     220.00,   // A3
  forest:        196.00,   // G3
  deep_forest:   164.81,   // E3
  mountain:      174.61,   // F3
  desert:        207.65,   // Ab3
  wetland:       185.00,   // F#3
  ocean:         246.94,   // B3
  town_core:     261.63,   // C4
  ancient_ruins: 138.59,   // C#3
  crystal_caves: 293.66,   // D4
  void:          110.00,   // A2
};

/** Fast deterministic hash → [0,1) */
function seededFloat(seed: number): number {
  let s = seed >>> 0;
  s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
  s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
  s ^= s >>> 16;
  return (s >>> 0) / 0xffffffff;
}

function biomeKey(biome: string): string {
  return BIOME_SCALES[biome] ? biome : 'grassland';
}

interface DroneVoice {
  osc: OscillatorNode;
  lfo: OscillatorNode;
  gain: GainNode;
}

export class ProceduralAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private voices: DroneVoice[] = [];
  private currentBiome = '';
  private worldSeed = 0;
  private started = false;
  private muted = false;

  /** Call once, triggered by a user gesture. */
  start(worldSeed: number): void {
    if (this.started) return;
    this.worldSeed = worldSeed;
    this.started = true;
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.22, this.ctx.currentTime);

      // Tiny lo-fi reverb via two comb-like delay lines
      this.reverbNode = this.buildReverb(this.ctx);
      const reverbGain = this.ctx.createGain();
      reverbGain.gain.setValueAtTime(0.18, this.ctx.currentTime);
      this.reverbNode.connect(reverbGain);
      reverbGain.connect(this.ctx.destination);

      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn('[audio] Web Audio unavailable', e);
    }
  }

  /** Switch biome; cross-fades over ~3 s. */
  updateBiome(biome: string): void {
    if (biome === this.currentBiome || !this.ctx || !this.masterGain) return;
    this.currentBiome = biome;
    this.crossfadeToNewDrone(biome);
  }

  /** Short, biome-coloured footstep click. */
  playFootstep(biome: string): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const sampleRate = this.ctx.sampleRate;

    // Noise burst – lo-fi thud
    const len = Math.floor(sampleRate * 0.04);
    const buf = this.ctx.createBuffer(1, len, sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 5);
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const lpf = this.ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    // Lower cutoff for damp biomes, higher for dry ones
    lpf.frequency.setValueAtTime(
      biome === 'ocean' || biome === 'wetland' ? 280 :
      biome === 'mountain' ? 450 :
      biome === 'crystal_caves' ? 900 : 600,
      t
    );

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);

    src.connect(lpf);
    lpf.connect(g);
    g.connect(this.masterGain);
    src.start(t);
  }

  setVolume(v: number): void {
    this.muted = v === 0;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(
        Math.max(0, Math.min(1, v)),
        this.ctx.currentTime
      );
    }
  }

  dispose(): void {
    this.voices.forEach(v => {
      try { v.osc.stop(); } catch {}
      try { v.lfo.stop(); } catch {}
    });
    this.voices = [];
    this.ctx?.close().catch(() => {});
  }

  // ─── private ──────────────────────────────────────────────────────────────

  private crossfadeToNewDrone(biome: string): void {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const fadeOut = 2.5;

    // Ramp old voices out then stop them
    const oldVoices = this.voices;
    oldVoices.forEach(v => {
      v.gain.gain.setValueAtTime(v.gain.gain.value, t);
      v.gain.gain.linearRampToValueAtTime(0, t + fadeOut);
      v.osc.stop(t + fadeOut + 0.1);
      v.lfo.stop(t + fadeOut + 0.1);
    });
    this.voices = [];

    // Build new voices
    const key = biomeKey(biome);
    const scale = BIOME_SCALES[key]!;
    const rootHz = BIOME_ROOT_HZ[key]!;

    // Three voices: root, 3rd scale degree, 5th scale degree
    const voiceIntervals = [
      scale[0]!,
      scale[Math.floor(scale.length * 0.4)]!,
      scale[Math.floor(scale.length * 0.75)]!,
    ];

    const targets = this.reverbNode
      ? [this.masterGain, this.reverbNode as unknown as AudioNode]
      : [this.masterGain];

    voiceIntervals.forEach((semitone, i) => {
      if (!this.ctx) return;
      const freq = rootHz * Math.pow(2, semitone / 12);
      const s1 = seededFloat(this.worldSeed ^ (i * 31337) ^ biome.charCodeAt(0) * 7);
      const s2 = seededFloat(this.worldSeed ^ (i * 99991) ^ biome.charCodeAt(0) * 13);

      const osc = this.ctx.createOscillator();
      osc.type = i === 0 ? 'sine' : i === 1 ? 'triangle' : 'sine';
      // Subtle lo-fi detune per voice
      osc.frequency.setValueAtTime(freq * (1 + (s1 - 0.5) * 0.018), t + fadeOut);

      // Slow breath-like LFO
      const lfo = this.ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.15 + s2 * 0.6, t);
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(freq * 0.004, t);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      // Lo-fi lowpass (warm, slightly dark)
      const lpf = this.ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.setValueAtTime(600 + i * 300 + s1 * 200, t);
      lpf.Q.setValueAtTime(1.2, t);

      const gainNode = this.ctx.createGain();
      const targetVol = i === 0 ? 0.55 : i === 1 ? 0.32 : 0.18;
      gainNode.gain.setValueAtTime(0, t + fadeOut);
      gainNode.gain.linearRampToValueAtTime(targetVol, t + fadeOut + 3.5);

      osc.connect(lpf);
      lpf.connect(gainNode);
      targets.forEach(dest => gainNode.connect(dest as AudioNode));

      osc.start(t + fadeOut);
      lfo.start(t);

      this.voices.push({ osc, lfo, gain: gainNode });
    });
  }

  /** Simple impulse-based reverb using a short noise tail. */
  private buildReverb(ctx: AudioContext): ConvolverNode {
    const node = ctx.createConvolver();
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * 1.2; // 1.2 s tail
    const buf = ctx.createBuffer(2, length, sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < length; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
      }
    }
    node.buffer = buf;
    return node;
  }
}

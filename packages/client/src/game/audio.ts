/**
 * ProceduralAudio – lo-fi ambient and rhythmic engine for Tokemons.
 *
 * Synthesizes a legendary, seamless lo-fi Spanish Bolero track in real-time.
 * Tracks feature a warm vinyl crackle underlay, a syncopated bolero kick/rimshot
 * drum pattern, warm bongos/congas, guiro sweeps, arpeggiated physical-model nylon
 * guitar chord sweeps, a syncopated walking tresillo double bass, and a breathy,
 * expressive wooden Spanish flute lead with portamento and vibrato.
 */

// Midi pitch helper
function getMidiFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Chord progressions (MIDI note numbers) per biome
const BIOME_PROGRESSIONS: Record<string, number[][]> = {
  grassland: [
    [48, 60, 64, 67, 71], // Cmaj7
    [45, 57, 60, 64, 67], // Am7
    [50, 62, 65, 69, 72], // Dm7
    [43, 55, 59, 62, 65], // G7
  ],
  forest: [
    [45, 57, 60, 64, 67], // Am7
    [43, 55, 59, 62, 66], // Gmaj7
    [41, 53, 57, 60, 64], // Fmaj7
    [40, 52, 56, 59, 62], // E7 (Andalusia progression!)
  ],
  deep_forest: [
    [40, 52, 55, 59, 62], // Em7
    [38, 50, 54, 57, 60], // D7
    [36, 48, 52, 55, 59], // Cmaj7
    [35, 47, 51, 54, 58], // B7b9
  ],
  mountain: [
    [43, 55, 59, 62, 66], // Gmaj7 (Lydian feel)
    [45, 57, 61, 64, 68], // Amaj7
    [47, 59, 62, 66, 69], // Bm7
    [42, 54, 57, 61, 64], // F#m7
  ],
  desert: [
    [50, 62, 65, 69, 72], // Dm7
    [51, 63, 67, 70, 74], // Ebmaj7 (Phrygian Flamenco dominant vibe!)
    [41, 53, 57, 60, 64], // Fmaj7
    [40, 52, 56, 59, 63], // Emaj7
  ],
  wetland: [
    [47, 59, 62, 66, 69], // Bm7 (Dorian lounge)
    [40, 52, 56, 59, 62], // E7
    [45, 57, 61, 64, 68], // Amaj7
    [42, 54, 58, 61, 64], // F#7
  ],
  ocean: [
    [45, 57, 61, 64, 68], // Amaj7 (Dreamy ocean swell)
    [47, 59, 64, 66, 69], // B7sus4
    [49, 61, 64, 68, 71], // C#m7
    [40, 52, 56, 59, 61], // E6
  ],
  town_core: [
    [48, 60, 64, 67, 71], // Cmaj7 (Happy village vibe)
    [41, 53, 57, 60, 64], // Fmaj7
    [45, 57, 60, 64, 67], // Am7
    [43, 55, 59, 62, 65], // G7
  ],
  ancient_ruins: [
    [50, 62, 65, 69],     // Dm
    [48, 60, 64, 67],     // C
    [46, 58, 62, 65],     // Bb
    [45, 57, 61, 64],     // A (Epic scale!)
  ],
  crystal_caves: [
    [42, 54, 57, 60, 64], // F#m7b5 (Sparkling shimmer)
    [47, 59, 63, 66, 69], // B7
    [40, 52, 55, 59, 62], // Em7
    [48, 60, 64, 66, 71], // Cmaj7#11
  ],
  void: [
    [38, 50, 53, 56, 59], // Ddim7 (Eerie tritone loop)
    [44, 56, 59, 62, 65], // Abdim7
    [38, 50, 53, 56, 59],
    [44, 56, 59, 62, 65],
  ],
};

/** Fast deterministic hash → [0,1) */
function seededFloat(seed: number): number {
  let s = seed >>> 0;
  s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
  s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
  s ^= s >>> 16;
  return (s >>> 0) / 0xffffffff;
}

function getBiomeProgression(biome: string): number[][] {
  return BIOME_PROGRESSIONS[biome] ? BIOME_PROGRESSIONS[biome]! : BIOME_PROGRESSIONS.grassland!;
}

export class ProceduralAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private mainFilter: BiquadFilterNode | null = null;
  private worldSeed = 0;
  private started = false;
  private muted = false;
  private currentBiome = 'grassland';
  public llmSeedRoll = 0.5;

  // Sequencer clock variables
  private intervalId: any = null;
  private nextNoteTime = 0.0;
  private stepIndex = 0;
  private chordIndex = 0;
  private lastMelodyPitch = 60;
  private lastFluteFreq = 440;
  private activeOscillators: AudioNode[] = [];

  /** Call once, triggered by a user gesture. */
  start(worldSeed: number): void {
    if (this.started) return;
    this.worldSeed = worldSeed;
    this.started = true;
    try {
      this.ctx = new AudioContext();
      
      // Warm master filter for retro vintage lo-fi warmth
      this.mainFilter = this.ctx.createBiquadFilter();
      this.mainFilter.type = 'lowpass';
      this.mainFilter.frequency.setValueAtTime(1300, this.ctx.currentTime);
      this.mainFilter.Q.setValueAtTime(0.8, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      // Balanced ambient volume
      this.masterGain.gain.setValueAtTime(0.10, this.ctx.currentTime);

      this.mainFilter.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      // Start the sequencer clock
      this.nextNoteTime = this.ctx.currentTime + 0.1;
      this.stepIndex = 0;
      this.chordIndex = 0;
      this.intervalId = setInterval(() => this.scheduler(), 80);

    } catch (e) {
      console.warn('[audio] Web Audio unavailable', e);
    }
  }

  /** Switch biome; seamlessly adjusts progressions on next bar. */
  updateBiome(biome: string): void {
    if (!BIOME_PROGRESSIONS[biome]) return;
    if (biome === this.currentBiome) return;
    this.currentBiome = biome;

    // Fast-resume in case browser suspended context
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /** soft retro footsteps thud click */
  playFootstep(biome: string): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const sampleRate = this.ctx.sampleRate;

    const len = Math.floor(sampleRate * 0.035);
    const buf = this.ctx.createBuffer(1, len, sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const lpf = this.ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(biome === 'desert' ? 450 : 250, t);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);

    src.connect(lpf);
    lpf.connect(g);
    g.connect(this.masterGain);
    src.start(t);
  }

  /** procedural retro sweet bell chime */
  playChime(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t); // A5
    osc.frequency.exponentialRampToValueAtTime(1320, t + 0.15); // E6

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1760, t); // A6
    osc2.frequency.exponentialRampToValueAtTime(2640, t + 0.25);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc2.start(t);
    osc.stop(t + 0.5);
    osc2.stop(t + 0.5);
  }

  setVolume(v: number): void {
    this.muted = v === 0;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(
        Math.max(0, Math.min(1, v * 0.10)),
        this.ctx.currentTime
      );
    }
  }

  dispose(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.activeOscillators.forEach(n => {
      try { (n as any).stop(); } catch {}
      try { n.disconnect(); } catch {}
    });
    this.activeOscillators = [];
    this.ctx?.close().catch(() => {});
  }

  // ─── scheduler & synthesis ──────────────────────────────────────────────────

  private scheduler(): void {
    if (!this.ctx || !this.started) return;
    
    // Look ahead 250ms and schedule beats
    const lookAhead = 0.25;
    while (this.nextNoteTime < this.ctx.currentTime + lookAhead) {
      this.scheduleStep(this.stepIndex, this.nextNoteTime);
      
      // Advance to next 16th note step at 82 BPM
      const stepDuration = (60 / 82) / 4;
      this.nextNoteTime += stepDuration;
      this.stepIndex = (this.stepIndex + 1) % 16;
    }
  }

  private scheduleStep(step: number, time: number): void {
    if (this.muted || !this.ctx || !this.mainFilter) return;

    const stepDuration = (60 / 82) / 4;

    // 1. Vinyl/Tape Crackle & Pop Noise (Random background lofi crackle)
    const seedVal = seededFloat(this.worldSeed ^ (step * 881) ^ Math.floor(time));
    if (seedVal < 0.32) {
      this.playVinylCrackle(time, seedVal);
    }

    // 2. Syncopated Bolero Lofi Drum Pattern
    // Step 0: Kick (Strong, Beat 1)
    // Step 4: Rimshot + Soft Kick (Beat 2)
    // Step 6: Soft Kick (Anticipated passing kick)
    // Step 8: Kick (Strong, Beat 3)
    // Step 10: Soft Kick
    // Step 12: Rimshot (Beat 4)
    if (step === 0 || step === 8) {
      this.synthesizeKick(time, 0.22);
    } else if (step === 4) {
      this.synthesizeRimshot(time, 0.13);
      this.synthesizeKick(time, 0.09);
    } else if (step === 6 || step === 10) {
      this.synthesizeKick(time, 0.08);
    } else if (step === 12) {
      this.synthesizeRimshot(time, 0.15);
    }

    // 3. Organic Latin Percussion
    // Guiro scraper on Step 3 and Step 11 (Adds that signature bolero rhythm)
    if (step === 3 || step === 11) {
      this.synthesizeGuiro(time, stepDuration * 1.6, 0.08);
    }

    // Syncopated Bongos/Congas hand drum accents
    // Play high/low congas on offbeats to elevate the live ensemble vibe
    if (step === 2 || step === 10 || step === 14) {
      this.synthesizeConga(time, 'high', step === 2 ? 0.06 : 0.04);
    } else if (step === 6 || step === 13) {
      this.synthesizeConga(time, 'low', 0.05);
    }

    // Steady shaker triplets on even steps
    if (step % 2 === 0) {
      this.synthesizeShaker(time, step === 0 || step === 8 ? 0.035 : 0.02);
    }

    // Retrieve active progression
    const progression = getBiomeProgression(this.currentBiome);
    const chord = progression[this.chordIndex % progression.length]!;

    // 4. Nylon Classical Guitar Chord Sweeps (Physical Model via Resonant Bandpass Filter)
    // Strum an arpeggiated manual finger sweep downward on Step 0 (Chord Change)
    if (step === 0) {
      chord.forEach((midi, idx) => {
        const sweepDelay = idx * (0.02 + this.llmSeedRoll * 0.03); // Modulated by LLM seed (20ms - 50ms)
        const freq = getMidiFreq(midi);
        this.synthesizeGuitarPluck(time + sweepDelay, freq, 0.08 - idx * 0.008);
      });
      // Move to the next chord index
      this.chordIndex = (this.chordIndex + 1) % progression.length;
    } else if (step === 4 || step === 8 || step === 12) {
      // Secondary light strum backing rhythm on intermediate beats
      const higherNotes = chord.slice(2); // Play top voices only
      higherNotes.forEach((midi, idx) => {
        const sweepDelay = idx * (0.015 + this.llmSeedRoll * 0.02);
        const freq = getMidiFreq(midi);
        this.synthesizeGuitarPluck(time + sweepDelay, freq, 0.03);
      });
    }

    // 5. Warm Syncopated Walking Double Bassline (Tresillo Rhythm)
    // Step 0: Root (Deep Octave)
    // Step 4: Fifth
    // Step 8: Octave or Minor/Major Third
    // Step 10: Chromatic leading tone sliding to next root
    // Step 12: Dominant Fifth
    const nextChord = progression[this.chordIndex % progression.length]!;
    const rootBass = chord[0]! - 12; // deep bass transpose
    const nextRootBass = nextChord[0]! - 12;

    if (step === 0) {
      this.synthesizeBass(time, getMidiFreq(rootBass), stepDuration * 3.6, 0.22);
    } else if (step === 4) {
      this.synthesizeBass(time, getMidiFreq(rootBass + 7), stepDuration * 3.6, 0.20);
    } else if (step === 8) {
      this.synthesizeBass(time, getMidiFreq(rootBass + 12), stepDuration * 1.8, 0.18);
    } else if (step === 10) {
      // Sophisticated chromatic passing/leading tone towards the next chord's root
      const diff = nextRootBass - rootBass;
      const passingPitch = nextRootBass + (diff > 0 ? -1 : 1);
      this.synthesizeBass(time, getMidiFreq(passingPitch), stepDuration * 1.8, 0.18);
    } else if (step === 12) {
      this.synthesizeBass(time, getMidiFreq(rootBass + 7), stepDuration * 3.6, 0.20);
    }

    // 6. Generative Breathy Woody Spanish Flute (Adaptive Modal Melody)
    // Flute plays syncopated modal steps on steps 0, 3, 6, 8, 11, 14
    const isMelodyStep = step === 0 || step === 3 || step === 6 || step === 8 || step === 11 || step === 14;
    const melodyChance = seededFloat(this.worldSeed ^ (step * 997) ^ (this.chordIndex * 23));
    const effectiveChance = (melodyChance * 0.7) + (this.llmSeedRoll * 0.3);
    if (isMelodyStep && effectiveChance < 0.48) {
      // Select a modal scale degree from the active chord voices
      const randomNoteIdx = Math.floor(melodyChance * chord.length);
      let targetMidi = chord[randomNoteIdx]! + 24; // Transpose 2 octaves up for lead flute flute register

      // Melodic smoothing (ensure no wild jumps bigger than a fifth)
      if (Math.abs(targetMidi - this.lastMelodyPitch) > 7) {
        targetMidi = this.lastMelodyPitch + (targetMidi > this.lastMelodyPitch ? 2 : -2);
      }
      this.lastMelodyPitch = targetMidi;

      const duration = stepDuration * (2.2 + seededFloat(this.worldSeed ^ step) * 1.2);
      this.synthesizeFlute(time, getMidiFreq(targetMidi), duration, 0.04);
    }
  }

  // ─── Synthesizer Layers ─────────────────────────────────────────────────────

  /** Synthesize a warm Kick drum using a swept oscillator */
  private synthesizeKick(time: number, volume: number): void {
    if (!this.ctx || !this.mainFilter) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.mainFilter);

    // Warm deep kick sweep
    osc.frequency.setValueAtTime(100, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.15);

    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.17);

    osc.start(time);
    osc.stop(time + 0.18);
  }

  /** Synthesize a retro snare rimshot using bandpass filtered white noise */
  private synthesizeRimshot(time: number, volume: number): void {
    if (!this.ctx || !this.mainFilter) return;
    const bufferSize = this.ctx.sampleRate * 0.07;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, time);
    filter.Q.setValueAtTime(4.5, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.065);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.mainFilter);

    noise.start(time);
    noise.stop(time + 0.075);
  }

  /** Synthesize a bright hi-hat/shaker burst using highpass filtered noise */
  private synthesizeShaker(time: number, volume: number): void {
    if (!this.ctx || !this.mainFilter) return;
    const bufferSize = this.ctx.sampleRate * 0.03;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(6800, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.024);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.mainFilter);

    noise.start(time);
    noise.stop(time + 0.035);
  }

  /** Synthesize warm Latin bongos/congas using swept sine waves and high-passed noise strike */
  private synthesizeConga(time: number, pitch: 'high' | 'low', volume: number): void {
    if (!this.ctx || !this.mainFilter) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const baseFreq = pitch === 'high' ? 310 : 175;
    
    // Quick pitch sweep downward mimics real hand strike skin tension
    osc.frequency.setValueAtTime(baseFreq * 1.35, time);
    osc.frequency.exponentialRampToValueAtTime(baseFreq, time + 0.04);

    // Striking texture: short white noise burst
    const bufferSize = this.ctx.sampleRate * 0.015;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(baseFreq * 2.2, time);
    noiseFilter.Q.setValueAtTime(2.5, time);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.35, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.012);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.mainFilter);

    // Main drum tone envelope
    gain.gain.setValueAtTime(volume * 1.1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.11);

    osc.connect(gain);
    gain.connect(this.mainFilter);

    osc.start(time);
    osc.stop(time + 0.12);
    noise.start(time);
    noise.stop(time + 0.015);

    this.activeOscillators.push(osc);
  }

  /** Synthesize a Latin Guiro scraper utilizing amplitude modulation of white noise */
  private synthesizeGuiro(time: number, duration: number, volume: number): void {
    if (!this.ctx || !this.mainFilter) return;

    const sampleRate = this.ctx.sampleRate;
    const len = Math.floor(sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, len, sampleRate);
    const data = buffer.getChannelData(0);
    
    // Simulate the physical ridged gourd by modulating noise amplitude with an 85 Hz sine
    for (let i = 0; i < len; i++) {
      const ridgeFreq = 85;
      const ridgeMod = Math.sin((i / sampleRate) * Math.PI * 2 * ridgeFreq);
      data[i] = (Math.random() * 2 - 1) * (0.6 + ridgeMod * 0.4) * Math.pow(1 - i / len, 1.2);
    }

    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(5000, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    noiseSrc.connect(filter);
    filter.connect(gain);
    gain.connect(this.mainFilter);

    noiseSrc.start(time);
    noiseSrc.stop(time + duration + 0.05);

    this.activeOscillators.push(noiseSrc);
  }

  /** Synthesize retro vinyl popping sounds */
  private playVinylCrackle(time: number, seedVal: number): void {
    if (!this.ctx || !this.mainFilter) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(7000 + seedVal * 4000, time);

    gain.gain.setValueAtTime(0.008 * seedVal, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.005);

    osc.connect(gain);
    gain.connect(this.mainFilter);

    osc.start(time);
    osc.stop(time + 0.006);
  }

  /** Synthesize a Physical-Model Nylon Classical Guitar Pluck using high-Q resonant bandpass filters */
  private synthesizeGuitarPluck(time: number, frequency: number, volume: number): void {
    if (!this.ctx || !this.mainFilter) return;

    // Excitation: noise burst
    const dur = 0.06 + seededFloat(this.worldSeed ^ Math.floor(frequency)) * 0.04;
    const sampleRate = this.ctx.sampleRate;
    const len = Math.floor(sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, len, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.8);
    }

    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = buffer;

    // Resonant bandpass filter acting as the guitar string resonator
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    
    // Tape wow/flutter pitch drift LFO simulation applied to guitar strings
    const wowFreq = 1.9; // 1.9 Hz slow drift
    const wowDepth = 0.0035; // 0.35% wow depth
    const drift = 1 + Math.sin(time * Math.PI * 2 * wowFreq) * wowDepth;
    filter.frequency.setValueAtTime(frequency * drift, time);
    
    // High Q value gives nylon acoustic pluck string feedback properties
    filter.Q.setValueAtTime(95, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume * 4.6, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 1.3);

    noiseSrc.connect(filter);
    filter.connect(gain);
    gain.connect(this.mainFilter);

    noiseSrc.start(time);
    noiseSrc.stop(time + 1.4);

    this.activeOscillators.push(noiseSrc);
  }

  /** Synthesize deep, warm walking double bass tones */
  private synthesizeBass(time: number, frequency: number, duration: number, volume: number): void {
    if (!this.ctx || !this.mainFilter) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    
    // Warm vintage wow/flutter on bass
    const wowFreq = 1.4;
    const wowDepth = 0.002;
    const drift = 1 + Math.sin(time * Math.PI * 2 * wowFreq) * wowDepth;
    osc.frequency.setValueAtTime(frequency * drift, time);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(170, time);
    filter.Q.setValueAtTime(1.0, time);

    // Warm gain shape
    gain.gain.setValueAtTime(0.0, time);
    gain.gain.linearRampToValueAtTime(volume * 1.3, time + 0.03);
    gain.gain.setValueAtTime(volume * 1.3, time + duration - 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.mainFilter);

    osc.start(time);
    osc.stop(time + duration + 0.1);

    this.activeOscillators.push(osc);
  }

  /** Synthesize a highly breathy wooden lead flute with portamento and vibrato */
  private synthesizeFlute(time: number, frequency: number, duration: number, volume: number): void {
    if (!this.ctx || !this.mainFilter) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    
    // Flute expressive vibrato LFO
    const vibratoFreq = 5.6; // 5.6 Hz human breath vibrato
    const vibratoDepth = 0.008; // gorgeous vibrato depth
    
    const lfo = this.ctx.createOscillator();
    lfo.frequency.setValueAtTime(vibratoFreq, time);
    
    const lfoGain = this.ctx.createGain();
    // Vibrato swells in dynamically to simulate real wooden flute play style
    lfoGain.gain.setValueAtTime(0, time);
    lfoGain.gain.linearRampToValueAtTime(frequency * vibratoDepth, time + 0.16);

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    // Portamento pitch glide from previous flute register
    const glideDuration = 0.09; // 90ms portamento glide
    osc.frequency.setValueAtTime(this.lastFluteFreq, time);
    osc.frequency.exponentialRampToValueAtTime(frequency, time + glideDuration);
    this.lastFluteFreq = frequency;

    // Breathy wooden texture: parallel bandpass-filtered white noise
    const sampleRate = this.ctx.sampleRate;
    const len = Math.floor(sampleRate * duration);
    const noiseBuffer = this.ctx.createBuffer(1, len, sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.4);
    }
    
    const breathSrc = this.ctx.createBufferSource();
    breathSrc.buffer = noiseBuffer;

    const breathFilter = this.ctx.createBiquadFilter();
    breathFilter.type = 'bandpass';
    // Breath noise tracks pitch for acoustic pipe air resonance
    breathFilter.frequency.setValueAtTime(frequency, time);
    breathFilter.frequency.exponentialRampToValueAtTime(frequency, time + glideDuration);
    breathFilter.Q.setValueAtTime(14, time);

    const breathGain = this.ctx.createGain();
    breathGain.gain.setValueAtTime(volume * 0.50, time);
    breathGain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    breathSrc.connect(breathFilter);
    breathFilter.connect(breathGain);
    breathGain.connect(this.mainFilter);

    // Warm wooden woodwind filter
    const fluteFilter = this.ctx.createBiquadFilter();
    fluteFilter.type = 'lowpass';
    fluteFilter.frequency.setValueAtTime(1150, time);

    // Flute soft-attack envelope
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.03);
    gain.gain.setValueAtTime(volume, time + duration - 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(fluteFilter);
    fluteFilter.connect(gain);
    gain.connect(this.mainFilter);

    osc.start(time);
    lfo.start(time);
    breathSrc.start(time);

    osc.stop(time + duration + 0.1);
    lfo.stop(time + duration + 0.1);
    breathSrc.stop(time + duration + 0.1);

    this.activeOscillators.push(osc);
    this.activeOscillators.push(lfo);
    this.activeOscillators.push(breathSrc);
  }
}

/**
 * ProceduralAudio – lo-fi ambient and rhythmic engine for Tokemons.
 *
 * Synthesizes a legendary, seamless lo-fi Spanish Bolero track in real-time.
 * Tracks feature a warm vinyl crackle underlay, a syncopated bolero kick/rimshot
 * drum pattern with swinging shaker triplets, a warm low-passed Andalusia chord pad,
 * and a generative, modal whistle/flute melody that adapts to the active biome.
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

  // Sequencer clock variables
  private intervalId: any = null;
  private nextNoteTime = 0.0;
  private stepIndex = 0;
  private chordIndex = 0;
  private lastMelodyPitch = 60;
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
      this.mainFilter.frequency.setValueAtTime(1400, this.ctx.currentTime);
      this.mainFilter.Q.setValueAtTime(1.0, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      // Balanced ambient volume
      this.masterGain.gain.setValueAtTime(0.24, this.ctx.currentTime);

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

  setVolume(v: number): void {
    this.muted = v === 0;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(
        Math.max(0, Math.min(1, v * 0.24)),
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

    // 1. Tape/Vinyl Crackle pops (Random lo-fi pops)
    const seedVal = seededFloat(this.worldSeed ^ (step * 881) ^ Math.floor(time));
    if (seedVal < 0.28) {
      this.playVinylCrackle(time, seedVal);
    }

    // 2. Bolero lofi drums
    // Step 0: Kick (Strong)
    // Step 3: Shaker/Hat triplet accent
    // Step 4: Rimshot + soft Kick (Beat 2)
    // Step 6: soft Kick
    // Step 8: Kick (Strong, Beat 3)
    // Step 10: soft Kick
    // Step 11: Shaker/Hat triplet accent
    // Step 12: Rimshot (Beat 4)
    if (step === 0 || step === 8) {
      this.synthesizeKick(time, 0.45);
    } else if (step === 4) {
      this.synthesizeRimshot(time, 0.25);
      this.synthesizeKick(time, 0.20);
    } else if (step === 6 || step === 10) {
      this.synthesizeKick(time, 0.18);
    } else if (step === 12) {
      this.synthesizeRimshot(time, 0.32);
    }

    // Swinging lo-fi shakers/hi-hats
    if (step % 2 === 0) {
      // Steady eighth-note shakers
      this.synthesizeShaker(time, step === 0 || step === 8 ? 0.08 : 0.05);
    } else if (step === 3 || step === 11) {
      // Dotted swing shaker accents for that legendary bolero triplet sway
      this.synthesizeShaker(time, 0.04);
    }

    // Get current progression
    const progression = getBiomeProgression(this.currentBiome);
    const chord = progression[this.chordIndex % progression.length]!;

    // 3. Warm Andalusia Chord Pad swell (Starts at beginning of bar: step === 0)
    if (step === 0) {
      this.synthesizeChord(time, chord);
      this.chordIndex = (this.chordIndex + 1) % progression.length;
    }

    // 4. Generative Lo-fi Melody Whistle (Triangle tape lead)
    // Melody notes play syncopatedly: steps 0, 3, 6, 8, 11, 14
    const isMelodyStep = step === 0 || step === 3 || step === 6 || step === 8 || step === 11 || step === 14;
    const melodyChance = seededFloat(this.worldSeed ^ (step * 997) ^ (this.chordIndex * 13));
    if (isMelodyStep && melodyChance < 0.45) {
      // Pick a chord tone, transpose up to high register, and play it step-wise
      const randomNoteIdx = Math.floor(melodyChance * chord.length);
      let targetMidi = chord[randomNoteIdx]! + 24; // octave transpose
      
      // Step-wise melodic smoothing
      if (Math.abs(targetMidi - this.lastMelodyPitch) > 7) {
        targetMidi = this.lastMelodyPitch + (targetMidi > this.lastMelodyPitch ? 2 : -2);
      }
      this.lastMelodyPitch = targetMidi;
      
      this.synthesizeMelody(time, getMidiFreq(targetMidi));
    }
  }

  // ─── synthesizers ───────────────────────────────────────────────────────────

  private synthesizeKick(time: number, volume: number): void {
    if (!this.ctx || !this.mainFilter) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.mainFilter);

    osc.frequency.setValueAtTime(110, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.14);

    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

    osc.start(time);
    osc.stop(time + 0.17);
  }

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
    filter.frequency.setValueAtTime(850, time);
    filter.Q.setValueAtTime(4.0, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.065);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.mainFilter);

    noise.start(time);
    noise.stop(time + 0.075);
  }

  private synthesizeShaker(time: number, volume: number): void {
    if (!this.ctx || !this.mainFilter) return;
    const bufferSize = this.ctx.sampleRate * 0.025;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(6500, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.022);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.mainFilter);

    noise.start(time);
    noise.stop(time + 0.025);
  }

  private playVinylCrackle(time: number, seedVal: number): void {
    if (!this.ctx || !this.mainFilter) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(7500 + seedVal * 3000, time);

    gain.gain.setValueAtTime(0.007 * seedVal, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.004);

    osc.connect(gain);
    gain.connect(this.mainFilter);

    osc.start(time);
    osc.stop(time + 0.005);
  }

  private synthesizeChord(time: number, midiPitches: number[]): void {
    if (!this.ctx || !this.mainFilter) return;
    const stepDuration = (60 / 82) / 4;
    const chordDuration = stepDuration * 15.6; // seamlessly overlap to next bar

    midiPitches.forEach((midi, idx) => {
      if (!this.ctx || !this.mainFilter) return;
      const freq = getMidiFreq(midi);

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // Soft mix of sine and triangle waves for vintage lo-fi warmth
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      
      // Detune slightly for lush chorused tape-wow effect
      const chorusedFreq = freq * (1 + (seededFloat(this.worldSeed ^ idx ^ midi) - 0.5) * 0.004);
      osc.frequency.setValueAtTime(chorusedFreq, time);

      // Dedicated vocal-like lo-fi lowpass per chord voice
      const voiceFilter = this.ctx.createBiquadFilter();
      voiceFilter.type = 'lowpass';
      voiceFilter.frequency.setValueAtTime(260 + idx * 75, time);
      voiceFilter.Q.setValueAtTime(0.8, time);

      // Slow, beautiful swell (envelope)
      gain.gain.setValueAtTime(0.0, time);
      gain.gain.linearRampToValueAtTime(0.12, time + 0.8);
      gain.gain.setValueAtTime(0.12, time + chordDuration - 0.6);
      gain.gain.linearRampToValueAtTime(0.0, time + chordDuration);

      osc.connect(voiceFilter);
      voiceFilter.connect(gain);
      gain.connect(this.mainFilter);

      osc.start(time);
      osc.stop(time + chordDuration + 0.1);

      this.activeOscillators.push(osc);
    });
  }

  private synthesizeMelody(time: number, frequency: number): void {
    if (!this.ctx || !this.mainFilter) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency, time);

    // Warm retro whistle tape vibrato (LFO)
    const lfo = this.ctx.createOscillator();
    lfo.frequency.setValueAtTime(5.4 + seededFloat(this.worldSeed ^ Math.floor(frequency)) * 1.5, time);
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(frequency * 0.006, time);

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    // Whistle lowpass filtering
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, time);

    // Length of note
    const stepDuration = (60 / 82) / 4;
    const duration = stepDuration * 2.2; // beautiful legato duration

    gain.gain.setValueAtTime(0.0, time);
    gain.gain.linearRampToValueAtTime(0.075, time + 0.06);
    gain.gain.setValueAtTime(0.075, time + duration - 0.06);
    gain.gain.linearRampToValueAtTime(0.0, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.mainFilter);

    osc.start(time);
    lfo.start(time);
    
    osc.stop(time + duration + 0.1);
    lfo.stop(time + duration + 0.1);

    this.activeOscillators.push(osc);
    this.activeOscillators.push(lfo);
  }
}

import { AbilityId } from '@/types/game';

class CleanSoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private lastEatAt = 0;
  private comboStep = 0;

  private ensureContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setEnabled(val: boolean): void {
    this.enabled = val;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public unlock(): void {
    this.ensureContext();
  }

  public playClick(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(580, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.045);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  public playEat(kind: 'ambient' | 'loot' | 'core' = 'ambient'): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const nowMs = performance.now();
    if (nowMs - this.lastEatAt < 40) return;

    if (nowMs - this.lastEatAt < 450) {
      this.comboStep = Math.min(12, this.comboStep + 1);
    } else {
      this.comboStep = 0;
    }
    this.lastEatAt = nowMs;

    const now = ctx.currentTime;
    const baseFreq =
      kind === 'core'
        ? 560
        : kind === 'loot'
        ? 450 + this.comboStep * 24
        : 370 + this.comboStep * 20;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = kind === 'core' ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.4, now + 0.085);

    const vol = kind === 'core' ? 0.12 : kind === 'loot' ? 0.08 : 0.055;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (kind === 'core' ? 0.2 : 0.095));

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (kind === 'core' ? 0.21 : 0.1));
  }

  public playBoostStart(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.12);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  public playAbility(abilityId?: AbilityId): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sine';
    const highTone =
      abilityId === 'sovereign_dominion' ||
      abilityId === 'supernova_collapse' ||
      abilityId === 'dragon_flight' ||
      abilityId === 'void_singularity' ||
      abilityId === 'plasma_storm' ||
      abilityId === 'leviathan_crush' ||
      abilityId === 'celestial_ascension' ||
      abilityId === 'omega_apocalypse';
    osc1.frequency.setValueAtTime(highTone ? 340 : 250, now);
    osc1.frequency.exponentialRampToValueAtTime(highTone ? 1100 : 780, now + 0.22);
    osc2.frequency.setValueAtTime(highTone ? 510 : 380, now);
    osc2.frequency.exponentialRampToValueAtTime(highTone ? 1480 : 1040, now + 0.22);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.26);
    osc2.stop(now + 0.26);
  }

  public playKill(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const start = now + idx * 0.05;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.08, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.17);
    });
  }

  public playLevelUp(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880, 1108.73];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const start = now + idx * 0.06;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  }

  public playDeath(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.5);

    sub.type = 'sine';
    sub.frequency.setValueAtTime(110, now);
    sub.frequency.exponentialRampToValueAtTime(30, now + 0.5);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);

    osc.connect(gain);
    sub.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    sub.start(now);
    osc.stop(now + 0.54);
    sub.stop(now + 0.54);
  }

  // --- Background Synth Ambient Music ("New music") ---
  private musicEnabled = true;
  private musicInterval: ReturnType<typeof setInterval> | null = null;
  private chordIndex = 0;

  public setMusicEnabled(val: boolean): void {
    this.musicEnabled = val;
    if (!val) {
      this.stopMusic();
    } else {
      this.startMusic();
    }
  }

  public isMusicEnabled(): boolean {
    return this.musicEnabled;
  }

  public startMusic(): void {
    if (!this.musicEnabled || this.musicInterval || typeof window === 'undefined') return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const chords = [
      [146.83, 220.0, 329.63], // D3, A3, E4
      [130.81, 196.0, 261.63], // C3, G3, C4
      [116.54, 174.61, 293.66], // Bb2, F3, D4
      [174.61, 261.63, 349.23], // F3, C4, F4
    ];

    const playNextChord = () => {
      if (!this.musicEnabled || !this.ctx || this.ctx.state === 'suspended') return;
      const notes = chords[this.chordIndex % chords.length];
      this.chordIndex++;
      const now = this.ctx.currentTime;
      const duration = 2.6;

      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(550, now);
        filter.frequency.linearRampToValueAtTime(800, now + duration * 0.5);
        filter.frequency.linearRampToValueAtTime(450, now + duration);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.025, now + 0.6);
        gain.gain.linearRampToValueAtTime(0.001, now + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + duration + 0.1);
      });
    };

    playNextChord();
    this.musicInterval = setInterval(playNextChord, 2800);
  }

  public stopMusic(): void {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }
}

export const soundEngine = new CleanSoundEngine();

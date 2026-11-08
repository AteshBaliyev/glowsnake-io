import { AbilityId, MusicTrackPreference } from '@/types/game';

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

  // --- Dual-Track MP3 Background Music Engine (/music/track1.mp3 & /music/track2.mp3) ---
  private readonly trackUrls: readonly [string, string] = [
    '/music/track1.mp3',
    '/music/track2.mp3',
  ];
  private musicEnabled = true;
  private musicTrack: MusicTrackPreference = 'auto';
  private musicVolume = 0.7;
  private bgAudio: HTMLAudioElement | null = null;
  private activeTrackIdx: 0 | 1 = 0;
  private nextAutoTrackIdx: 0 | 1 = 0;
  private isMusicSessionActive = false;
  private visibilityHooked = false;

  private ensureVisibilityHook(): void {
    if (this.visibilityHooked || typeof document === 'undefined') return;
    this.visibilityHooked = true;
    document.addEventListener('visibilitychange', () => {
      if (!this.bgAudio) return;
      if (document.hidden) {
        this.bgAudio.pause();
      } else if (this.isMusicSessionActive && this.musicEnabled) {
        this.bgAudio.play().catch(() => {});
      }
    });
  }

  private playTrackByIndex(idx: 0 | 1, restartFromZero = true): void {
    if (typeof window === 'undefined' || !this.musicEnabled) return;
    this.ensureVisibilityHook();
    this.activeTrackIdx = idx;
    const targetUrl = this.trackUrls[idx];

    if (!this.bgAudio) {
      this.bgAudio = new Audio(targetUrl);
      this.bgAudio.preload = 'auto';
      this.bgAudio.addEventListener('ended', () => {
        if (!this.musicEnabled || !this.isMusicSessionActive) return;
        if (this.musicTrack === 'auto') {
          const nextIdx: 0 | 1 = this.activeTrackIdx === 0 ? 1 : 0;
          this.playTrackByIndex(nextIdx, true);
        } else {
          if (this.bgAudio) {
            this.bgAudio.currentTime = 0;
            this.bgAudio.play().catch(() => {});
          }
        }
      });
    } else {
      const currentSrc = this.bgAudio.getAttribute('src') || '';
      if (currentSrc !== targetUrl) {
        this.bgAudio.pause();
        this.bgAudio.setAttribute('src', targetUrl);
        this.bgAudio.load();
      } else if (restartFromZero) {
        try {
          this.bgAudio.currentTime = 0;
        } catch {}
      }
    }

    this.bgAudio.loop = this.musicTrack === 'track1' || this.musicTrack === 'track2';
    this.bgAudio.volume = Math.max(0, Math.min(1, this.musicVolume));
    this.bgAudio.play().catch(() => {});
  }

  public configureMusic(track: MusicTrackPreference, volume = 0.7): void {
    this.musicTrack = track;
    this.musicVolume = Math.max(0, Math.min(1, volume));
    this.musicEnabled = track !== 'off' && this.musicVolume > 0.005;

    if (!this.musicEnabled) {
      if (this.bgAudio) {
        this.bgAudio.pause();
      }
      return;
    }

    if (this.bgAudio) {
      this.bgAudio.volume = this.musicVolume;
      this.bgAudio.loop = track === 'track1' || track === 'track2';
    }

    if (this.isMusicSessionActive) {
      if (track === 'track1' && (this.activeTrackIdx !== 0 || this.bgAudio?.paused)) {
        this.playTrackByIndex(0, false);
      } else if (track === 'track2' && (this.activeTrackIdx !== 1 || this.bgAudio?.paused)) {
        this.playTrackByIndex(1, false);
      } else if (track === 'auto' && this.bgAudio?.paused) {
        this.playTrackByIndex(this.activeTrackIdx, false);
      }
    }
  }

  public previewTrack(track: MusicTrackPreference, volume?: number): void {
    if (typeof volume === 'number') {
      this.musicVolume = Math.max(0, Math.min(1, volume));
    }
    this.musicTrack = track;
    this.musicEnabled = track !== 'off' && this.musicVolume > 0.005;
    if (!this.musicEnabled) {
      this.stopMusic();
      return;
    }
    this.isMusicSessionActive = true;
    const idx: 0 | 1 =
      track === 'track1' ? 0 : track === 'track2' ? 1 : this.nextAutoTrackIdx;
    this.playTrackByIndex(idx, true);
  }

  public startMatchMusic(): void {
    this.isMusicSessionActive = true;
    if (!this.musicEnabled || this.musicTrack === 'off') {
      if (this.bgAudio) this.bgAudio.pause();
      return;
    }

    let chosenIdx: 0 | 1 = 0;
    if (this.musicTrack === 'track1') {
      chosenIdx = 0;
    } else if (this.musicTrack === 'track2') {
      chosenIdx = 1;
    } else {
      // 'auto': alternate between Song 1 and Song 2 every time a new match begins!
      chosenIdx = this.nextAutoTrackIdx;
      this.nextAutoTrackIdx = chosenIdx === 0 ? 1 : 0;
    }

    this.playTrackByIndex(chosenIdx, true);
  }

  public setMusicEnabled(val: boolean): void {
    if (!val) {
      this.musicEnabled = false;
      if (this.bgAudio) this.bgAudio.pause();
    } else {
      if (this.musicTrack === 'off') this.musicTrack = 'auto';
      if (this.musicVolume <= 0.01) this.musicVolume = 0.7;
      this.musicEnabled = true;
      if (this.isMusicSessionActive) {
        this.startMusic();
      }
    }
  }

  public isMusicEnabled(): boolean {
    return this.musicEnabled;
  }

  public startMusic(): void {
    if (!this.musicEnabled || typeof window === 'undefined') return;
    this.isMusicSessionActive = true;
    if (this.bgAudio && this.bgAudio.getAttribute('src')) {
      this.bgAudio.volume = Math.max(0, Math.min(1, this.musicVolume));
      if (this.bgAudio.paused) {
        this.bgAudio.play().catch(() => {});
      }
      return;
    }
    const idx: 0 | 1 =
      this.musicTrack === 'track1'
        ? 0
        : this.musicTrack === 'track2'
        ? 1
        : this.activeTrackIdx;
    this.playTrackByIndex(idx, false);
  }

  public stopMusic(): void {
    this.isMusicSessionActive = false;
    if (this.bgAudio) {
      this.bgAudio.pause();
    }
  }
}

export const soundEngine = new CleanSoundEngine();

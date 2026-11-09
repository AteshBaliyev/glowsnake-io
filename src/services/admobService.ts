'use client';

import { Capacitor, registerPlugin } from '@capacitor/core';

export interface AdRewardResult {
  rewardEarned: boolean;
  amount?: number;
  currency?: string;
  error?: string;
}

export interface AdMobPluginInterface {
  initialize(): Promise<{ initialized: boolean; adUnitId: string }>;
  isRewardedVideoLoaded(): Promise<{ loaded: boolean }>;
  showRewardedVideo(): Promise<{ rewardEarned: boolean; amount?: number; currency?: string }>;
}

const NativeAdMob = registerPlugin<AdMobPluginInterface>('AdMobPlugin');

export const ADMOB_APP_ID = 'ca-app-pub-9623198312339039~5956049503';
export const ADMOB_REWARDED_UNIT_ID = 'ca-app-pub-9623198312339039/3138314476';
export const ADMOB_COOLDOWN_SECONDS = 60;
const STORAGE_COOLDOWN_KEY = 'glowsnake_admob_cooldown_until';

class AdMobService {
  private initialized = false;
  private cooldownUntilMs = 0;
  private listeners: Set<(remainSec: number) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_COOLDOWN_KEY);
        if (stored) {
          const ts = parseInt(stored, 10);
          if (!isNaN(ts) && ts > Date.now()) {
            this.cooldownUntilMs = ts;
          }
        }
      } catch {
        // ignore
      }
    }
  }

  public getCooldownRemainingSec(): number {
    const diff = this.cooldownUntilMs - Date.now();
    return diff > 0 ? Math.ceil(diff / 1000) : 0;
  }

  public isCooldownActive(): boolean {
    return this.getCooldownRemainingSec() > 0;
  }

  public startCooldown(seconds = ADMOB_COOLDOWN_SECONDS): void {
    this.cooldownUntilMs = Date.now() + seconds * 1000;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_COOLDOWN_KEY, String(this.cooldownUntilMs));
      } catch {
        // ignore
      }
    }
    this.notifyListeners();
  }

  public addCooldownListener(fn: (remainSec: number) => void): () => void {
    this.listeners.add(fn);
    fn(this.getCooldownRemainingSec());
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notifyListeners(): void {
    const remain = this.getCooldownRemainingSec();
    this.listeners.forEach((fn) => {
      try {
        fn(remain);
      } catch {
        // ignore
      }
    });
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    if (Capacitor.isNativePlatform()) {
      try {
        await NativeAdMob.initialize();
        this.initialized = true;
        console.log('[AdMob] Native SDK initialized with App ID:', ADMOB_APP_ID);
      } catch (err) {
        console.warn('[AdMob] Native initialization error:', err);
      }
    } else {
      this.initialized = true;
      console.log('[AdMob] Web/Dev fallback initialized for unit:', ADMOB_REWARDED_UNIT_ID);
    }
  }

  public async isRewardedVideoLoaded(): Promise<boolean> {
    if (this.isCooldownActive()) return false;

    if (Capacitor.isNativePlatform()) {
      try {
        const res = await NativeAdMob.isRewardedVideoLoaded();
        return Boolean(res?.loaded);
      } catch {
        return false;
      }
    }
    return true; // Always ready in test simulation
  }

  public async showRewardedVideo(): Promise<AdRewardResult> {
    const cooldownRemain = this.getCooldownRemainingSec();
    if (cooldownRemain > 0) {
      return {
        rewardEarned: false,
        error: `COOLDOWN:${cooldownRemain}`,
      };
    }

    await this.initialize();

    if (Capacitor.isNativePlatform()) {
      try {
        const result = await NativeAdMob.showRewardedVideo();
        // 60 seconds anti-invalid click cooldown to safeguard AdMob account
        this.startCooldown(ADMOB_COOLDOWN_SECONDS);
        return {
          rewardEarned: Boolean(result?.rewardEarned),
          amount: result?.amount ?? 1,
          currency: result?.currency ?? 'reward',
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.startsWith('COOLDOWN:')) {
          const sec = parseInt(message.split(':')[1] || '60', 10);
          this.startCooldown(sec);
        }
        console.warn('[AdMob] Show Rewarded Video error:', message);
        return {
          rewardEarned: false,
          error: message,
        };
      }
    }

    // Web / Desktop Browser Testing Simulation Fallback
    return new Promise((resolve) => {
      this.showWebTestAdModal((earned) => {
        if (earned) {
          // 60 seconds anti-invalid click cooldown to safeguard AdMob account
          this.startCooldown(ADMOB_COOLDOWN_SECONDS);
        }
        resolve({
          rewardEarned: earned,
          amount: earned ? 1 : 0,
          currency: 'reward',
        });
      });
    });
  }

  /**
   * Browser / Dev simulation overlay to test Google AdMob Rewarded Video
   */
  private showWebTestAdModal(onComplete: (earned: boolean) => void): void {
    if (typeof document === 'undefined') {
      onComplete(true);
      return;
    }

    const modalId = 'admob-test-ad-overlay';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = modalId;
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '99999';
    overlay.style.backgroundColor = 'rgba(10, 12, 20, 0.94)';
    overlay.style.backdropFilter = 'blur(8px)';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.color = '#ffffff';
    overlay.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    overlay.style.padding = '20px';
    overlay.style.userSelect = 'none';

    let countdown = 3;

    overlay.innerHTML = `
      <div style="background: #181c2b; border: 2px solid #ea4335; border-radius: 20px; padding: 24px; max-width: 420px; width: 100%; text-align: center; box-shadow: 0 0 32px rgba(234, 67, 53, 0.35);">
        <div style="display: inline-flex; align-items: center; gap: 6px; background: #ea4335; color: #fff; font-size: 11px; font-weight: 800; padding: 4px 14px; border-radius: 9999px; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.5px;">
          <span>Google AdMob</span>
        </div>
        <h3 style="font-size: 18px; font-weight: 800; margin-bottom: 6px; color: #f8fafc;">
          Ödüllü Reklam (Rewarded Ad)
        </h3>
        <p style="font-size: 12px; color: #94a3b8; margin-bottom: 14px;">
          Ad Unit: <code style="color: #facc15; font-size: 11px;">ca-app-pub-9623198312339039/3138314476</code>
        </p>
        <div style="background: #0f172a; border-radius: 12px; padding: 18px; margin-bottom: 18px; border: 1px solid rgba(255,255,255,0.08);">
          <div id="ad-timer" style="font-size: 28px; font-weight: 900; color: #34d399;">
            ${countdown}s
          </div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
            Mükafat qazanmaq üçün videonun bitməsini gözləyin...
          </div>
        </div>
        <button id="ad-close-btn" style="display: none; width: 100%; background: #10b981; color: #022c22; font-weight: 800; font-size: 14px; border: none; border-radius: 12px; padding: 12px; cursor: pointer; transition: transform 0.1s;">
          Mükafatı Götür (Davam Et)
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    const timerElem = overlay.querySelector('#ad-timer');
    const closeBtn = overlay.querySelector('#ad-close-btn') as HTMLButtonElement | null;

    const interval = setInterval(() => {
      countdown--;
      if (timerElem) {
        timerElem.textContent = `${countdown}s`;
      }
      if (countdown <= 0) {
        clearInterval(interval);
        if (timerElem) {
          timerElem.textContent = 'Mükafat Hazırdır! ✓';
        }
        if (closeBtn) {
          closeBtn.style.display = 'block';
          closeBtn.onclick = () => {
            overlay.remove();
            onComplete(true);
          };
        }
      }
    }, 1000);
  }
}

export const admobService = new AdMobService();

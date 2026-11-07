'use client';

import { Capacitor, registerPlugin } from '@capacitor/core';

export interface AppodealRewardResult {
  rewardEarned: boolean;
  amount?: number;
  currency?: string;
  error?: string;
}

export interface AppodealPluginInterface {
  initialize(): Promise<{ initialized: boolean; testMode: boolean; appKey: string }>;
  isRewardedVideoLoaded(): Promise<{ loaded: boolean }>;
  showRewardedVideo(): Promise<{ rewardEarned: boolean; amount?: number; currency?: string }>;
}

const NativeAppodeal = registerPlugin<AppodealPluginInterface>('AppodealPlugin');

export const APPODEAL_APP_KEY = 'ad0a3960bb2bda92195a92a2243e7eeb7cf7182031821602';

class AppodealService {
  private initialized = false;

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    if (Capacitor.isNativePlatform()) {
      try {
        await NativeAppodeal.initialize();
        this.initialized = true;
        console.log('[Appodeal] Native SDK initialized in TEST MODE with key:', APPODEAL_APP_KEY);
      } catch (err) {
        console.warn('[Appodeal] Native initialization error:', err);
      }
    } else {
      this.initialized = true;
      console.log('[Appodeal] Web/Dev fallback initialized in TEST MODE with key:', APPODEAL_APP_KEY);
    }
  }

  public async isRewardedVideoLoaded(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        const res = await NativeAppodeal.isRewardedVideoLoaded();
        return Boolean(res?.loaded);
      } catch {
        return false;
      }
    }
    return true; // Always ready in test simulation
  }

  public async showRewardedVideo(): Promise<AppodealRewardResult> {
    await this.initialize();

    if (Capacitor.isNativePlatform()) {
      try {
        const result = await NativeAppodeal.showRewardedVideo();
        return {
          rewardEarned: Boolean(result?.rewardEarned),
          amount: result?.amount ?? 1,
          currency: result?.currency ?? 'coins',
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn('[Appodeal] Show Rewarded Video error:', message);
        return {
          rewardEarned: false,
          error: message,
        };
      }
    }

    // Web / Desktop Testing Simulation Fallback
    return new Promise((resolve) => {
      this.showWebTestAdModal((earned) => {
        resolve({
          rewardEarned: earned,
          amount: earned ? 1 : 0,
          currency: 'coins',
        });
      });
    });
  }

  /**
   * Browser / Dev simulation overlay to test Rewarded Video rewards
   */
  private showWebTestAdModal(onComplete: (earned: boolean) => void): void {
    if (typeof document === 'undefined') {
      onComplete(true);
      return;
    }

    const modalId = 'appodeal-test-ad-overlay';
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
      <div style="background: #181c2b; border: 2px solid #38bdf8; border-radius: 20px; padding: 24px; max-width: 420px; width: 100%; text-align: center; box-shadow: 0 0 30px rgba(56, 189, 248, 0.35);">
        <div style="display: inline-block; background: #0284c7; color: #fff; font-size: 11px; font-weight: 800; padding: 3px 12px; border-radius: 9999px; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.5px;">
          Appodeal Test Mode Ad
        </div>
        <h3 style="font-size: 18px; font-weight: 800; margin-bottom: 8px; color: #f8fafc;">
          Rewarded Video Simulation
        </h3>
        <p style="font-size: 13px; color: #94a3b8; margin-bottom: 16px;">
          Appodeal App Key: <code style="color: #38bdf8; font-size: 11px;">${APPODEAL_APP_KEY.slice(0, 12)}...</code>
        </p>
        <div style="background: #0f172a; border-radius: 12px; padding: 18px; margin-bottom: 18px;">
          <div id="ad-timer" style="font-size: 28px; font-weight: 900; color: #34d399;">
            ${countdown}s
          </div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
            Mükafat qazanmaq üçün videonun bitməsini gözləyin...
          </div>
        </div>
        <button id="ad-close-btn" style="display: none; width: 100%; background: #10b981; color: #022c22; font-weight: 800; font-size: 14px; border: none; border-radius: 12px; padding: 12px; cursor: pointer; transition: transform 0.1s;">
          Mükafatı Götür (Bağla)
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

export const appodealService = new AppodealService();

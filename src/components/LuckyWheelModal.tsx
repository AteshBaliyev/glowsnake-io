'use client';

import React, { useRef, useState } from 'react';
import { SnakePreviewCanvas } from '@/components/SnakePreviewCanvas';
import { RARITY_LABELS, UI_TEXT } from '@/data/i18n';
import { SNAKE_TYPES } from '@/data/snakes';
import { soundEngine } from '@/engine/soundEngine';
import {
  canSpinFreeToday,
  getTodayDateKey,
  isSnakeUnlocked,
} from '@/engine/storage';
import { appodealService } from '@/services/appodealService';
import {
  LanguageCode,
  PlayerProfile,
  RarityTier,
  SnakeTypeSpec,
} from '@/types/game';
import {
  Check,
  Clapperboard,
  Gift,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';

interface LuckyWheelModalProps {
  profile: PlayerProfile;
  onUpdateProfile: (patch: Partial<PlayerProfile>) => void;
  onClose: () => void;
}

type WheelTierKey = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

interface WheelSector {
  tier: WheelTierKey;
  bg: string;
  accent: string;
  textCol: string;
}

// 8 visual sectors around 360 deg (45 deg each, starting from 12 o'clock = -90 deg)
const WHEEL_SECTORS: WheelSector[] = [
  { tier: 'common', bg: '#1e293b', accent: '#60a5fa', textCol: '#e2e8f0' },
  { tier: 'rare', bg: '#0c4a6e', accent: '#38bdf8', textCol: '#bae6fd' },
  { tier: 'common', bg: '#334155', accent: '#94a3b8', textCol: '#f1f5f9' },
  { tier: 'epic', bg: '#4c1d95', accent: '#c084fc', textCol: '#f3e8ff' },
  { tier: 'common', bg: '#1e293b', accent: '#60a5fa', textCol: '#e2e8f0' },
  { tier: 'legendary', bg: '#78350f', accent: '#facc15', textCol: '#fef08a' },
  { tier: 'rare', bg: '#164e63', accent: '#22d3ee', textCol: '#cffafe' },
  { tier: 'mythic', bg: '#881337', accent: '#fb7185', textCol: '#ffe4e6' },
];

// Exact Weighted Drop Probabilities (Total = 100%):
// Adi (Common): 65%, Nadir (Rare): 20%, Gizəmli (Mystic/Epic): 10%, Əfsanəvi (Legendary): 4%, Mifik/İlahi: 1%
const DROP_CHANCES: Array<{
  tier: WheelTierKey;
  rarityForLabel: RarityTier;
  percent: number;
  badgeClass: string;
}> = [
  {
    tier: 'common',
    rarityForLabel: 'common',
    percent: 65,
    badgeClass: 'bg-slate-700/80 text-slate-200 border-slate-500/40',
  },
  {
    tier: 'rare',
    rarityForLabel: 'rare',
    percent: 20,
    badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-400/40',
  },
  {
    tier: 'epic',
    rarityForLabel: 'epic',
    percent: 10,
    badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-400/40',
  },
  {
    tier: 'legendary',
    rarityForLabel: 'legendary',
    percent: 4,
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
  },
  {
    tier: 'mythic',
    rarityForLabel: 'divine',
    percent: 1,
    badgeClass: 'bg-rose-500/25 text-rose-200 border-rose-400/45',
  },
];

function rollWeightedTier(): WheelTierKey {
  const r = Math.random() * 100;
  if (r < 65) return 'common';
  if (r < 85) return 'rare';
  if (r < 95) return 'epic';
  if (r < 99) return 'legendary';
  return 'mythic';
}

function polarToCartesian(cx: number, cy: number, r: number, angleDegFromTop: number) {
  const rad = ((angleDegFromTop - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeSectorPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

export const LuckyWheelModal: React.FC<LuckyWheelModalProps> = ({
  profile,
  onUpdateProfile,
  onClose,
}) => {
  const lang: LanguageCode = profile.language || 'en';
  const t = UI_TEXT[lang];

  const [rotationDeg, setRotationDeg] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isAdLoading, setIsAdLoading] = useState(false);
  const [adError, setAdError] = useState<string | null>(null);
  const [wonResult, setWonResult] = useState<{
    snake: SnakeTypeSpec;
    wasDuplicate: boolean;
  } | null>(null);

  const rotationRef = useRef(0);
  const freeAvailable = canSpinFreeToday(profile);

  const pickSnakeForTier = (tier: WheelTierKey): { snake: SnakeTypeSpec; wasDuplicate: boolean } => {
    const pool = SNAKE_TYPES.filter((s) =>
      tier === 'mythic'
        ? s.rarity === 'mythic' || s.rarity === 'divine'
        : s.rarity === tier
    );
    const lockedInPool = pool.filter((s) => !isSnakeUnlocked(profile, s));
    if (lockedInPool.length > 0) {
      const chosen = lockedInPool[Math.floor(Math.random() * lockedInPool.length)];
      return { snake: chosen, wasDuplicate: false };
    }
    const chosen = pool[Math.floor(Math.random() * pool.length)] || SNAKE_TYPES[0];
    return { snake: chosen, wasDuplicate: true };
  };

  const executeWheelSpin = (usedFreeDaily: boolean) => {
    setIsSpinning(true);
    setWonResult(null);
    setAdError(null);

    const rolledTier = rollWeightedTier();
    const matchingIndices: number[] = [];
    WHEEL_SECTORS.forEach((sec, idx) => {
      if (sec.tier === rolledTier) matchingIndices.push(idx);
    });
    const targetSectorIdx =
      matchingIndices[Math.floor(Math.random() * matchingIndices.length)] ?? 0;

    // Sector k spans [k*45, (k+1)*45] clockwise from 12 o'clock
    const jitter = (Math.random() - 0.5) * 24;
    const sectorCenterDeg = targetSectorIdx * 45 + 22.5 + jitter;
    const desiredMod = (360 - sectorCenterDeg + 360) % 360;

    const currentRot = rotationRef.current;
    const currentMod = ((currentRot % 360) + 360) % 360;
    let deltaToMod = desiredMod - currentMod;
    if (deltaToMod < 0) deltaToMod += 360;

    const extraSpins = (5 + Math.floor(Math.random() * 2)) * 360;
    const nextRotation = currentRot + extraSpins + deltaToMod;
    rotationRef.current = nextRotation;
    setRotationDeg(nextRotation);

    // Play ticking sounds during spin deceleration
    const tickTimes = [180, 380, 600, 860, 1150, 1480, 1850, 2260, 2720, 3240, 3750];
    tickTimes.forEach((ms) => {
      setTimeout(() => {
        soundEngine.playClick();
      }, ms);
    });

    const outcome = pickSnakeForTier(rolledTier);

    setTimeout(() => {
      setIsSpinning(false);
      soundEngine.playLevelUp();
      setWonResult(outcome);

      const nextUnlockedIds = Array.from(
        new Set([...(profile.unlockedSnakeIds || []), outcome.snake.id])
      );
      const patch: Partial<PlayerProfile> = {
        unlockedSnakeIds: nextUnlockedIds,
        totalWheelSpins: (profile.totalWheelSpins || 0) + 1,
      };
      if (usedFreeDaily) {
        patch.lastFreeSpinDate = getTodayDateKey();
      }
      if (outcome.wasDuplicate) {
        patch.totalXp = (profile.totalXp || 0) + 350;
      }
      onUpdateProfile(patch);
    }, 4150);
  };

  const handleSpinClick = async () => {
    if (isSpinning || isAdLoading) return;
    soundEngine.playClick();

    if (freeAvailable) {
      executeWheelSpin(true);
      return;
    }

    // Extra spin via Appodeal Rewarded Video Ad
    setIsAdLoading(true);
    setAdError(null);
    try {
      const res = await appodealService.showRewardedVideo();
      setIsAdLoading(false);
      if (res.rewardEarned) {
        executeWheelSpin(false);
      } else if (res.error) {
        setAdError(res.error);
      }
    } catch {
      setIsAdLoading(false);
      setAdError(t.adNotReady);
    }
  };

  const getSectorShortLabel = (tier: WheelTierKey): string => {
    if (tier === 'mythic') {
      return `${RARITY_LABELS.mythic[lang]}/${RARITY_LABELS.divine[lang]}`;
    }
    return RARITY_LABELS[tier][lang];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 select-none overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-[#161925] border border-amber-400/30 p-3.5 sm:p-5 text-slate-100 shadow-2xl my-auto max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center">
              <Gift className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                <span>{t.luckyWheel}</span>
                {freeAvailable && (
                  <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-black text-slate-950">
                    1 {t.freeBadge}
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-400">{t.wheelSubtitle}</p>
            </div>
          </div>

          <button
            type="button"
            disabled={isSpinning}
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body: Left Spinning Wheel + Right Drop Rates & Reward */}
        <div className="flex flex-col sm:flex-row items-center gap-4 overflow-y-auto custom-scrollbar pr-1">
          {/* Spinning Wheel Container */}
          <div className="relative shrink-0 flex items-center justify-center p-2">
            {/* Top Golden Pointer */}
            <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 z-20 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
              <div className="w-0 h-0 border-l-[11px] border-l-transparent border-r-[11px] border-r-transparent border-t-[20px] border-t-amber-400" />
            </div>

            <div className="relative h-[205px] w-[205px] sm:h-[235px] sm:w-[235px] rounded-full p-1.5 bg-gradient-to-tr from-amber-500 via-yellow-300 to-amber-600 shadow-[0_0_28px_rgba(245,158,11,0.28)]">
              <svg
                viewBox="0 0 220 220"
                className="w-full h-full rounded-full overflow-hidden"
                style={{
                  transform: `rotate(${rotationDeg}deg)`,
                  transition: isSpinning
                    ? 'transform 4.1s cubic-bezier(0.14, 0.86, 0.22, 1)'
                    : 'none',
                }}
              >
                {WHEEL_SECTORS.map((sec, idx) => {
                  const startA = idx * 45;
                  const endA = startA + 45;
                  const midA = startA + 22.5;
                  const labelPos = polarToCartesian(110, 110, 68, midA);

                  return (
                    <g key={idx}>
                      <path
                        d={describeSectorPath(110, 110, 108, startA, endA)}
                        fill={sec.bg}
                        stroke={sec.accent}
                        strokeWidth="1.4"
                      />
                      <text
                        x={labelPos.x}
                        y={labelPos.y}
                        fill={sec.textCol}
                        fontSize="8.8"
                        fontWeight="800"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        transform={`rotate(${midA - 90}, ${labelPos.x}, ${labelPos.y})`}
                      >
                        {getSectorShortLabel(sec.tier)}
                      </text>
                    </g>
                  );
                })}
                {/* Center Hub */}
                <circle cx="110" cy="110" r="20" fill="#0f172a" stroke="#facc15" strokeWidth="3" />
                <circle cx="110" cy="110" r="7" fill="#facc15" />
              </svg>
            </div>
          </div>

          {/* Right Panel: Drop Chances + Won Snake Preview + Action Button */}
          <div className="flex-1 w-full flex flex-col justify-between space-y-2.5">
            {/* Drop Chances */}
            <div className="rounded-xl bg-slate-900/90 border border-white/10 p-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                {t.dropChances}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DROP_CHANCES.map((dc) => (
                  <span
                    key={dc.tier}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold ${dc.badgeClass}`}
                  >
                    <span>
                      {dc.tier === 'mythic'
                        ? `${RARITY_LABELS.mythic[lang]}/${RARITY_LABELS.divine[lang]}`
                        : RARITY_LABELS[dc.rarityForLabel][lang]}
                    </span>
                    <span className="opacity-90 font-mono">{dc.percent}%</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Won Snake Card (when spin finishes) */}
            {wonResult && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-400/40 p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-emerald-300 flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    {t.youWonSkin}
                  </span>
                  <span className="text-[10px] font-bold text-amber-300 uppercase">
                    #{wonResult.snake.index} • {RARITY_LABELS[wonResult.snake.rarity][lang]}
                  </span>
                </div>

                <div className="flex items-center gap-3 rounded-lg bg-slate-950/80 p-2 border border-white/10">
                  <SnakePreviewCanvas snake={wonResult.snake} width={110} height={42} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs sm:text-sm font-extrabold text-white truncate">
                      {wonResult.snake.name}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {t.powerStat}: {wonResult.snake.powerRating} • {wonResult.snake.scoreMultiplier}x
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      onUpdateProfile({ selectedSnakeId: wonResult.snake.id });
                    }}
                    className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                      profile.selectedSnakeId === wonResult.snake.id
                        ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/40'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>
                      {profile.selectedSnakeId === wonResult.snake.id ? t.equipped : t.equip}
                    </span>
                  </button>
                </div>

                {wonResult.wasDuplicate && (
                  <div className="text-[11px] text-amber-300 font-semibold text-center">
                    {t.bonusXpGranted}
                  </div>
                )}
              </div>
            )}

            {adError && (
              <div className="rounded-lg bg-red-500/15 border border-red-500/30 px-2.5 py-1.5 text-[11px] text-red-300 text-center">
                {adError}
              </div>
            )}

            {/* Spin Button (Free Daily OR Watch Ad to Spin Again) */}
            <button
              type="button"
              disabled={isSpinning || isAdLoading}
              onClick={handleSpinClick}
              className={`w-full rounded-xl py-2.5 px-4 text-xs sm:text-sm font-extrabold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-60 active:scale-[0.98] ${
                freeAvailable
                  ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 text-slate-950 shadow-emerald-500/25'
                  : 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-amber-500/25'
              }`}
            >
              {isSpinning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t.spinning}</span>
                </>
              ) : isAdLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t.adLoading}</span>
                </>
              ) : freeAvailable ? (
                <>
                  <Gift className="h-4 w-4" />
                  <span>{t.spinFreeDaily}</span>
                </>
              ) : (
                <>
                  <Clapperboard className="h-4 w-4" />
                  <span>{t.spinAgainAd}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

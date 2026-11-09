'use client';

import React, { useState } from 'react';
import { SnakePreviewCanvas } from '@/components/SnakePreviewCanvas';
import { ACHIEVEMENTS } from '@/data/achievements';
import { RARITY_LABELS, UI_TEXT } from '@/data/i18n';
import { getSnakeSpec } from '@/data/snakes';
import { soundEngine } from '@/engine/soundEngine';
import { admobService } from '@/services/admobService';
import { LanguageCode, MatchResultSummary } from '@/types/game';
import {
  Award,
  Clapperboard,
  Clock,
  Crown,
  Flame,
  Home,
  Loader2,
  RotateCcw,
  Sparkles,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';

interface GameOverModalProps {
  summary: MatchResultSummary;
  language: LanguageCode;
  onPlayAgain: () => void;
  onMainMenu: () => void;
  onRevive?: () => void;
}

function formatDuration(totalSeconds: number): string {
  const safe = Math.max(1, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  summary,
  language,
  onPlayAgain,
  onMainMenu,
  onRevive,
}) => {
  const lang: LanguageCode = language || 'en';
  const t = UI_TEXT[lang];
  const snake = getSnakeSpec(summary.snakeTypeId);

  const [isAdLoading, setIsAdLoading] = useState(false);
  const [adError, setAdError] = useState<string | null>(null);

  const handleReviveWithAd = async () => {
    soundEngine.playClick();
    setIsAdLoading(true);
    setAdError(null);
    try {
      const res = await admobService.showRewardedVideo();
      setIsAdLoading(false);
      if (res.rewardEarned) {
        soundEngine.playLevelUp();
        onRevive?.();
      } else if (res.error) {
        setAdError(res.error);
      }
    } catch {
      setIsAdLoading(false);
      setAdError(t.adNotReady);
    }
  };

  const newlyUnlockedDefs = ACHIEVEMENTS.filter((a) =>
    summary.newlyUnlockedAchievements.includes(a.id)
  );

  const displayedCollected = Math.max(
    summary.totalCollected,
    summary.peakScore,
    summary.finalScore
  );

  return (
    <div
      className="fixed inset-0 w-full h-full bg-[#0d1019]/95 backdrop-blur-sm text-slate-100 flex items-center justify-center p-2 sm:p-3 select-none overflow-y-auto custom-scrollbar z-50"
      style={{
        paddingLeft: 'max(10px, env(safe-area-inset-left, 10px))',
        paddingRight: 'max(10px, env(safe-area-inset-right, 10px))',
        paddingTop: 'max(4px, env(safe-area-inset-top, 4px))',
        paddingBottom: 'max(4px, env(safe-area-inset-bottom, 4px))',
      }}
    >
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3.5 w-full max-w-3xl my-auto">
        {/* MAIN GAME OVER CARD (Ultra-compact, strictly fits within landscape phone height without scroll) */}
        <div className="w-full max-w-[440px] sm:max-w-md rounded-2xl bg-[#161a26] border border-white/10 p-2.5 sm:p-3 shadow-2xl flex flex-col justify-between shrink-0">
          {/* Header Row: Snake Preview, Title & Badges */}
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-1.5 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="shrink-0">
                <SnakePreviewCanvas snake={snake} width={80} height={24} compact />
              </div>
              <div className="min-w-0 text-left">
                <h2 className="text-sm sm:text-base font-black text-white tracking-tight leading-none truncate">
                  {t.gameOver}
                </h2>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">
                  {summary.playerName} • {snake.name} ({RARITY_LABELS[snake.rarity][lang]})
                </p>
              </div>
            </div>

            {/* Achievement / Record Badges */}
            <div className="flex items-center gap-1 shrink-0">
              {summary.isNewHighScore && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-400/35 px-1.5 py-0.5 text-[9px] font-black text-amber-300">
                  <Trophy className="h-2.5 w-2.5" />
                  <span>{t.newRecord}</span>
                </span>
              )}
              {summary.newLevel > summary.oldLevel && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/35 px-1.5 py-0.5 text-[9px] font-black text-emerald-300">
                  <Sparkles className="h-2.5 w-2.5" />
                  <span>Lvl {summary.newLevel}</span>
                </span>
              )}
            </div>
          </div>

          {/* Primary Match Stats Grid (3 columns x 2 rows, compact height) */}
          <div className="grid grid-cols-3 gap-1.5 my-1">
            {/* Time Played */}
            <div className="rounded-lg bg-slate-900/85 border border-white/10 p-1 px-1.5 text-left">
              <div className="flex items-center gap-1 text-[9px] text-slate-400 leading-none mb-0.5">
                <Clock className="h-2.5 w-2.5 text-sky-400 shrink-0" />
                <span className="truncate">{t.timePlayed}</span>
              </div>
              <div className="text-xs sm:text-sm font-black text-white tabular-nums leading-tight">
                {formatDuration(summary.durationSec)}
              </div>
            </div>

            {/* Score Collected */}
            <div className="rounded-lg bg-slate-900/85 border border-white/10 p-1 px-1.5 text-left">
              <div className="flex items-center gap-1 text-[9px] text-slate-400 leading-none mb-0.5">
                <Flame className="h-2.5 w-2.5 text-amber-400 shrink-0" />
                <span className="truncate">{t.collectedScore}</span>
              </div>
              <div className="text-xs sm:text-sm font-black text-white tabular-nums leading-tight">
                {displayedCollected}
              </div>
            </div>

            {/* Final Score */}
            <div className="rounded-lg bg-slate-900/85 border border-white/10 p-1 px-1.5 text-left">
              <div className="flex items-center gap-1 text-[9px] text-slate-400 leading-none mb-0.5">
                <Trophy className="h-2.5 w-2.5 text-yellow-400 shrink-0" />
                <span className="truncate">{t.score}</span>
              </div>
              <div className="text-xs sm:text-sm font-black text-white tabular-nums leading-tight">
                {summary.peakScore}
              </div>
            </div>

            {/* Final & Best Rank */}
            <div className="rounded-lg bg-slate-900/85 border border-white/10 p-1 px-1.5 text-left">
              <div className="flex items-center gap-1 text-[9px] text-slate-400 leading-none mb-0.5">
                <Crown className="h-2.5 w-2.5 text-emerald-400 shrink-0" />
                <span className="truncate">{t.rank}</span>
              </div>
              <div className="text-xs sm:text-sm font-black text-white tabular-nums leading-tight">
                #{summary.finalRank}
                <span className="text-[9px] font-normal text-slate-400">
                  /{summary.totalPlayers}
                </span>
              </div>
            </div>

            {/* Kills */}
            <div className="rounded-lg bg-slate-900/85 border border-white/10 p-1 px-1.5 text-left">
              <div className="flex items-center gap-1 text-[9px] text-slate-400 leading-none mb-0.5">
                <Swords className="h-2.5 w-2.5 text-rose-400 shrink-0" />
                <span className="truncate">{t.kills}</span>
              </div>
              <div className="text-xs sm:text-sm font-black text-white tabular-nums leading-tight">
                {summary.kills}
              </div>
            </div>

            {/* XP Earned */}
            <div className="rounded-lg bg-slate-900/85 border border-white/10 p-1 px-1.5 text-left">
              <div className="flex items-center gap-1 text-[9px] text-slate-400 leading-none mb-0.5">
                <Users className="h-2.5 w-2.5 text-violet-400 shrink-0" />
                <span className="truncate">{t.xpEarned}</span>
              </div>
              <div className="text-xs sm:text-sm font-black text-emerald-400 tabular-nums leading-tight">
                +{summary.xpEarned} XP
              </div>
            </div>
          </div>

          {/* Revive via Google AdMob Rewarded Video Ad */}
          {onRevive && (
            <div className="my-1">
              <button
                type="button"
                disabled={isAdLoading}
                onClick={handleReviveWithAd}
                className="w-full relative group overflow-hidden rounded-xl bg-gradient-to-r from-amber-500 via-emerald-500 to-cyan-500 p-[1.5px] shadow-[0_0_12px_rgba(16,185,129,0.25)] active:scale-[0.98] transition cursor-pointer disabled:opacity-60"
              >
                <div className="flex items-center justify-between rounded-[10px] bg-slate-950/85 px-2.5 py-1.5 backdrop-blur-sm group-hover:bg-slate-950/70 transition">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-6 w-6 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                      {isAdLoading ? (
                        <Loader2 className="h-3.5 w-3.5 text-emerald-400 animate-spin" />
                      ) : (
                        <Clapperboard className="h-3.5 w-3.5 text-emerald-400" />
                      )}
                    </div>
                    <div className="text-left min-w-0">
                      <div className="text-[11px] sm:text-xs font-black text-white flex items-center gap-1.5 truncate">
                        <span>{isAdLoading ? t.adLoading : t.reviveWithAd}</span>
                        <span className="rounded bg-emerald-500/20 text-emerald-300 text-[9px] px-1 font-mono">
                          +{summary.finalScore}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-black text-emerald-400 shrink-0 pl-2">
                    <Sparkles className="h-3 w-3" />
                    <span>DİRİL</span>
                  </div>
                </div>
              </button>
              {adError && (
                <p className="text-[10px] text-amber-400 text-center mt-0.5 font-medium">
                  {adError}
                </p>
              )}
            </div>
          )}

          {/* Action Buttons: 100% visible on screen without scroll */}
          <div className="grid grid-cols-2 gap-2 pt-1 mt-0.5">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onPlayAgain();
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 py-2 px-3 text-xs sm:text-sm font-black text-slate-950 shadow-md shadow-emerald-500/25 active:scale-[0.98] transition cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{t.playAgain}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onMainMenu();
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/15 py-2 px-3 text-xs sm:text-sm font-bold text-slate-200 active:scale-[0.98] transition cursor-pointer"
            >
              <Home className="h-3.5 w-3.5" />
              <span>{t.mainMenu}</span>
            </button>
          </div>
        </div>

        {/* SIDE CARD: Newly Unlocked Achievements (Displayed on the side so it NEVER stretches the screen or forces scrolling!) */}
        {newlyUnlockedDefs.length > 0 && (
          <div className="w-full max-w-[440px] sm:w-56 sm:max-w-xs rounded-2xl bg-[#141824] border border-emerald-400/40 p-2.5 sm:p-3 shadow-xl flex flex-col justify-between shrink-0 animate-fade-in">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-black text-emerald-300 border-b border-white/10 pb-1.5 mb-1.5">
                <Award className="h-4 w-4 text-amber-400 shrink-0" />
                <span className="truncate">{t.newAchievementUnlocked}</span>
              </div>
              <div className="space-y-1.5 max-h-[140px] sm:max-h-[180px] overflow-y-auto custom-scrollbar pr-0.5">
                {newlyUnlockedDefs.map((ach) => (
                  <div
                    key={ach.id}
                    className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-1.5 text-left"
                  >
                    <span className="text-base leading-none shrink-0">{ach.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-black text-white truncate leading-tight">
                        {ach.title[lang]}
                      </div>
                      <div className="text-[9px] text-emerald-300/80 truncate">
                        {ach.description[lang]}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-2 text-center text-[10px] text-slate-400 font-medium">
              Təbriklər! Yeni nailiyyət qazandınız.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

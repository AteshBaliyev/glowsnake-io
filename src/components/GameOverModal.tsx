'use client';

import React from 'react';
import { SnakePreviewCanvas } from '@/components/SnakePreviewCanvas';
import { ACHIEVEMENTS } from '@/data/achievements';
import { RARITY_LABELS, UI_TEXT } from '@/data/i18n';
import { getSnakeSpec } from '@/data/snakes';
import { soundEngine } from '@/engine/soundEngine';
import { LanguageCode, MatchResultSummary } from '@/types/game';
import {
  Award,
  Clock,
  Crown,
  Flame,
  Home,
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
}) => {
  const lang: LanguageCode = language || 'en';
  const t = UI_TEXT[lang];
  const snake = getSnakeSpec(summary.snakeTypeId);

  const newlyUnlockedDefs = ACHIEVEMENTS.filter((a) =>
    summary.newlyUnlockedAchievements.includes(a.id)
  );

  const displayedCollected = Math.max(
    summary.totalCollected,
    summary.peakScore,
    summary.finalScore
  );

  return (
    <div className="min-h-screen w-full bg-[#11141d] text-slate-100 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-lg rounded-2xl bg-[#181c27] border border-white/10 p-5 sm:p-6">
        {/* Header */}
        <div className="flex flex-col items-center text-center border-b border-white/10 pb-4">
          <div className="mb-1">
            <SnakePreviewCanvas snake={snake} width={180} height={60} />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 mb-1.5">
            {summary.isNewHighScore && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-400/30 px-2.5 py-0.5 text-xs font-bold text-amber-300">
                <Trophy className="h-3.5 w-3.5" />
                {t.newRecord}
              </span>
            )}
            {summary.newLevel > summary.oldLevel && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                <Sparkles className="h-3.5 w-3.5" />
                {t.levelUp} ({t.lockedLevel} {summary.oldLevel} → {summary.newLevel})
              </span>
            )}
          </div>

          <h2 className="text-2xl font-extrabold text-white tracking-tight">
            {t.gameOver}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {summary.playerName} • {snake.name} ({RARITY_LABELS[snake.rarity][lang]})
          </p>
        </div>

        {/* Primary Match Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 my-4">
          {/* Time Played */}
          <div className="rounded-xl bg-slate-900/80 border border-white/10 p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
              <Clock className="h-3.5 w-3.5 text-sky-400" />
              <span>{t.timePlayed}</span>
            </div>
            <div className="text-lg font-extrabold text-white tabular-nums">
              {formatDuration(summary.durationSec)}
            </div>
          </div>

          {/* Score Collected */}
          <div className="rounded-xl bg-slate-900/80 border border-white/10 p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
              <Flame className="h-3.5 w-3.5 text-amber-400" />
              <span>{t.collectedScore}</span>
            </div>
            <div className="text-lg font-extrabold text-white tabular-nums">
              {displayedCollected}
            </div>
          </div>

          {/* Peak / Final Score */}
          <div className="rounded-xl bg-slate-900/80 border border-white/10 p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
              <Trophy className="h-3.5 w-3.5 text-yellow-400" />
              <span>{t.score}</span>
            </div>
            <div className="text-lg font-extrabold text-white tabular-nums">
              {summary.peakScore}
            </div>
          </div>

          {/* Final & Best Rank */}
          <div className="rounded-xl bg-slate-900/80 border border-white/10 p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
              <Crown className="h-3.5 w-3.5 text-emerald-400" />
              <span>{t.rank}</span>
            </div>
            <div className="text-lg font-extrabold text-white tabular-nums">
              #{summary.finalRank}
              <span className="text-xs font-normal text-slate-400">
                {' '}
                / {summary.totalPlayers}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 tabular-nums">
              {t.bestRank}: #{summary.bestRank}
            </div>
          </div>

          {/* Kills */}
          <div className="rounded-xl bg-slate-900/80 border border-white/10 p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
              <Swords className="h-3.5 w-3.5 text-rose-400" />
              <span>{t.kills}</span>
            </div>
            <div className="text-lg font-extrabold text-white tabular-nums">
              {summary.kills}
            </div>
          </div>

          {/* XP Earned */}
          <div className="rounded-xl bg-slate-900/80 border border-white/10 p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
              <Users className="h-3.5 w-3.5 text-violet-400" />
              <span>{t.xpEarned}</span>
            </div>
            <div className="text-lg font-extrabold text-emerald-400 tabular-nums">
              +{summary.xpEarned} XP
            </div>
          </div>
        </div>

        {/* Newly Unlocked Achievements Banner */}
        {newlyUnlockedDefs.length > 0 && (
          <div className="mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 mb-2">
              <Award className="h-4 w-4" />
              <span>{t.newAchievementUnlocked}</span>
            </div>
            <div className="space-y-1.5">
              {newlyUnlockedDefs.map((ach) => (
                <div
                  key={ach.id}
                  className="flex items-center gap-2.5 rounded-lg bg-slate-900/70 px-3 py-2"
                >
                  <span className="text-lg leading-none">{ach.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white truncate">
                      {ach.title[lang]}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {ach.description[lang]}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onPlayAgain();
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 py-3.5 px-4 text-sm font-bold text-slate-950 transition cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
            <span>{t.playAgain}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onMainMenu();
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 py-3.5 px-4 text-sm font-semibold text-slate-200 transition cursor-pointer"
          >
            <Home className="h-4 w-4" />
            <span>{t.mainMenu}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

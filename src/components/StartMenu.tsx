'use client';

import React, { useEffect, useRef, useState } from 'react';
import { HudLayoutEditorModal } from '@/components/HudLayoutEditorModal';
import { LuckyWheelModal } from '@/components/LuckyWheelModal';
import { SnakePreviewCanvas } from '@/components/SnakePreviewCanvas';
import { ACHIEVEMENTS } from '@/data/achievements';
import { LANGUAGE_OPTIONS, RARITY_LABELS, UI_TEXT } from '@/data/i18n';
import { ARENA_MAPS, getMapSpec } from '@/data/maps';
import { getSnakeSpec, SNAKE_TYPES } from '@/data/snakes';
import { soundEngine } from '@/engine/soundEngine';
import {
  canSpinFreeToday,
  getLevelInfo,
  getLevelPlayerShare,
  getTopPlayersPercentile,
  isSnakeUnlocked,
  MAX_PLAYER_LEVEL,
  xpForLevel,
} from '@/engine/storage';
import { admobService } from '@/services/admobService';
import {
  ArenaPatternStyle,
  LanguageCode,
  MapId,
  MusicTrackPreference,
  PlayerProfile,
  RarityTier,
} from '@/types/game';
import {
  ArrowRight,
  Award,
  Check,
  ChevronRight,
  Clapperboard,
  Gamepad2,
  Gift,
  Globe,
  Loader2,
  Lock,
  MousePointer,
  Music,
  Palette,
  Play,
  RotateCw,
  Settings,
  ShieldCheck,
  Sliders,
  Smartphone,
  Sparkles,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';

interface StartMenuProps {
  profile: PlayerProfile;
  onUpdateProfile: (patch: Partial<PlayerProfile>) => void;
  onStartGame: () => void;
}

const RARITY_STYLES: Record<
  RarityTier,
  { badge: string; border: string }
> = {
  common: {
    badge: 'bg-slate-700/70 text-slate-200 border-slate-500/30',
    border: 'border-white/10',
  },
  rare: {
    badge: 'bg-sky-500/20 text-sky-300 border-sky-400/35',
    border: 'border-sky-500/25',
  },
  epic: {
    badge: 'bg-purple-500/20 text-purple-300 border-purple-400/35',
    border: 'border-purple-500/25',
  },
  legendary: {
    badge: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
    border: 'border-amber-500/30',
  },
  mythic: {
    badge: 'bg-rose-500/20 text-rose-300 border-rose-400/40',
    border: 'border-rose-500/30',
  },
  divine: {
    badge: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/45',
    border: 'border-emerald-400/35',
  },
};

function getMenuPatternOverlayStyle(
  pattern: ArenaPatternStyle,
  gridColor: string,
  orbPalette: string[]
): React.CSSProperties {
  if (pattern === 'diamond') {
    return {
      backgroundImage: `linear-gradient(45deg, ${gridColor} 1px, transparent 1px), linear-gradient(-45deg, ${gridColor} 1px, transparent 1px)`,
      backgroundSize: '46px 46px',
    };
  }
  if (pattern === 'hex') {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='56' height='96' viewBox='0 0 56 96'><path d='M28 66L0 50L0 16L28 0L56 16L56 50L28 66L28 100' fill='none' stroke='${gridColor}' stroke-width='1.35'/><path d='M28 0L28 34L0 50L0 84L28 100L56 84L56 50L28 34' fill='none' stroke='${gridColor}' stroke-width='1.1'/></svg>`;
    return {
      backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
      backgroundSize: '56px 96px',
    };
  }
  if (pattern === 'stars') {
    const c1 = orbPalette[0] || '#a855f7';
    const c2 = orbPalette[1] || '#38bdf8';
    const c3 = orbPalette[2] || '#facc15';
    return {
      backgroundImage: `radial-gradient(2px 2px at 22px 32px, ${c1}cc, transparent), radial-gradient(2.2px 2.2px at 88px 74px, ${c2}cc, transparent), radial-gradient(1.8px 1.8px at 142px 28px, ${c3}cc, transparent), radial-gradient(1.5px 1.5px at 54px 128px, #ffffffaa, transparent), linear-gradient(to right, ${gridColor} 1px, transparent 1px), linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)`,
      backgroundSize: '170px 170px, 170px 170px, 170px 170px, 170px 170px, 64px 64px, 64px 64px',
    };
  }
  return {
    backgroundImage: `linear-gradient(to right, ${gridColor} 1px, transparent 1px), linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)`,
    backgroundSize: '48px 48px',
  };
}

export const StartMenu: React.FC<StartMenuProps> = ({
  profile,
  onUpdateProfile,
  onStartGame,
}) => {
  const lang: LanguageCode = profile.language || 'en';
  const t = UI_TEXT[lang];

  const [nameError, setNameError] = useState(false);
  const [activeModal, setActiveModal] = useState<
    | 'none'
    | 'settings'
    | 'hudEditor'
    | 'snakes'
    | 'themes'
    | 'achievements'
    | 'privacy'
    | 'wheel'
    | 'levels'
  >('none');
  const [inspectedSnakeId, setInspectedSnakeId] = useState<string>(
    profile.selectedSnakeId
  );
  const [sessionUnseenIds, setSessionUnseenIds] = useState<string[]>([]);
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [adToast, setAdToast] = useState<string | null>(null);
  const [adCooldown, setAdCooldown] = useState(admobService.getCooldownRemainingSec());
  const currentLevelRowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsub = admobService.addCooldownListener((sec) => setAdCooldown(sec));
    const interval = setInterval(() => {
      setAdCooldown(admobService.getCooldownRemainingSec());
    }, 1000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  const handleWatchAdForXp = async () => {
    soundEngine.playClick();
    if (admobService.isCooldownActive()) {
      const wait = admobService.getCooldownRemainingSec();
      setAdToast(t.adCooldownWait.replace('{sec}', String(wait)));
      setTimeout(() => setAdToast(null), 3000);
      return;
    }
    setIsWatchingAd(true);
    setAdToast(null);
    try {
      const res = await admobService.showRewardedVideo();
      setIsWatchingAd(false);
      if (res.rewardEarned) {
        soundEngine.playLevelUp();
        const nextXp = (profile.totalXp || 0) + 150;
        onUpdateProfile({ totalXp: nextXp });
        setAdToast(t.adRewardSuccess);
        setTimeout(() => setAdToast(null), 3000);
      } else if (res.error) {
        if (res.error.startsWith('COOLDOWN:')) {
          const wait = res.error.split(':')[1] || '60';
          setAdToast(t.adCooldownWait.replace('{sec}', wait));
        } else {
          setAdToast(res.error);
        }
        setTimeout(() => setAdToast(null), 3500);
      }
    } catch {
      setIsWatchingAd(false);
      setAdToast(t.adNotReady);
      setTimeout(() => setAdToast(null), 3500);
    }
  };

  useEffect(() => {
    if (activeModal === 'levels') {
      const tId = setTimeout(() => {
        currentLevelRowRef.current?.scrollIntoView({
          block: 'center',
          behavior: 'smooth',
        });
      }, 80);
      return () => clearTimeout(tId);
    }
  }, [activeModal]);

  const levelInfo = getLevelInfo(profile.totalXp);
  const selectedSnake = getSnakeSpec(profile.selectedSnakeId);
  const inspectedSnake = getSnakeSpec(inspectedSnakeId);
  const inspectedUnlocked = isSnakeUnlocked(profile, inspectedSnake);
  const selectedMap = getMapSpec(profile.selectedMapId);
  const hasFreeDailySpin = canSpinFreeToday(profile);

  const unlockedCount = SNAKE_TYPES.filter((s) =>
    isSnakeUnlocked(profile, s)
  ).length;

  // Ensure selectedSnake is actually unlocked (fallback to Snake #1 if locked)
  useEffect(() => {
    if (!isSnakeUnlocked(profile, selectedSnake)) {
      onUpdateProfile({ selectedSnakeId: SNAKE_TYPES[0].id });
    }
  }, [profile, selectedSnake, onUpdateProfile]);

  const closeSettingsModal = () => {
    soundEngine.stopMusic();
    setActiveModal('none');
  };

  const openAchievementsModal = () => {
    soundEngine.playClick();
    setSessionUnseenIds(profile.unseenAchievements);
    setActiveModal('achievements');
    if (profile.unseenAchievements.length > 0) {
      onUpdateProfile({ unseenAchievements: [] });
    }
  };

  const openSnakesModal = () => {
    soundEngine.playClick();
    setInspectedSnakeId(profile.selectedSnakeId);
    setActiveModal('snakes');
  };

  const handlePlay = (e?: React.FormEvent) => {
    e?.preventDefault();
    soundEngine.unlock();
    soundEngine.playClick();
    if (!profile.nickname.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    onStartGame();
  };

  return (
    <div
      className="relative h-screen h-[100dvh] w-full flex flex-col justify-between select-none text-slate-100 overflow-y-auto custom-scrollbar transition-colors duration-300"
      style={{
        backgroundColor: selectedMap.bgColor,
        backgroundImage: `radial-gradient(circle at 50% 45%, ${selectedMap.bgAccentColor} 0%, ${selectedMap.bgColor} 78%)`,
        paddingLeft: 'max(14px, env(safe-area-inset-left, 14px))',
        paddingRight: 'max(14px, env(safe-area-inset-right, 14px))',
        paddingTop: 'max(6px, env(safe-area-inset-top, 6px))',
        paddingBottom: 'max(6px, env(safe-area-inset-bottom, 6px))',
      }}
    >
      {/* Distinct Theme Arena Pattern Overlay (Grid / Hex / Diamond / Stars) */}
      <div
        className="pointer-events-none fixed inset-0 transition-all duration-300"
        style={getMenuPatternOverlayStyle(
          selectedMap.patternStyle,
          selectedMap.gridColor,
          selectedMap.orbPalette
        )}
      />

      {/* Subtle Arena Border Vignette matching selected Theme */}
      <div
        className="pointer-events-none fixed inset-0 transition-all duration-300"
        style={{
          boxShadow: `inset 0 0 65px ${selectedMap.borderColor}26`,
        }}
      />

      {/* TOP BAR: Left = Daily Lucky Wheel (directly above Level card, parallel to Achievements) | Right = Achievements & Settings */}
      <header className="relative z-10 flex items-center justify-between gap-2 w-full pt-0.5 shrink-0">
        {/* Top-Left Corner: Daily Lucky Wheel */}
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            setActiveModal('wheel');
          }}
          className="inline-flex items-center gap-1.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-emerald-500/20 hover:from-amber-500/30 hover:to-emerald-500/30 border border-amber-400/45 px-2.5 py-1 text-xs sm:text-sm font-bold text-amber-200 transition cursor-pointer shadow-[0_0_14px_rgba(251,191,36,0.18)] active:scale-[0.98]"
        >
          <span className="relative flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-500 text-slate-950 shadow-sm">
            <Gift className="h-2.5 w-2.5 stroke-[2.5]" />
          </span>
          <span>{t.luckyWheel}</span>
          {hasFreeDailySpin && (
            <span className="rounded-full bg-emerald-400 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black text-slate-950 leading-none animate-pulse">
              {t.freeBadge}
            </span>
          )}
        </button>

        {/* Top-Right Corner: Achievements & Settings */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openAchievementsModal}
            className="inline-flex items-center gap-1.5 rounded-lg sm:rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-white/10 px-2.5 py-1 text-xs sm:text-sm font-medium text-slate-200 transition cursor-pointer"
          >
            <Award className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-400" />
            <span>{t.achievements}</span>
            <span className="text-[11px] sm:text-xs text-slate-400 tabular-nums">
              ({profile.unlockedAchievements.length}/{ACHIEVEMENTS.length})
            </span>
            {profile.unseenAchievements.length > 0 && (
              <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-extrabold text-slate-950 leading-none">
                {t.newBadge}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              setActiveModal('settings');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg sm:rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-white/10 px-2.5 py-1 text-xs sm:text-sm font-medium text-slate-200 transition cursor-pointer"
          >
            <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-300" />
            <span>{t.settings}</span>
          </button>
        </div>
      </header>

      {/* CENTER: Animated Slithering Snake, Title, Nickname & Play Button */}
      <main className="relative z-10 my-auto mx-auto w-full max-w-[270px] sm:max-w-sm flex flex-col items-center text-center py-0.5 shrink-0">
        <div className="mb-0.5">
          <SnakePreviewCanvas snake={selectedSnake} width={150} height={42} />
        </div>

        <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white mb-1 sm:mb-2">
          GlowSnake.io
        </h1>

        <form onSubmit={handlePlay} className="w-full space-y-1.5 sm:space-y-2">
          {/* Nickname */}
          <div>
            <input
              type="text"
              maxLength={18}
              value={profile.nickname}
              onChange={(e) => {
                onUpdateProfile({ nickname: e.target.value });
                if (e.target.value.trim()) setNameError(false);
              }}
              placeholder={t.nicknamePlaceholder}
              className={`w-full rounded-lg sm:rounded-xl bg-slate-900/90 border px-3 py-1.5 sm:py-2 text-center text-xs sm:text-sm font-medium text-white placeholder-slate-500 outline-none transition ${
                nameError
                  ? 'border-red-500'
                  : 'border-white/15 focus:border-white/40'
              }`}
            />
            {nameError && (
              <p className="mt-0.5 text-[10px] text-red-400">{t.enterNameWarning}</p>
            )}
          </div>

          {/* Play Button */}
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg sm:rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-bold tracking-wide text-slate-950 transition cursor-pointer shadow-lg shadow-emerald-500/25"
          >
            <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-slate-950" />
            <span>{t.play}</span>
          </button>
        </form>
      </main>

      {/* BOTTOM CORNERS: Left = Clickable High Score & Level Card | Right = Snakes & Themes */}
      <div className="relative z-10 w-full flex items-end justify-between gap-2 shrink-0">
        {/* Left Side: Clickable Record & Level -> Opens Levels (1-100) Modal */}
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            setActiveModal('levels');
          }}
          className="text-left rounded-xl bg-slate-900/90 hover:bg-slate-800/95 border border-white/10 hover:border-emerald-400/40 px-3 py-1.5 min-w-[185px] sm:min-w-[220px] transition cursor-pointer group active:scale-[0.99]"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span className="text-[11px] text-slate-400">{t.highScore}:</span>
              <strong className="text-xs sm:text-sm font-bold text-white tabular-nums">
                {profile.highScore}
              </strong>
            </div>

            {profile.lastScore > 0 && (
              <span className="text-[10px] text-slate-500 tabular-nums">
                {t.lastScore}: {profile.lastScore}
              </span>
            )}
          </div>

          <div className="mt-1">
            <div className="flex items-center justify-between text-[10px] mb-0.5 gap-1.5">
              <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-300 group-hover:text-emerald-200">
                <span>
                  {t.level} {levelInfo.level}
                </span>
                <ChevronRight className="h-3 w-3 text-emerald-400 transition-transform group-hover:translate-x-0.5" />
              </span>
              <span className="text-[10px] text-slate-400 tabular-nums">
                {levelInfo.currentLevelXp} / {levelInfo.neededForNext} XP
              </span>
            </div>
            <div className="h-1 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${Math.round(levelInfo.progress * 100)}%` }}
              />
            </div>
          </div>
        </button>

        {/* Right Side: Snakes & Themes Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={openSnakesModal}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-white/10 px-3 py-2 text-xs sm:text-sm font-semibold text-white transition cursor-pointer"
          >
            <span
              className="h-3 w-3 rounded-full shrink-0 border border-white/20"
              style={{ backgroundColor: selectedSnake.primaryColor }}
            />
            <span>{t.snakes}</span>
            <span className="text-[10px] text-slate-400 font-normal tabular-nums">
              ({unlockedCount}/{SNAKE_TYPES.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              setActiveModal('themes');
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-white/10 px-3 py-2 text-xs sm:text-sm font-semibold text-white transition cursor-pointer"
          >
            <Palette className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span>{t.themes}</span>
          </button>
        </div>
      </div>

      {/* Subtle Author Credit at Very Bottom */}
      <footer className="relative z-10 pt-0.5 text-center text-[10px] text-slate-400/80 shrink-0">
        {t.authorCredit}
      </footer>

      {/* ================= SETTINGS MODAL ================= */}
      {activeModal === 'settings' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-2xl sm:max-w-3xl rounded-2xl sm:rounded-3xl bg-[#141528] border-2 border-cyan-500/30 p-3 sm:p-4 text-slate-100 shadow-2xl relative my-auto max-h-[96vh] flex flex-col">
            {/* Top Bar: Title & Language Selector */}
            <div className="flex flex-wrap items-center justify-between border-b border-white/10 pb-2 mb-2 gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-cyan-400" />
                <h2 className="text-sm sm:text-base font-extrabold text-white tracking-wide">
                  {t.settings}
                </h2>
              </div>

              {/* Compact Language Selector */}
              <div className="flex items-center gap-1 bg-slate-900/90 px-1.5 py-0.5 rounded-xl border border-white/10 max-w-[62vw] sm:max-w-none overflow-x-auto no-scrollbar">
                <Globe className="h-3.5 w-3.5 text-cyan-400 shrink-0 mr-0.5" />
                {LANGUAGE_OPTIONS.map((opt) => {
                  const active = lang === opt.code;
                  return (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        onUpdateProfile({ language: opt.code });
                      }}
                      className={`rounded-lg px-2 py-0.5 text-[10px] sm:text-[11px] font-bold transition cursor-pointer shrink-0 whitespace-nowrap ${
                        active
                          ? 'bg-cyan-500 text-slate-950 shadow-sm font-black'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={closeSettingsModal}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer ml-auto"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Main 2-Column Content */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 overflow-y-auto max-h-[calc(92vh-50px)] custom-scrollbar pr-1">
              {/* LEFT COLUMN: Control Modes, Handedness & Orientation */}
              <div className="flex flex-col justify-between space-y-2">
                <div className="space-y-1.5">
                  {/* 1. Arrow Mode */}
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      onUpdateProfile({ controlMode: 'arrow' });
                    }}
                    className={`w-full rounded-xl sm:rounded-2xl border-2 p-1.5 sm:p-2 transition flex items-center justify-between cursor-pointer ${
                      profile.controlMode === 'arrow'
                        ? 'border-cyan-400 bg-cyan-950/40 shadow-[0_0_12px_rgba(34,211,238,0.25)] ring-1 ring-cyan-400'
                        : 'border-white/15 bg-slate-900/60 hover:bg-slate-800/70'
                    }`}
                  >
                    {/* Green Snake Graphic */}
                    <div className="flex items-center gap-1">
                      <div className="h-4 w-16 sm:w-20 rounded-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-300 flex items-center justify-end pr-1 relative shadow-inner">
                        <div className="flex flex-col gap-0.5">
                          <span className="h-1 w-1 rounded-full bg-slate-950" />
                          <span className="h-1 w-1 rounded-full bg-slate-950" />
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 text-center px-1">
                      <span className="text-[11px] sm:text-xs font-extrabold text-white block truncate">
                        {t.controlArrowMode}
                      </span>
                    </div>

                    {/* Arrow */}
                    <div className="h-6 w-6 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-400/40">
                      <ArrowRight className="h-3.5 w-3.5 text-emerald-400" />
                    </div>
                  </button>

                  {/* 2. Classic Mode */}
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      onUpdateProfile({ controlMode: 'classic' });
                    }}
                    className={`w-full rounded-xl sm:rounded-2xl border-2 p-1.5 sm:p-2 transition flex items-center justify-between cursor-pointer ${
                      profile.controlMode === 'classic'
                        ? 'border-cyan-400 bg-cyan-950/40 shadow-[0_0_12px_rgba(34,211,238,0.25)] ring-1 ring-cyan-400'
                        : 'border-white/15 bg-slate-900/60 hover:bg-slate-800/70'
                    }`}
                  >
                    {/* Brown/Orange Snake Graphic */}
                    <div className="flex items-center gap-1">
                      <div className="h-4 w-16 sm:w-20 rounded-full bg-gradient-to-r from-amber-700 via-amber-500 to-amber-400 flex items-center justify-end pr-1 relative shadow-inner">
                        <div className="flex flex-col gap-0.5">
                          <span className="h-1 w-1 rounded-full bg-slate-950" />
                          <span className="h-1 w-1 rounded-full bg-slate-950" />
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 text-center px-1">
                      <span className="text-[11px] sm:text-xs font-extrabold text-white block truncate">
                        {t.controlClassicMode}
                      </span>
                    </div>

                    {/* Hand pointing icon */}
                    <div className="h-6 w-6 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0 border border-amber-400/40">
                      <MousePointer className="h-3.5 w-3.5 text-amber-300" />
                    </div>
                  </button>

                  {/* 3. Joystick Mode */}
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      onUpdateProfile({ controlMode: 'joystick' });
                    }}
                    className={`w-full rounded-xl sm:rounded-2xl border-2 p-1.5 sm:p-2 transition flex items-center justify-between cursor-pointer ${
                      profile.controlMode === 'joystick'
                        ? 'border-cyan-400 bg-cyan-950/40 shadow-[0_0_12px_rgba(34,211,238,0.25)] ring-1 ring-cyan-400'
                        : 'border-white/15 bg-slate-900/60 hover:bg-slate-800/70'
                    }`}
                  >
                    {/* Purple Snake Graphic */}
                    <div className="flex items-center gap-1">
                      <div className="h-4 w-16 sm:w-20 rounded-full bg-gradient-to-r from-purple-700 via-purple-500 to-purple-400 flex items-center justify-end pr-1 relative shadow-inner">
                        <div className="flex flex-col gap-0.5">
                          <span className="h-1 w-1 rounded-full bg-slate-950" />
                          <span className="h-1 w-1 rounded-full bg-slate-950" />
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 text-center px-1">
                      <span className="text-[11px] sm:text-xs font-extrabold text-white block truncate">
                        {t.controlJoystickMode}
                      </span>
                    </div>

                    {/* Joystick Icon */}
                    <div className="h-6 w-6 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0 border border-purple-400/40">
                      <Gamepad2 className="h-3.5 w-3.5 text-purple-300" />
                    </div>
                  </button>
                </div>

                {/* Sub Controls: Handedness & Orientation Mode */}
                <div className="flex items-center justify-center gap-3 py-1">
                  {/* Right Handed Pad (Thumbstick Left, Action Right) */}
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      onUpdateProfile({ controlHand: 'right' });
                    }}
                    title={t.controlLayoutRight}
                    className={`h-10 w-12 sm:w-14 rounded-xl border-2 p-1.5 flex items-center justify-between transition cursor-pointer ${
                      profile.controlHand === 'right'
                        ? 'border-cyan-400 bg-cyan-950/50 shadow-[0_0_8px_rgba(34,211,238,0.3)]'
                        : 'border-white/15 bg-slate-900/70 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="h-4 w-4 rounded-full border border-cyan-400/60 flex items-center justify-center bg-cyan-500/20">
                      <div className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                    </div>
                    <div className="flex flex-col gap-0.5 items-center">
                      <div className="h-1.5 w-1.5 rounded-full bg-white/70" />
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
                    </div>
                  </button>

                  {/* Left Handed Pad (Action Left, Thumbstick Right) */}
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      onUpdateProfile({ controlHand: 'left' });
                    }}
                    title={t.controlLayoutLeft}
                    className={`h-10 w-12 sm:w-14 rounded-xl border-2 p-1.5 flex items-center justify-between transition cursor-pointer ${
                      profile.controlHand === 'left'
                        ? 'border-cyan-400 bg-cyan-950/50 shadow-[0_0_8px_rgba(34,211,238,0.3)]'
                        : 'border-white/15 bg-slate-900/70 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="flex flex-col gap-0.5 items-center">
                      <div className="h-1.5 w-1.5 rounded-full bg-white/70" />
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
                    </div>
                    <div className="h-4 w-4 rounded-full border border-cyan-400/60 flex items-center justify-center bg-cyan-500/20">
                      <div className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                    </div>
                  </button>

                  {/* Auto-rotate Orientation Button */}
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      const next = !profile.autoRotate;
                      onUpdateProfile({ autoRotate: next });
                      if (next && typeof window !== 'undefined') {
                        try {
                          (screen.orientation as unknown as { lock?: (o: string) => Promise<void> })
                            ?.lock?.('landscape')
                            ?.catch?.(() => {});
                        } catch {}
                      }
                    }}
                    title={t.autoRotateLabel}
                    className={`h-10 w-12 sm:w-14 rounded-xl border-2 flex items-center justify-center transition cursor-pointer ${
                      profile.autoRotate
                        ? 'border-cyan-400 bg-cyan-950/50 shadow-[0_0_8px_rgba(34,211,238,0.3)] text-cyan-300'
                        : 'border-white/15 bg-slate-900/70 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="relative">
                      <Smartphone className="h-5 w-5" />
                      <RotateCw className="h-2.5 w-2.5 absolute -top-1 -right-1 text-cyan-400 animate-spin-slow" />
                    </div>
                  </button>
                </div>

                {/* HUD & Button Layout Customizer Button */}
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      soundEngine.stopMusic();
                      setActiveModal('hudEditor');
                    }}
                    className="w-full rounded-xl border border-cyan-400/45 bg-gradient-to-r from-cyan-500/20 via-emerald-500/15 to-purple-500/20 hover:from-cyan-500/30 hover:to-emerald-500/25 px-3 py-2 text-xs font-extrabold text-cyan-200 transition cursor-pointer flex items-center justify-center gap-2 shadow-sm active:scale-[0.99]"
                  >
                    <Sliders className="h-4 w-4 text-cyan-300 shrink-0" />
                    <span className="truncate">{t.customizeHudBtn}</span>
                  </button>
                </div>

                {/* Bottom Left OK Button */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      closeSettingsModal();
                    }}
                    className="w-full sm:w-32 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs tracking-wide py-2 px-4 shadow-md transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>{t.ok}</span>
                  </button>
                </div>
              </div>

              {/* RIGHT COLUMN: Checkboxes (Matching Screenshot) */}
              <div className="flex flex-col justify-between space-y-1.5">
                <div className="space-y-1">
                  {/* 1. Show player names */}
                  <label className="flex items-center gap-2.5 py-1 px-1.5 rounded-lg hover:bg-white/5 cursor-pointer transition select-none">
                    <input
                      type="checkbox"
                      checked={profile.showPlayerNames}
                      onChange={(e) => {
                        soundEngine.playClick();
                        onUpdateProfile({ showPlayerNames: e.target.checked });
                      }}
                      className="hidden"
                    />
                    <div
                      className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition shrink-0 ${
                        profile.showPlayerNames
                          ? 'border-cyan-400 bg-cyan-500 shadow-[0_0_6px_rgba(34,211,238,0.4)] text-slate-950'
                          : 'border-white/30 bg-slate-900/80 text-transparent'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </div>
                    <span className="text-xs font-semibold text-white truncate">
                      {t.showPlayerNames}
                    </span>
                  </label>

                  {/* 2. Fade my name */}
                  <label className="flex items-center gap-2.5 py-1 px-1.5 rounded-lg hover:bg-white/5 cursor-pointer transition select-none">
                    <input
                      type="checkbox"
                      checked={profile.fadeMyName}
                      onChange={(e) => {
                        soundEngine.playClick();
                        onUpdateProfile({ fadeMyName: e.target.checked });
                      }}
                      className="hidden"
                    />
                    <div
                      className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition shrink-0 ${
                        profile.fadeMyName
                          ? 'border-cyan-400 bg-cyan-500 shadow-[0_0_6px_rgba(34,211,238,0.4)] text-slate-950'
                          : 'border-white/30 bg-slate-900/80 text-transparent'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </div>
                    <span className="text-xs font-semibold text-white truncate">
                      {t.fadeMyName}
                    </span>
                  </label>

                  {/* 3. Best graphics */}
                  <label className="flex items-center gap-2.5 py-1 px-1.5 rounded-lg hover:bg-white/5 cursor-pointer transition select-none">
                    <input
                      type="checkbox"
                      checked={profile.bestGraphics}
                      onChange={(e) => {
                        soundEngine.playClick();
                        onUpdateProfile({ bestGraphics: e.target.checked });
                      }}
                      className="hidden"
                    />
                    <div
                      className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition shrink-0 ${
                        profile.bestGraphics
                          ? 'border-cyan-400 bg-cyan-500 shadow-[0_0_6px_rgba(34,211,238,0.4)] text-slate-950'
                          : 'border-white/30 bg-slate-900/80 text-transparent'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </div>
                    <span className="text-xs font-semibold text-white truncate">
                      {t.bestGraphics}
                    </span>
                  </label>

                  {/* 4. Wiggling food */}
                  <label className="flex items-center gap-2.5 py-1 px-1.5 rounded-lg hover:bg-white/5 cursor-pointer transition select-none">
                    <input
                      type="checkbox"
                      checked={profile.wigglingFood}
                      onChange={(e) => {
                        soundEngine.playClick();
                        onUpdateProfile({ wigglingFood: e.target.checked });
                      }}
                      className="hidden"
                    />
                    <div
                      className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition shrink-0 ${
                        profile.wigglingFood
                          ? 'border-cyan-400 bg-cyan-500 shadow-[0_0_6px_rgba(34,211,238,0.4)] text-slate-950'
                          : 'border-white/30 bg-slate-900/80 text-transparent'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </div>
                    <span className="text-xs font-semibold text-white truncate">
                      {t.wigglingFood}
                    </span>
                  </label>

                  {/* 5. Map on top */}
                  <label className="flex items-center gap-2.5 py-1 px-1.5 rounded-lg hover:bg-white/5 cursor-pointer transition select-none">
                    <input
                      type="checkbox"
                      checked={profile.mapOnTop}
                      onChange={(e) => {
                        soundEngine.playClick();
                        onUpdateProfile({ mapOnTop: e.target.checked });
                      }}
                      className="hidden"
                    />
                    <div
                      className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition shrink-0 ${
                        profile.mapOnTop
                          ? 'border-cyan-400 bg-cyan-500 shadow-[0_0_6px_rgba(34,211,238,0.4)] text-slate-950'
                          : 'border-white/30 bg-slate-900/80 text-transparent'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </div>
                    <span className="text-xs font-semibold text-white truncate">
                      {t.mapOnTop}
                    </span>
                  </label>

                  {/* 6. Double tap to boost */}
                  <label className="flex items-center gap-2.5 py-1 px-1.5 rounded-lg hover:bg-white/5 cursor-pointer transition select-none">
                    <input
                      type="checkbox"
                      checked={profile.doubleTapToBoost}
                      onChange={(e) => {
                        soundEngine.playClick();
                        onUpdateProfile({ doubleTapToBoost: e.target.checked });
                      }}
                      className="hidden"
                    />
                    <div
                      className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition shrink-0 ${
                        profile.doubleTapToBoost
                          ? 'border-cyan-400 bg-cyan-500 shadow-[0_0_6px_rgba(34,211,238,0.4)] text-slate-950'
                          : 'border-white/30 bg-slate-900/80 text-transparent'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </div>
                    <span className="text-xs font-semibold text-white truncate">
                      {t.doubleTapToBoost}
                    </span>
                  </label>

                  {/* 7. Look ahead */}
                  <label className="flex items-center gap-2.5 py-1 px-1.5 rounded-lg hover:bg-white/5 cursor-pointer transition select-none">
                    <input
                      type="checkbox"
                      checked={profile.lookAhead}
                      onChange={(e) => {
                        soundEngine.playClick();
                        onUpdateProfile({ lookAhead: e.target.checked });
                      }}
                      className="hidden"
                    />
                    <div
                      className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition shrink-0 ${
                        profile.lookAhead
                          ? 'border-cyan-400 bg-cyan-500 shadow-[0_0_6px_rgba(34,211,238,0.4)] text-slate-950'
                          : 'border-white/30 bg-slate-900/80 text-transparent'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </div>
                    <span className="text-xs font-semibold text-white truncate">
                      {t.lookAhead}
                    </span>
                  </label>

                  {/* 8. Background Music Track Selector & Volume */}
                  <div className="rounded-xl bg-slate-900/75 border border-cyan-500/25 p-2 space-y-1.5 mt-1">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {profile.musicTrack === 'off' || profile.musicVolume <= 0.01 ? (
                          <VolumeX className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        ) : (
                          <Music className="h-3.5 w-3.5 text-cyan-300 shrink-0" />
                        )}
                        <span className="text-xs font-bold text-white truncate">
                          {t.bgMusicLabel}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-cyan-300 tabular-nums">
                        {profile.musicTrack === 'off'
                          ? '0%'
                          : `${Math.round((profile.musicVolume ?? 0.7) * 100)}%`}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                      {(
                        [
                          { id: 'auto', label: t.musicAuto },
                          { id: 'track1', label: t.musicTrack1 },
                          { id: 'track2', label: t.musicTrack2 },
                          { id: 'off', label: t.musicOff },
                        ] as { id: MusicTrackPreference; label: string }[]
                      ).map((opt) => {
                        const active = (profile.musicTrack || 'auto') === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              soundEngine.unlock();
                              soundEngine.playClick();
                              const nextVol =
                                opt.id !== 'off' && (profile.musicVolume ?? 0.7) <= 0.02
                                  ? 0.7
                                  : profile.musicVolume ?? 0.7;
                              onUpdateProfile({
                                musicTrack: opt.id,
                                musicVolume: nextVol,
                                musicEnabled: opt.id !== 'off' && nextVol > 0.01,
                              });
                              if (opt.id === 'off') {
                                soundEngine.configureMusic('off', nextVol);
                                soundEngine.stopMusic();
                              } else {
                                soundEngine.previewTrack(opt.id, nextVol);
                              }
                            }}
                            className={`rounded-lg px-1.5 py-1 text-[10px] font-bold truncate transition cursor-pointer ${
                              active
                                ? opt.id === 'off'
                                  ? 'bg-rose-500 text-white shadow-xs'
                                  : 'bg-cyan-500 text-slate-950 shadow-xs'
                                : 'bg-slate-800/90 text-slate-300 border border-white/10 hover:text-white'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Music Volume Slider */}
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {t.musicVolumeLabel}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={profile.musicTrack === 'off' ? 0 : profile.musicVolume ?? 0.7}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          const nextTrack: MusicTrackPreference =
                            v <= 0.01
                              ? 'off'
                              : profile.musicTrack === 'off'
                              ? 'auto'
                              : profile.musicTrack || 'auto';
                          onUpdateProfile({
                            musicVolume: v,
                            musicTrack: nextTrack,
                            musicEnabled: nextTrack !== 'off' && v > 0.01,
                          });
                          soundEngine.configureMusic(nextTrack, v);
                          if (nextTrack !== 'off' && v > 0.01) {
                            soundEngine.startMusic();
                          } else {
                            soundEngine.stopMusic();
                          }
                        }}
                        className="w-full accent-cyan-400 h-1.5 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* 9. Sound Effects */}
                  <label className="flex items-center gap-2.5 py-1 px-1.5 rounded-lg hover:bg-white/5 cursor-pointer transition select-none">
                    <input
                      type="checkbox"
                      checked={profile.soundEnabled}
                      onChange={(e) => {
                        const val = e.target.checked;
                        soundEngine.setEnabled(val);
                        if (val) soundEngine.playClick();
                        onUpdateProfile({ soundEnabled: val });
                      }}
                      className="hidden"
                    />
                    <div
                      className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition shrink-0 ${
                        profile.soundEnabled
                          ? 'border-cyan-400 bg-cyan-500 shadow-[0_0_6px_rgba(34,211,238,0.4)] text-slate-950'
                          : 'border-white/30 bg-slate-900/80 text-transparent'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Volume2 className="h-3.5 w-3.5 text-cyan-300 shrink-0" />
                      <span className="text-xs font-semibold text-white truncate">
                        {t.newSounds}
                      </span>
                    </div>
                  </label>
                </div>

                {/* Bottom Right Privacy Policy Button */}
                <div className="flex items-center justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setActiveModal('privacy');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-purple-900/40 hover:bg-purple-800/60 border border-purple-500/40 px-2.5 py-1 text-[11px] font-semibold text-purple-200 transition cursor-pointer"
                  >
                    <div className="h-4 w-4 rounded-full bg-purple-600 flex items-center justify-center text-white">
                      <Lock className="h-2.5 w-2.5" />
                    </div>
                    <span>{t.privacyPolicy}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= PRIVACY POLICY MODAL ================= */}
      {activeModal === 'privacy' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#141528] border border-purple-500/30 p-5 text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">
                  {t.privacyTitle}
                </h3>
              </div>
              <button
                onClick={() => setActiveModal('settings')}
                className="rounded-lg p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              {t.privacyBody}
            </p>

            <button
              type="button"
              onClick={() => setActiveModal('settings')}
              className="w-full rounded-xl bg-purple-600 hover:bg-purple-500 py-2.5 text-xs font-bold text-white transition cursor-pointer"
            >
              {t.ok}
            </button>
          </div>
        </div>
      )}

      {/* ================= ACHIEVEMENTS MODAL ================= */}
      {activeModal === 'achievements' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-[#181b24] border border-white/10 p-5 text-slate-100 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-400" />
                <div>
                  <h2 className="text-base font-bold text-white">
                    {t.achievements}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {t.unlockedCount}: {profile.unlockedAchievements.length} /{' '}
                    {ACHIEVEMENTS.length}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal('none')}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto pr-1 space-y-2">
              {ACHIEVEMENTS.map((ach) => {
                const isUnlocked = profile.unlockedAchievements.includes(ach.id);
                const isNewlyUnlocked = sessionUnseenIds.includes(ach.id);

                return (
                  <div
                    key={ach.id}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition ${
                      isNewlyUnlocked
                        ? 'border-emerald-400/60 bg-emerald-500/15'
                        : isUnlocked
                        ? 'border-white/15 bg-slate-900/80'
                        : 'border-white/5 bg-slate-950/60 opacity-65'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`h-10 w-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                          isUnlocked
                            ? 'bg-slate-800 border border-white/10'
                            : 'bg-slate-900 border border-white/5 grayscale'
                        }`}
                      >
                        {ach.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white truncate">
                            {ach.title[lang]}
                          </span>
                          {isNewlyUnlocked && (
                            <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-extrabold text-slate-950 leading-none shrink-0">
                              {t.newBadge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {ach.description[lang]}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg shrink-0 ${
                        isUnlocked
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {isUnlocked ? t.unlockedBadge : t.lockedBadge}
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setActiveModal('none')}
              className="mt-4 w-full rounded-xl bg-slate-800 hover:bg-slate-700 py-2.5 text-sm font-semibold text-white transition cursor-pointer shrink-0"
            >
              {t.close}
            </button>
          </div>
        </div>
      )}

      {/* ================= SNAKES MODAL (100 Progressive Snakes + Side Live Preview) ================= */}
      {activeModal === 'snakes' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-[#181b24] border border-white/10 p-4 sm:p-5 text-slate-100 flex flex-col max-h-[88vh]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3 mb-3.5 shrink-0">
              <div>
                <h2 className="text-base font-bold text-white">
                  {t.snakes} ({unlockedCount}/{SNAKE_TYPES.length})
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t.level} {levelInfo.level} • {levelInfo.currentLevelXp} / {levelInfo.neededForNext} XP
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isWatchingAd || adCooldown > 0}
                  onClick={handleWatchAdForXp}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-teal-500/20 hover:from-amber-500/30 hover:to-emerald-500/30 border border-emerald-400/40 px-3 py-1.5 text-xs font-bold text-emerald-300 transition cursor-pointer disabled:opacity-60 shadow-[0_0_12px_rgba(16,185,129,0.2)] active:scale-[0.98]"
                >
                  {isWatchingAd ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                  ) : (
                    <Clapperboard className="h-3.5 w-3.5 text-amber-400" />
                  )}
                  <span>
                    {isWatchingAd
                      ? t.adLoading
                      : adCooldown > 0
                      ? `⏳ ${t.adCooldownWait.replace('{sec}', String(adCooldown))}`
                      : t.getFreeCoins}
                  </span>
                </button>

                <button
                  onClick={() => setActiveModal('none')}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {adToast && (
              <div className="mb-2.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 px-3 py-1.5 text-xs font-semibold text-emerald-300 text-center">
                {adToast}
              </div>
            )}

            {/* Body: Left Grid (100 Snakes) + Right Compact Side Preview */}
            <div className="flex flex-col md:flex-row gap-4 min-h-0 flex-1 overflow-hidden">
              {/* Scrollable 100 Snakes Grid */}
              <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5 content-start custom-scrollbar">
                {SNAKE_TYPES.map((snake) => {
                  const unlocked = isSnakeUnlocked(profile, snake);
                  const isEquipped = snake.id === profile.selectedSnakeId;
                  const isInspected = snake.id === inspectedSnake.id;
                  const rStyle = RARITY_STYLES[snake.rarity];

                  return (
                    <button
                      key={snake.id}
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        setInspectedSnakeId(snake.id);
                        if (unlocked) {
                          onUpdateProfile({ selectedSnakeId: snake.id });
                        }
                      }}
                      className={`text-left rounded-xl border p-3 transition cursor-pointer ${
                        isInspected
                          ? 'border-emerald-400 bg-slate-800/95 ring-1 ring-emerald-400/50'
                          : isEquipped
                          ? 'border-emerald-500/50 bg-emerald-500/10'
                          : unlocked
                          ? `${rStyle.border} bg-slate-900/75 hover:bg-slate-800/80`
                          : 'border-white/5 bg-slate-950/65 hover:bg-slate-900/75 opacity-80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-mono text-slate-400">
                            #{snake.index.toString().padStart(2, '0')}
                          </span>
                          <span
                            className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold leading-none ${rStyle.badge}`}
                          >
                            {RARITY_LABELS[snake.rarity][lang]}
                          </span>
                          <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/15 border border-amber-400/25 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-300 leading-none tabular-nums">
                            <Zap className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                            {snake.powerRating}
                          </span>
                        </div>

                        {!unlocked ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-800/90 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                            <Lock className="h-3 w-3" />
                            {t.lockedLevel} {snake.requiredLevel}
                          </span>
                        ) : isEquipped ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                            <Check className="h-3 w-3" />
                            {t.equipped}
                          </span>
                        ) : null}
                      </div>

                      {/* Color Swatch Dots + Name */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white truncate">
                            {snake.name}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {snake.subtitle[lang]}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            className="h-3 w-3 rounded-full border border-white/20"
                            style={{ backgroundColor: snake.primaryColor }}
                          />
                          <span
                            className="h-3 w-3 rounded-full border border-white/20"
                            style={{ backgroundColor: snake.secondaryColor }}
                          />
                          <span
                            className="h-3 w-3 rounded-full border border-white/20"
                            style={{ backgroundColor: snake.accentColor }}
                          />
                        </div>
                      </div>

                      {/* Unique Ability Tag */}
                      <div className="mt-2 pt-1.5 border-t border-white/5 flex items-center justify-between text-[11px]">
                        <span className="inline-flex items-center gap-1 font-medium text-slate-300 truncate">
                          <Sparkles
                            className="h-3 w-3 shrink-0"
                            style={{ color: snake.ability.badgeColor }}
                          />
                          <span className="truncate">{snake.ability.name[lang]}</span>
                        </span>
                        <span className="text-slate-500 tabular-nums shrink-0 ml-2">
                          {snake.ability.cooldownSec}s
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Right Side Compact Live Preview Card (Works even when snake is LOCKED!) */}
              <div className="w-full md:w-[285px] shrink-0 rounded-xl bg-slate-900/90 border border-white/10 p-3.5 flex flex-col justify-between overflow-y-auto custom-scrollbar">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {t.previewLabel}
                    </span>
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                        RARITY_STYLES[inspectedSnake.rarity].badge
                      }`}
                    >
                      {RARITY_LABELS[inspectedSnake.rarity][lang]}
                    </span>
                  </div>

                  {/* Compact Live Animated Snake Canvas */}
                  <div
                    className="relative rounded-xl border border-white/10 flex items-center justify-center py-2 mb-2.5 overflow-hidden"
                    style={{
                      backgroundColor: '#11141d',
                      backgroundImage:
                        'linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)',
                      backgroundSize: '20px 20px',
                    }}
                  >
                    <SnakePreviewCanvas
                      snake={inspectedSnake}
                      width={215}
                      height={66}
                    />
                    {!inspectedUnlocked && (
                      <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 rounded-md bg-black/65 border border-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                        <Lock className="h-2.5 w-2.5" />
                        {t.lockedLevel} {inspectedSnake.requiredLevel}
                      </span>
                    )}
                  </div>

                  {/* Inspected Name & Subtitle */}
                  <div className="mb-2">
                    <div className="text-base font-extrabold text-white leading-tight">
                      #{inspectedSnake.index.toString().padStart(2, '0')}{' '}
                      {inspectedSnake.name}
                    </div>
                    <div className="text-xs text-slate-400">
                      {inspectedSnake.subtitle[lang]}
                    </div>
                  </div>

                  {/* Progressive Combat Power Stats (#1 -> #100) */}
                  <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                    <div className="rounded-lg bg-slate-950/80 border border-amber-400/20 p-1.5 text-center">
                      <div className="text-[9px] text-slate-400 truncate">
                        {t.powerStat}
                      </div>
                      <div className="text-xs font-extrabold text-amber-300 tabular-nums">
                        ⚡{inspectedSnake.powerRating}
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-950/80 border border-emerald-400/20 p-1.5 text-center">
                      <div className="text-[9px] text-slate-400 truncate">
                        {t.scoreMultStat}
                      </div>
                      <div className="text-xs font-extrabold text-emerald-300 tabular-nums">
                        {inspectedSnake.scoreMultiplier.toFixed(2)}x
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-950/80 border border-sky-400/20 p-1.5 text-center">
                      <div className="text-[9px] text-slate-400 truncate">
                        {t.magnetStat}
                      </div>
                      <div className="text-xs font-extrabold text-sky-300 tabular-nums">
                        +{inspectedSnake.passiveMagnetBonus}px
                      </div>
                    </div>
                  </div>

                  {/* Unique Ability Details */}
                  <div className="rounded-xl bg-slate-950/75 border border-white/10 p-2.5 mb-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-white">
                        <Sparkles
                          className="h-3.5 w-3.5 shrink-0"
                          style={{ color: inspectedSnake.ability.badgeColor }}
                        />
                        {inspectedSnake.ability.name[lang]}
                      </span>
                      <span className="text-[10px] text-slate-400 tabular-nums">
                        {inspectedSnake.ability.cooldownSec}s CD
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      {inspectedSnake.ability.description[lang]}
                    </p>
                  </div>
                </div>

                {/* Equip / Locked Status Button */}
                {inspectedUnlocked ? (
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      onUpdateProfile({ selectedSnakeId: inspectedSnake.id });
                    }}
                    className={`w-full rounded-xl py-2.5 px-3 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      inspectedSnake.id === profile.selectedSnakeId
                        ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                    }`}
                  >
                    <Check className="h-4 w-4" />
                    <span>
                      {inspectedSnake.id === profile.selectedSnakeId
                        ? t.equipped
                        : t.equip}
                    </span>
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="w-full rounded-xl bg-slate-800/80 border border-amber-400/25 py-2.5 px-3 text-xs font-semibold text-amber-300 flex items-center justify-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {t.unlocksAtLevel} {inspectedSnake.requiredLevel}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={isWatchingAd || adCooldown > 0}
                      onClick={handleWatchAdForXp}
                      className="w-full rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/35 py-2 px-3 text-xs font-bold text-emerald-300 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 transition"
                    >
                      {isWatchingAd ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                      ) : (
                        <Clapperboard className="h-3.5 w-3.5 text-amber-400" />
                      )}
                      <span>
                        {isWatchingAd
                          ? t.adLoading
                          : adCooldown > 0
                          ? `⏳ ${t.adCooldownWait.replace('{sec}', String(adCooldown))}`
                          : t.getFreeCoins}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= THEMES / BACKGROUNDS MODAL (Live Preview Behind Modal) ================= */}
      {activeModal === 'themes' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-[1px] p-2 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-[#141722]/92 border border-white/15 p-3.5 sm:p-5 text-slate-100 shadow-2xl my-auto max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-emerald-400" />
                <h2 className="text-sm sm:text-base font-bold text-white">
                  {t.themes} ({ARENA_MAPS.length})
                </h2>
              </div>
              <button
                onClick={() => setActiveModal('none')}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto max-h-[62vh] custom-scrollbar pr-1">
              {ARENA_MAPS.map((map) => {
                const active = map.id === profile.selectedMapId;
                return (
                  <button
                    key={map.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      onUpdateProfile({ selectedMapId: map.id as MapId });
                    }}
                    className={`w-full flex items-center justify-between rounded-xl border p-2.5 transition cursor-pointer ${
                      active
                        ? 'border-emerald-400 bg-emerald-500/15 text-white ring-1 ring-emerald-400/50 shadow-md'
                        : 'border-white/10 bg-slate-900/75 text-slate-200 hover:bg-slate-800/85'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="h-8 w-8 rounded-lg border-2 shrink-0 relative overflow-hidden shadow-inner"
                        style={{
                          background: `radial-gradient(circle at 35% 35%, ${map.bgAccentColor}, ${map.bgColor})`,
                          borderColor: map.borderColor,
                        }}
                      >
                        <span
                          className="absolute inset-0 opacity-75"
                          style={getMenuPatternOverlayStyle(
                            map.patternStyle,
                            map.gridColor,
                            map.orbPalette
                          )}
                        />
                      </span>
                      <div className="text-left min-w-0">
                        <div className="text-xs font-bold truncate">
                          {map.name[lang]}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          {map.orbPalette.slice(0, 4).map((col, idx) => (
                            <span
                              key={idx}
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: col }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {active && (
                      <Check className="h-4 w-4 text-emerald-400 shrink-0 ml-1" />
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setActiveModal('none')}
              className="mt-3 w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 py-2 text-xs sm:text-sm font-bold text-slate-950 transition cursor-pointer shrink-0"
            >
              {t.ok}
            </button>
          </div>
        </div>
      )}

      {/* ================= LEVELS (1 – 100) & GLOBAL PLAYER % MODAL ================= */}
      {activeModal === 'levels' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2.5 sm:p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-[#151824] border border-emerald-500/30 p-3.5 sm:p-5 text-slate-100 shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3 shrink-0 gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                  <Trophy className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-extrabold text-white truncate">
                    {t.levelsTitle}
                  </h2>
                  <p className="text-[11px] text-slate-400 truncate">
                    {t.levelsSubtitle}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Player Current Level & Global Percentile Banner */}
            <div className="rounded-xl bg-gradient-to-r from-emerald-500/15 via-cyan-500/10 to-purple-500/15 border border-emerald-400/30 p-3 mb-3 shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-emerald-500 px-2 py-0.5 text-xs font-black text-slate-950">
                    {t.level} {levelInfo.level} / {MAX_PLAYER_LEVEL}
                  </span>
                  <span className="text-xs font-semibold text-slate-200 tabular-nums">
                    {profile.totalXp.toLocaleString()} XP
                  </span>
                </div>

                <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900/85 border border-cyan-400/35 px-2.5 py-1 text-[11px] font-bold text-cyan-300">
                  <Users className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                  <span>
                    {t.topPlayersBadge} {getTopPlayersPercentile(levelInfo.level)}%
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-300 mb-1">
                <span>
                  {t.avgPlayerPercent}:{' '}
                  <strong className="text-emerald-300">
                    {getLevelPlayerShare(levelInfo.level)}%
                  </strong>
                </span>
                <span className="tabular-nums text-slate-400">
                  {levelInfo.currentLevelXp} / {levelInfo.neededForNext} XP
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-900/90 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-300"
                  style={{ width: `${Math.round(levelInfo.progress * 100)}%` }}
                />
              </div>
            </div>

            {/* Scrollable Levels 1 -> 100 List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar min-h-0">
              {Array.from({ length: MAX_PLAYER_LEVEL }, (_, i) => i + 1).map(
                (lvl) => {
                  const isCurrent = lvl === levelInfo.level;
                  const isReached = lvl <= levelInfo.level;
                  const shareStr = getLevelPlayerShare(lvl);
                  const shareNum = parseFloat(shareStr);
                  const barWidth = Math.min(100, Math.max(4, shareNum * 11));
                  const rewardSnake = SNAKE_TYPES[lvl - 1];
                  const reqXp = xpForLevel(lvl);

                  return (
                    <div
                      key={lvl}
                      ref={isCurrent ? currentLevelRowRef : null}
                      className={`rounded-xl border p-2.5 sm:p-3 transition ${
                        isCurrent
                          ? 'border-emerald-400 bg-emerald-500/15 ring-1 ring-emerald-400/50 shadow-[0_0_15px_rgba(16,185,129,0.18)]'
                          : isReached
                          ? 'border-white/15 bg-slate-900/80'
                          : 'border-white/5 bg-slate-950/65 opacity-80'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`h-8 w-10 rounded-lg flex items-center justify-center text-xs font-black tabular-nums shrink-0 ${
                              isCurrent
                                ? 'bg-emerald-400 text-slate-950'
                                : isReached
                                ? 'bg-slate-800 text-emerald-300 border border-emerald-500/30'
                                : 'bg-slate-900 text-slate-500 border border-white/5'
                            }`}
                          >
                            {lvl}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs sm:text-sm font-bold text-white">
                                {t.level} {lvl}
                              </span>
                              {isCurrent && (
                                <span className="rounded-full bg-emerald-400 px-2 py-0.5 text-[9px] font-black text-slate-950 leading-none">
                                  {t.currentBadge}
                                </span>
                              )}
                              <span className="text-[10px] text-slate-400 tabular-nums">
                                ({reqXp.toLocaleString()} XP)
                              </span>
                            </div>

                            {/* Average Player % at this level */}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[11px] text-slate-300">
                                {t.avgPlayerPercent}:{' '}
                                <strong className="text-cyan-300 tabular-nums">
                                  {shareStr}%
                                </strong>
                              </span>
                              <div className="w-16 sm:w-24 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-cyan-400/85"
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Snake Unlocked at This Level */}
                        {rewardSnake && (
                          <button
                            type="button"
                            onClick={() => {
                              soundEngine.playClick();
                              setInspectedSnakeId(rewardSnake.id);
                              setActiveModal('snakes');
                            }}
                            className="inline-flex items-center gap-2 rounded-lg bg-slate-900/95 hover:bg-slate-800 border border-white/10 px-2.5 py-1.5 text-left transition cursor-pointer shrink-0"
                          >
                            <span
                              className="h-3.5 w-3.5 rounded-full border border-white/25 shrink-0"
                              style={{
                                backgroundColor: rewardSnake.primaryColor,
                              }}
                            />
                            <div className="min-w-0">
                              <div className="text-[11px] font-bold text-white truncate max-w-[120px] sm:max-w-[155px]">
                                #{rewardSnake.index} {rewardSnake.name}
                              </div>
                              <div className="flex items-center gap-1 text-[9px] text-amber-300 font-semibold">
                                <span>
                                  {RARITY_LABELS[rewardSnake.rarity][lang]}
                                </span>
                                <span>•</span>
                                <span>⚡{rewardSnake.powerRating}</span>
                              </div>
                            </div>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }
              )}
            </div>

            <button
              type="button"
              onClick={() => setActiveModal('none')}
              className="mt-3 w-full rounded-xl bg-slate-800 hover:bg-slate-700 py-2 text-xs sm:text-sm font-semibold text-white transition cursor-pointer shrink-0"
            >
              {t.close}
            </button>
          </div>
        </div>
      )}

      {/* ================= DAILY LUCKY WHEEL MODAL ================= */}
      {activeModal === 'wheel' && (
        <LuckyWheelModal
          profile={profile}
          onUpdateProfile={onUpdateProfile}
          onClose={() => setActiveModal('none')}
        />
      )}

      {/* ================= HUD & BUTTON LAYOUT CUSTOMIZER MODAL ================= */}
      {activeModal === 'hudEditor' && (
        <HudLayoutEditorModal
          profile={profile}
          onUpdateProfile={onUpdateProfile}
          onClose={() => setActiveModal('settings')}
        />
      )}
    </div>
  );
};

'use client';

import React, { useEffect, useState } from 'react';
import { SnakePreviewCanvas } from '@/components/SnakePreviewCanvas';
import { ACHIEVEMENTS } from '@/data/achievements';
import { LANGUAGE_OPTIONS, RARITY_LABELS, UI_TEXT } from '@/data/i18n';
import { ARENA_MAPS, getMapSpec } from '@/data/maps';
import { getSnakeSpec, SNAKE_TYPES } from '@/data/snakes';
import { soundEngine } from '@/engine/soundEngine';
import { getLevelInfo, isSnakeUnlocked } from '@/engine/storage';
import { MultiplayerClient } from '@/network/multiplayerClient';
import {
  LanguageCode,
  MapId,
  PlayerProfile,
  RarityTier,
  RoomSummary,
} from '@/types/game';
import {
  ArrowRight,
  Award,
  Check,
  Gamepad2,
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
  Smartphone,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  WifiOff,
  X,
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

export const StartMenu: React.FC<StartMenuProps> = ({
  profile,
  onUpdateProfile,
  onStartGame,
}) => {
  const lang: LanguageCode = profile.language || 'en';
  const t = UI_TEXT[lang];

  const [nameError, setNameError] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [simulatedOnlineCount, setSimulatedOnlineCount] = useState(55);
  const [activeModal, setActiveModal] = useState<
    'none' | 'settings' | 'snakes' | 'themes' | 'achievements' | 'privacy'
  >('none');
  const [showAdvancedNetwork, setShowAdvancedNetwork] = useState(false);
  const [inspectedSnakeId, setInspectedSnakeId] = useState<string>(
    profile.selectedSnakeId
  );
  const [sessionUnseenIds, setSessionUnseenIds] = useState<string[]>([]);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSimulatedOnlineCount((c) => {
        const delta = Math.random() < 0.5 ? -1 : 1;
        return Math.max(52, Math.min(58, c + delta));
      });
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const levelInfo = getLevelInfo(profile.totalXp);
  const selectedSnake = getSnakeSpec(profile.selectedSnakeId);
  const inspectedSnake = getSnakeSpec(inspectedSnakeId);
  const inspectedUnlocked = isSnakeUnlocked(profile, inspectedSnake);
  const selectedMap = getMapSpec(profile.selectedMapId);

  const unlockedCount = SNAKE_TYPES.filter((s) =>
    isSnakeUnlocked(profile, s)
  ).length;

  // Ensure selectedSnake is actually unlocked (fallback to Snake #1 if locked)
  useEffect(() => {
    if (!isSnakeUnlocked(profile, selectedSnake)) {
      onUpdateProfile({ selectedSnakeId: SNAKE_TYPES[0].id });
    }
  }, [profile, selectedSnake, onUpdateProfile]);

  useEffect(() => {
    if (profile.preferredMode !== 'online') return;
    const lobby = new MultiplayerClient();
    lobby.connectLobby(profile.customServerUrl, {
      onRooms: (r) => setRooms(r),
    });
    return () => {
      lobby.disconnect();
    };
  }, [profile.preferredMode, profile.customServerUrl]);

  const totalOnline = rooms.reduce((acc, r) => acc + r.activePlayers, 0);

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
    setNetworkError(null);

    // Online mode strictly requires internet connectivity
    if (profile.preferredMode === 'online') {
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (!isOnline) {
        setNetworkError(t.internetRequired);
        return;
      }

      setIsConnecting(true);
      setTimeout(() => {
        setIsConnecting(false);
        onStartGame();
      }, 950);
      return;
    }

    onStartGame();
  };

  return (
    <div
      className="relative min-h-screen w-full flex flex-col justify-between px-3.5 py-2 sm:px-6 sm:py-5 select-none text-slate-100 overflow-y-auto"
      style={{ backgroundColor: selectedMap.bgColor }}
    >
      {/* Subtle Clean Background Grid */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: `linear-gradient(to right, ${selectedMap.gridColor} 1px, transparent 1px), linear-gradient(to bottom, ${selectedMap.gridColor} 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />

      {/* TOP BAR: Achievements & Settings on Top-Right */}
      <header className="relative z-10 flex items-center justify-end gap-2 w-full pt-0.5">
        <button
          type="button"
          onClick={openAchievementsModal}
          className="inline-flex items-center gap-1.5 rounded-lg sm:rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-white/10 px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-medium text-slate-200 transition cursor-pointer"
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
          className="inline-flex items-center gap-1.5 rounded-lg sm:rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-white/10 px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-medium text-slate-200 transition cursor-pointer"
        >
          <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-300" />
          <span>{t.settings}</span>
        </button>
      </header>

      {/* CENTER: Title, Nickname, Online/Offline, Play */}
      <main className="relative z-10 my-auto mx-auto w-full max-w-xs sm:max-w-sm flex flex-col items-center text-center py-1 sm:py-4">
        <div className="mb-0.5">
          <SnakePreviewCanvas snake={selectedSnake} width={180} height={52} />
        </div>

        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mb-2 sm:mb-4">
          GlowSnake.io
        </h1>

        <form onSubmit={handlePlay} className="w-full space-y-2 sm:space-y-3">
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
              className={`w-full rounded-lg sm:rounded-xl bg-slate-900/90 border px-3.5 py-2 sm:py-3 text-center text-sm sm:text-base font-medium text-white placeholder-slate-500 outline-none transition ${
                nameError
                  ? 'border-red-500'
                  : 'border-white/15 focus:border-white/40'
              }`}
            />
            {nameError && (
              <p className="mt-1 text-xs text-red-400">{t.enterNameWarning}</p>
            )}
          </div>

          {/* Offline / Online Switch */}
          <div className="grid grid-cols-2 gap-1 rounded-lg sm:rounded-xl bg-slate-900/90 border border-white/10 p-1">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onUpdateProfile({ preferredMode: 'offline' });
              }}
              className={`rounded-md sm:rounded-lg py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition cursor-pointer ${
                profile.preferredMode === 'offline'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.offline}
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setNetworkError(null);
                onUpdateProfile({ preferredMode: 'online' });
              }}
              className={`rounded-md sm:rounded-lg py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition cursor-pointer ${
                profile.preferredMode === 'online'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.online}
              {profile.preferredMode === 'online' ? ` (${simulatedOnlineCount})` : ''}
            </button>
          </div>

          {/* Network Error Toast for Online Mode without Internet */}
          {networkError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/15 border border-red-500/30 p-2 text-xs text-red-300 text-left animate-shake">
              <WifiOff className="h-4 w-4 text-red-400 shrink-0" />
              <span>{networkError}</span>
            </div>
          )}

          {/* Play Button */}
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg sm:rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] px-4 py-2.5 sm:py-3.5 text-sm sm:text-base font-bold tracking-wide text-slate-950 transition cursor-pointer shadow-lg shadow-emerald-500/20"
          >
            <Play className="h-4 w-4 sm:h-5 sm:w-5 fill-slate-950" />
            <span>{t.play}</span>
          </button>
        </form>
      </main>

      {/* BOTTOM CORNERS: Left = High Score & Level | Right = Snakes & Themes */}
      <div className="relative z-10 w-full flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-3">
        {/* Left Side: Record & Level */}
        <div className="rounded-2xl bg-slate-900/90 border border-white/10 px-4 py-3 min-w-[220px]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-400 shrink-0" />
              <span className="text-xs text-slate-400">{t.highScore}:</span>
              <strong className="text-base font-bold text-white tabular-nums">
                {profile.highScore}
              </strong>
            </div>

            {profile.lastScore > 0 && (
              <span className="text-xs text-slate-500 tabular-nums">
                {t.lastScore}: {profile.lastScore}
              </span>
            )}
          </div>

          <div className="mt-2">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-slate-300">
                {t.level} {levelInfo.level}
              </span>
              <span className="text-[11px] text-slate-500 tabular-nums">
                {levelInfo.currentLevelXp} / {levelInfo.neededForNext} XP
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${Math.round(levelInfo.progress * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right Side: Snakes & Themes Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={openSnakesModal}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 border border-white/10 px-4 py-3.5 text-sm font-semibold text-white transition cursor-pointer"
          >
            <span
              className="h-3.5 w-3.5 rounded-full shrink-0 border border-white/20"
              style={{ backgroundColor: selectedSnake.primaryColor }}
            />
            <span>{t.snakes}</span>
            <span className="text-xs text-slate-400 font-normal tabular-nums">
              ({unlockedCount}/{SNAKE_TYPES.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              setActiveModal('themes');
            }}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 border border-white/10 px-4 py-3.5 text-sm font-semibold text-white transition cursor-pointer"
          >
            <Palette className="h-4 w-4 text-slate-300 shrink-0" />
            <span>{t.themes}</span>
          </button>
        </div>
      </div>

      {/* Subtle Author Credit at Very Bottom */}
      <footer className="relative z-10 mt-3 text-center text-[11px] text-slate-500">
        {t.authorCredit}
      </footer>

      {/* ================= SETTINGS MODAL (Matches user reference exactly!) ================= */}
      {activeModal === 'settings' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-3xl bg-[#141528] border-2 border-cyan-500/30 p-5 sm:p-6 text-slate-100 shadow-2xl relative my-auto max-h-[92vh] flex flex-col">
            {/* Top Bar: Title & Language Selector */}
            <div className="flex flex-wrap items-center justify-between border-b border-white/10 pb-3 mb-4 gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-cyan-400" />
                <h2 className="text-lg font-extrabold text-white tracking-wide">
                  {t.settings}
                </h2>
              </div>

              {/* Language Chips */}
              <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-white/10">
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
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                        active
                          ? 'bg-cyan-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setActiveModal('none')}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer ml-auto"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Main 2-Column Content */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0 overflow-y-auto pr-1">
              {/* LEFT COLUMN: Control Modes, Handedness & Orientation */}
              <div className="flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  {/* 1. Arrow Mode */}
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      onUpdateProfile({ controlMode: 'arrow' });
                    }}
                    className={`w-full rounded-2xl border-2 p-3 transition flex items-center justify-between cursor-pointer ${
                      profile.controlMode === 'arrow'
                        ? 'border-cyan-400 bg-cyan-950/40 shadow-[0_0_15px_rgba(34,211,238,0.25)] ring-1 ring-cyan-400'
                        : 'border-white/15 bg-slate-900/60 hover:bg-slate-800/70'
                    }`}
                  >
                    {/* Green Snake Graphic */}
                    <div className="flex items-center gap-1.5">
                      <div className="h-5 w-24 rounded-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-300 flex items-center justify-end pr-1 relative shadow-inner">
                        <div className="flex flex-col gap-0.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-950" />
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-950" />
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 text-center px-2">
                      <span className="text-xs sm:text-sm font-extrabold text-white block">
                        {t.controlArrowMode}
                      </span>
                    </div>

                    {/* Arrow */}
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-400/40">
                      <ArrowRight className="h-5 w-5 text-emerald-400" />
                    </div>
                  </button>

                  {/* 2. Classic Mode */}
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      onUpdateProfile({ controlMode: 'classic' });
                    }}
                    className={`w-full rounded-2xl border-2 p-3 transition flex items-center justify-between cursor-pointer ${
                      profile.controlMode === 'classic'
                        ? 'border-cyan-400 bg-cyan-950/40 shadow-[0_0_15px_rgba(34,211,238,0.25)] ring-1 ring-cyan-400'
                        : 'border-white/15 bg-slate-900/60 hover:bg-slate-800/70'
                    }`}
                  >
                    {/* Brown/Orange Snake Graphic */}
                    <div className="flex items-center gap-1.5">
                      <div className="h-5 w-24 rounded-full bg-gradient-to-r from-amber-700 via-amber-500 to-amber-400 flex items-center justify-end pr-1 relative shadow-inner">
                        <div className="flex flex-col gap-0.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-950" />
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-950" />
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 text-center px-2">
                      <span className="text-xs sm:text-sm font-extrabold text-white block">
                        {t.controlClassicMode}
                      </span>
                    </div>

                    {/* Hand pointing icon */}
                    <div className="h-8 w-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0 border border-amber-400/40">
                      <MousePointer className="h-4 w-4 text-amber-300" />
                    </div>
                  </button>

                  {/* 3. Joystick Mode */}
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      onUpdateProfile({ controlMode: 'joystick' });
                    }}
                    className={`w-full rounded-2xl border-2 p-3 transition flex items-center justify-between cursor-pointer ${
                      profile.controlMode === 'joystick'
                        ? 'border-cyan-400 bg-cyan-950/40 shadow-[0_0_15px_rgba(34,211,238,0.25)] ring-1 ring-cyan-400'
                        : 'border-white/15 bg-slate-900/60 hover:bg-slate-800/70'
                    }`}
                  >
                    {/* Purple Snake Graphic */}
                    <div className="flex items-center gap-1.5">
                      <div className="h-5 w-24 rounded-full bg-gradient-to-r from-purple-700 via-purple-500 to-purple-400 flex items-center justify-end pr-1 relative shadow-inner">
                        <div className="flex flex-col gap-0.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-950" />
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-950" />
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 text-center px-2">
                      <span className="text-xs sm:text-sm font-extrabold text-white block">
                        {t.controlJoystickMode}
                      </span>
                    </div>

                    {/* Joystick Icon */}
                    <div className="h-8 w-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0 border border-purple-400/40">
                      <Gamepad2 className="h-4 w-4 text-purple-300" />
                    </div>
                  </button>
                </div>

                {/* Sub Controls: Handedness & Orientation Mode */}
                <div className="flex items-center justify-center gap-4 py-2">
                  {/* Right Handed Pad (Thumbstick Left, Action Right) */}
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      onUpdateProfile({ controlHand: 'right' });
                    }}
                    title={t.controlLayoutRight}
                    className={`h-14 w-16 rounded-xl border-2 p-2 flex items-center justify-between transition cursor-pointer ${
                      profile.controlHand === 'right'
                        ? 'border-cyan-400 bg-cyan-950/50 shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                        : 'border-white/15 bg-slate-900/70 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="h-6 w-6 rounded-full border border-cyan-400/60 flex items-center justify-center bg-cyan-500/20">
                      <div className="h-2 w-2 rounded-full bg-cyan-300" />
                    </div>
                    <div className="flex flex-col gap-1 items-center">
                      <div className="h-2.5 w-2.5 rounded-full bg-white/70" />
                      <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
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
                    className={`h-14 w-16 rounded-xl border-2 p-2 flex items-center justify-between transition cursor-pointer ${
                      profile.controlHand === 'left'
                        ? 'border-cyan-400 bg-cyan-950/50 shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                        : 'border-white/15 bg-slate-900/70 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="flex flex-col gap-1 items-center">
                      <div className="h-2.5 w-2.5 rounded-full bg-white/70" />
                      <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                    </div>
                    <div className="h-6 w-6 rounded-full border border-cyan-400/60 flex items-center justify-center bg-cyan-500/20">
                      <div className="h-2 w-2 rounded-full bg-cyan-300" />
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
                    className={`h-14 w-16 rounded-xl border-2 flex items-center justify-center transition cursor-pointer ${
                      profile.autoRotate
                        ? 'border-cyan-400 bg-cyan-950/50 shadow-[0_0_10px_rgba(34,211,238,0.3)] text-cyan-300'
                        : 'border-white/15 bg-slate-900/70 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="relative">
                      <Smartphone className="h-6 w-6" />
                      <RotateCw className="h-3.5 w-3.5 absolute -top-1 -right-1 text-cyan-400 animate-spin-slow" />
                    </div>
                  </button>
                </div>

                {/* Bottom Left OK Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setActiveModal('none');
                    }}
                    className="w-full sm:w-36 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm tracking-wide py-3 px-6 shadow-lg transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>{t.ok}</span>
                  </button>
                </div>
              </div>

              {/* RIGHT COLUMN: Checkboxes (Matching Screenshot) */}
              <div className="flex flex-col justify-between space-y-2.5">
                <div className="space-y-2">
                  {/* 1. Show player names */}
                  <label className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition select-none">
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
                      className={`h-6 w-6 rounded-lg border-2 flex items-center justify-center transition ${
                        profile.showPlayerNames
                          ? 'border-cyan-400 bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.4)] text-slate-950'
                          : 'border-white/30 bg-slate-900/80 text-transparent'
                      }`}
                    >
                      <Check className="h-4 w-4 stroke-[3]" />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-white">
                      {t.showPlayerNames}
                    </span>
                  </label>

                  {/* 2. Fade my name */}
                  <label className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition select-none">
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
                      className={`h-6 w-6 rounded-lg border-2 flex items-center justify-center transition ${
                        profile.fadeMyName
                          ? 'border-cyan-400 bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.4)] text-slate-950'
                          : 'border-white/30 bg-slate-900/80 text-transparent'
                      }`}
                    >
                      <Check className="h-4 w-4 stroke-[3]" />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-white">
                      {t.fadeMyName}
                    </span>
                  </label>

                  {/* 3. Best graphics */}
                  <label className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition select-none">
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
                      className={`h-6 w-6 rounded-lg border-2 flex items-center justify-center transition ${
                        profile.bestGraphics
                          ? 'border-cyan-400 bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.4)] text-slate-950'
                          : 'border-white/30 bg-slate-900/80 text-transparent'
                      }`}
                    >
                      <Check className="h-4 w-4 stroke-[3]" />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-white">
                      {t.bestGraphics}
                    </span>
                  </label>

                  {/* 4. Wiggling food */}
                  <label className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition select-none">
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
                      className={`h-6 w-6 rounded-lg border-2 flex items-center justify-center transition ${
                        profile.wigglingFood
                          ? 'border-cyan-400 bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.4)] text-slate-950'
                          : 'border-white/30 bg-slate-900/80 text-transparent'
                      }`}
                    >
                      <Check className="h-4 w-4 stroke-[3]" />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-white">
                      {t.wigglingFood}
                    </span>
                  </label>

                  {/* 5. Map on top */}
                  <label className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition select-none">
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
                      className={`h-6 w-6 rounded-lg border-2 flex items-center justify-center transition ${
                        profile.mapOnTop
                          ? 'border-cyan-400 bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.4)] text-slate-950'
                          : 'border-white/30 bg-slate-900/80 text-transparent'
                      }`}
                    >
                      <Check className="h-4 w-4 stroke-[3]" />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-white">
                      {t.mapOnTop}
                    </span>
                  </label>

                  {/* 6. Double tap to boost */}
                  <label className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition select-none">
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
                      className={`h-6 w-6 rounded-lg border-2 flex items-center justify-center transition ${
                        profile.doubleTapToBoost
                          ? 'border-cyan-400 bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.4)] text-slate-950'
                          : 'border-white/30 bg-slate-900/80 text-transparent'
                      }`}
                    >
                      <Check className="h-4 w-4 stroke-[3]" />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-white">
                      {t.doubleTapToBoost}
                    </span>
                  </label>

                  {/* 7. Look ahead (Unchecked by default in reference) */}
                  <label className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition select-none">
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
                      className={`h-6 w-6 rounded-lg border-2 flex items-center justify-center transition ${
                        profile.lookAhead
                          ? 'border-cyan-400 bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.4)] text-slate-950'
                          : 'border-white/30 bg-slate-900/80 text-transparent'
                      }`}
                    >
                      <Check className="h-4 w-4 stroke-[3]" />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-white">
                      {t.lookAhead}
                    </span>
                  </label>

                  {/* 8. New music (Speaker icon) */}
                  <label className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition select-none">
                    <input
                      type="checkbox"
                      checked={profile.musicEnabled}
                      onChange={(e) => {
                        const val = e.target.checked;
                        soundEngine.setMusicEnabled(val);
                        soundEngine.playClick();
                        onUpdateProfile({ musicEnabled: val });
                      }}
                      className="hidden"
                    />
                    <div
                      className={`h-6 w-6 rounded-lg border-2 flex items-center justify-center transition ${
                        profile.musicEnabled
                          ? 'border-cyan-400 bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.4)] text-slate-950'
                          : 'border-white/30 bg-slate-900/80 text-transparent'
                      }`}
                    >
                      <Check className="h-4 w-4 stroke-[3]" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Music className="h-4 w-4 text-cyan-300" />
                      <span className="text-xs sm:text-sm font-bold text-white">
                        {t.newMusic}
                      </span>
                    </div>
                  </label>

                  {/* 9. New sounds (Note icon) */}
                  <label className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition select-none">
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
                      className={`h-6 w-6 rounded-lg border-2 flex items-center justify-center transition ${
                        profile.soundEnabled
                          ? 'border-cyan-400 bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.4)] text-slate-950'
                          : 'border-white/30 bg-slate-900/80 text-transparent'
                      }`}
                    >
                      <Check className="h-4 w-4 stroke-[3]" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Volume2 className="h-4 w-4 text-cyan-300" />
                      <span className="text-xs sm:text-sm font-bold text-white">
                        {t.newSounds}
                      </span>
                    </div>
                  </label>
                </div>

                {/* Bottom Right Privacy Policy Button */}
                <div className="flex items-center justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setActiveModal('privacy');
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-purple-900/40 hover:bg-purple-800/60 border border-purple-500/40 px-3 py-1.5 text-xs font-semibold text-purple-200 transition cursor-pointer"
                  >
                    <div className="h-5 w-5 rounded-full bg-purple-600 flex items-center justify-center text-white">
                      <Lock className="h-3 w-3" />
                    </div>
                    <span>{t.privacyPolicy}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Expandable Advanced Network Config */}
            <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500">
              <button
                type="button"
                onClick={() => setShowAdvancedNetwork((v) => !v)}
                className="hover:text-slate-300 transition cursor-pointer"
              >
                {showAdvancedNetwork ? '▼ Hide Network URLs' : '▶ Advanced Network URLs'}
              </button>
            </div>

            {showAdvancedNetwork && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-2 border-t border-white/10">
                <input
                  type="text"
                  value={profile.customServerUrl}
                  onChange={(e) =>
                    onUpdateProfile({ customServerUrl: e.target.value })
                  }
                  placeholder={t.serverUrlLabel}
                  className="rounded-xl bg-slate-900 border border-white/10 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
                />
                <input
                  type="text"
                  value={profile.firebaseDbUrl}
                  onChange={(e) =>
                    onUpdateProfile({ firebaseDbUrl: e.target.value })
                  }
                  placeholder={t.firebaseUrlLabel}
                  className="rounded-xl bg-slate-900 border border-white/10 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
                />
              </div>
            )}
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

      {/* ================= SNAKES MODAL (35 Snakes + Side Compact Preview for Locked & Unlocked) ================= */}
      {activeModal === 'snakes' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-[#181b24] border border-white/10 p-4 sm:p-5 text-slate-100 flex flex-col max-h-[88vh]">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3.5 shrink-0">
              <div>
                <h2 className="text-base font-bold text-white">
                  {t.snakes} ({unlockedCount}/{SNAKE_TYPES.length})
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t.level} {levelInfo.level}
                </p>
              </div>
              <button
                onClick={() => setActiveModal('none')}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body: Left Grid (35 Snakes) + Right Compact Side Preview */}
            <div className="flex flex-col md:flex-row gap-4 min-h-0 flex-1 overflow-hidden">
              {/* Scrollable 35 Snakes Grid */}
              <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5 content-start">
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
              <div className="w-full md:w-[275px] shrink-0 rounded-xl bg-slate-900/90 border border-white/10 p-3.5 flex flex-col justify-between">
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
                    className="relative rounded-xl border border-white/10 flex items-center justify-center py-2 mb-3 overflow-hidden"
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
                      height={70}
                    />
                    {!inspectedUnlocked && (
                      <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 rounded-md bg-black/65 border border-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                        <Lock className="h-2.5 w-2.5" />
                        {t.lockedLevel} {inspectedSnake.requiredLevel}
                      </span>
                    )}
                  </div>

                  {/* Inspected Name & Subtitle */}
                  <div className="mb-2.5">
                    <div className="text-base font-extrabold text-white leading-tight">
                      #{inspectedSnake.index.toString().padStart(2, '0')}{' '}
                      {inspectedSnake.name}
                    </div>
                    <div className="text-xs text-slate-400">
                      {inspectedSnake.subtitle[lang]}
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
                  <div className="w-full rounded-xl bg-slate-800/80 border border-amber-400/25 py-2.5 px-3 text-xs font-semibold text-amber-300 flex items-center justify-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {t.unlocksAtLevel} {inspectedSnake.requiredLevel}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= THEMES MODAL ================= */}
      {activeModal === 'themes' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#181b24] border border-white/10 p-5 text-slate-100">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <h2 className="text-base font-bold text-white">{t.themes}</h2>
              <button
                onClick={() => setActiveModal('none')}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              {ARENA_MAPS.map((map) => {
                const active = map.id === profile.selectedMapId;
                const room = rooms.find((r) => r.mapId === map.id);
                return (
                  <button
                    key={map.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      onUpdateProfile({ selectedMapId: map.id as MapId });
                    }}
                    className={`w-full flex items-center justify-between rounded-xl border p-3.5 transition cursor-pointer ${
                      active
                        ? 'border-emerald-500 bg-emerald-500/10 text-white'
                        : 'border-white/10 bg-slate-900/70 text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="h-7 w-7 rounded-lg border border-white/15 shrink-0"
                        style={{ backgroundColor: map.bgColor }}
                      />
                      <div className="text-left">
                        <div className="text-sm font-semibold">
                          {map.name[lang]}
                        </div>
                        {profile.preferredMode === 'online' && room && (
                          <div className="text-[11px] text-slate-400">
                            {t.players}: {room.activePlayers}
                            {room.instanceCount > 1
                              ? ` • ${room.instanceCount} ${t.serverRoom}`
                              : ''}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {map.orbPalette.slice(0, 3).map((col, idx) => (
                        <span
                          key={idx}
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: col }}
                        />
                      ))}
                      {active && (
                        <Check className="h-4 w-4 text-emerald-400 ml-1.5" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setActiveModal('none')}
              className="mt-5 w-full rounded-xl bg-slate-800 hover:bg-slate-700 py-2.5 text-sm font-semibold text-white transition cursor-pointer"
            >
              {t.close}
            </button>
          </div>
        </div>
      )}

      {/* Online Matchmaking Realistic Connecting Overlay */}
      {isConnecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in select-none">
          <div className="rounded-2xl border border-sky-500/35 bg-slate-900/95 p-6 max-w-xs w-full text-center shadow-2xl space-y-3">
            <div className="relative mx-auto h-12 w-12 flex items-center justify-center">
              <Loader2 className="h-10 w-10 text-sky-400 animate-spin" />
              <Globe className="h-5 w-5 text-emerald-400 absolute" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white mb-1">
                {t.connectingOnline}
              </h3>
              <p className="text-xs text-sky-300 font-mono">
                {t.onlineRegion} • 54/60
              </p>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 animate-pulse w-4/5 rounded-full" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

'use client';

import React, { useRef, useState } from 'react';
import { UI_TEXT } from '@/data/i18n';
import { getMapSpec } from '@/data/maps';
import { soundEngine } from '@/engine/soundEngine';
import { getDefaultHudLayout } from '@/engine/storage';
import {
  HudCustomLayout,
  HudElementId,
  LanguageCode,
  PlayerProfile,
} from '@/types/game';
import {
  ArrowDownUp,
  Check,
  Crown,
  Minus,
  Move,
  Plus,
  RotateCcw,
  Sliders,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';

interface HudLayoutEditorModalProps {
  profile: PlayerProfile;
  onUpdateProfile: (patch: Partial<PlayerProfile>) => void;
  onClose: () => void;
}

function cloneLayout(layout: HudCustomLayout): HudCustomLayout {
  return {
    joystick: { ...layout.joystick },
    boost: { ...layout.boost },
    skill: { ...layout.skill },
    minimap: { ...layout.minimap },
    leaderboard: { ...layout.leaderboard },
    scorebar: { ...layout.scorebar },
  };
}

export const HudLayoutEditorModal: React.FC<HudLayoutEditorModalProps> = ({
  profile,
  onUpdateProfile,
  onClose,
}) => {
  const lang: LanguageCode = profile.language || 'en';
  const t = UI_TEXT[lang];
  const mapSpec = getMapSpec(profile.selectedMapId);

  const [draft, setDraft] = useState<HudCustomLayout>(() =>
    profile.hudLayout
      ? cloneLayout(profile.hudLayout)
      : getDefaultHudLayout(profile.controlHand, profile.mapOnTop)
  );
  const [isDefaultReset, setIsDefaultReset] = useState<boolean>(
    !profile.hudLayout
  );
  const [selectedId, setSelectedId] = useState<HudElementId>('boost');
  const [dockBottom, setDockBottom] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    id: HudElementId;
    pointerId: number;
    startX: number;
    startY: number;
    origXPct: number;
    origYPct: number;
  } | null>(null);

  const elementLabels: Record<HudElementId, string> = {
    joystick: t.hudJoystick,
    skill: t.hudSkill,
    boost: t.hudBoost,
    minimap: t.hudMinimap,
    leaderboard: t.hudLeaderboard,
    scorebar: t.hudScorebar,
  };

  const handlePointerDown = (
    id: HudElementId,
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    e.stopPropagation();
    setSelectedId(id);
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origXPct: draft[id].xPct,
      origYPct: draft[id].yPct,
    };
  };

  const handlePointerMove = (
    id: HudElementId,
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    const st = dragStateRef.current;
    if (!st || st.id !== id || st.pointerId !== e.pointerId) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;

    const dxPct = ((e.clientX - st.startX) / rect.width) * 100;
    const dyPct = ((e.clientY - st.startY) / rect.height) * 100;

    const nextXPct = Math.max(5, Math.min(95, Number((st.origXPct + dxPct).toFixed(1))));
    const nextYPct = Math.max(7, Math.min(93, Number((st.origYPct + dyPct).toFixed(1))));

    setIsDefaultReset(false);
    setDraft((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        xPct: nextXPct,
        yPct: nextYPct,
      },
    }));
  };

  const handlePointerUp = (
    id: HudElementId,
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    const st = dragStateRef.current;
    if (st && st.id === id && st.pointerId === e.pointerId) {
      dragStateRef.current = null;
    }
  };

  const updateSelectedPatch = (
    patch: Partial<{ scale: number; opacity: number }>
  ) => {
    setIsDefaultReset(false);
    setDraft((prev) => ({
      ...prev,
      [selectedId]: {
        ...prev[selectedId],
        ...patch,
      },
    }));
  };

  const handleReset = () => {
    soundEngine.playClick();
    setDraft(getDefaultHudLayout(profile.controlHand, profile.mapOnTop));
    setIsDefaultReset(true);
  };

  const handleSave = () => {
    soundEngine.playClick();
    onUpdateProfile({
      hudLayout: isDefaultReset ? null : draft,
    });
    onClose();
  };

  const selectedItem = draft[selectedId];

  const getWrapperStyle = (id: HudElementId): React.CSSProperties => {
    const item = draft[id];
    return {
      left: `${item.xPct}%`,
      top: `${item.yPct}%`,
      transform: `translate(-50%, -50%) scale(${item.scale})`,
      opacity: item.opacity,
    };
  };

  const selectionRing = (id: HudElementId) =>
    selectedId === id
      ? 'ring-2 ring-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.55)] z-30'
      : 'ring-1 ring-dashed ring-white/25 hover:ring-white/50 z-20';

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[60] touch-none select-none overflow-hidden text-slate-100"
      style={{
        backgroundColor: mapSpec.bgColor,
        backgroundImage: `radial-gradient(circle at 50% 50%, ${mapSpec.bgAccentColor} 0%, ${mapSpec.bgColor} 80%)`,
      }}
    >
      {/* Subtle reference grid so alignment is effortless */}
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage: `linear-gradient(to right, ${mapSpec.gridColor} 1px, transparent 1px), linear-gradient(to bottom, ${mapSpec.gridColor} 1px, transparent 1px)`,
          backgroundSize: '44px 44px',
        }}
      />
      {/* Center crosshair guide */}
      <div className="pointer-events-none absolute left-1/2 top-0 bottom-0 w-px bg-cyan-400/15" />
      <div className="pointer-events-none absolute top-1/2 left-0 right-0 h-px bg-cyan-400/15" />

      {/* 1. MINIMAP DRAGGABLE */}
      <div
        onPointerDown={(e) => handlePointerDown('minimap', e)}
        onPointerMove={(e) => handlePointerMove('minimap', e)}
        onPointerUp={(e) => handlePointerUp('minimap', e)}
        onPointerCancel={(e) => handlePointerUp('minimap', e)}
        style={getWrapperStyle('minimap')}
        className={`absolute cursor-grab active:cursor-grabbing rounded-xl bg-slate-900/85 border border-slate-400/35 w-[90px] h-[90px] sm:w-[114px] sm:h-[114px] flex flex-col items-center justify-center p-2 ${selectionRing(
          'minimap'
        )}`}
      >
        <span className="h-2 w-2 rounded-sm bg-emerald-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        <span className="h-1.5 w-1.5 rounded-sm bg-amber-400 absolute top-5 right-5" />
        <span className="h-1 w-1 rounded-sm bg-slate-300/60 absolute bottom-4 left-6" />
        <span className="mt-auto text-[10px] font-bold text-cyan-200 bg-slate-950/80 px-1.5 py-0.5 rounded">
          {t.hudMinimap}
        </span>
      </div>

      {/* 2. LEADERBOARD DRAGGABLE */}
      <div
        onPointerDown={(e) => handlePointerDown('leaderboard', e)}
        onPointerMove={(e) => handlePointerMove('leaderboard', e)}
        onPointerUp={(e) => handlePointerUp('leaderboard', e)}
        onPointerCancel={(e) => handlePointerUp('leaderboard', e)}
        style={getWrapperStyle('leaderboard')}
        className={`absolute cursor-grab active:cursor-grabbing w-36 sm:w-44 rounded-xl bg-slate-950/75 border border-white/15 p-2 ${selectionRing(
          'leaderboard'
        )}`}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-1 mb-1">
          <span className="text-[11px] font-bold text-slate-200">
            {t.hudLeaderboard}
          </span>
          <Move className="h-3 w-3 text-cyan-400" />
        </div>
        <div className="space-y-0.5 text-[10px] text-slate-300">
          <div className="flex justify-between">
            <span>1. ApexKing</span>
            <span className="font-mono">14250</span>
          </div>
          <div className="flex justify-between">
            <span>2. ViperPro</span>
            <span className="font-mono">9840</span>
          </div>
          <div className="flex justify-between text-emerald-300 font-bold">
            <span>3. {profile.nickname.trim() || 'You'}</span>
            <span className="font-mono">6420</span>
          </div>
        </div>
        <div className="mt-1 pt-1 border-t border-white/10 flex items-center justify-between text-[10px]">
          <span className="inline-flex items-center gap-1 text-slate-400">
            <Crown className="h-3 w-3 text-amber-400" />
            {t.rank}
          </span>
          <strong className="text-emerald-400">#3/296</strong>
        </div>
      </div>

      {/* 3. SCORE BAR DRAGGABLE */}
      <div
        onPointerDown={(e) => handlePointerDown('scorebar', e)}
        onPointerMove={(e) => handlePointerMove('scorebar', e)}
        onPointerUp={(e) => handlePointerUp('scorebar', e)}
        onPointerCancel={(e) => handlePointerUp('scorebar', e)}
        style={getWrapperStyle('scorebar')}
        className={`absolute cursor-grab active:cursor-grabbing rounded-xl bg-slate-950/85 border border-white/15 px-3.5 py-1.5 text-xs text-slate-200 whitespace-nowrap flex items-center gap-3 ${selectionRing(
          'scorebar'
        )}`}
      >
        <span>
          <span className="text-slate-400 mr-1">{t.score}:</span>
          <strong className="font-bold text-white">1250</strong>
        </span>
        <span>
          <span className="text-slate-400 mr-1">{t.rank}:</span>
          <strong className="font-bold text-emerald-400">#8/296</strong>
        </span>
      </div>

      {/* 4. JOYSTICK DRAGGABLE */}
      <div
        onPointerDown={(e) => handlePointerDown('joystick', e)}
        onPointerMove={(e) => handlePointerMove('joystick', e)}
        onPointerUp={(e) => handlePointerUp('joystick', e)}
        onPointerCancel={(e) => handlePointerUp('joystick', e)}
        style={getWrapperStyle('joystick')}
        className={`absolute cursor-grab active:cursor-grabbing h-28 w-28 rounded-full border border-cyan-400/45 bg-slate-900/75 flex flex-col items-center justify-center ${selectionRing(
          'joystick'
        )}`}
      >
        <div className="h-11 w-11 rounded-full bg-cyan-400/90 shadow-md flex items-center justify-center">
          <Move className="h-4 w-4 text-slate-950" />
        </div>
        <span className="mt-1 text-[9px] font-bold text-cyan-200">
          {t.hudJoystick}
        </span>
      </div>

      {/* 5. SKILL BUTTON DRAGGABLE */}
      <div
        onPointerDown={(e) => handlePointerDown('skill', e)}
        onPointerMove={(e) => handlePointerMove('skill', e)}
        onPointerUp={(e) => handlePointerUp('skill', e)}
        onPointerCancel={(e) => handlePointerUp('skill', e)}
        style={getWrapperStyle('skill')}
        className={`absolute cursor-grab active:cursor-grabbing h-16 w-16 rounded-full border border-white/35 bg-slate-800/95 text-white flex flex-col items-center justify-center text-[11px] font-bold ${selectionRing(
          'skill'
        )}`}
      >
        <Sparkles className="h-4 w-4 mb-0.5 text-purple-300" />
        <span>{t.skill}</span>
      </div>

      {/* 6. BOOST BUTTON DRAGGABLE */}
      <div
        onPointerDown={(e) => handlePointerDown('boost', e)}
        onPointerMove={(e) => handlePointerMove('boost', e)}
        onPointerUp={(e) => handlePointerUp('boost', e)}
        onPointerCancel={(e) => handlePointerUp('boost', e)}
        style={getWrapperStyle('boost')}
        className={`absolute cursor-grab active:cursor-grabbing h-20 w-20 rounded-full bg-emerald-500 text-slate-950 flex flex-col items-center justify-center text-xs font-extrabold ${selectionRing(
          'boost'
        )}`}
      >
        <Zap className="h-5 w-5 mb-0.5" />
        <span>{t.boost}</span>
      </div>

      {/* COMPACT INSPECTOR & TOOLBAR (Flippable Top / Bottom so no corner is blocked) */}
      <div
        className={`fixed left-1/2 -translate-x-1/2 z-40 w-[94vw] max-w-xl rounded-2xl bg-[#121526]/95 backdrop-blur-md border border-cyan-400/35 px-3 py-2 shadow-2xl transition-all ${
          dockBottom ? 'bottom-2' : 'top-2'
        }`}
      >
        {/* Top Row: Title, Dock Flip, Reset, Save, Close */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-white/10 pb-1.5 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <Sliders className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
            <span className="text-xs font-extrabold text-white truncate">
              {t.hudEditorTitle}
            </span>
            <span className="hidden sm:inline text-[10px] text-slate-400 truncate">
              • {t.hudEditorHint}
            </span>
          </div>

          <div className="flex items-center gap-1 ml-auto">
            <button
              type="button"
              onClick={() => setDockBottom((v) => !v)}
              title="Move toolbar"
              className="rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 p-1 text-slate-300 cursor-pointer"
            >
              <ArrowDownUp className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 px-2 py-1 text-[11px] font-semibold text-slate-200 cursor-pointer"
            >
              <RotateCcw className="h-3 w-3 text-amber-400" />
              <span>{t.hudResetBtn}</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-2.5 py-1 text-[11px] font-black text-slate-950 cursor-pointer shadow-sm"
            >
              <Check className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>{t.hudSaveBtn}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onClose();
              }}
              className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Element Selector Chips */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1.5 mb-1.5 custom-scrollbar">
          {(
            [
              'boost',
              'skill',
              'joystick',
              'minimap',
              'leaderboard',
              'scorebar',
            ] as HudElementId[]
          ).map((id) => {
            const active = selectedId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setSelectedId(id);
                }}
                className={`rounded-lg px-2 py-0.5 text-[10px] font-bold whitespace-nowrap transition cursor-pointer ${
                  active
                    ? 'bg-cyan-500 text-slate-950 shadow-xs'
                    : 'bg-slate-900/90 text-slate-300 border border-white/10 hover:text-white'
                }`}
              >
                {elementLabels[id]}
              </button>
            );
          })}
        </div>

        {/* Size & Opacity Controls for Selected Element */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
          {/* Scale / Size Slider */}
          <div className="flex items-center gap-1.5 bg-slate-900/80 rounded-xl px-2 py-1 border border-white/10">
            <span className="text-[10px] font-semibold text-slate-300 shrink-0">
              {t.hudElementSize}:
            </span>
            <button
              type="button"
              onClick={() =>
                updateSelectedPatch({
                  scale: Math.max(
                    0.6,
                    Number((selectedItem.scale - 0.08).toFixed(2))
                  ),
                })
              }
              className="h-5 w-5 rounded bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-200 cursor-pointer shrink-0"
            >
              <Minus className="h-3 w-3" />
            </button>
            <input
              type="range"
              min={0.6}
              max={1.65}
              step={0.05}
              value={selectedItem.scale}
              onChange={(e) =>
                updateSelectedPatch({ scale: parseFloat(e.target.value) })
              }
              className="w-full accent-cyan-400 h-1.5 cursor-pointer"
            />
            <button
              type="button"
              onClick={() =>
                updateSelectedPatch({
                  scale: Math.min(
                    1.65,
                    Number((selectedItem.scale + 0.08).toFixed(2))
                  ),
                })
              }
              className="h-5 w-5 rounded bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-200 cursor-pointer shrink-0"
            >
              <Plus className="h-3 w-3" />
            </button>
            <span className="text-[10px] font-mono font-bold text-cyan-300 w-9 text-right tabular-nums shrink-0">
              {Math.round(selectedItem.scale * 100)}%
            </span>
          </div>

          {/* Opacity Slider */}
          <div className="flex items-center gap-2 bg-slate-900/80 rounded-xl px-2 py-1 border border-white/10">
            <span className="text-[10px] font-semibold text-slate-300 shrink-0">
              {t.hudElementOpacity}:
            </span>
            <input
              type="range"
              min={0.35}
              max={1.0}
              step={0.05}
              value={selectedItem.opacity}
              onChange={(e) =>
                updateSelectedPatch({ opacity: parseFloat(e.target.value) })
              }
              className="w-full accent-emerald-400 h-1.5 cursor-pointer"
            />
            <span className="text-[10px] font-mono font-bold text-emerald-300 w-9 text-right tabular-nums shrink-0">
              {Math.round(selectedItem.opacity * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

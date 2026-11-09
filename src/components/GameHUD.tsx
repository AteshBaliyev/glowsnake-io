'use client';

import React, { useEffect, useRef, useState } from 'react';
import { UI_TEXT } from '@/data/i18n';
import { getSnakeSpec } from '@/data/snakes';
import {
  ControlHand,
  ControlMode,
  HudCustomLayout,
  HudItemPlacement,
  LanguageCode,
  LeaderboardEntry,
  MapId,
  SnakeEntity,
} from '@/types/game';
import { Crown, Sparkles, Users, Zap } from 'lucide-react';

export interface HudState {
  mySnake: SnakeEntity | null;
  leaderboard: LeaderboardEntry[];
  myRank: number;
  totalPlayers: number;
  serverInstanceIndex: number;
  fps: number;
  pingMs: number;
  now: number;
}

interface GameHUDProps {
  language: LanguageCode;
  mapId: MapId;
  snakeTypeId: string;
  hud: HudState;
  controlMode: ControlMode;
  controlHand: ControlHand;
  mapOnTop: boolean;
  hudLayout?: HudCustomLayout | null;
  onTouchSteer: (angle: number | null) => void;
  onTouchBoost: (boosting: boolean) => void;
  onTriggerAbility: () => void;
}

function toPlacementStyle(item: HudItemPlacement): React.CSSProperties {
  return {
    left: `${item.xPct}%`,
    top: `${item.yPct}%`,
    transform: `translate(-50%, -50%) scale(${item.scale})`,
    opacity: item.opacity,
  };
}

export const GameHUD: React.FC<GameHUDProps> = ({
  language,
  snakeTypeId,
  hud,
  controlMode,
  controlHand,
  mapOnTop,
  hudLayout,
  onTouchSteer,
  onTouchBoost,
  onTriggerAbility,
}) => {
  const lang: LanguageCode = language || 'en';
  const t = UI_TEXT[lang];
  const snakeSpec = getSnakeSpec(snakeTypeId);

  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [joyKnob, setJoyKnob] = useState<{ x: number; y: number } | null>(null);
  const joyRef = useRef<HTMLDivElement | null>(null);
  const activeTouchId = useRef<number | null>(null);

  useEffect(() => {
    const hasTouch =
      typeof window !== 'undefined' &&
      ('ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.innerWidth < 1024 ||
        /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent));
    setIsTouchDevice(hasTouch);
  }, []);

  const showMobileControls = isTouchDevice || controlMode === 'joystick';
  const isLeftHanded = controlHand === 'left';

  const me = hud.mySnake;
  const score = Math.floor(me?.score || 0);
  const length = me?.segments.length || 14;
  const kills = me?.kills || 0;
  const totalPlayers = Math.max(1, hud.totalPlayers || 1);
  const myRank = Math.min(totalPlayers, Math.max(1, hud.myRank || totalPlayers));

  const cdRemainingMs = me ? Math.max(0, me.abilityCooldownUntil - hud.now) : 0;
  const cdSec = (cdRemainingMs / 1000).toFixed(1);
  const cdReady = cdRemainingMs <= 0;

  const joyScale = hudLayout ? hudLayout.joystick.scale : 1;

  const isPointerDownRef = useRef(false);

  const handleJoyPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    isPointerDownRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    updateJoyFromTouch(e.clientX, e.clientY);
  };

  const handleJoyPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    if (!isPointerDownRef.current) return;
    updateJoyFromTouch(e.clientX, e.clientY);
  };

  const handleJoyPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;
    setJoyKnob(null);
    onTouchSteer(null);
  };

  const handleJoyStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (activeTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    if (!touch || !joyRef.current) return;
    activeTouchId.current = touch.identifier;
    updateJoyFromTouch(touch.clientX, touch.clientY);
  };

  const handleJoyMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (activeTouchId.current === null || !joyRef.current) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const item = e.changedTouches[i];
      if (item.identifier === activeTouchId.current) {
        updateJoyFromTouch(item.clientX, item.clientY);
        break;
      }
    }
  };

  const handleJoyEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchId.current) {
        activeTouchId.current = null;
        setJoyKnob(null);
        onTouchSteer(null);
        break;
      }
    }
  };

  const updateJoyFromTouch = (clientX: number, clientY: number) => {
    if (!joyRef.current) return;
    const rect = joyRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const maxR = rect.width * 0.36;
    const d = Math.hypot(dx, dy);
    const clampedD = Math.min(maxR, d) / Math.max(0.4, joyScale);
    const angle = Math.atan2(dy, dx);
    setJoyKnob({
      x: Math.cos(angle) * clampedD,
      y: Math.sin(angle) * clampedD,
    });
    if (d > 6) {
      onTouchSteer(angle);
    }
  };

  const minimapInTopLeft = hudLayout
    ? hudLayout.minimap.xPct < 24 && hudLayout.minimap.yPct < 32
    : mapOnTop;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 select-none">
      {/* Top-Left Live Arena Player Count Badge */}
      <div
        className={`absolute top-3.5 ${
          minimapInTopLeft ? 'left-[118px] sm:left-[136px]' : 'left-3.5'
        } flex flex-wrap items-center gap-1.5 pointer-events-auto`}
      >
        <div className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900/85 border border-white/10 px-2.5 py-1.5 text-xs text-slate-200">
          <Users className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <span className="font-semibold tabular-nums">
            {t.players}: {totalPlayers}
          </span>
        </div>
      </div>

      {/* Leaderboard + Live Rank */}
      <div
        style={hudLayout ? toPlacementStyle(hudLayout.leaderboard) : undefined}
        className={`absolute ${
          hudLayout ? '' : 'top-3.5 right-3.5'
        } w-36 sm:w-44 rounded-xl bg-slate-950/65 backdrop-blur-xs border border-white/10 p-1.5 sm:p-2 shadow-lg`}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-1 mb-1">
          <span className="text-[11px] sm:text-xs font-bold text-slate-200">
            {t.leaderboard}
          </span>
          <span className="text-[9px] sm:text-[10px] font-semibold text-slate-400 tabular-nums">
            {totalPlayers} {t.players}
          </span>
        </div>

        <div className="space-y-[1px]">
          {hud.leaderboard.slice(0, 5).map((entry, idx) => {
            const isMe = me && entry.id === me.id;
            return (
              <div
                key={entry.id}
                className={`flex items-center justify-between rounded px-1 py-[1px] text-[10px] sm:text-[11px] ${
                  isMe
                    ? 'bg-emerald-500/25 text-emerald-300 font-bold'
                    : 'text-slate-300'
                }`}
              >
                <span className="truncate pr-1.5 max-w-[75px] sm:max-w-[95px]">
                  {idx + 1}. {entry.name}
                </span>
                <span className="font-mono tabular-nums text-[10px] sm:text-[11px]">
                  {entry.score}
                </span>
              </div>
            );
          })}
        </div>

        {/* Live Rank Strip */}
        <div className="mt-1 pt-1 border-t border-white/10 flex items-center justify-between text-[10px] sm:text-[11px]">
          <span className="inline-flex items-center gap-1 text-slate-400 font-medium">
            <Crown className="h-3 w-3 text-amber-400" />
            {t.rank}
          </span>
          <strong className="font-extrabold text-emerald-400 tabular-nums">
            #{myRank}/{totalPlayers}
          </strong>
        </div>
      </div>

      {/* Stats / Score Bar */}
      <div
        style={hudLayout ? toPlacementStyle(hudLayout.scorebar) : undefined}
        className={`absolute ${
          hudLayout ? '' : 'bottom-3 left-1/2 -translate-x-1/2'
        } pointer-events-auto whitespace-nowrap`}
      >
        <div className="flex items-center gap-3 sm:gap-4 rounded-xl bg-slate-950/75 backdrop-blur-xs border border-white/10 px-3.5 py-1.5 text-xs text-slate-200 shadow-md">
          <div>
            <span className="text-slate-400 mr-1">{t.score}:</span>
            <strong className="text-sm font-bold text-white tabular-nums">
              {score}
            </strong>
          </div>

          <div>
            <span className="text-slate-400 mr-1">{t.rank}:</span>
            <strong className="font-bold text-emerald-400 tabular-nums">
              #{myRank}/{totalPlayers}
            </strong>
          </div>

          <div className="hidden sm:block">
            <span className="text-slate-400 mr-1">{t.length}:</span>
            <strong className="font-semibold text-white tabular-nums">
              {length}
            </strong>
          </div>

          <div className="hidden sm:block">
            <span className="text-slate-400 mr-1">{t.kills}:</span>
            <strong className="font-semibold text-white tabular-nums">
              {kills}
            </strong>
          </div>
        </div>
      </div>

      {/* Mobile / Touch Controls */}
      {showMobileControls && (
        <>
          {/* Virtual Joystick (Active in joystick mode) */}
          {controlMode === 'joystick' && (
            <div
              ref={joyRef}
              onTouchStart={handleJoyStart}
              onTouchMove={handleJoyMove}
              onTouchEnd={handleJoyEnd}
              onTouchCancel={handleJoyEnd}
              onPointerDown={handleJoyPointerDown}
              onPointerMove={handleJoyPointerMove}
              onPointerUp={handleJoyPointerUp}
              onPointerCancel={handleJoyPointerUp}
              style={
                hudLayout ? toPlacementStyle(hudLayout.joystick) : undefined
              }
              className={`pointer-events-auto absolute ${
                hudLayout
                  ? ''
                  : `bottom-6 ${isLeftHanded ? 'right-5' : 'left-5'}`
              } h-28 w-28 rounded-full border border-cyan-400/30 bg-slate-900/70 shadow-lg flex items-center justify-center touch-none`}
            >
              <div
                className="h-11 w-11 rounded-full bg-cyan-400/90 shadow-md transition-transform duration-75"
                style={{
                  transform: joyKnob
                    ? `translate(${joyKnob.x}px, ${joyKnob.y}px)`
                    : 'translate(0px, 0px)',
                }}
              />
            </div>
          )}

          {hudLayout ? (
            <>
              {/* Independently Positioned Skill Button */}
              <button
                onTouchStart={(e) => {
                  e.preventDefault();
                  onTriggerAbility();
                }}
                onClick={onTriggerAbility}
                style={toPlacementStyle(hudLayout.skill)}
                className={`pointer-events-auto absolute touch-none h-16 w-16 rounded-full border flex flex-col items-center justify-center text-[11px] font-bold shadow-lg ${
                  cdReady
                    ? 'border-white/30 bg-slate-800 text-white active:opacity-80'
                    : 'border-white/10 bg-slate-900/80 text-slate-400'
                }`}
              >
                <Sparkles
                  className="h-4 w-4 mb-0.5"
                  style={{
                    color:
                      me && me.activeEffect === snakeSpec.ability.id
                        ? snakeSpec.ability.badgeColor
                        : undefined,
                  }}
                />
                <span>{cdReady ? t.skill : `${cdSec}s`}</span>
              </button>

              {/* Independently Positioned Boost Button */}
              <button
                onTouchStart={(e) => {
                  e.preventDefault();
                  onTouchBoost(true);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  onTouchBoost(false);
                }}
                onTouchCancel={() => onTouchBoost(false)}
                onMouseDown={() => onTouchBoost(true)}
                onMouseUp={() => onTouchBoost(false)}
                onMouseLeave={() => onTouchBoost(false)}
                style={toPlacementStyle(hudLayout.boost)}
                className="pointer-events-auto absolute touch-none h-20 w-20 rounded-full bg-emerald-500 text-slate-950 flex flex-col items-center justify-center text-xs font-bold active:opacity-85 shadow-lg"
              >
                <Zap className="h-5 w-5 mb-0.5" />
                <span>{t.boost}</span>
              </button>
            </>
          ) : (
            /* Default Grouped Action Buttons: Skill & Boost */
            <div
              className={`pointer-events-auto absolute bottom-6 ${
                isLeftHanded ? 'left-5' : 'right-5'
              } flex items-end gap-3 touch-none`}
            >
              <button
                onTouchStart={(e) => {
                  e.preventDefault();
                  onTriggerAbility();
                }}
                onClick={onTriggerAbility}
                className={`h-16 w-16 rounded-full border flex flex-col items-center justify-center text-[11px] font-bold ${
                  cdReady
                    ? 'border-white/30 bg-slate-800 text-white active:scale-95'
                    : 'border-white/10 bg-slate-900/80 text-slate-400'
                }`}
              >
                <Sparkles className="h-4 w-4 mb-0.5" />
                <span>{cdReady ? t.skill : `${cdSec}s`}</span>
              </button>

              <button
                onTouchStart={(e) => {
                  e.preventDefault();
                  onTouchBoost(true);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  onTouchBoost(false);
                }}
                onTouchCancel={() => onTouchBoost(false)}
                onMouseDown={() => onTouchBoost(true)}
                onMouseUp={() => onTouchBoost(false)}
                onMouseLeave={() => onTouchBoost(false)}
                className="h-20 w-20 rounded-full bg-emerald-500 text-slate-950 flex flex-col items-center justify-center text-xs font-bold active:scale-95 shadow-lg"
              >
                <Zap className="h-5 w-5 mb-0.5" />
                <span>{t.boost}</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

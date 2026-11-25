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
  const [floatingJoyOrigin, setFloatingJoyOrigin] = useState<{ x: number; y: number } | null>(null);
  const [isBoostingUi, setIsBoostingUi] = useState(false);

  const joyRef = useRef<HTMLDivElement | null>(null);
  const activeJoyTouchId = useRef<number | null>(null);
  const activeBoostTouchId = useRef<number | null>(null);
  const floatingOriginRef = useRef<{ x: number; y: number } | null>(null);
  const joyPointerDownRef = useRef(false);
  const boostPointerDownRef = useRef(false);

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
  // Determine which half owns Joystick vs Boost based on handedness or custom HUD layout
  const boostOnRightHalf = hudLayout ? hudLayout.boost.xPct >= 50 : !isLeftHanded;

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
  const MAX_JOY_R = 46 * Math.max(0.75, joyScale);

  const beginJoyAt = (clientX: number, clientY: number) => {
    // If finger lands near resting joystick center, anchor smoothly; anywhere else on that half creates a floating base under thumb!
    let origin = { x: clientX, y: clientY };
    if (joyRef.current && !floatingOriginRef.current) {
      const rect = joyRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      if (Math.hypot(clientX - cx, clientY - cy) <= rect.width * 0.52) {
        origin = { x: cx, y: cy };
      }
    }
    floatingOriginRef.current = origin;
    setFloatingJoyOrigin(origin);
    moveJoyTo(clientX, clientY);
  };

  const moveJoyTo = (clientX: number, clientY: number) => {
    let origin = floatingOriginRef.current;
    if (!origin) {
      origin = { x: clientX, y: clientY };
      floatingOriginRef.current = origin;
      setFloatingJoyOrigin(origin);
    }
    const dx = clientX - origin.x;
    const dy = clientY - origin.y;
    const d = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    // Dynamic leash: if finger drags beyond max radius, base gently follows so 180-degree turns are instant!
    if (d > MAX_JOY_R) {
      const leashR = MAX_JOY_R * 0.92;
      origin = {
        x: clientX - Math.cos(angle) * leashR,
        y: clientY - Math.sin(angle) * leashR,
      };
      floatingOriginRef.current = origin;
      setFloatingJoyOrigin(origin);
      setJoyKnob({
        x: Math.cos(angle) * (leashR / Math.max(0.5, joyScale)),
        y: Math.sin(angle) * (leashR / Math.max(0.5, joyScale)),
      });
    } else {
      const clampedD = d / Math.max(0.5, joyScale);
      setJoyKnob({
        x: Math.cos(angle) * clampedD,
        y: Math.sin(angle) * clampedD,
      });
    }

    if (d > 5) {
      onTouchSteer(angle);
    }
  };

  const endJoy = () => {
    activeJoyTouchId.current = null;
    joyPointerDownRef.current = false;
    floatingOriginRef.current = null;
    setFloatingJoyOrigin(null);
    setJoyKnob(null);
    onTouchSteer(null);
  };

  // Touch Handlers for Full Half-Screen Joystick Zone
  const handleJoyZoneTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (activeJoyTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    activeJoyTouchId.current = touch.identifier;
    beginJoyAt(touch.clientX, touch.clientY);
  };

  const handleJoyZoneTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (activeJoyTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const item = e.changedTouches[i];
      if (item.identifier === activeJoyTouchId.current) {
        moveJoyTo(item.clientX, item.clientY);
        break;
      }
    }
  };

  const handleJoyZoneTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (activeJoyTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeJoyTouchId.current) {
        endJoy();
        break;
      }
    }
  };

  // Mouse/Pen Pointer fallback on Joystick Zone
  const handleJoyPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    joyPointerDownRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    beginJoyAt(e.clientX, e.clientY);
  };

  const handleJoyPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch' || !joyPointerDownRef.current) return;
    moveJoyTo(e.clientX, e.clientY);
  };

  const handleJoyPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch' || !joyPointerDownRef.current) return;
    endJoy();
  };

  // Touch Handlers for Full Half-Screen Boost Zone
  const handleBoostZoneTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (activeBoostTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    activeBoostTouchId.current = touch.identifier;
    setIsBoostingUi(true);
    onTouchBoost(true);
  };

  const handleBoostZoneTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (activeBoostTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeBoostTouchId.current) {
        activeBoostTouchId.current = null;
        setIsBoostingUi(false);
        onTouchBoost(false);
        break;
      }
    }
  };

  const handleBoostPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    boostPointerDownRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setIsBoostingUi(true);
    onTouchBoost(true);
  };

  const handleBoostPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch' || !boostPointerDownRef.current) return;
    boostPointerDownRef.current = false;
    setIsBoostingUi(false);
    onTouchBoost(false);
  };

  const minimapInTopLeft = hudLayout
    ? hudLayout.minimap.xPct < 24 && hudLayout.minimap.yPct < 32
    : mapOnTop;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 select-none">
      {/* FULL HALF-SCREEN TOUCH ZONES (Forgiving Thumb Controls for Mobile) */}
      {showMobileControls && (
        <>
          {/* Steering Side Half-Screen Floating Joystick Catcher (Joystick Mode) */}
          {controlMode === 'joystick' && (
            <div
              onTouchStart={handleJoyZoneTouchStart}
              onTouchMove={handleJoyZoneTouchMove}
              onTouchEnd={handleJoyZoneTouchEnd}
              onTouchCancel={handleJoyZoneTouchEnd}
              onPointerDown={handleJoyPointerDown}
              onPointerMove={handleJoyPointerMove}
              onPointerUp={handleJoyPointerUp}
              onPointerCancel={handleJoyPointerUp}
              className={`pointer-events-auto fixed top-0 bottom-0 ${
                boostOnRightHalf ? 'left-0 right-1/2' : 'left-1/2 right-0'
              } touch-none z-0`}
            />
          )}

          {/* Boost Side Half-Screen Catcher: Pressing anywhere on/near the Boost side speeds up! */}
          {controlMode === 'joystick' && (
            <div
              onTouchStart={handleBoostZoneTouchStart}
              onTouchEnd={handleBoostZoneTouchEnd}
              onTouchCancel={handleBoostZoneTouchEnd}
              onPointerDown={handleBoostPointerDown}
              onPointerMove={() => {}}
              onPointerUp={handleBoostPointerUp}
              onPointerCancel={handleBoostPointerUp}
              className={`pointer-events-auto fixed top-0 bottom-0 ${
                boostOnRightHalf ? 'left-1/2 right-0' : 'left-0 right-1/2'
              } touch-none z-0`}
            />
          )}
        </>
      )}

      {/* Top-Left Live Arena Player Count Badge */}
      <div
        className={`absolute top-3.5 z-10 ${
          minimapInTopLeft ? 'left-[118px] sm:left-[136px]' : 'left-3.5'
        } flex flex-wrap items-center gap-1.5 pointer-events-none`}
      >
        <div className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900/90 border border-white/10 px-2.5 py-1.5 text-xs text-slate-200">
          <Users className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <span className="font-semibold tabular-nums">
            {t.players}: {totalPlayers}
          </span>
        </div>
      </div>

      {/* Leaderboard + Live Rank (No backdrop-blur for 60 FPS WebView stability) */}
      <div
        style={hudLayout ? toPlacementStyle(hudLayout.leaderboard) : undefined}
        className={`absolute z-10 ${
          hudLayout ? '' : 'top-3.5 right-3.5'
        } w-36 sm:w-44 rounded-xl bg-slate-950/88 border border-white/10 p-1.5 sm:p-2 shadow-lg`}
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

      {/* Stats / Score Bar (No backdrop-blur for zero GPU compositor stalls) */}
      <div
        style={hudLayout ? toPlacementStyle(hudLayout.scorebar) : undefined}
        className={`absolute z-10 ${
          hudLayout ? '' : 'bottom-3 left-1/2 -translate-x-1/2'
        } pointer-events-none whitespace-nowrap`}
      >
        <div className="flex items-center gap-3 sm:gap-4 rounded-xl bg-slate-950/88 border border-white/10 px-3.5 py-1.5 text-xs text-slate-200 shadow-md">
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

      {/* Mobile / Touch Control Visuals */}
      {showMobileControls && (
        <>
          {/* Virtual Joystick Visual (Snaps smoothly under thumb when active!) */}
          {controlMode === 'joystick' && (
            <div
              ref={joyRef}
              style={
                floatingJoyOrigin
                  ? {
                      left: `${floatingJoyOrigin.x}px`,
                      top: `${floatingJoyOrigin.y}px`,
                      transform: `translate(-50%, -50%) scale(${joyScale})`,
                    }
                  : hudLayout
                  ? toPlacementStyle(hudLayout.joystick)
                  : undefined
              }
              className={`pointer-events-none absolute z-20 ${
                floatingJoyOrigin || hudLayout
                  ? ''
                  : `bottom-6 ${isLeftHanded ? 'right-5' : 'left-5'}`
              } h-28 w-28 rounded-full border ${
                floatingJoyOrigin
                  ? 'border-cyan-300/70 bg-slate-900/75 shadow-[0_0_20px_rgba(34,211,238,0.28)]'
                  : 'border-cyan-400/30 bg-slate-900/55 shadow-lg'
              } flex items-center justify-center`}
            >
              <div
                className="h-11 w-11 rounded-full bg-cyan-400/95 shadow-md"
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
                type="button"
                onTouchStart={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onTriggerAbility();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onTriggerAbility();
                }}
                style={toPlacementStyle(hudLayout.skill)}
                className={`pointer-events-auto absolute z-20 touch-none h-16 w-16 rounded-full border flex flex-col items-center justify-center text-[11px] font-bold shadow-lg ${
                  cdReady
                    ? 'border-white/30 bg-slate-800/95 text-white active:scale-95'
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

              {/* Independently Positioned Boost Button (with generous invisible touch halo) */}
              <button
                type="button"
                onTouchStart={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleBoostZoneTouchStart(e as unknown as React.TouchEvent<HTMLDivElement>);
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleBoostZoneTouchEnd(e as unknown as React.TouchEvent<HTMLDivElement>);
                }}
                onTouchCancel={(e) => {
                  e.stopPropagation();
                  handleBoostZoneTouchEnd(e as unknown as React.TouchEvent<HTMLDivElement>);
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setIsBoostingUi(true);
                  onTouchBoost(true);
                }}
                onMouseUp={(e) => {
                  e.stopPropagation();
                  setIsBoostingUi(false);
                  onTouchBoost(false);
                }}
                onMouseLeave={() => {
                  if (isBoostingUi) {
                    setIsBoostingUi(false);
                    onTouchBoost(false);
                  }
                }}
                style={toPlacementStyle(hudLayout.boost)}
                className={`pointer-events-auto absolute z-20 touch-none h-20 w-20 rounded-full flex flex-col items-center justify-center text-xs font-bold shadow-lg transition-transform ${
                  isBoostingUi
                    ? 'bg-emerald-400 text-slate-950 scale-95 ring-4 ring-emerald-300/60'
                    : 'bg-emerald-500 text-slate-950'
                }`}
              >
                <span className="absolute -inset-6 rounded-full pointer-events-auto" />
                <Zap className="h-5 w-5 mb-0.5 relative z-10" />
                <span className="relative z-10">{t.boost}</span>
              </button>
            </>
          ) : (
            /* Default Grouped Action Buttons: Skill & Boost */
            <div
              className={`pointer-events-none absolute bottom-6 z-20 ${
                isLeftHanded ? 'left-5' : 'right-5'
              } flex items-end gap-3.5`}
            >
              <button
                type="button"
                onTouchStart={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onTriggerAbility();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onTriggerAbility();
                }}
                className={`pointer-events-auto touch-none h-16 w-16 rounded-full border flex flex-col items-center justify-center text-[11px] font-bold shadow-lg ${
                  cdReady
                    ? 'border-white/30 bg-slate-800/95 text-white active:scale-95'
                    : 'border-white/10 bg-slate-900/80 text-slate-400'
                }`}
              >
                <Sparkles className="h-4 w-4 mb-0.5" />
                <span>{cdReady ? t.skill : `${cdSec}s`}</span>
              </button>

              <button
                type="button"
                onTouchStart={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleBoostZoneTouchStart(e as unknown as React.TouchEvent<HTMLDivElement>);
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleBoostZoneTouchEnd(e as unknown as React.TouchEvent<HTMLDivElement>);
                }}
                onTouchCancel={(e) => {
                  e.stopPropagation();
                  handleBoostZoneTouchEnd(e as unknown as React.TouchEvent<HTMLDivElement>);
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setIsBoostingUi(true);
                  onTouchBoost(true);
                }}
                onMouseUp={(e) => {
                  e.stopPropagation();
                  setIsBoostingUi(false);
                  onTouchBoost(false);
                }}
                onMouseLeave={() => {
                  if (isBoostingUi) {
                    setIsBoostingUi(false);
                    onTouchBoost(false);
                  }
                }}
                className={`pointer-events-auto relative touch-none h-20 w-20 rounded-full flex flex-col items-center justify-center text-xs font-bold shadow-lg transition-transform ${
                  isBoostingUi
                    ? 'bg-emerald-400 text-slate-950 scale-95 ring-4 ring-emerald-300/60'
                    : 'bg-emerald-500 text-slate-950'
                }`}
              >
                <span className="absolute -inset-6 rounded-full pointer-events-auto" />
                <Zap className="h-5 w-5 mb-0.5 relative z-10" />
                <span className="relative z-10">{t.boost}</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

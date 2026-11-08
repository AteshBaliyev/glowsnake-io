'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GameHUD, HudState } from '@/components/GameHUD';
import { getMapSpec } from '@/data/maps';
import { ArenaRenderer } from '@/engine/renderer';
import { SimulationWorld } from '@/engine/simulation';
import { soundEngine } from '@/engine/soundEngine';
import { ServerDeathPayload } from '@/network/multiplayerClient';
import {
  PlayerProfile,
  SimulationEvent,
  WorldSnapshot,
} from '@/types/game';

interface GameCanvasProps {
  profile: PlayerProfile;
  initialScore?: number;
  onGameOver: (payload: ServerDeathPayload) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  profile,
  initialScore,
  onGameOver,
}) => {
  const profileRef = useRef<PlayerProfile>(profile);
  profileRef.current = profile;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [hud, setHud] = useState<HudState>({
    mySnake: null,
    leaderboard: [],
    myRank: 1,
    totalPlayers: 296,
    serverInstanceIndex: 1,
    fps: 60,
    pingMs: 0,
    now: Date.now(),
  });

  const inputAngleRef = useRef<number>(0);
  const touchAngleRef = useRef<number | null>(null);
  const mouseBoostRef = useRef<boolean>(false);
  const keyBoostRef = useRef<boolean>(false);
  const touchBoostRef = useRef<boolean>(false);
  const doubleTapBoostRef = useRef<boolean>(false);
  const lastTapTimeRef = useRef<number>(0);
  const pendingAbilityRef = useRef<boolean>(false);
  const keysPressedRef = useRef<Set<string>>(new Set());
  const gameOverFiredRef = useRef<boolean>(false);

  // Sync live music preference & volume changes
  useEffect(() => {
    soundEngine.configureMusic(profile.musicTrack, profile.musicVolume);
  }, [profile.musicTrack, profile.musicVolume]);

  const triggerAbility = useCallback(() => {
    pendingAbilityRef.current = true;
  }, []);

  const handleTouchSteer = useCallback((angle: number | null) => {
    touchAngleRef.current = angle;
    if (angle !== null) {
      inputAngleRef.current = angle;
    }
  }, []);

  const handleTouchBoost = useCallback((boosting: boolean) => {
    touchBoostRef.current = boosting;
    if (boosting) soundEngine.playBoostStart();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    gameOverFiredRef.current = false;
    soundEngine.unlock();
    soundEngine.configureMusic(
      profileRef.current.musicTrack,
      profileRef.current.musicVolume
    );
    soundEngine.startMusic();

    const mapSpec = getMapSpec(profile.selectedMapId);
    const renderer = new ArenaRenderer();

    const playerName = profile.nickname.trim() || 'Player';
    const snakeTypeId = profile.selectedSnakeId;
    const mapId = profile.selectedMapId;

    const processAudioEvents = (events: SimulationEvent[], selfId: string) => {
      for (const ev of events) {
        if (ev.actorId === selfId) {
          if (ev.type === 'eat_core') soundEngine.playEat('core');
          else if (ev.type === 'eat_loot') soundEngine.playEat('loot');
          else if (ev.type === 'eat_orb') soundEngine.playEat('ambient');
          else if (ev.type === 'ability_cast') soundEngine.playAbility(ev.abilityId);
          else if (ev.type === 'kill') soundEngine.playKill();
          else if (ev.type === 'death') soundEngine.playDeath();
        }
      }
    };

    const localWorld = new SimulationWorld({
      mapId,
      mode: 'offline',
    });
    const myPlayerId = `plr_${Math.random().toString(36).slice(2, 9)}`;
    const spawned = localWorld.spawnSnake({
      id: myPlayerId,
      name: playerName,
      snakeTypeId,
      isBot: false,
      initialScore: initialScore || 0,
    });
    if (initialScore && initialScore > 0) {
      spawned.shieldUntil = Date.now() + 5000;
      spawned.phaseUntil = Date.now() + 2500;
    }
    const spawnedAtMs = spawned.spawnedAt;
    inputAngleRef.current = spawned.angle;
    renderer.resetCamera(spawned.x, spawned.y);

    const updateCanvasSize = () => {
      const dpr = profileRef.current.bestGraphics
        ? Math.min(2, window.devicePixelRatio || 1)
        : 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    let activeCanvasTouchId: number | null = null;

    const updateSteerFromCoord = (clientX: number, clientY: number) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      if (Math.hypot(dx, dy) > 8) {
        inputAngleRef.current = Math.atan2(dy, dx);
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (
        touchAngleRef.current !== null &&
        profileRef.current.controlMode === 'joystick'
      )
        return;
      updateSteerFromCoord(e.clientX, e.clientY);
    };

    const onMouseDown = (e: MouseEvent) => {
      soundEngine.unlock();
      if (profileRef.current.musicTrack !== 'off') {
        soundEngine.startMusic();
      }

      if (profileRef.current.doubleTapToBoost && e.button === 0) {
        const nowTap = performance.now();
        if (nowTap - lastTapTimeRef.current < 280) {
          doubleTapBoostRef.current = !doubleTapBoostRef.current;
          if (doubleTapBoostRef.current) soundEngine.playBoostStart();
        }
        lastTapTimeRef.current = nowTap;
      }

      if (e.button === 0) {
        mouseBoostRef.current = true;
        soundEngine.playBoostStart();
      } else if (e.button === 2) {
        pendingAbilityRef.current = true;
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      soundEngine.unlock();
      if (profileRef.current.musicTrack !== 'off') {
        soundEngine.startMusic();
      }

      if (profileRef.current.controlMode !== 'joystick') {
        const touch = e.changedTouches[0];
        if (touch && activeCanvasTouchId === null) {
          activeCanvasTouchId = touch.identifier;
          updateSteerFromCoord(touch.clientX, touch.clientY);
        }
      }

      if (profileRef.current.doubleTapToBoost && e.touches.length === 1) {
        const nowTap = performance.now();
        if (nowTap - lastTapTimeRef.current < 280) {
          doubleTapBoostRef.current = !doubleTapBoostRef.current;
          if (doubleTapBoostRef.current) soundEngine.playBoostStart();
        }
        lastTapTimeRef.current = nowTap;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (profileRef.current.controlMode !== 'joystick') {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (
            touch.identifier === activeCanvasTouchId ||
            activeCanvasTouchId === null
          ) {
            activeCanvasTouchId = touch.identifier;
            updateSteerFromCoord(touch.clientX, touch.clientY);
            break;
          }
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (activeCanvasTouchId !== null) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === activeCanvasTouchId) {
            activeCanvasTouchId = null;
            break;
          }
        }
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        mouseBoostRef.current = false;
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      keysPressedRef.current.add(code);
      if (code === 'Space' || code === 'ShiftLeft' || code === 'ShiftRight') {
        if (!keyBoostRef.current) soundEngine.playBoostStart();
        keyBoostRef.current = true;
      } else if (code === 'KeyQ' || code === 'KeyE') {
        pendingAbilityRef.current = true;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      keysPressedRef.current.delete(code);
      if (code === 'Space' || code === 'ShiftLeft' || code === 'ShiftRight') {
        keyBoostRef.current = false;
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let animId = 0;
    let lastFrameMs = performance.now();
    let lastHudUpdateMs = 0;
    let framesInSec = 0;
    let fpsTimerMs = performance.now();
    let measuredFps = 60;

    let cachedPeakScore = 0;
    let cachedFinalScore = 0;
    let cachedTotalCollected = 0;
    let cachedKills = 0;
    let cachedBestRank = 999;
    let cachedFinalRank = 1;
    let cachedTotalPlayers = 296;

    const frame = (perfNow: number) => {
      const dtSec = Math.min(0.05, Math.max(0.001, (perfNow - lastFrameMs) / 1000));
      lastFrameMs = perfNow;

      framesInSec++;
      if (perfNow - fpsTimerMs >= 1000) {
        measuredFps = framesInSec;
        framesInSec = 0;
        fpsTimerMs = perfNow;
      }

      const keys = keysPressedRef.current;
      let kx = 0;
      let ky = 0;
      if (keys.has('ArrowLeft') || keys.has('KeyA')) kx -= 1;
      if (keys.has('ArrowRight') || keys.has('KeyD')) kx += 1;
      if (keys.has('ArrowUp') || keys.has('KeyW')) ky -= 1;
      if (keys.has('ArrowDown') || keys.has('KeyS')) ky += 1;
      if (kx !== 0 || ky !== 0) {
        inputAngleRef.current = Math.atan2(ky, kx);
      }

      const isBoosting =
        mouseBoostRef.current ||
        keyBoostRef.current ||
        touchBoostRef.current ||
        doubleTapBoostRef.current;
      const fireAbility = pendingAbilityRef.current;
      pendingAbilityRef.current = false;

      const meBefore = localWorld.snakes.get(myPlayerId);
      if (meBefore && meBefore.alive) {
        cachedFinalScore = Math.floor(meBefore.score);
        cachedPeakScore = Math.floor(meBefore.peakScore);
        cachedTotalCollected = Math.floor(meBefore.totalCollected);
        cachedKills = meBefore.kills;
        cachedBestRank = Math.min(cachedBestRank, meBefore.bestRank);
        cachedFinalRank = localWorld.getRankForId(myPlayerId);
        cachedTotalPlayers = Math.max(1, localWorld.getTotalActiveSnakes());
      }

      localWorld.setSnakeInput(
        myPlayerId,
        inputAngleRef.current,
        isBoosting,
        fireAbility
      );
      const nowMs = Date.now();
      localWorld.step(dtSec, nowMs);

      const meNow = localWorld.snakes.get(myPlayerId);
      const camCenter =
        meNow && meNow.alive
          ? { x: meNow.x, y: meNow.y }
          : renderer.getCameraCenter();
      const zoomEst = Math.max(0.22, renderer.getCameraZoom());
      const vHalfW = window.innerWidth / 2 / zoomEst + 360;
      const vHalfH = window.innerHeight / 2 / zoomEst + 360;

      const snapshot: WorldSnapshot = localWorld.buildSnapshot(
        nowMs,
        { x: camCenter.x, y: camCenter.y, halfW: vHalfW, halfH: vHalfH },
        true,
        myPlayerId
      );
      processAudioEvents(snapshot.events, myPlayerId);
      renderer.ingestEvents(snapshot.events, myPlayerId);

      const meAfter = localWorld.snakes.get(myPlayerId);
      if ((!meAfter || !meAfter.alive) && !gameOverFiredRef.current) {
        gameOverFiredRef.current = true;
        const durationSec = Math.max(
          1,
          Math.round((nowMs - spawnedAtMs) / 1000)
        );
        const finalRank = Math.min(
          cachedTotalPlayers,
          Math.max(1, cachedFinalRank)
        );
        const bestRank = Math.min(
          finalRank,
          meAfter ? meAfter.bestRank : cachedBestRank
        );

        onGameOver({
          finalScore: meAfter ? Math.floor(meAfter.score) : cachedFinalScore,
          peakScore: meAfter ? Math.floor(meAfter.peakScore) : cachedPeakScore,
          totalCollected: meAfter
            ? Math.floor(meAfter.totalCollected)
            : cachedTotalCollected,
          kills: meAfter ? meAfter.kills : cachedKills,
          durationSec,
          finalRank,
          bestRank: Math.max(1, bestRank),
          totalPlayers: cachedTotalPlayers,
        });
      }

      const dpr = profileRef.current.bestGraphics
        ? Math.min(2, window.devicePixelRatio || 1)
        : 1;
      const cssW = window.innerWidth;
      const cssH = window.innerHeight;
      ctx.save();
      ctx.scale(dpr, dpr);

      renderer.renderFrame(
        ctx,
        cssW,
        cssH,
        mapSpec,
        snapshot,
        myPlayerId,
        dtSec,
        {
          showPlayerNames: profileRef.current.showPlayerNames,
          fadeMyName: profileRef.current.fadeMyName,
          bestGraphics: profileRef.current.bestGraphics,
          wigglingFood: profileRef.current.wigglingFood,
          mapOnTop: profileRef.current.mapOnTop,
          lookAhead: profileRef.current.lookAhead,
          controlMode: profileRef.current.controlMode,
          minimapPlacement: profileRef.current.hudLayout?.minimap || null,
        }
      );
      ctx.restore();

      if (perfNow - lastHudUpdateMs >= 100) {
        lastHudUpdateMs = perfNow;
        const myEntity =
          snapshot.snakes.find((s) => s.id === myPlayerId) || null;
        const totalPlayers = Math.max(
          1,
          snapshot.totalPlayers || snapshot.snakes.length || 1
        );
        const myRank = snapshot.ranksById[myPlayerId] || totalPlayers;

        setHud({
          mySnake: myEntity,
          leaderboard: snapshot.leaderboard,
          myRank,
          totalPlayers,
          serverInstanceIndex: snapshot.serverInstanceIndex || 1,
          fps: measuredFps,
          pingMs: 0,
          now: snapshot.now,
        });
      }

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animId);
      soundEngine.stopMusic();
      window.removeEventListener('resize', updateCanvasSize);
      window.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    profile.selectedMapId,
    profile.selectedSnakeId,
    profile.nickname,
    initialScore,
    onGameOver,
  ]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#13161f]">
      <canvas ref={canvasRef} className="block h-full w-full cursor-crosshair" />

      <GameHUD
        language={profile.language}
        mapId={profile.selectedMapId}
        snakeTypeId={profile.selectedSnakeId}
        hud={hud}
        controlMode={profile.controlMode}
        controlHand={profile.controlHand}
        mapOnTop={profile.mapOnTop}
        hudLayout={profile.hudLayout}
        onTouchSteer={handleTouchSteer}
        onTouchBoost={handleTouchBoost}
        onTriggerAbility={triggerAbility}
      />
    </div>
  );
};

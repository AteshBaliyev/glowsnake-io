'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GameHUD, HudState } from '@/components/GameHUD';
import { UI_TEXT } from '@/data/i18n';
import { getMapSpec } from '@/data/maps';
import { ArenaRenderer } from '@/engine/renderer';
import { SimulationWorld } from '@/engine/simulation';
import { soundEngine } from '@/engine/soundEngine';
import {
  FirebaseRealtimeSync,
  MultiplayerClient,
  ServerDeathPayload,
} from '@/network/multiplayerClient';
import {
  PlayerProfile,
  SimulationEvent,
  WorldSnapshot,
} from '@/types/game';
import { AlertTriangle } from 'lucide-react';

interface GameCanvasProps {
  profile: PlayerProfile;
  onUpdateProfile: (patch: Partial<PlayerProfile>) => void;
  onGameOver: (payload: ServerDeathPayload) => void;
  onExitToMenu: () => void;
  onSwitchToOffline: () => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  profile,
  onUpdateProfile,
  onGameOver,
  onExitToMenu,
  onSwitchToOffline,
}) => {
  const profileRef = useRef<PlayerProfile>(profile);
  profileRef.current = profile;

  const t = UI_TEXT[profile.language || 'en'];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const [hud, setHud] = useState<HudState>({
    mySnake: null,
    leaderboard: [],
    myRank: 1,
    totalPlayers: profile.preferredMode === 'offline' ? 112 : 55,
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

  // Background Synth Ambient Music lifecycle
  useEffect(() => {
    soundEngine.setMusicEnabled(profile.musicEnabled);
    if (profile.musicEnabled) {
      soundEngine.startMusic();
    } else {
      soundEngine.stopMusic();
    }
    return () => {
      soundEngine.stopMusic();
    };
  }, [profile.musicEnabled]);

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
    setConnectionError(null);
    soundEngine.unlock();
    if (profile.musicEnabled) {
      soundEngine.startMusic();
    }

    const mapSpec = getMapSpec(profile.selectedMapId);
    const renderer = new ArenaRenderer();

    let localWorld: SimulationWorld | null = null;
    let mpClient: MultiplayerClient | null = null;
    let fbSync: FirebaseRealtimeSync | null = null;
    let myPlayerId = 'local_player';
    let spawnedAtMs = Date.now();

    const playerName = profile.nickname.trim() || 'Player';
    const snakeTypeId = profile.selectedSnakeId;
    const mapId = profile.selectedMapId;
    const mode = profile.preferredMode;
    const customServerUrl = profile.customServerUrl;
    const firebaseDbUrl = profile.firebaseDbUrl;

    const useFirebase = mode === 'online' && Boolean(firebaseDbUrl.trim());

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

    if (mode === 'offline' || useFirebase) {
      localWorld = new SimulationWorld({
        mapId,
        mode: useFirebase ? 'online' : 'offline',
      });
      myPlayerId = `plr_${Math.random().toString(36).slice(2, 9)}`;
      const spawned = localWorld.spawnSnake({
        id: myPlayerId,
        name: playerName,
        snakeTypeId,
        isBot: false,
        initialScore: 0,
      });
      spawnedAtMs = spawned.spawnedAt;
      inputAngleRef.current = spawned.angle;
      renderer.resetCamera(spawned.x, spawned.y);

      if (useFirebase) {
        fbSync = new FirebaseRealtimeSync(firebaseDbUrl, mapId, myPlayerId);
        fbSync.start(() => localWorld?.snakes.get(myPlayerId));
      }
    } else {
      mpClient = new MultiplayerClient();
      mpClient.connectLobby(customServerUrl, {
        onStatus: (connected, err) => {
          if (!connected && err) {
            setConnectionError(err);
          } else if (connected) {
            setConnectionError(null);
          }
        },
      });

      mpClient.joinMatch(
        { name: playerName, snakeTypeId, mapId },
        {
          onDeath: (payload) => {
            if (gameOverFiredRef.current) return;
            gameOverFiredRef.current = true;
            soundEngine.playDeath();
            onGameOver(payload);
          },
          onEvents: (snap) => {
            if (mpClient) {
              processAudioEvents(snap.events, mpClient.playerId);
              renderer.ingestEvents(snap.events, mpClient.playerId);
            }
          },
        }
      );
    }

    const updateCanvasSize = () => {
      const dpr = profileRef.current.bestGraphics
        ? Math.min(2, window.devicePixelRatio || 1)
        : 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    const onMouseMove = (e: MouseEvent) => {
      if (touchAngleRef.current !== null && profileRef.current.controlMode === 'joystick') return;
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      if (Math.hypot(dx, dy) > 8) {
        inputAngleRef.current = Math.atan2(dy, dx);
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      soundEngine.unlock();
      if (profileRef.current.musicEnabled) {
        soundEngine.startMusic();
      }

      // Double click / tap to boost
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
      if (profileRef.current.musicEnabled) {
        soundEngine.startMusic();
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
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let animId = 0;
    let lastFrameMs = performance.now();
    let lastHudUpdateMs = 0;
    let lastNetInputMs = 0;
    let framesInSec = 0;
    let fpsTimerMs = performance.now();
    let measuredFps = 60;

    let cachedPeakScore = 0;
    let cachedFinalScore = 0;
    let cachedTotalCollected = 0;
    let cachedKills = 0;
    let cachedBestRank = 999;
    let cachedFinalRank = 1;
    let cachedTotalPlayers = 100;

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

      let snapshot: WorldSnapshot | null = null;
      let activeSelfId = myPlayerId;

      if (localWorld) {
        if (fbSync) {
          const remoteList = fbSync.getRemoteSnakes();
          const remoteIds = new Set(remoteList.map((r) => r.id));
          for (const [id, s] of localWorld.snakes.entries()) {
            if (!s.isBot && id !== myPlayerId && !remoteIds.has(id)) {
              localWorld.snakes.delete(id);
            }
          }
          for (const rem of remoteList) {
            localWorld.snakes.set(rem.id, { ...rem, isBot: false });
          }
        }

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

        snapshot = localWorld.buildSnapshot(nowMs);
        processAudioEvents(snapshot.events, myPlayerId);
        renderer.ingestEvents(snapshot.events, myPlayerId);

        const meAfter = localWorld.snakes.get(myPlayerId);
        if ((!meAfter || !meAfter.alive) && !gameOverFiredRef.current) {
          gameOverFiredRef.current = true;
          const durationSec = Math.max(
            1,
            Math.round((nowMs - spawnedAtMs) / 1000)
          );
          const finalRank = Math.min(cachedTotalPlayers, Math.max(1, cachedFinalRank));
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
      } else if (mpClient) {
        activeSelfId = mpClient.playerId;
        if (fireAbility || perfNow - lastNetInputMs >= 42) {
          lastNetInputMs = perfNow;
          mpClient.sendInput(inputAngleRef.current, isBoosting, fireAbility);
        }
        snapshot = mpClient.getInterpolatedSnapshot(dtSec);
      }

      const dpr = profile.bestGraphics
        ? Math.min(2, window.devicePixelRatio || 1)
        : 1;
      const cssW = window.innerWidth;
      const cssH = window.innerHeight;
      ctx.save();
      ctx.scale(dpr, dpr);

      if (snapshot) {
        renderer.renderFrame(
          ctx,
          cssW,
          cssH,
          mapSpec,
          snapshot,
          activeSelfId,
          dtSec,
          {
            showPlayerNames: profileRef.current.showPlayerNames,
            fadeMyName: profileRef.current.fadeMyName,
            bestGraphics: profileRef.current.bestGraphics,
            wigglingFood: profileRef.current.wigglingFood,
            mapOnTop: profileRef.current.mapOnTop,
            lookAhead: profileRef.current.lookAhead,
          }
        );
      } else {
        ctx.fillStyle = mapSpec.bgColor;
        ctx.fillRect(0, 0, cssW, cssH);
      }
      ctx.restore();

      if (snapshot && perfNow - lastHudUpdateMs >= 100) {
        lastHudUpdateMs = perfNow;
        const myEntity =
          snapshot.snakes.find((s) => s.id === activeSelfId) || null;
        const totalPlayers = Math.max(
          1,
          snapshot.totalPlayers || snapshot.snakes.length || 1
        );
        const myRank = snapshot.ranksById[activeSelfId] || totalPlayers;

        setHud({
          mySnake: myEntity,
          leaderboard: snapshot.leaderboard,
          myRank,
          totalPlayers,
          serverInstanceIndex: snapshot.serverInstanceIndex || 1,
          fps: measuredFps,
          pingMs: mpClient ? mpClient.pingMs : 0,
          now: snapshot.now,
        });
      }

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', updateCanvasSize);
      window.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      mpClient?.leaveMatch();
      mpClient?.disconnect();
      fbSync?.stop();
    };
  }, [
    profile.preferredMode,
    profile.selectedMapId,
    profile.selectedSnakeId,
    profile.nickname,
    profile.customServerUrl,
    profile.firebaseDbUrl,
    onGameOver,
  ]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#13161f]">
      <canvas ref={canvasRef} className="block h-full w-full cursor-crosshair" />

      {connectionError && profile.preferredMode === 'online' && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-xl border border-white/15 bg-slate-900/95 px-4 py-2.5 text-xs text-slate-200">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
          <span>{t.connectionFailed}</span>
          <button
            onClick={onSwitchToOffline}
            className="rounded-lg bg-emerald-500 px-3 py-1 font-bold text-slate-950 hover:bg-emerald-400 transition cursor-pointer shrink-0"
          >
            {t.switchOffline}
          </button>
        </div>
      )}

      <GameHUD
        language={profile.language}
        mode={profile.preferredMode}
        mapId={profile.selectedMapId}
        snakeTypeId={profile.selectedSnakeId}
        hud={hud}
        soundEnabled={profile.soundEnabled}
        musicEnabled={profile.musicEnabled}
        controlMode={profile.controlMode}
        controlHand={profile.controlHand}
        mapOnTop={profile.mapOnTop}
        onToggleSound={() => {
          const next = !profile.soundEnabled;
          soundEngine.setEnabled(next);
          if (next) soundEngine.playClick();
          onUpdateProfile({ soundEnabled: next });
        }}
        onToggleMusic={() => {
          const next = !profile.musicEnabled;
          soundEngine.setMusicEnabled(next);
          soundEngine.playClick();
          onUpdateProfile({ musicEnabled: next });
        }}
        onLeave={onExitToMenu}
        onTouchSteer={handleTouchSteer}
        onTouchBoost={handleTouchBoost}
        onTriggerAbility={triggerAbility}
      />
    </div>
  );
};

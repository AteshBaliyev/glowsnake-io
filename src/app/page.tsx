'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GameCanvas } from '@/components/GameCanvas';
import { GameOverModal } from '@/components/GameOverModal';
import { StartMenu } from '@/components/StartMenu';
import { soundEngine } from '@/engine/soundEngine';
import {
  applyMatchOutcome,
  DEFAULT_PROFILE,
  loadProfile,
  saveProfile,
} from '@/engine/storage';
import { ServerDeathPayload } from '@/network/multiplayerClient';
import { MatchResultSummary, PlayerProfile } from '@/types/game';

export default function HomePage() {
  const [profile, setProfile] = useState<PlayerProfile>(DEFAULT_PROFILE);
  const profileRef = useRef<PlayerProfile>(DEFAULT_PROFILE);
  const [hydrated, setHydrated] = useState(false);
  const [screen, setScreen] = useState<'menu' | 'playing' | 'gameover'>('menu');
  const [matchSummary, setMatchSummary] = useState<MatchResultSummary | null>(
    null
  );
  const [matchKey, setMatchKey] = useState(1);
  const [reviveScore, setReviveScore] = useState<number>(0);

  useEffect(() => {
    const loaded = loadProfile();
    profileRef.current = loaded;
    setProfile(loaded);
    soundEngine.setEnabled(loaded.soundEnabled);
    setHydrated(true);
  }, []);

  const handleUpdateProfile = useCallback((patch: Partial<PlayerProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      profileRef.current = next;
      saveProfile(next);
      return next;
    });
  }, []);

  const handleStartGame = useCallback(() => {
    setReviveScore(0);
    setMatchSummary(null);
    setMatchKey((k) => k + 1);
    setScreen('playing');
  }, []);

  const handleRevive = useCallback(() => {
    if (!matchSummary) return;
    setReviveScore(matchSummary.finalScore);
    setMatchSummary(null);
    setMatchKey((k) => k + 1);
    setScreen('playing');
  }, [matchSummary]);

  const handleGameOver = useCallback((payload: ServerDeathPayload) => {
    const curr = profileRef.current;
    const { updatedProfile, fullSummary } = applyMatchOutcome(curr, {
      playerName: curr.nickname.trim() || 'Player',
      snakeTypeId: curr.selectedSnakeId,
      mapId: curr.selectedMapId,
      mode: curr.preferredMode,
      finalScore: payload.finalScore,
      peakScore: payload.peakScore,
      totalCollected: payload.totalCollected,
      kills: payload.kills,
      durationSec: payload.durationSec,
      finalRank: payload.finalRank,
      bestRank: payload.bestRank,
      totalPlayers: payload.totalPlayers,
    });
    profileRef.current = updatedProfile;
    setProfile(updatedProfile);
    setMatchSummary(fullSummary);
    setScreen('gameover');
  }, []);

  const handleToggleSound = useCallback(() => {
    setProfile((prev) => {
      const nextVal = !prev.soundEnabled;
      soundEngine.setEnabled(nextVal);
      const next = { ...prev, soundEnabled: nextVal };
      profileRef.current = next;
      saveProfile(next);
      return next;
    });
  }, []);

  const handleBackToMenu = useCallback(() => {
    soundEngine.playClick();
    setMatchSummary(null);
    setScreen('menu');
  }, []);

  const handleSwitchToOffline = useCallback(() => {
    handleUpdateProfile({ preferredMode: 'offline' });
    setMatchKey((k) => k + 1);
  }, [handleUpdateProfile]);

  if (!hydrated) {
    return <div className="min-h-screen bg-[#13161f]" />;
  }

  if (screen === 'menu') {
    return (
      <StartMenu
        profile={profile}
        onUpdateProfile={handleUpdateProfile}
        onStartGame={handleStartGame}
      />
    );
  }

  if (screen === 'gameover' && matchSummary) {
    return (
      <GameOverModal
        summary={matchSummary}
        language={profile.language}
        onPlayAgain={handleStartGame}
        onRevive={handleRevive}
        onMainMenu={handleBackToMenu}
      />
    );
  }

  return (
    <GameCanvas
      key={matchKey}
      profile={profile}
      initialScore={reviveScore}
      onUpdateProfile={handleUpdateProfile}
      onGameOver={handleGameOver}
      onExitToMenu={handleBackToMenu}
      onSwitchToOffline={handleSwitchToOffline}
    />
  );
}

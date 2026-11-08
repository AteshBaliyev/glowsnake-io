import {
  ControlHand,
  HudCustomLayout,
  MatchResultSummary,
  MusicTrackPreference,
  PlayerProfile,
  SnakeTypeSpec,
} from '@/types/game';

const STORAGE_KEY = 'glowsnake_io_profile_v4';
export const MAX_PLAYER_LEVEL = 100;

export const DEFAULT_PRODUCTION_SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL || 'https://vps-2613da52.vps.rcld.dev';

export function getDefaultHudLayout(
  controlHand: ControlHand = 'right',
  mapOnTop = true
): HudCustomLayout {
  const isLeft = controlHand === 'left';
  return {
    joystick: {
      xPct: isLeft ? 88 : 12,
      yPct: 78,
      scale: 1.0,
      opacity: 0.9,
    },
    skill: {
      xPct: isLeft ? 22 : 78,
      yPct: 83,
      scale: 1.0,
      opacity: 0.95,
    },
    boost: {
      xPct: isLeft ? 10 : 90,
      yPct: 80,
      scale: 1.0,
      opacity: 0.95,
    },
    minimap: {
      xPct: 9,
      yPct: mapOnTop ? 18 : 82,
      scale: 1.0,
      opacity: 0.85,
    },
    leaderboard: {
      xPct: 89,
      yPct: 22,
      scale: 1.0,
      opacity: 0.85,
    },
    scorebar: {
      xPct: 50,
      yPct: 93,
      scale: 1.0,
      opacity: 0.9,
    },
  };
}

export const DEFAULT_PROFILE: PlayerProfile = {
  nickname: '',
  language: 'en',
  selectedSnakeId: 'swift-viper',
  selectedMapId: 'cyberpunk-city',
  preferredMode: 'offline',
  customServerUrl: DEFAULT_PRODUCTION_SERVER_URL,
  firebaseDbUrl: '',
  controlMode: 'arrow',
  controlHand: 'right',
  autoRotate: true,
  showPlayerNames: true,
  fadeMyName: true,
  bestGraphics: true,
  wigglingFood: true,
  mapOnTop: true,
  doubleTapToBoost: true,
  lookAhead: false,
  musicEnabled: true,
  musicTrack: 'auto',
  musicVolume: 0.7,
  soundEnabled: true,
  hudLayout: null,
  highScore: 0,
  lastScore: 0,
  totalXp: 0,
  totalKills: 0,
  totalTimePlayedSec: 0,
  gamesPlayed: 0,
  unlockedAchievements: [],
  unseenAchievements: [],
  unlockedSnakeIds: [],
  lastFreeSpinDate: '',
  totalWheelSpins: 0,
};

export function getTodayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function canSpinFreeToday(profile: PlayerProfile): boolean {
  return profile.lastFreeSpinDate !== getTodayDateKey();
}

/**
 * Smooth XP curve for Levels 1 -> 100:
 * Lvl 1: 0 XP
 * Lvl 2: 100 XP
 * Lvl 10: 1,908 XP
 * Lvl 25: 10,464 XP
 * Lvl 50: 38,514 XP
 * Lvl 100: 147,114 XP
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  const n = level - 1;
  return n * 100 + n * (n - 1) * 14;
}

export function getLevelInfo(totalXp: number): {
  level: number;
  currentLevelXp: number;
  neededForNext: number;
  progress: number;
} {
  const safeXp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  while (level < MAX_PLAYER_LEVEL && safeXp >= xpForLevel(level + 1)) {
    level++;
  }
  if (level >= MAX_PLAYER_LEVEL) {
    const startXp = xpForLevel(MAX_PLAYER_LEVEL);
    return {
      level: MAX_PLAYER_LEVEL,
      currentLevelXp: safeXp - startXp,
      neededForNext: 5000,
      progress: 1,
    };
  }
  const startXp = xpForLevel(level);
  const nextXp = xpForLevel(level + 1);
  const span = Math.max(1, nextXp - startXp);
  const currentLevelXp = safeXp - startXp;
  return {
    level,
    currentLevelXp,
    neededForNext: span,
    progress: Math.min(1, Math.max(0, currentLevelXp / span)),
  };
}

// Precomputed normalized global player distribution across Levels 1..100
const LEVEL_DISTRIBUTION_WEIGHTS: number[] = (() => {
  const raw: number[] = [];
  let sum = 0;
  for (let lvl = 1; lvl <= MAX_PLAYER_LEVEL; lvl++) {
    // Realistic pyramid curve: abundant early players, rare elite veterans at 80-100
    const w = Math.exp(-0.058 * (lvl - 1)) * Math.pow(lvl, -0.32);
    raw.push(w);
    sum += w;
  }
  return raw.map((w) => (w / sum) * 100);
})();

export function getLevelPlayerShare(level: number): string {
  const idx = Math.max(1, Math.min(MAX_PLAYER_LEVEL, Math.floor(level))) - 1;
  const pct = LEVEL_DISTRIBUTION_WEIGHTS[idx];
  if (pct >= 1) return pct.toFixed(1);
  if (pct >= 0.1) return pct.toFixed(2);
  return Math.max(0.01, pct).toFixed(2);
}

export function getTopPlayersPercentile(level: number): string {
  const clamped = Math.max(1, Math.min(MAX_PLAYER_LEVEL, Math.floor(level)));
  if (clamped <= 1) return '100';
  let cumulativeAboveOrEqual = 0;
  for (let i = clamped - 1; i < MAX_PLAYER_LEVEL; i++) {
    cumulativeAboveOrEqual += LEVEL_DISTRIBUTION_WEIGHTS[i];
  }
  if (cumulativeAboveOrEqual >= 10) return cumulativeAboveOrEqual.toFixed(1);
  if (cumulativeAboveOrEqual >= 1) return cumulativeAboveOrEqual.toFixed(2);
  return Math.max(0.02, cumulativeAboveOrEqual).toFixed(2);
}

export function isSnakeUnlocked(profile: PlayerProfile, snake: SnakeTypeSpec): boolean {
  if (Array.isArray(profile.unlockedSnakeIds) && profile.unlockedSnakeIds.includes(snake.id)) {
    return true;
  }
  const { level } = getLevelInfo(profile.totalXp);
  return level >= snake.requiredLevel;
}

export function loadProfile(): PlayerProfile {
  if (typeof window === 'undefined') return { ...DEFAULT_PROFILE };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    const validTracks: MusicTrackPreference[] = ['auto', 'track1', 'track2', 'off'];
    const resolvedTrack: MusicTrackPreference =
      parsed.musicTrack && validTracks.includes(parsed.musicTrack)
        ? parsed.musicTrack
        : parsed.musicEnabled === false
        ? 'off'
        : 'auto';
    const resolvedVol =
      typeof parsed.musicVolume === 'number'
        ? Math.max(0, Math.min(1, parsed.musicVolume))
        : 0.7;

    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      musicTrack: resolvedTrack,
      musicVolume: resolvedVol,
      musicEnabled: resolvedTrack !== 'off' && resolvedVol > 0,
      hudLayout:
        parsed.hudLayout && typeof parsed.hudLayout === 'object'
          ? parsed.hudLayout
          : null,
      customServerUrl:
        parsed.customServerUrl && parsed.customServerUrl.trim() !== ''
          ? parsed.customServerUrl
          : DEFAULT_PRODUCTION_SERVER_URL,
      unlockedAchievements: Array.isArray(parsed.unlockedAchievements)
        ? parsed.unlockedAchievements
        : [],
      unseenAchievements: Array.isArray(parsed.unseenAchievements)
        ? parsed.unseenAchievements
        : [],
      unlockedSnakeIds: Array.isArray(parsed.unlockedSnakeIds)
        ? parsed.unlockedSnakeIds
        : [],
      lastFreeSpinDate:
        typeof parsed.lastFreeSpinDate === 'string' ? parsed.lastFreeSpinDate : '',
      totalWheelSpins:
        typeof parsed.totalWheelSpins === 'number' ? parsed.totalWheelSpins : 0,
    };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function saveProfile(profile: PlayerProfile): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearUnseenAchievements(profile: PlayerProfile): PlayerProfile {
  if (profile.unseenAchievements.length === 0) return profile;
  const updated: PlayerProfile = {
    ...profile,
    unseenAchievements: [],
  };
  saveProfile(updated);
  return updated;
}

export function applyMatchOutcome(
  profile: PlayerProfile,
  input: Omit<
    MatchResultSummary,
    'xpEarned' | 'oldLevel' | 'newLevel' | 'newlyUnlockedAchievements' | 'isNewHighScore'
  >
): { updatedProfile: PlayerProfile; fullSummary: MatchResultSummary } {
  const oldLevel = getLevelInfo(profile.totalXp).level;
  const bestRunScore = Math.max(0, Math.floor(Math.max(input.finalScore, input.peakScore)));
  const isNewHighScore = bestRunScore > profile.highScore && bestRunScore > 0;

  const rawXp =
    Math.floor(bestRunScore * 0.42) +
    input.kills * 20 +
    Math.floor(input.durationSec / 30) * 5;
  const xpEarned = Math.max(6, Math.floor(rawXp));

  const nextTotalXp = profile.totalXp + xpEarned;
  const newLevel = getLevelInfo(nextTotalXp).level;
  const nextTotalKills = profile.totalKills + input.kills;

  const unlockedSet = new Set(profile.unlockedAchievements);
  const newlyUnlocked: string[] = [];

  const grant = (id: string, cond: boolean) => {
    if (cond && !unlockedSet.has(id)) {
      unlockedSet.add(id);
      newlyUnlocked.push(id);
    }
  };

  grant('first_blood', input.kills >= 1);
  grant('score_300', bestRunScore >= 300 || input.totalCollected >= 300);
  grant('score_1000', bestRunScore >= 1000 || input.totalCollected >= 1000);
  grant('score_3000', bestRunScore >= 3000 || input.totalCollected >= 3000);
  grant('top_3', input.bestRank >= 1 && input.bestRank <= 3);
  grant('rank_1', input.bestRank === 1);
  grant('slayer_5', input.kills >= 5);
  grant('slayer_15', input.kills >= 15);
  grant('survivor_3m', input.durationSec >= 180);
  grant('level_10', newLevel >= 10);
  grant('level_21', newLevel >= 21);
  grant('veteran_25_kills', nextTotalKills >= 25);

  const updatedProfile: PlayerProfile = {
    ...profile,
    highScore: Math.max(profile.highScore, bestRunScore),
    lastScore: Math.floor(Math.max(0, input.finalScore)),
    totalXp: nextTotalXp,
    totalKills: nextTotalKills,
    totalTimePlayedSec: profile.totalTimePlayedSec + input.durationSec,
    gamesPlayed: profile.gamesPlayed + 1,
    unlockedAchievements: Array.from(unlockedSet),
    unseenAchievements: Array.from(
      new Set([...profile.unseenAchievements, ...newlyUnlocked])
    ),
  };

  saveProfile(updatedProfile);

  const fullSummary: MatchResultSummary = {
    ...input,
    xpEarned,
    oldLevel,
    newLevel,
    newlyUnlockedAchievements: newlyUnlocked,
    isNewHighScore,
  };

  return { updatedProfile, fullSummary };
}

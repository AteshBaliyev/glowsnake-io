import { MatchResultSummary, PlayerProfile, SnakeTypeSpec } from '@/types/game';

const STORAGE_KEY = 'glowsnake_io_profile_v4';

export const DEFAULT_PROFILE: PlayerProfile = {
  nickname: '',
  language: 'en', // Default language is English
  selectedSnakeId: 'swift-viper',
  selectedMapId: 'cyberpunk-city',
  preferredMode: 'offline',
  customServerUrl: '',
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
  soundEnabled: true,
  highScore: 0,
  lastScore: 0,
  totalXp: 0,
  totalKills: 0,
  totalTimePlayedSec: 0,
  gamesPlayed: 0,
  unlockedAchievements: [],
  unseenAchievements: [],
};

/**
 * Smooth XP curve for Levels 1 -> 35+:
 * Lvl 1: 0 XP
 * Lvl 2: 75 XP
 * Lvl 5: 420 XP
 * Lvl 10: 1,440 XP
 * Lvl 20: 5,130 XP
 * Lvl 35: 14,960 XP
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  const n = level - 1;
  return n * 75 + n * (n - 1) * 12;
}

export function getLevelInfo(totalXp: number): {
  level: number;
  currentLevelXp: number;
  neededForNext: number;
  progress: number;
} {
  const safeXp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  while (level < 60 && safeXp >= xpForLevel(level + 1)) {
    level++;
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

export function isSnakeUnlocked(profile: PlayerProfile, snake: SnakeTypeSpec): boolean {
  const { level } = getLevelInfo(profile.totalXp);
  return level >= snake.requiredLevel;
}

export function loadProfile(): PlayerProfile {
  if (typeof window === 'undefined') return { ...DEFAULT_PROFILE };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      unlockedAchievements: Array.isArray(parsed.unlockedAchievements)
        ? parsed.unlockedAchievements
        : [],
      unseenAchievements: Array.isArray(parsed.unseenAchievements)
        ? parsed.unseenAchievements
        : [],
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

  // Reward XP for score, kills, and survival minutes
  const xpEarned = Math.max(
    12,
    Math.floor(bestRunScore * 0.85) + input.kills * 40 + Math.floor(input.durationSec / 20) * 10
  );

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

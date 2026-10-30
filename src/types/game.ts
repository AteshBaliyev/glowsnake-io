export type GameMode = 'offline' | 'online';

export type LanguageCode = 'en' | 'az' | 'tr' | 'ru';

export type RarityTier =
  | 'common'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'mythic'
  | 'divine';

export type BotSkillTier = 'weak' | 'normal' | 'strong' | 'titan';

export type AbilityId =
  // Common (1-6)
  | 'quick_dash'
  | 'venom_trail'
  | 'food_magnet'
  | 'armor_shield'
  | 'score_boost_15'
  | 'frost_chill'
  // Rare (7-13)
  | 'ghost_phase'
  | 'ember_trail'
  | 'time_shift'
  | 'forward_blink'
  | 'score_drain'
  | 'shock_push'
  | 'eagle_vision'
  // Epic (14-20)
  | 'decoy_clone'
  | 'gravity_vortex'
  | 'slice_wave'
  | 'bio_regen'
  | 'star_harvest'
  | 'sticky_trap'
  | 'thorn_reflect'
  // Legendary (21-26)
  | 'sunflare_nova'
  | 'abyssal_whirlpool'
  | 'valkyrie_charge'
  | 'crimson_eclipse'
  | 'twin_mirage'
  | 'chain_lightning'
  // Mythic (27-31)
  | 'aurora_wake'
  | 'dragon_flight'
  | 'chronos_stop'
  | 'soul_scythe'
  | 'phoenix_rebirth'
  // Divine (32-35)
  | 'supernova_collapse'
  | 'seraph_grace'
  | 'chimera_barrage'
  | 'sovereign_dominion';

export type MapId =
  | 'cyberpunk-city'
  | 'neon-space'
  | 'dark-forest'
  | 'lava-arena'
  | 'cryo-matrix';

export type LocalizedText = Record<LanguageCode, string>;

export interface SnakeAbilitySpec {
  id: AbilityId;
  name: LocalizedText;
  description: LocalizedText;
  cooldownSec: number;
  durationSec: number;
  badgeColor: string;
}

export interface SnakeTypeSpec {
  id: string;
  index: number;
  requiredLevel: number;
  rarity: RarityTier;
  name: string;
  subtitle: LocalizedText;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  trimColor: string;
  eyeColor: string;
  speedStat: number;
  turnStat: number;
  controlStat: number;
  ability: SnakeAbilitySpec;
}

export interface ArenaMapSpec {
  id: MapId;
  name: LocalizedText;
  offlineHalfSize: number; // Sized for 80-150 snakes without crowding
  onlineHalfSize: number;  // Sized for 50-60 snakes without crowding
  bgColor: string;
  gridColor: string;
  borderColor: string;
  orbPalette: string[];
}

export type OrbKind = 'ambient' | 'loot' | 'core' | 'star';

export interface Orb {
  id: string;
  x: number;
  y: number;
  value: number;
  color: string;
  radius: number;
  kind: OrbKind;
}

export type HazardKind =
  | 'venom_pool'
  | 'fireball'
  | 'vortex'
  | 'acid_web'
  | 'laser_wave'
  | 'aurora_pool';

export interface HazardZone {
  id: string;
  ownerId: string;
  kind: HazardKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  createdAt: number;
  expiresAt: number;
  color: string;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface SnakeEntity {
  id: string;
  name: string;
  snakeTypeId: string;
  isBot: boolean;
  botTier?: BotSkillTier;
  isDecoy?: boolean;
  ownerId?: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  targetAngle: number;
  speed: number;
  radius: number;
  score: number;
  peakScore: number;
  totalCollected: number;
  kills: number;
  bestRank: number;
  spawnedAt: number;
  isBoosting: boolean;
  segments: Point2D[];
  abilityCooldownUntil: number;
  abilityActiveUntil: number;
  activeEffect: AbilityId | null;
  slowedUntil: number;
  webbedUntil: number;
  stealthUntil: number;
  doubleScoreUntil: number;
  magnetUntil: number;
  shieldUntil: number;
  phaseUntil: number;
  freeBoostUntil: number;
  wideViewUntil: number;
  alive: boolean;
}

export interface SimulationEvent {
  type:
    | 'eat_orb'
    | 'eat_loot'
    | 'eat_core'
    | 'ability_cast'
    | 'kill'
    | 'death';
  actorId?: string;
  targetId?: string;
  abilityId?: AbilityId;
  x: number;
  y: number;
  value?: number;
  color?: string;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  kills: number;
  snakeTypeId: string;
}

export interface MinimapDot {
  id: string;
  x: number;
  y: number;
  isLeader?: boolean;
}

export interface WorldSnapshot {
  now: number;
  mapId: MapId;
  worldHalfSize: number;
  totalPlayers: number;
  serverInstanceIndex: number;
  snakes: SnakeEntity[];
  orbs: Orb[];
  hazards: HazardZone[];
  leaderboard: LeaderboardEntry[];
  ranksById: Record<string, number>;
  minimapDots: MinimapDot[];
  events: SimulationEvent[];
}

export interface MatchResultSummary {
  playerName: string;
  snakeTypeId: string;
  mapId: MapId;
  mode: GameMode;
  finalScore: number;
  peakScore: number;
  totalCollected: number;
  kills: number;
  durationSec: number;
  finalRank: number;
  bestRank: number;
  totalPlayers: number;
  xpEarned: number;
  oldLevel: number;
  newLevel: number;
  newlyUnlockedAchievements: string[];
  isNewHighScore: boolean;
}

export type ControlMode = 'arrow' | 'classic' | 'joystick';
export type ControlHand = 'right' | 'left';

export interface PlayerSettings {
  controlMode: ControlMode;
  controlHand: ControlHand;
  autoRotate: boolean;
  showPlayerNames: boolean;
  fadeMyName: boolean;
  bestGraphics: boolean;
  wigglingFood: boolean;
  mapOnTop: boolean;
  doubleTapToBoost: boolean;
  lookAhead: boolean;
  musicEnabled: boolean;
  soundEnabled: boolean;
}

export interface PlayerProfile extends PlayerSettings {
  nickname: string;
  language: LanguageCode; // Default: 'en'
  selectedSnakeId: string;
  selectedMapId: MapId;
  preferredMode: GameMode;
  customServerUrl: string;
  firebaseDbUrl: string;
  highScore: number;
  lastScore: number;
  totalXp: number;
  totalKills: number;
  totalTimePlayedSec: number;
  gamesPlayed: number;
  unlockedAchievements: string[];
  unseenAchievements: string[];
}

export interface RoomSummary {
  mapId: MapId;
  activePlayers: number; // Seamless total players across instances
  instanceCount: number;
}

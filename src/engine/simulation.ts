import {
  INTERNATIONAL_ONLINE_NAMES,
  PLAYER_LIKE_NAMES,
} from '@/data/achievements';
import { ARENA_MAPS, getMapSpec } from '@/data/maps';
import { getSnakeSpec, SNAKE_TYPES } from '@/data/snakes';
import {
  ArenaMapSpec,
  BotSkillTier,
  GameMode,
  HazardZone,
  LeaderboardEntry,
  MapId,
  MinimapDot,
  Orb,
  OrbKind,
  SimulationEvent,
  SnakeEntity,
  WorldSnapshot,
} from '@/types/game';

const BASE_SEGMENTS = 14;
const MAX_SEGMENTS = 235;
const BASE_RADIUS = 13;
const BASE_SPEED = 212; // +10% increased default snake speed
const BOOST_MULTIPLIER = 1.66;

const UNIFIED_BOT_NAMES: string[] = Array.from(
  new Set([...INTERNATIONAL_ONLINE_NAMES, ...PLAYER_LIKE_NAMES])
);

const CELL_SIZE = 440;

function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function shortestAngleDiff(from: number, to: number): number {
  return normalizeAngle(to - from);
}

function distSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function distToSegmentSq(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return distSq(px, py, x1, y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return distSq(px, py, projX, projY);
}

function cellKey(cx: number, cy: number): number {
  // Collision-free integer spatial hash key (supports coordinates up to +-850,000px)
  return (cx + 2048) * 4096 + (cy + 2048);
}

export interface SimulationConfig {
  mapId: MapId;
  mode: GameMode;
  targetTotalPopulation?: number; // ~300 snakes in massive 3x arena
  serverInstanceIndex?: number;
}

interface SegRef {
  snake: SnakeEntity;
  x: number;
  y: number;
  isHead: boolean;
  segIndex: number;
}

export class SimulationWorld {
  public map: ArenaMapSpec;
  public mode: GameMode;
  public worldHalfSize: number;
  public serverInstanceIndex: number;

  public snakes: Map<string, SnakeEntity> = new Map();
  public orbs: Map<string, Orb> = new Map();
  public hazards: Map<string, HazardZone> = new Map();
  public pendingEvents: SimulationEvent[] = [];

  private targetPopulation: number;
  private maxAmbientOrbs: number;
  private maxCores: number;
  private maxLootOrbs: number;

  private ambientOrbCount = 0;
  private coreOrbCount = 0;
  private lootOrbCount = 0;

  private orbGrid: Map<number, Orb[]> = new Map();
  private orbCellKeys: Map<string, number> = new Map();
  private segGrid: Map<number, SegRef[]> = new Map();
  private nonEmptySegBuckets: SegRef[][] = [];

  private cachedRanks: Record<string, number> = {};
  private cachedLeaderboard: LeaderboardEntry[] = [];
  private cachedMinimapDots: MinimapDot[] = [];
  private cachedTotalPlayers = 0;

  private idCounter = 1;
  private lastMaintainAt = 0;
  private lastRankSortAt = 0;
  private stepCounter = 0;
  private boostDrainAccum: Map<string, number> = new Map();
  private trailSpawnAccum: Map<string, number> = new Map();
  private passiveScoreAccum: Map<string, number> = new Map();
  private botNextDecisionAt: Map<string, number> = new Map();
  private botGreedMode: Map<string, boolean> = new Map();

  constructor(config: SimulationConfig) {
    this.map = getMapSpec(config.mapId);
    this.mode = config.mode;
    this.serverInstanceIndex = config.serverInstanceIndex ?? 1;

    if (config.mode === 'offline') {
      this.worldHalfSize = this.map.offlineHalfSize;
      // ~300 active snakes across the 3x giant arena
      this.targetPopulation =
        config.targetTotalPopulation ?? Math.floor(290 + Math.random() * 16);
      this.maxAmbientOrbs = 12500; // Optimized high-density ambient food without mobile GC stutter
      this.maxCores = 280;
      this.maxLootOrbs = 4500;
    } else {
      this.worldHalfSize = this.map.onlineHalfSize;
      // ~300 active global snakes in Online arena
      this.targetPopulation =
        config.targetTotalPopulation ?? Math.floor(288 + Math.random() * 18);
      this.maxAmbientOrbs = 12000;
      this.maxCores = 260;
      this.maxLootOrbs = 4500;
    }

    this.seedInitialOrbs();
    this.rebuildSegmentGrid();
    this.maintainPopulation(Date.now(), true);
    this.recomputeRanks(Date.now());
  }

  private nextId(prefix: string): string {
    this.idCounter += 1;
    return `${prefix}_${this.idCounter.toString(36)}`;
  }

  // ==================== O(1) INCREMENTAL ORB SPATIAL GRID ====================
  private registerOrb(orb: Orb): void {
    this.orbs.set(orb.id, orb);
    if (orb.kind === 'ambient') this.ambientOrbCount++;
    else if (orb.kind === 'core') this.coreOrbCount++;
    else if (orb.kind === 'loot') this.lootOrbCount++;

    const cx = Math.floor(orb.x / CELL_SIZE);
    const cy = Math.floor(orb.y / CELL_SIZE);
    const key = cellKey(cx, cy);
    this.orbCellKeys.set(orb.id, key);
    let bucket = this.orbGrid.get(key);
    if (!bucket) {
      bucket = [];
      this.orbGrid.set(key, bucket);
    }
    bucket.push(orb);
  }

  private unregisterOrb(id: string): void {
    const orb = this.orbs.get(id);
    if (!orb) return;
    this.orbs.delete(id);

    if (orb.kind === 'ambient') this.ambientOrbCount = Math.max(0, this.ambientOrbCount - 1);
    else if (orb.kind === 'core') this.coreOrbCount = Math.max(0, this.coreOrbCount - 1);
    else if (orb.kind === 'loot') this.lootOrbCount = Math.max(0, this.lootOrbCount - 1);

    const key = this.orbCellKeys.get(id);
    this.orbCellKeys.delete(id);
    if (key !== undefined) {
      const bucket = this.orbGrid.get(key);
      if (bucket) {
        const idx = bucket.indexOf(orb);
        if (idx !== -1) {
          bucket[idx] = bucket[bucket.length - 1];
          bucket.pop();
        }
      }
    }
  }

  private relocateOrb(orb: Orb, nx: number, ny: number): void {
    orb.x = nx;
    orb.y = ny;
    const newKey = cellKey(Math.floor(nx / CELL_SIZE), Math.floor(ny / CELL_SIZE));
    const oldKey = this.orbCellKeys.get(orb.id);
    if (oldKey === newKey) return;

    if (oldKey !== undefined) {
      const oldBucket = this.orbGrid.get(oldKey);
      if (oldBucket) {
        const idx = oldBucket.indexOf(orb);
        if (idx !== -1) {
          oldBucket[idx] = oldBucket[oldBucket.length - 1];
          oldBucket.pop();
        }
      }
    }
    this.orbCellKeys.set(orb.id, newKey);
    let nextBucket = this.orbGrid.get(newKey);
    if (!nextBucket) {
      nextBucket = [];
      this.orbGrid.set(newKey, nextBucket);
    }
    nextBucket.push(orb);
  }

  // Zero-GC pooled segment spatial grid rebuild (~0.4ms for 300 snakes)
  private rebuildSegmentGrid(): void {
    for (let i = 0; i < this.nonEmptySegBuckets.length; i++) {
      this.nonEmptySegBuckets[i].length = 0;
    }
    this.nonEmptySegBuckets.length = 0;

    for (const s of this.snakes.values()) {
      if (!s.alive) continue;
      const segs = s.segments;
      const len = segs.length;
      for (let i = 0; i < len; i++) {
        const seg = segs[i];
        const key = cellKey(Math.floor(seg.x / CELL_SIZE), Math.floor(seg.y / CELL_SIZE));
        let bucket = this.segGrid.get(key);
        if (!bucket) {
          bucket = [];
          this.segGrid.set(key, bucket);
        }
        if (bucket.length === 0) {
          this.nonEmptySegBuckets.push(bucket);
        }
        bucket.push({
          snake: s,
          x: seg.x,
          y: seg.y,
          isHead: i === 0,
          segIndex: i,
        });
      }
    }
  }

  private getNearbyOrbs(x: number, y: number, cellSpan = 1): Orb[] {
    const cx = Math.floor(x / CELL_SIZE);
    const cy = Math.floor(y / CELL_SIZE);
    const result: Orb[] = [];
    for (let dx = -cellSpan; dx <= cellSpan; dx++) {
      for (let dy = -cellSpan; dy <= cellSpan; dy++) {
        const b = this.orbGrid.get(cellKey(cx + dx, cy + dy));
        if (b && b.length > 0) {
          for (let i = 0; i < b.length; i++) result.push(b[i]);
        }
      }
    }
    return result;
  }

  private getNearbySegments(x: number, y: number, cellSpan = 1): SegRef[] {
    const cx = Math.floor(x / CELL_SIZE);
    const cy = Math.floor(y / CELL_SIZE);
    const result: SegRef[] = [];
    for (let dx = -cellSpan; dx <= cellSpan; dx++) {
      for (let dy = -cellSpan; dy <= cellSpan; dy++) {
        const b = this.segGrid.get(cellKey(cx + dx, cy + dy));
        if (b && b.length > 0) {
          for (let i = 0; i < b.length; i++) result.push(b[i]);
        }
      }
    }
    return result;
  }

  private findSafePoint(marginFromBorder = 420, isBot = false): { x: number; y: number } {
    const bound = this.worldHalfSize - marginFromBorder;
    let humanPlayer: SnakeEntity | undefined;
    if (isBot) {
      for (const s of this.snakes.values()) {
        if (!s.isBot && s.alive) {
          humanPlayer = s;
          break;
        }
      }
    }

    let bestPoint = { x: 0, y: 0 };
    let bestScore = -Infinity;

    const minPlayerDistSq = isBot && humanPlayer ? 980 * 980 : 0;
    const minHeadDistSq = 340 * 340;
    const minSegDistSq = 210 * 210;

    for (let attempt = 0; attempt < 28; attempt++) {
      const x = (Math.random() * 2 - 1) * bound;
      const y = (Math.random() * 2 - 1) * bound;

      if (humanPlayer && isBot) {
        const dPlayerSq = distSq(x, y, humanPlayer.x, humanPlayer.y);
        if (dPlayerSq < minPlayerDistSq) {
          if (dPlayerSq > bestScore) {
            bestScore = dPlayerSq;
            bestPoint = { x, y };
          }
          continue;
        }
      }

      // Fast O(1) spatial hash check instead of scanning all 300 snakes!
      const nearby = this.getNearbySegments(x, y, 1);
      if (nearby.length === 0) {
        return { x, y };
      }

      let crowded = false;
      let minSnakeDist = Infinity;

      for (let i = 0; i < nearby.length; i++) {
        const ref = nearby[i];
        const dSq = distSq(x, y, ref.x, ref.y);
        if (dSq < minSnakeDist) minSnakeDist = dSq;
        if ((ref.isHead && dSq < minHeadDistSq) || dSq < minSegDistSq) {
          crowded = true;
          break;
        }
      }

      if (!crowded) {
        return { x, y };
      }

      if (minSnakeDist > bestScore) {
        bestScore = minSnakeDist;
        bestPoint = { x, y };
      }
    }

    return bestPoint.x !== 0 || bestPoint.y !== 0
      ? bestPoint
      : {
          x: (Math.random() * 2 - 1) * bound,
          y: (Math.random() * 2 - 1) * bound,
        };
  }

  private seedInitialOrbs(): void {
    for (let i = 0; i < this.maxAmbientOrbs; i++) {
      this.spawnAmbientOrb();
    }
    for (let i = 0; i < this.maxCores; i++) {
      this.spawnCoreOrb();
    }
  }

  private spawnAmbientOrb(): void {
    const bound = this.worldHalfSize - 80;
    const x = (Math.random() * 2 - 1) * bound;
    const y = (Math.random() * 2 - 1) * bound;
    const roll = Math.random();
    const value = roll > 0.9 ? 5 : roll > 0.55 ? 3 : 2;
    const palette = this.map.orbPalette;
    const color = palette[Math.floor(Math.random() * palette.length)];
    const id = this.nextId('orb');
    this.registerOrb({
      id,
      x,
      y,
      value,
      color,
      radius: value >= 5 ? 7.4 : value >= 3 ? 5.9 : 4.7,
      kind: 'ambient',
    });
  }

  private spawnCoreOrb(): void {
    const zone = this.worldHalfSize * 0.65;
    const x = (Math.random() * 2 - 1) * zone;
    const y = (Math.random() * 2 - 1) * zone;
    const id = this.nextId('core');
    this.registerOrb({
      id,
      x,
      y,
      value: 25,
      color: '#facc15',
      radius: 10.5,
      kind: 'core',
    });
  }

  public spawnOrbAt(
    x: number,
    y: number,
    value: number,
    kind: OrbKind,
    color: string
  ): void {
    if (value <= 0) return;
    const maxB = this.worldHalfSize - 40;
    const cx = Math.max(-maxB, Math.min(maxB, x));
    const cy = Math.max(-maxB, Math.min(maxB, y));
    const id = this.nextId('loot');
    const radius = Math.min(13, 5.4 + Math.sqrt(value) * 1.05);
    this.registerOrb({
      id,
      x: cx,
      y: cy,
      value,
      color,
      radius,
      kind,
    });
  }

  public spawnSnake(params: {
    id?: string;
    name: string;
    snakeTypeId: string;
    isBot: boolean;
    botTier?: BotSkillTier;
    initialScore?: number;
  }): SnakeEntity {
    const id = params.id || this.nextId(params.isBot ? 's' : 'p');
    const spec = getSnakeSpec(params.snakeTypeId);
    const pos = this.findSafePoint(420, params.isBot);
    const angle = Math.random() * Math.PI * 2 - Math.PI;
    const score = Math.max(0, Math.floor(params.initialScore ?? 0));
    const radius = this.computeRadius(score);
    const segCount = this.computeSegmentCount(score);
    const spacing = radius * 0.72;

    const segments = [];
    for (let i = 0; i < segCount; i++) {
      segments.push({
        x: pos.x - Math.cos(angle) * spacing * i,
        y: pos.y - Math.sin(angle) * spacing * i,
      });
    }

    const now = Date.now();
    const snake: SnakeEntity = {
      id,
      name: params.name.trim().slice(0, 18) || 'Player',
      snakeTypeId: spec.id,
      isBot: params.isBot,
      botTier: params.botTier,
      x: pos.x,
      y: pos.y,
      vx: 0,
      vy: 0,
      angle,
      targetAngle: angle,
      speed: BASE_SPEED,
      radius,
      score,
      peakScore: score,
      totalCollected: score,
      kills: 0,
      bestRank: 999,
      spawnedAt: now,
      isBoosting: false,
      segments,
      abilityCooldownUntil: 0,
      abilityActiveUntil: 0,
      activeEffect: null,
      slowedUntil: 0,
      webbedUntil: 0,
      stealthUntil: 0,
      doubleScoreUntil: 0,
      magnetUntil: 0,
      shieldUntil: params.isBot ? 0 : now + 1500,
      phaseUntil: 0,
      freeBoostUntil: 0,
      wideViewUntil: 0,
      alive: true,
    };

    this.snakes.set(id, snake);
    return snake;
  }

  private spawnVariedBot(
    initialSeed = false,
    usedNames?: Set<string>,
    seedSlotIndex?: number,
    forcedBracket?: 'top5' | 'top20' | 'veteran' | 'general'
  ): void {
    const namePool = UNIFIED_BOT_NAMES;

    let chosenName = namePool[Math.floor(Math.random() * namePool.length)].trim();
    if (usedNames && usedNames.has(chosenName)) {
      chosenName = `${chosenName}_${Math.floor(1 + Math.random() * 99)}`;
    }
    usedNames?.add(chosenName);

    let tier: BotSkillTier = 'normal';
    let initScore = 0;
    let snakePool = SNAKE_TYPES.slice(0, 25);

    if (initialSeed && typeof seedSlotIndex === 'number') {
      if (seedSlotIndex < 5) {
        // Ranks 1 - 5: ~15,000 down to ~5,000
        const topBands: Array<[number, number]> = [
          [13100, 14950],
          [10900, 12750],
          [8800, 10550],
          [6850, 8450],
          [5120, 6550],
        ];
        const [minS, maxS] = topBands[seedSlotIndex];
        initScore = Math.floor(minS + Math.random() * (maxS - minS));
        tier = 'titan';
        snakePool = SNAKE_TYPES.slice(82, 100);
      } else if (seedSlotIndex < 20) {
        // Ranks 6 - 20: ~5,000 down to ~2,000
        const t = (seedSlotIndex - 5) / 14; // 0 .. 1
        const center = 4820 - t * 2700; // 4820 -> 2120
        const jitter = (Math.random() - 0.5) * 240;
        initScore = Math.max(2020, Math.min(4960, Math.floor(center + jitter)));
        tier = Math.random() < 0.8 ? 'strong' : 'normal';
        snakePool = SNAKE_TYPES.slice(54, 88);
      } else if (seedSlotIndex < 60) {
        // Ranks 21 - 60: ~2,000 down to ~750
        const t = (seedSlotIndex - 20) / 39;
        const center = 1950 - t * 1170;
        const jitter = (Math.random() - 0.5) * 120;
        initScore = Math.max(750, Math.min(1990, Math.floor(center + jitter)));
        tier = Math.random() < 0.45 ? 'strong' : 'normal';
        snakePool = SNAKE_TYPES.slice(30, 65);
      } else if (seedSlotIndex < 140) {
        // Ranks 61 - 140: ~750 down to ~220
        const t = (seedSlotIndex - 60) / 79;
        const center = 740 - t * 510;
        const jitter = (Math.random() - 0.5) * 60;
        initScore = Math.max(210, Math.min(749, Math.floor(center + jitter)));
        const r = Math.random();
        tier = r < 0.22 ? 'weak' : r < 0.8 ? 'normal' : 'strong';
        snakePool = SNAKE_TYPES.slice(12, 42);
      } else {
        // Ranks 141 - ~300: ~210 down to ~18 (varied skill tiers including agile hunters & weak bots)
        const r = Math.random();
        initScore = Math.floor(18 + Math.pow(Math.random(), 1.3) * 190);
        tier = r < 0.34 ? 'weak' : r < 0.78 ? 'normal' : 'strong';
        snakePool = SNAKE_TYPES.slice(0, 26);
      }
    } else if (forcedBracket === 'top5') {
      initScore = Math.floor(5250 + Math.random() * 8800);
      tier = 'titan';
      snakePool = SNAKE_TYPES.slice(80, 100);
    } else if (forcedBracket === 'top20') {
      initScore = Math.floor(2080 + Math.random() * 2820);
      tier = Math.random() < 0.78 ? 'strong' : 'normal';
      snakePool = SNAKE_TYPES.slice(52, 88);
    } else if (forcedBracket === 'veteran') {
      initScore = Math.floor(760 + Math.random() * 1180);
      tier = Math.random() < 0.45 ? 'strong' : 'normal';
      snakePool = SNAKE_TYPES.slice(28, 62);
    } else {
      const r = Math.random();
      if (r < 0.3) {
        tier = 'weak';
        initScore = Math.floor(15 + Math.random() * 95);
        snakePool = SNAKE_TYPES.slice(0, 22);
      } else if (r < 0.75) {
        tier = 'normal';
        initScore = Math.floor(45 + Math.random() * 340);
        snakePool = SNAKE_TYPES.slice(10, 48);
      } else {
        tier = 'strong';
        initScore = Math.floor(120 + Math.random() * 560);
        snakePool = SNAKE_TYPES.slice(35, 78);
      }
    }

    const pickedSnake =
      snakePool[Math.floor(Math.random() * snakePool.length)] || SNAKE_TYPES[0];
    this.spawnSnake({
      name: chosenName,
      snakeTypeId: pickedSnake.id,
      isBot: true,
      botTier: tier,
      initialScore: initScore,
    });
  }

  public getHumanPlayer(): SnakeEntity | undefined {
    for (const s of this.snakes.values()) {
      if (!s.isBot && s.alive) return s;
    }
    return undefined;
  }

  private spawnBotNearPlayer(human: SnakeEntity, usedNames?: Set<string>): void {
    const namePool = UNIFIED_BOT_NAMES;
    let chosenName = namePool[Math.floor(Math.random() * namePool.length)].trim();
    if (usedNames && usedNames.has(chosenName)) {
      chosenName = `${chosenName}_${Math.floor(1 + Math.random() * 99)}`;
    }
    usedNames?.add(chosenName);

    const r = Math.random();
    const tier: BotSkillTier = r < 0.28 ? 'weak' : r < 0.72 ? 'normal' : 'strong';
    const initScore = Math.floor(35 + Math.random() * 420);
    const pool = tier === 'strong' ? SNAKE_TYPES.slice(25, 65) : SNAKE_TYPES.slice(0, 35);
    const pickedSnake = pool[Math.floor(Math.random() * pool.length)] || SNAKE_TYPES[0];

    // Tactical perimeter around player: 980px to 1320px (just off the visible screen edge)
    const angle = Math.random() * Math.PI * 2;
    const dist = 980 + Math.random() * 340;
    const bound = this.worldHalfSize - 400;
    const px = Math.max(-bound, Math.min(bound, human.x + Math.cos(angle) * dist));
    const py = Math.max(-bound, Math.min(bound, human.y + Math.sin(angle) * dist));

    // Direction pointing towards the player's sector with slight organic variation
    const toPlayerAngle = Math.atan2(human.y - py, human.x - px) + (Math.random() - 0.5) * 0.45;

    const id = this.nextId('s');
    const radius = this.computeRadius(initScore);
    const segCount = this.computeSegmentCount(initScore);
    const spacing = radius * 0.72;

    const segments = [];
    for (let i = 0; i < segCount; i++) {
      segments.push({
        x: px - Math.cos(toPlayerAngle) * spacing * i,
        y: py - Math.sin(toPlayerAngle) * spacing * i,
      });
    }

    const now = Date.now();
    const snake: SnakeEntity = {
      id,
      name: chosenName.slice(0, 18),
      snakeTypeId: pickedSnake.id,
      isBot: true,
      botTier: tier,
      x: px,
      y: py,
      vx: 0,
      vy: 0,
      angle: toPlayerAngle,
      targetAngle: toPlayerAngle,
      speed: BASE_SPEED,
      score: initScore,
      peakScore: initScore,
      totalCollected: initScore,
      kills: 0,
      radius,
      alive: true,
      spawnedAt: now,
      isBoosting: false,
      segments,
      bestRank: 999,
      abilityCooldownUntil: now + 4000,
      abilityActiveUntil: 0,
      activeEffect: null,
      stealthUntil: 0,
      shieldUntil: 0,
      phaseUntil: 0,
      slowedUntil: 0,
      magnetUntil: 0,
      wideViewUntil: 0,
      doubleScoreUntil: 0,
      freeBoostUntil: 0,
      webbedUntil: 0,
    };
    this.snakes.set(id, snake);
  }

  public removeSnake(id: string): void {
    this.snakes.delete(id);
    this.boostDrainAccum.delete(id);
    this.trailSpawnAccum.delete(id);
    this.passiveScoreAccum.delete(id);
    this.botNextDecisionAt.delete(id);
    this.botGreedMode.delete(id);
  }

  public setSnakeInput(
    id: string,
    targetAngle: number,
    isBoosting: boolean,
    triggerAbility = false
  ): void {
    const s = this.snakes.get(id);
    if (!s || !s.alive) return;
    if (Number.isFinite(targetAngle)) {
      s.targetAngle = normalizeAngle(targetAngle);
    }
    s.isBoosting = Boolean(isBoosting);
    if (triggerAbility) {
      this.castAbility(s, Date.now());
    }
  }

  private computeRadius(score: number): number {
    const s = Math.max(0, score);
    return BASE_RADIUS + Math.min(30, Math.pow(s, 0.43) * 0.45);
  }

  private computeSegmentCount(score: number): number {
    const s = Math.max(0, score);
    let extra = 0;
    if (s <= 400) {
      extra = s / 8; // up to +50 segs (64 total)
    } else if (s <= 2500) {
      extra = 50 + (s - 400) / 30; // up to +120 segs (134 total)
    } else {
      extra = 120 + (s - 2500) / 135; // up to MAX_SEGMENTS smoothly across 2,500 -> 15,000
    }
    return BASE_SEGMENTS + Math.min(MAX_SEGMENTS - BASE_SEGMENTS, Math.floor(extra));
  }

  private addScore(snake: SnakeEntity, amount: number): void {
    if (amount <= 0 || snake.isDecoy) return;
    let effectiveAmount = amount;
    // Keep top bots naturally within the ~15,000 ceiling; human player has NO ceiling!
    if (snake.isBot && snake.score >= 14600) {
      if (snake.score >= 15250) return;
      effectiveAmount = Math.max(0, Math.floor(amount * 0.12));
      if (effectiveAmount <= 0) return;
    }
    snake.score += effectiveAmount;
    snake.totalCollected += effectiveAmount;
    if (snake.score > snake.peakScore) {
      snake.peakScore = snake.score;
    }
  }

  public killSnake(
    victim: SnakeEntity,
    cause: 'collision' | 'border' | 'ability',
    killer?: SnakeEntity,
    now = Date.now()
  ): number {
    if (!victim.alive) return 0;
    victim.alive = false;

    if (victim.isDecoy) {
      this.removeSnake(victim.id);
      return 0;
    }

    const spec = getSnakeSpec(victim.snakeTypeId);
    const totalDropScore = Math.max(
      Math.floor(victim.segments.length * 3.8),
      Math.floor(Math.max(0, victim.score) * 0.65)
    );

    if (totalDropScore > 0) {
      this.trimExcessLootOrbs();

      const totalPieces = Math.max(
        14,
        Math.min(
          Math.floor(victim.segments.length * 1.5) + (victim.score > 400 ? 28 : 8),
          160,
          totalDropScore
        )
      );

      const basePieceValue = Math.max(1, Math.floor(totalDropScore / totalPieces));
      let remaining = totalDropScore;

      for (let i = 0; i < totalPieces && remaining > 0; i++) {
        const pieceVal =
          i === totalPieces - 1 ? remaining : Math.min(remaining, basePieceValue);
        remaining -= pieceVal;

        const segFraction = i / totalPieces;
        const segIdx = Math.min(
          victim.segments.length - 1,
          Math.floor(segFraction * victim.segments.length)
        );
        const seg = victim.segments[segIdx] || { x: victim.x, y: victim.y };

        const scatterR = Math.min(26, 8 + Math.sqrt(victim.radius) * 2.8);
        const jitterX = (Math.random() - 0.5) * scatterR * 2;
        const jitterY = (Math.random() - 0.5) * scatterR * 2;

        const orbColor =
          i % 6 === 0 ? '#38bdf8' : i % 4 === 0 ? spec.accentColor : spec.primaryColor;
        const orbKind = i % 8 === 0 && pieceVal >= 6 ? 'star' : 'loot';

        this.spawnOrbAt(
          seg.x + jitterX,
          seg.y + jitterY,
          pieceVal,
          orbKind,
          orbColor
        );
      }

      if (victim.score > 250) {
        const headBursts = Math.min(8, Math.floor(victim.score / 200));
        for (let b = 0; b < headBursts; b++) {
          const ang = (Math.PI * 2 * b) / headBursts + Math.random() * 0.4;
          const dist = 12 + Math.random() * 22;
          this.spawnOrbAt(
            victim.x + Math.cos(ang) * dist,
            victim.y + Math.sin(ang) * dist,
            Math.max(5, Math.floor(basePieceValue * 1.8)),
            'core',
            '#facc15'
          );
        }
      }
    }

    if (killer && killer.id !== victim.id) {
      killer.kills += 1;
      this.pendingEvents.push({
        type: 'kill',
        actorId: killer.id,
        targetId: victim.id,
        x: victim.x,
        y: victim.y,
        value: totalDropScore,
        color: spec.primaryColor,
      });
    }

    this.pendingEvents.push({
      type: 'death',
      actorId: victim.id,
      targetId: killer?.id,
      x: victim.x,
      y: victim.y,
      value: totalDropScore,
      color: spec.primaryColor,
    });

    // Immediately purge dead bots from Map to guarantee zero memory growth
    if (victim.isBot) {
      this.removeSnake(victim.id);
    }

    void cause;
    void now;
    return totalDropScore;
  }

  private trimExcessLootOrbs(): void {
    if (this.lootOrbCount <= this.maxLootOrbs) return;
    let toRemove = this.lootOrbCount - this.maxLootOrbs + 200;
    for (const [id, o] of this.orbs.entries()) {
      if (o.kind === 'loot') {
        this.unregisterOrb(id);
        toRemove--;
        if (toRemove <= 0) break;
      }
    }
  }

  private spawnLaserWave(snake: SnakeEntity, angleOffset: number, now: number, color: string): void {
    const a = snake.angle + angleOffset;
    const speed = 680;
    const hid = this.nextId('hz');
    this.hazards.set(hid, {
      id: hid,
      ownerId: snake.id,
      kind: 'laser_wave',
      x: snake.x + Math.cos(a) * (snake.radius + 16),
      y: snake.y + Math.sin(a) * (snake.radius + 16),
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      radius: 36,
      createdAt: now,
      expiresAt: now + 1600,
      color,
    });
  }

  private spawnDecoyClone(snake: SnakeEntity, angleDelta: number, now: number): void {
    const decoyId = this.nextId('decoy');
    const cloneSegs = snake.segments.map((pt) => ({ x: pt.x, y: pt.y }));
    const a = normalizeAngle(snake.angle + angleDelta);
    const decoy: SnakeEntity = {
      ...snake,
      id: decoyId,
      isBot: true,
      isDecoy: true,
      ownerId: snake.id,
      score: 0,
      peakScore: 0,
      totalCollected: 0,
      angle: a,
      targetAngle: a,
      segments: cloneSegs,
      stealthUntil: 0,
      freeBoostUntil: now + 4000,
      spawnedAt: now,
    };
    this.snakes.set(decoyId, decoy);
  }

  private pushNearbyEnemies(snake: SnakeEntity, radius: number, power: number, now: number): void {
    const span = Math.max(1, Math.ceil(radius / CELL_SIZE));
    const near = this.getNearbySegments(snake.x, snake.y, span);
    const hitSet = new Set<string>();
    for (const ref of near) {
      if (!ref.isHead) continue;
      const other = ref.snake;
      if (!other.alive || other.id === snake.id || other.ownerId === snake.id) continue;
      if (hitSet.has(other.id) || now < other.shieldUntil) continue;
      const dx = other.x - snake.x;
      const dy = other.y - snake.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d <= radius) {
        hitSet.add(other.id);
        const force = ((radius - d) / radius) * power + 180;
        other.vx += (dx / d) * force;
        other.vy += (dy / d) * force;
        other.slowedUntil = Math.max(other.slowedUntil, now + 1500);
      }
    }
  }

  private upgradeNearbyOrbsToStars(x: number, y: number, radius: number, maxCount: number): void {
    const span = Math.max(1, Math.ceil(radius / CELL_SIZE));
    const orbs = this.getNearbyOrbs(x, y, span);
    let converted = 0;
    const rSq = radius * radius;
    for (const orb of orbs) {
      if (orb.kind === 'ambient' && distSq(x, y, orb.x, orb.y) <= rSq) {
        this.ambientOrbCount = Math.max(0, this.ambientOrbCount - 1);
        orb.kind = 'star';
        orb.value = 12;
        orb.color = '#facc15';
        orb.radius = 9.4;
        converted++;
        if (converted >= maxCount) break;
      }
    }
  }

  public castAbility(snake: SnakeEntity, now: number): boolean {
    if (!snake.alive || snake.isDecoy) return false;
    if (now < snake.abilityCooldownUntil) return false;

    const spec = getSnakeSpec(snake.snakeTypeId);
    const ab = spec.ability;
    const durMs = ab.durationSec * 1000;
    snake.abilityCooldownUntil = now + ab.cooldownSec * 1000;

    if (durMs > 0) {
      snake.abilityActiveUntil = now + durMs;
      snake.activeEffect = ab.id;
    }

    this.pendingEvents.push({
      type: 'ability_cast',
      actorId: snake.id,
      abilityId: ab.id,
      x: snake.x,
      y: snake.y,
      color: ab.badgeColor,
    });

    switch (ab.id) {
      case 'quick_dash':
        snake.freeBoostUntil = Math.max(snake.freeBoostUntil, now + durMs);
        break;

      case 'food_magnet':
        snake.magnetUntil = Math.max(snake.magnetUntil, now + durMs);
        break;

      case 'armor_shield':
        snake.shieldUntil = Math.max(snake.shieldUntil, now + durMs);
        break;

      case 'score_boost_15':
        snake.doubleScoreUntil = Math.max(snake.doubleScoreUntil, now + durMs);
        break;

      case 'frost_chill': {
        const near = this.getNearbySegments(snake.x, snake.y, 1);
        for (const ref of near) {
          if (!ref.isHead) continue;
          const o = ref.snake;
          if (o.id !== snake.id && now >= o.shieldUntil && distSq(snake.x, snake.y, o.x, o.y) <= 360 * 360) {
            o.slowedUntil = Math.max(o.slowedUntil, now + durMs);
          }
        }
        break;
      }

      case 'ghost_phase':
        snake.phaseUntil = Math.max(snake.phaseUntil, now + durMs);
        break;

      case 'forward_blink': {
        const blinkDist = 270;
        const safeB = this.worldHalfSize - 55;
        const nx = Math.max(-safeB, Math.min(safeB, snake.x + Math.cos(snake.angle) * blinkDist));
        const ny = Math.max(-safeB, Math.min(safeB, snake.y + Math.sin(snake.angle) * blinkDist));
        const dx = nx - snake.x;
        const dy = ny - snake.y;
        snake.x = nx;
        snake.y = ny;
        for (let i = 0; i < snake.segments.length; i++) {
          snake.segments[i].x += dx;
          snake.segments[i].y += dy;
        }
        snake.phaseUntil = Math.max(snake.phaseUntil, now + 800);
        break;
      }

      case 'shock_push':
        this.pushNearbyEnemies(snake, 340, 540, now);
        break;

      case 'eagle_vision':
        snake.wideViewUntil = Math.max(snake.wideViewUntil, now + durMs);
        break;

      case 'decoy_clone':
        snake.stealthUntil = Math.max(snake.stealthUntil, now + 3400);
        this.spawnDecoyClone(snake, 0, now);
        break;

      case 'gravity_vortex': {
        const hid = this.nextId('hz');
        this.hazards.set(hid, {
          id: hid,
          ownerId: snake.id,
          kind: 'vortex',
          x: snake.x + Math.cos(snake.angle) * 210,
          y: snake.y + Math.sin(snake.angle) * 210,
          vx: 0,
          vy: 0,
          radius: 260,
          createdAt: now,
          expiresAt: now + durMs,
          color: '#9333ea',
        });
        break;
      }

      case 'slice_wave':
        this.spawnLaserWave(snake, 0, now, '#10b981');
        break;

      case 'bio_regen':
        snake.freeBoostUntil = Math.max(snake.freeBoostUntil, now + durMs);
        break;

      case 'star_harvest':
        this.upgradeNearbyOrbsToStars(snake.x, snake.y, 380, 14);
        snake.magnetUntil = Math.max(snake.magnetUntil, now + durMs);
        break;

      case 'sticky_trap': {
        const tail = snake.segments[Math.min(4, snake.segments.length - 1)] || snake;
        const hid = this.nextId('hz');
        this.hazards.set(hid, {
          id: hid,
          ownerId: snake.id,
          kind: 'acid_web',
          x: tail.x,
          y: tail.y,
          vx: 0,
          vy: 0,
          radius: 240,
          createdAt: now,
          expiresAt: now + durMs,
          color: '#dc2626',
        });
        break;
      }

      case 'thorn_reflect':
        snake.shieldUntil = Math.max(snake.shieldUntil, now + durMs);
        this.pushNearbyEnemies(snake, 280, 440, now);
        break;

      case 'sunflare_nova': {
        snake.freeBoostUntil = Math.max(snake.freeBoostUntil, now + durMs);
        const near = this.getNearbySegments(snake.x, snake.y, 1);
        const hit = new Set<string>();
        for (const ref of near) {
          if (!ref.isHead) continue;
          const o = ref.snake;
          if (o.id === snake.id || hit.has(o.id) || now < o.shieldUntil) continue;
          if (distSq(snake.x, snake.y, o.x, o.y) <= 360 * 360) {
            hit.add(o.id);
            const cut = Math.min(45, Math.floor(o.score * 0.16));
            if (cut >= 2) {
              o.score -= cut;
              this.spawnOrbAt(o.x, o.y, Math.floor(cut * 0.5), 'star', '#facc15');
            }
          }
        }
        break;
      }

      case 'abyssal_whirlpool':
        snake.stealthUntil = Math.max(snake.stealthUntil, now + durMs);
        snake.magnetUntil = Math.max(snake.magnetUntil, now + durMs);
        break;

      case 'valkyrie_charge':
        snake.shieldUntil = Math.max(snake.shieldUntil, now + durMs);
        snake.freeBoostUntil = Math.max(snake.freeBoostUntil, now + durMs);
        break;

      case 'crimson_eclipse':
        snake.doubleScoreUntil = Math.max(snake.doubleScoreUntil, now + durMs);
        break;

      case 'twin_mirage':
        snake.stealthUntil = Math.max(snake.stealthUntil, now + durMs);
        this.spawnDecoyClone(snake, -0.32, now);
        this.spawnDecoyClone(snake, 0.32, now);
        break;

      case 'chain_lightning': {
        const near = this.getNearbySegments(snake.x, snake.y, 1);
        const struck = new Set<string>();
        for (const ref of near) {
          if (!ref.isHead || struck.size >= 5) break;
          const o = ref.snake;
          if (o.id === snake.id || struck.has(o.id) || now < o.shieldUntil) continue;
          if (distSq(snake.x, snake.y, o.x, o.y) <= 410 * 410) {
            struck.add(o.id);
            o.slowedUntil = Math.max(o.slowedUntil, now + 2600);
            const cut = Math.min(65, Math.floor(o.score * 0.2));
            if (cut >= 2) {
              o.score -= cut;
              this.spawnOrbAt(o.x, o.y, Math.floor(cut * 0.5), 'loot', '#fde047');
            }
          }
        }
        break;
      }

      case 'aurora_wake':
        snake.freeBoostUntil = Math.max(snake.freeBoostUntil, now + durMs);
        break;

      case 'dragon_flight':
        snake.phaseUntil = Math.max(snake.phaseUntil, now + durMs);
        snake.freeBoostUntil = Math.max(snake.freeBoostUntil, now + durMs);
        snake.magnetUntil = Math.max(snake.magnetUntil, now + durMs);
        break;

      case 'chronos_stop':
        snake.doubleScoreUntil = Math.max(snake.doubleScoreUntil, now + durMs);
        break;

      case 'soul_scythe':
        this.spawnLaserWave(snake, -0.18, now, '#a855f7');
        this.spawnLaserWave(snake, 0.18, now, '#f43f5e');
        snake.magnetUntil = Math.max(snake.magnetUntil, now + durMs);
        break;

      case 'phoenix_rebirth':
        this.pushNearbyEnemies(snake, 380, 580, now);
        this.upgradeNearbyOrbsToStars(snake.x, snake.y, 400, 18);
        snake.shieldUntil = Math.max(snake.shieldUntil, now + durMs);
        break;

      case 'supernova_collapse':
        this.pushNearbyEnemies(snake, 380, 560, now);
        snake.magnetUntil = Math.max(snake.magnetUntil, now + durMs);
        snake.doubleScoreUntil = Math.max(snake.doubleScoreUntil, now + durMs);
        break;

      case 'seraph_grace':
        snake.wideViewUntil = Math.max(snake.wideViewUntil, now + durMs);
        snake.phaseUntil = Math.max(snake.phaseUntil, now + durMs);
        snake.magnetUntil = Math.max(snake.magnetUntil, now + durMs);
        snake.freeBoostUntil = Math.max(snake.freeBoostUntil, now + durMs);
        break;

      case 'chimera_barrage':
        this.spawnLaserWave(snake, -0.26, now, '#ef4444');
        this.spawnLaserWave(snake, 0, now, '#eab308');
        this.spawnLaserWave(snake, 0.26, now, '#ef4444');
        snake.shieldUntil = Math.max(snake.shieldUntil, now + durMs);
        snake.freeBoostUntil = Math.max(snake.freeBoostUntil, now + durMs);
        break;

      case 'void_singularity':
        snake.phaseUntil = Math.max(snake.phaseUntil, now + durMs);
        snake.magnetUntil = Math.max(snake.magnetUntil, now + durMs);
        snake.doubleScoreUntil = Math.max(snake.doubleScoreUntil, now + durMs);
        break;

      case 'plasma_storm':
        for (const off of [-0.48, -0.24, 0, 0.24, 0.48]) {
          this.spawnLaserWave(snake, off, now, '#22d3ee');
        }
        snake.shieldUntil = Math.max(snake.shieldUntil, now + durMs);
        snake.freeBoostUntil = Math.max(snake.freeBoostUntil, now + durMs);
        break;

      case 'leviathan_crush':
        this.pushNearbyEnemies(snake, 480, 680, now);
        this.upgradeNearbyOrbsToStars(snake.x, snake.y, 460, 25);
        snake.shieldUntil = Math.max(snake.shieldUntil, now + durMs);
        snake.doubleScoreUntil = Math.max(snake.doubleScoreUntil, now + durMs);
        break;

      case 'celestial_ascension':
        snake.wideViewUntil = Math.max(snake.wideViewUntil, now + durMs);
        snake.phaseUntil = Math.max(snake.phaseUntil, now + durMs);
        snake.shieldUntil = Math.max(snake.shieldUntil, now + durMs);
        snake.magnetUntil = Math.max(snake.magnetUntil, now + durMs);
        snake.freeBoostUntil = Math.max(snake.freeBoostUntil, now + durMs);
        break;

      case 'sovereign_dominion':
        snake.shieldUntil = Math.max(snake.shieldUntil, now + durMs);
        snake.doubleScoreUntil = Math.max(snake.doubleScoreUntil, now + durMs);
        snake.magnetUntil = Math.max(snake.magnetUntil, now + durMs);
        snake.freeBoostUntil = Math.max(snake.freeBoostUntil, now + durMs);
        break;

      case 'omega_apocalypse':
        for (let k = 0; k < 8; k++) {
          this.spawnLaserWave(snake, (Math.PI * 2 * k) / 8, now, k % 2 === 0 ? '#f43f5e' : '#fde047');
        }
        this.pushNearbyEnemies(snake, 520, 720, now);
        this.upgradeNearbyOrbsToStars(snake.x, snake.y, 520, 35);
        snake.wideViewUntil = Math.max(snake.wideViewUntil, now + durMs);
        snake.shieldUntil = Math.max(snake.shieldUntil, now + durMs);
        snake.doubleScoreUntil = Math.max(snake.doubleScoreUntil, now + durMs);
        snake.magnetUntil = Math.max(snake.magnetUntil, now + durMs);
        snake.freeBoostUntil = Math.max(snake.freeBoostUntil, now + durMs);
        break;

      default:
        break;
    }

    return true;
  }

  public step(dtSec: number, now = Date.now()): void {
    const dt = Math.min(0.04, Math.max(0.001, dtSec));

    if (now - this.lastMaintainAt > 1000) {
      this.lastMaintainAt = now;
      this.maintainPopulation(now, false);
      this.maintainOrbs();
    }

    for (const s of this.snakes.values()) {
      if (!s.alive) continue;
      if (s.isDecoy && now - s.spawnedAt > 4000) {
        this.removeSnake(s.id);
        continue;
      }
      if (s.activeEffect && now >= s.abilityActiveUntil) {
        s.activeEffect = null;
      }
      if (s.isBot) {
        this.updateBotAI(s, now);
      }
    }

    this.updateContinuousAbilities(dt, now);
    this.updateHazards(dt, now);

    this.stepCounter = (this.stepCounter + 1) % 60;

    // Detect player position to optimize faraway bot computation
    let playerX = 0;
    let playerY = 0;
    let hasPlayer = false;
    for (const s of this.snakes.values()) {
      if (!s.isBot && s.alive) {
        playerX = s.x;
        playerY = s.y;
        hasPlayer = true;
        break;
      }
    }

    let bIdx = 0;
    for (const s of this.snakes.values()) {
      if (!s.alive) continue;
      this.moveSnake(s, dt, now);

      // Player and snakes near the screen always collect orbs every frame.
      // Distant bots off-screen interleave collection to eliminate lag and GC pressure.
      if (!s.isBot) {
        this.collectOrbsForSnake(s, dt, now);
      } else {
        bIdx++;
        const isNear = hasPlayer && Math.hypot(s.x - playerX, s.y - playerY) < 2400;
        if (isNear || (this.stepCounter + bIdx) % 4 === 0) {
          this.collectOrbsForSnake(s, dt, now);
        }
      }
    }

    // Rebuild spatial grid strictly AFTER movement so collisions and queries use exact current coordinates!
    this.rebuildSegmentGrid();
    this.resolveCollisions(now);

    if (now - this.lastRankSortAt > 220) {
      this.lastRankSortAt = now;
      this.recomputeRanks(now);
    }
  }

  private recomputeRanks(now = Date.now()): void {
    const aliveList: SnakeEntity[] = [];
    for (const s of this.snakes.values()) {
      if (s.alive && !s.isDecoy) aliveList.push(s);
    }
    aliveList.sort((a, b) => b.score - a.score);

    this.cachedTotalPlayers = aliveList.length;
    const ranks: Record<string, number> = {};
    const leaderId = aliveList[0]?.id;
    const dots: MinimapDot[] = [];

    for (let i = 0; i < aliveList.length; i++) {
      const rank = i + 1;
      const s = aliveList[i];
      ranks[s.id] = rank;
      if (rank < s.bestRank) {
        s.bestRank = rank;
      }
      if (now >= s.stealthUntil) {
        dots.push({
          id: s.id,
          x: Math.round(s.x),
          y: Math.round(s.y),
          isLeader: s.id === leaderId,
        });
      }
    }

    this.cachedRanks = ranks;
    this.cachedMinimapDots = dots;
    this.cachedLeaderboard = aliveList.slice(0, 10).map((s) => ({
      id: s.id,
      name: s.name,
      score: Math.floor(s.score),
      kills: s.kills,
      snakeTypeId: s.snakeTypeId,
    }));
  }

  private maintainPopulation(now = Date.now(), initialSeed = false): void {
    let nonDecoyCount = 0;
    let botCount = 0;
    let top5Count = 0;
    let top20Count = 0;
    let veteranCount = 0;
    const usedNames = new Set<string>();

    for (const s of this.snakes.values()) {
      if (s.alive && !s.isDecoy) {
        nonDecoyCount++;
        usedNames.add(s.name);
        if (s.isBot) {
          botCount++;
          if (s.score >= 5000) top5Count++;
          else if (s.score >= 2000) top20Count++;
          else if (s.score >= 750) veteranCount++;
        }
      }
    }

    // Gently fluctuate around ~300 active snakes (286 .. 308)
    if (!initialSeed && Math.random() < 0.12) {
      this.targetPopulation = Math.max(
        286,
        Math.min(308, this.targetPopulation + (Math.random() < 0.5 ? -2 : 2))
      );
    }

    if (nonDecoyCount > this.targetPopulation && botCount > 0) {
      let excess = Math.min(botCount, nonDecoyCount - this.targetPopulation);
      for (const [id, s] of this.snakes.entries()) {
        // Only trim small/low-score bots so leaderboard giants aren't artificially despawned
        if (s.isBot && !s.isDecoy && s.score < 500 && excess > 0) {
          this.removeSnake(id);
          excess--;
        }
      }
    } else if (nonDecoyCount < this.targetPopulation) {
      const toSpawn = initialSeed
        ? this.targetPopulation - nonDecoyCount
        : Math.min(14, this.targetPopulation - nonDecoyCount);
      for (let i = 0; i < toSpawn; i++) {
        if (initialSeed) {
          this.spawnVariedBot(true, usedNames, i);
        } else {
          let bracket: 'top5' | 'top20' | 'veteran' | 'general' = 'general';
          if (top5Count < 5) {
            bracket = 'top5';
            top5Count++;
          } else if (top20Count < 15) {
            bracket = 'top20';
            top20Count++;
          } else if (veteranCount < 38) {
            bracket = 'veteran';
            veteranCount++;
          }
          this.spawnVariedBot(false, usedNames, undefined, bracket);
        }
      }
    }

    // Ensure player has at least 1-2 active bot snakes in nearby perimeter (within 1400px)
    const human = this.getHumanPlayer();
    if (human && !initialSeed) {
      let botsNearby = 0;
      let closestBotDist = Infinity;
      for (const s of this.snakes.values()) {
        if (s.alive && s.isBot && !s.isDecoy) {
          const d = Math.hypot(s.x - human.x, s.y - human.y);
          if (d < 1400) botsNearby++;
          if (d < closestBotDist) closestBotDist = d;
        }
      }

      if (botsNearby < 1 || closestBotDist > 1400) {
        this.spawnBotNearPlayer(human, usedNames);
      }
    }
    void now;
  }

  private maintainOrbs(): void {
    const deficit = Math.min(1000, this.maxAmbientOrbs - this.ambientOrbCount);
    for (let i = 0; i < deficit; i++) {
      this.spawnAmbientOrb();
    }
    const coreDeficit = Math.min(30, this.maxCores - this.coreOrbCount);
    for (let i = 0; i < coreDeficit; i++) {
      this.spawnCoreOrb();
    }
  }

  private updateContinuousAbilities(dt: number, now: number): void {
    for (const s of this.snakes.values()) {
      if (!s.alive) continue;

      if (now < s.magnetUntil) {
        const isGod =
          s.activeEffect === 'omega_apocalypse' ||
          s.activeEffect === 'void_singularity' ||
          s.activeEffect === 'celestial_ascension';
        const isSuper =
          isGod ||
          s.activeEffect === 'supernova_collapse' ||
          s.activeEffect === 'sovereign_dominion' ||
          s.activeEffect === 'soul_scythe';
        const pullR = isGod ? 650 : isSuper ? 460 : 360;
        const pullSpd = isGod ? 680 : isSuper ? 550 : 440;
        const rSq = pullR * pullR;
        const span = Math.max(1, Math.ceil(pullR / CELL_SIZE));
        const nearOrbs = this.getNearbyOrbs(s.x, s.y, span);
        for (let i = 0; i < nearOrbs.length; i++) {
          const orb = nearOrbs[i];
          const d2 = distSq(s.x, s.y, orb.x, orb.y);
          if (d2 > 1 && d2 <= rSq) {
            const d = Math.sqrt(d2);
            const nx = orb.x + ((s.x - orb.x) / d) * pullSpd * dt;
            const ny = orb.y + ((s.y - orb.y) / d) * pullSpd * dt;
            this.relocateOrb(orb, nx, ny);
          }
        }
      }

      if (!s.activeEffect) continue;

      switch (s.activeEffect) {
        case 'venom_trail':
        case 'aurora_wake': {
          const prev = (this.trailSpawnAccum.get(s.id) || 0) + dt;
          if (prev >= 0.3) {
            this.trailSpawnAccum.set(s.id, 0);
            const tail = s.segments[s.segments.length - 1] || s;
            const hid = this.nextId('hz');
            this.hazards.set(hid, {
              id: hid,
              ownerId: s.id,
              kind: s.activeEffect === 'aurora_wake' ? 'aurora_pool' : 'venom_pool',
              x: tail.x,
              y: tail.y,
              vx: 0,
              vy: 0,
              radius: s.radius * 0.95,
              createdAt: now,
              expiresAt: now + 4200,
              color: s.activeEffect === 'aurora_wake' ? '#2dd4bf' : '#22c55e',
            });
          } else {
            this.trailSpawnAccum.set(s.id, prev);
          }
          break;
        }

        case 'ember_trail': {
          const prev = (this.trailSpawnAccum.get(s.id) || 0) + dt;
          if (prev >= 0.35) {
            this.trailSpawnAccum.set(s.id, 0);
            const tail = s.segments[s.segments.length - 1] || s;
            const backAngle = s.angle + Math.PI + (Math.random() - 0.5) * 0.5;
            const hid = this.nextId('hz');
            this.hazards.set(hid, {
              id: hid,
              ownerId: s.id,
              kind: 'fireball',
              x: tail.x,
              y: tail.y,
              vx: Math.cos(backAngle) * 145,
              vy: Math.sin(backAngle) * 145,
              radius: s.radius * 0.9,
              createdAt: now,
              expiresAt: now + 3200,
              color: '#ea580c',
            });
          } else {
            this.trailSpawnAccum.set(s.id, prev);
          }
          break;
        }

        case 'valkyrie_charge': {
          this.pushNearbyEnemies(s, 175, 340, now);
          break;
        }

        case 'time_shift':
        case 'abyssal_whirlpool':
        case 'chronos_stop': {
          const r = s.activeEffect === 'chronos_stop' ? 360 : 290;
          const rSq = r * r;
          const near = this.getNearbySegments(s.x, s.y, 1);
          for (const ref of near) {
            if (!ref.isHead) continue;
            const o = ref.snake;
            if (o.id === s.id || now < o.shieldUntil) continue;
            if (distSq(s.x, s.y, o.x, o.y) <= rSq) {
              o.slowedUntil = Math.max(o.slowedUntil, now + 450);
            }
          }
          break;
        }

        case 'score_drain':
        case 'crimson_eclipse':
        case 'void_singularity':
        case 'sovereign_dominion':
        case 'omega_apocalypse': {
          const accum = (this.passiveScoreAccum.get(s.id) || 0) + dt;
          if (accum >= 0.22) {
            this.passiveScoreAccum.set(s.id, 0);
            const near = this.getNearbySegments(s.x, s.y, 1);
            const drainedIds = new Set<string>();
            const drainRange = s.activeEffect === 'omega_apocalypse' ? 420 : 320;
            const drainAmt = s.activeEffect === 'omega_apocalypse' ? 9 : 5;
            for (const ref of near) {
              if (!ref.isHead) continue;
              const o = ref.snake;
              if (
                o.id === s.id ||
                o.isDecoy ||
                drainedIds.has(o.id) ||
                now < o.shieldUntil ||
                o.score < 3
              )
                continue;
              if (distSq(s.x, s.y, o.x, o.y) <= drainRange * drainRange) {
                drainedIds.add(o.id);
                const amt = Math.min(drainAmt, o.score);
                o.score -= amt;
                this.addScore(s, amt);
              }
            }
          } else {
            this.passiveScoreAccum.set(s.id, accum);
          }
          break;
        }

        case 'bio_regen': {
          const accum = (this.passiveScoreAccum.get(s.id) || 0) + dt;
          if (accum >= 0.4) {
            this.passiveScoreAccum.set(s.id, 0);
            this.addScore(s, 5);
          } else {
            this.passiveScoreAccum.set(s.id, accum);
          }
          break;
        }

        default:
          break;
      }
    }
  }

  private updateHazards(dt: number, now: number): void {
    for (const [id, hz] of this.hazards.entries()) {
      if (now >= hz.expiresAt) {
        this.hazards.delete(id);
        continue;
      }
      hz.x += hz.vx * dt;
      hz.y += hz.vy * dt;

      if (hz.kind === 'vortex') {
        const rSq = hz.radius * hz.radius;
        const orbs = this.getNearbyOrbs(hz.x, hz.y, 1);
        for (const orb of orbs) {
          const d2 = distSq(hz.x, hz.y, orb.x, orb.y);
          if (d2 > 16 && d2 <= rSq) {
            const d = Math.sqrt(d2);
            this.relocateOrb(
              orb,
              orb.x + ((hz.x - orb.x) / d) * 230 * dt,
              orb.y + ((hz.y - orb.y) / d) * 230 * dt
            );
          }
        }
        const near = this.getNearbySegments(hz.x, hz.y, 1);
        for (const ref of near) {
          if (!ref.isHead) continue;
          const s = ref.snake;
          if (s.id === hz.ownerId || s.ownerId === hz.ownerId || now < s.shieldUntil) continue;
          const d2 = distSq(hz.x, hz.y, s.x, s.y);
          if (d2 > 25 && d2 <= rSq) {
            const d = Math.sqrt(d2);
            s.vx += ((hz.x - s.x) / d) * 430 * dt;
            s.vy += ((hz.y - s.y) / d) * 430 * dt;
          }
        }
      } else if (hz.kind === 'acid_web') {
        const rSq = hz.radius * hz.radius;
        const near = this.getNearbySegments(hz.x, hz.y, 1);
        for (const ref of near) {
          if (!ref.isHead) continue;
          const s = ref.snake;
          if (s.id === hz.ownerId || now < s.shieldUntil) continue;
          if (distSq(hz.x, hz.y, s.x, s.y) <= rSq) {
            s.webbedUntil = Math.max(s.webbedUntil, now + 350);
          }
        }
      } else if (hz.kind === 'venom_pool' || hz.kind === 'aurora_pool') {
        const rSq = (hz.radius + 15) * (hz.radius + 15);
        const near = this.getNearbySegments(hz.x, hz.y, 1);
        for (const ref of near) {
          if (!ref.isHead) continue;
          const s = ref.snake;
          if (s.id === hz.ownerId || now < s.shieldUntil) continue;
          if (distSq(hz.x, hz.y, s.x, s.y) <= rSq) {
            s.slowedUntil = Math.max(
              s.slowedUntil,
              now + (hz.kind === 'aurora_pool' ? 1800 : 1000)
            );
          }
        }
      } else if (hz.kind === 'fireball') {
        const rSq = (hz.radius + 15) * (hz.radius + 15);
        const near = this.getNearbySegments(hz.x, hz.y, 1);
        for (const ref of near) {
          if (!ref.isHead) continue;
          const s = ref.snake;
          if (s.id === hz.ownerId || now < s.shieldUntil) continue;
          if (distSq(hz.x, hz.y, s.x, s.y) <= rSq) {
            const dx = s.x - hz.x;
            const dy = s.y - hz.y;
            const d = Math.hypot(dx, dy) || 1;
            s.vx += (dx / d) * 360;
            s.vy += (dy / d) * 360;
            if (s.score >= 4) {
              const burn = Math.min(16, s.score);
              s.score -= burn;
              this.spawnOrbAt(s.x, s.y, Math.floor(burn * 0.5), 'loot', hz.color);
            }
            this.hazards.delete(id);
            break;
          }
        }
      } else if (hz.kind === 'laser_wave') {
        const rSq = (hz.radius + 18) * (hz.radius + 18);
        const near = this.getNearbySegments(hz.x, hz.y, 1);
        for (const ref of near) {
          const s = ref.snake;
          if (s.id === hz.ownerId || s.ownerId === hz.ownerId || now < s.shieldUntil) continue;
          if (distSq(hz.x, hz.y, ref.x, ref.y) <= rSq) {
            s.slowedUntil = Math.max(s.slowedUntil, now + 1800);
            const cut = Math.min(90, Math.floor(s.score * 0.25));
            if (cut >= 2) {
              s.score -= cut;
              const dropHalf = Math.floor(cut * 0.5);
              if (dropHalf > 0) {
                this.spawnOrbAt(ref.x, ref.y, dropHalf, 'loot', hz.color);
              }
            }
            this.hazards.delete(id);
            break;
          }
        }
      }
    }
  }

  private moveSnake(s: SnakeEntity, dt: number, now: number): void {
    const spec = getSnakeSpec(s.snakeTypeId);
    s.radius = this.computeRadius(s.score);

    const sizePenalty = Math.max(0.55, 1 - Math.sqrt(s.score) * 0.0072);
    const effectiveTurnStat = s.isBot ? Math.min(13, spec.turnStat) : spec.turnStat;
    let turnRate = (3.4 + effectiveTurnStat * 0.16) * sizePenalty;
    if (s.isBot && s.botTier === 'weak') turnRate *= 0.78;
    if (s.isBot && s.isBoosting) turnRate *= 0.84;
    if (
      s.activeEffect === 'time_shift' ||
      s.activeEffect === 'chronos_stop' ||
      now < s.wideViewUntil
    ) {
      turnRate *= 1.5;
    }
    if (now < s.webbedUntil) {
      turnRate *= 0.6;
    }

    const diff = shortestAngleDiff(s.angle, s.targetAngle);
    const maxTurn = turnRate * dt;
    if (Math.abs(diff) <= maxTurn) {
      s.angle = s.targetAngle;
    } else {
      s.angle = normalizeAngle(s.angle + Math.sign(diff) * maxTurn);
    }

    // Progressive speed bonus from Snake #1 -> #100
    const effectiveSpeedBonus = s.isBot
      ? Math.min(45, (spec.speedStat - 7) * 3.2)
      : (spec.speedStat - 7) * 5.2;
    let speed = BASE_SPEED + effectiveSpeedBonus;

    const freeBoost = now < s.freeBoostUntil;
    const canBoost =
      now >= s.webbedUntil && (freeBoost || (s.isBoosting && s.score >= 6));

    if (freeBoost) {
      speed *= 1.75;
    } else if (canBoost && s.isBoosting) {
      speed *= BOOST_MULTIPLIER;
      // High-level snakes enjoy up to 90% less score drain when boosting!
      const eff = s.isBot ? Math.min(0.4, spec.boostEfficiency) : spec.boostEfficiency;
      const drainRate = 6 * (1 - eff);
      const drain = (this.boostDrainAccum.get(s.id) || 0) + dt * drainRate;
      if (drain >= 2) {
        const whole = Math.floor(drain);
        this.boostDrainAccum.set(s.id, drain - whole);
        const actual = Math.min(whole, s.score);
        s.score -= actual;
        const dropVal = Math.floor(actual * 0.5);
        if (dropVal >= 1 && Math.random() < 0.6) {
          const tail = s.segments[s.segments.length - 1] || s;
          this.spawnOrbAt(tail.x, tail.y, dropVal, 'loot', spec.primaryColor);
        }
      } else {
        this.boostDrainAccum.set(s.id, drain);
      }
    } else {
      s.isBoosting = false;
    }

    if (now < s.stealthUntil) speed *= 1.22;
    if (now < s.slowedUntil) speed *= 0.48;
    if (now < s.webbedUntil) speed *= 0.65;

    s.speed = speed;

    const spacing = s.radius * 0.72;

    // High-speed physics sub-stepping: at boost / high speeds (>250 px/s), run 2 sub-steps
    // to keep segment spacing and trailing constraints completely fluid and eliminate discrete segment jumping!
    const subSteps = s.isBoosting || speed > 250 ? 2 : 1;
    const subDt = dt / subSteps;
    const stepSpeed = speed;

    for (let step = 0; step < subSteps; step++) {
      s.x += (Math.cos(s.angle) * stepSpeed + s.vx) * subDt;
      s.y += (Math.sin(s.angle) * stepSpeed + s.vy) * subDt;
      const damping = Math.pow(0.04, subDt);
      s.vx *= damping;
      s.vy *= damping;

      if (s.segments.length === 0) {
        s.segments.push({ x: s.x, y: s.y });
      } else {
        s.segments[0].x = s.x;
        s.segments[0].y = s.y;
      }

      // FIXED: Pull-only trailing kinematics — prevents segments from telescoping backward or freezing when radius grows!
      for (let i = 1; i < s.segments.length; i++) {
        const prev = s.segments[i - 1];
        const curr = s.segments[i];
        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        const d = Math.hypot(dx, dy);
        if (d > spacing) {
          curr.x = prev.x + (dx / d) * spacing;
          curr.y = prev.y + (dy / d) * spacing;
        }
      }
    }

    // FIXED: Spawn new tail segments strictly along tail tangent with exact spacing (never stacked at d=0!)
    const desiredSegs = this.computeSegmentCount(s.score);
    while (s.segments.length < desiredSegs) {
      const len = s.segments.length;
      const last = s.segments[len - 1];
      let dirX = -Math.cos(s.angle);
      let dirY = -Math.sin(s.angle);
      if (len >= 2) {
        const prev = s.segments[len - 2];
        const tdx = last.x - prev.x;
        const tdy = last.y - prev.y;
        const td = Math.hypot(tdx, tdy);
        if (td > 0.001) {
          dirX = tdx / td;
          dirY = tdy / td;
        }
      }
      s.segments.push({
        x: last.x + dirX * spacing,
        y: last.y + dirY * spacing,
      });
    }
    if (s.segments.length > desiredSegs) {
      s.segments.length = desiredSegs;
    }
  }

  private collectOrbsForSnake(s: SnakeEntity, dt: number, now: number): void {
    if (s.isDecoy) return;
    const spec = getSnakeSpec(s.snakeTypeId);
    const passiveMag = s.isBot ? Math.min(20, spec.passiveMagnetBonus * 0.3) : spec.passiveMagnetBonus;

    const eatRadius = s.radius + 16 + passiveMag * 0.35;
    const eatSq = eatRadius * eatRadius;
    const auraPullR = passiveMag > 8 ? s.radius + 24 + passiveMag * 1.6 : 0;
    const auraPullSq = auraPullR * auraPullR;

    const abilityMult = now < s.doubleScoreUntil ? 2 : 1;
    const snakeMult = s.isBot ? 1 + (spec.scoreMultiplier - 1) * 0.25 : spec.scoreMultiplier;
    const totalMult = abilityMult * snakeMult;

    const nearby = this.getNearbyOrbs(s.x, s.y, 1);
    for (let i = 0; i < nearby.length; i++) {
      const orb = nearby[i];
      if (!this.orbs.has(orb.id)) continue;
      const d2 = distSq(s.x, s.y, orb.x, orb.y);
      const limitSq = eatSq + orb.radius * orb.radius;

      if (d2 <= limitSq) {
        const gained = Math.max(1, Math.round(orb.value * totalMult));
        this.addScore(s, gained);
        this.unregisterOrb(orb.id);

        this.pendingEvents.push({
          type:
            orb.kind === 'core'
              ? 'eat_core'
              : orb.kind === 'loot' || orb.kind === 'star'
              ? 'eat_loot'
              : 'eat_orb',
          actorId: s.id,
          x: orb.x,
          y: orb.y,
          value: gained,
          color: orb.color,
        });
      } else if (auraPullR > 0 && d2 > 1 && d2 <= auraPullSq) {
        // High-tier passive magnetic aura pulls nearby orbs smoothly into mouth!
        const d = Math.sqrt(d2);
        this.relocateOrb(
          orb,
          orb.x + ((s.x - orb.x) / d) * 320 * dt,
          orb.y + ((s.y - orb.y) / d) * 320 * dt
        );
      }
    }
  }

  private resolveCollisions(now: number): void {
    const half = this.worldHalfSize;
    const toKillMap = new Map<
      string,
      {
        victim: SnakeEntity;
        killer?: SnakeEntity;
        cause: 'collision' | 'border';
      }
    >();

    interface PairContact {
      attacker: SnakeEntity;
      defender: SnakeEntity;
      bodyHit: boolean;
      headHit: boolean;
      bestSegIdx: number;
      penetration: number;
      ramAlignment: number;
    }

    const contactsByAttacker = new Map<string, Map<string, PairContact>>();

    for (const a of this.snakes.values()) {
      if (!a.alive) continue;

      if (
        Math.abs(a.x) + a.radius * 0.65 >= half ||
        Math.abs(a.y) + a.radius * 0.65 >= half
      ) {
        toKillMap.set(a.id, { victim: a, cause: 'border' });
        continue;
      }

      if (now < a.phaseUntil) continue;

      // Giant snakes can exceed 40px radius, so span=1 (440px cells) covers all contacts cleanly
      const nearSegs = this.getNearbySegments(a.x, a.y, 1);
      const headCos = Math.cos(a.angle);
      const headSin = Math.sin(a.angle);

      for (let i = 0; i < nearSegs.length; i++) {
        const ref = nearSegs[i];
        const b = ref.snake;
        if (b.id === a.id || !b.alive) continue;
        if (a.ownerId === b.id || b.ownerId === a.id) continue;
        if (now < b.phaseUntil) continue;

        if (ref.isHead) {
          const headHitR = (a.radius + b.radius) * 0.96;
          const d2 = distSq(a.x, a.y, b.x, b.y);
          if (d2 <= headHitR * headHitR) {
            const d = Math.sqrt(d2) || 0.001;
            const align = ((b.x - a.x) * headCos + (b.y - a.y) * headSin) / d;
            const pen = Math.max(0, headHitR - d);

            let mapForA = contactsByAttacker.get(a.id);
            if (!mapForA) {
              mapForA = new Map();
              contactsByAttacker.set(a.id, mapForA);
            }
            const existing = mapForA.get(b.id);
            if (!existing) {
              mapForA.set(b.id, {
                attacker: a,
                defender: b,
                bodyHit: false,
                headHit: true,
                bestSegIdx: 0,
                penetration: pen,
                ramAlignment: align,
              });
            } else {
              existing.headHit = true;
              if (pen > existing.penetration) existing.penetration = pen;
              if (align > existing.ramAlignment) existing.ramAlignment = align;
            }
          }
        } else {
          const hitR = (a.radius + b.radius) * 0.9;
          const hitRSq = hitR * hitR;

          let minD2 = distSq(a.x, a.y, ref.x, ref.y);
          let cx = ref.x;
          let cy = ref.y;

          if (minD2 > hitRSq && ref.segIndex > 0 && ref.segIndex < b.segments.length) {
            const prevSeg = b.segments[ref.segIndex - 1];
            const sdx = ref.x - prevSeg.x;
            const sdy = ref.y - prevSeg.y;
            const l2 = sdx * sdx + sdy * sdy;
            if (l2 > 0) {
              const t = Math.max(0, Math.min(1, ((a.x - prevSeg.x) * sdx + (a.y - prevSeg.y) * sdy) / l2));
              cx = prevSeg.x + t * sdx;
              cy = prevSeg.y + t * sdy;
              minD2 = distSq(a.x, a.y, cx, cy);
            }
          }

          if (minD2 <= hitRSq) {
            const d = Math.sqrt(minD2) || 0.001;
            const align = ((cx - a.x) * headCos + (cy - a.y) * headSin) / d;
            const pen = Math.max(0, hitR - d);

            let mapForA = contactsByAttacker.get(a.id);
            if (!mapForA) {
              mapForA = new Map();
              contactsByAttacker.set(a.id, mapForA);
            }
            const existing = mapForA.get(b.id);
            if (!existing) {
              mapForA.set(b.id, {
                attacker: a,
                defender: b,
                bodyHit: true,
                headHit: false,
                bestSegIdx: ref.segIndex,
                penetration: pen,
                ramAlignment: align,
              });
            } else {
              existing.bodyHit = true;
              if (ref.segIndex > existing.bestSegIdx) existing.bestSegIdx = ref.segIndex;
              if (pen > existing.penetration) existing.penetration = pen;
              if (align > existing.ramAlignment) existing.ramAlignment = align;
            }
          }
        }
      }
    }

    const handledMutualPairs = new Set<string>();

    for (const [aId, mapForA] of contactsByAttacker.entries()) {
      for (const [bId, ab] of mapForA.entries()) {
        const a = ab.attacker;
        const b = ab.defender;
        if (!a.alive || !b.alive) continue;

        const ba = contactsByAttacker.get(bId)?.get(aId);

        if (ba) {
          // Mutual contact between A and B: STRICTLY ONLY ONE SNAKE DIES (never both!)
          const pairKey = aId < bId ? `${aId}|${bId}` : `${bId}|${aId}`;
          if (handledMutualPairs.has(pairKey)) continue;
          handledMutualPairs.add(pairKey);

          const aShield = now < a.shieldUntil;
          const bShield = now < b.shieldUntil;

          if (aShield && bShield) {
            a.vx -= Math.cos(a.angle) * 210;
            a.vy -= Math.sin(a.angle) * 210;
            b.vx -= Math.cos(b.angle) * 210;
            b.vy -= Math.sin(b.angle) * 210;
            continue;
          }
          if (aShield && !bShield) {
            toKillMap.set(b.id, { victim: b, killer: a, cause: 'collision' });
            continue;
          }
          if (bShield && !aShield) {
            toKillMap.set(a.id, { victim: a, killer: b, cause: 'collision' });
            continue;
          }

          // Neither shielded: determine whose head rammed into the other's body more!
          const aDeepBody = ab.bodyHit && ab.bestSegIdx >= 2;
          const bDeepBody = ba.bodyHit && ba.bestSegIdx >= 2;

          let aDies = false;
          if (aDeepBody && !bDeepBody) {
            aDies = true;
          } else if (bDeepBody && !aDeepBody) {
            aDies = false;
          } else {
            const faultA = ab.bestSegIdx * 18 + ab.penetration * 1.8 + ab.ramAlignment * 55;
            const faultB = ba.bestSegIdx * 18 + ba.penetration * 1.8 + ba.ramAlignment * 55;
            if (Math.abs(faultA - faultB) > 0.001) {
              aDies = faultA > faultB;
            } else if (a.score !== b.score) {
              aDies = a.score < b.score;
            } else {
              aDies = a.id < b.id;
            }
          }

          if (aDies) {
            toKillMap.set(a.id, { victim: a, killer: b, cause: 'collision' });
            b.vx -= Math.cos(b.angle) * 80;
            b.vy -= Math.sin(b.angle) * 80;
          } else {
            toKillMap.set(b.id, { victim: b, killer: a, cause: 'collision' });
            a.vx -= Math.cos(a.angle) * 80;
            a.vy -= Math.sin(a.angle) * 80;
          }
        } else {
          // Unilateral contact: only A's head hit B's body!
          if (now < a.shieldUntil) {
            a.vx -= Math.cos(a.angle) * 220;
            a.vy -= Math.sin(a.angle) * 220;
          } else {
            toKillMap.set(a.id, { victim: a, killer: b, cause: 'collision' });
          }
        }
      }
    }

    for (const item of toKillMap.values()) {
      if (item.victim.alive) {
        this.killSnake(item.victim, item.cause, item.killer, now);
      }
    }
  }

  private measureRayClearance(
    bot: SnakeEntity,
    rayAngle: number,
    maxDist: number,
    nearSegs: SegRef[],
    now: number,
    extraPad: number
  ): number {
    const rx = Math.cos(rayAngle);
    const ry = Math.sin(rayAngle);
    const safeBound = this.worldHalfSize - bot.radius - 75;

    let bestClearance = maxDist;

    if (rx > 0.05) {
      bestClearance = Math.min(bestClearance, Math.max(0, (safeBound - bot.x) / rx));
    } else if (rx < -0.05) {
      bestClearance = Math.min(bestClearance, Math.max(0, (-safeBound - bot.x) / rx));
    }
    if (ry > 0.05) {
      bestClearance = Math.min(bestClearance, Math.max(0, (safeBound - bot.y) / ry));
    } else if (ry < -0.05) {
      bestClearance = Math.min(bestClearance, Math.max(0, (-safeBound - bot.y) / ry));
    }

    if (now < bot.phaseUntil) {
      return bestClearance;
    }

    for (let i = 0; i < nearSegs.length; i++) {
      const ref = nearSegs[i];
      const other = ref.snake;
      if (other.id === bot.id || other.ownerId === bot.id || now < other.stealthUntil) {
        continue;
      }

      const dx = ref.x - bot.x;
      const dy = ref.y - bot.y;
      const proj = dx * rx + dy * ry;
      if (proj <= -bot.radius * 0.5 || proj >= bestClearance + 45) continue;

      const perp = Math.abs(dx * ry - dy * rx);
      const corridorR =
        bot.radius + other.radius + extraPad + (ref.isHead ? 28 : 10);

      if (perp < corridorR) {
        const hitDist = Math.max(0, proj - corridorR * 0.72);
        if (hitDist < bestClearance) {
          bestClearance = hitDist;
          if (bestClearance <= 2) return 0;
        }
      }
    }

    return bestClearance;
  }

  private updateBotAI(bot: SnakeEntity, now: number): void {
    if (bot.isDecoy) {
      bot.targetAngle = normalizeAngle(bot.angle + Math.sin(now * 0.005) * 0.08);
      bot.isBoosting = true;
      return;
    }

    const tier = bot.botTier || 'normal';
    const nextTick = this.botNextDecisionAt.get(bot.id) || 0;
    if (now < nextTick) {
      return;
    }

    const reactionDelay =
      tier === 'weak'
        ? 155 + Math.random() * 75
        : tier === 'normal'
        ? 90 + Math.random() * 45
        : tier === 'strong'
        ? 55 + Math.random() * 30
        : 45 + Math.random() * 25;
    this.botNextDecisionAt.set(bot.id, now + reactionDelay);

    const lookAhead =
      (tier === 'weak'
        ? 185
        : tier === 'normal'
        ? 300
        : tier === 'strong'
        ? 400
        : 450) + bot.radius * 2.4;

    const safetyPad =
      tier === 'weak' ? 6 : tier === 'normal' ? 18 : tier === 'strong' ? 28 : 34;

    const nearSegs = this.getNearbySegments(bot.x, bot.y, 1);
    const nearOrbs = this.getNearbyOrbs(bot.x, bot.y, 1);

    // 1. Scan nearby rival heads for hunting or threat awareness
    let huntTarget: SnakeEntity | null = null;
    let huntTargetScore = -Infinity;
    let closestEnemyHeadDist = Infinity;

    // Direct Player Awareness: Scan human player position so bots actively seek and interact with the player!
    const humanPlayer = this.getHumanPlayer();
    let distToHuman = Infinity;
    if (humanPlayer && humanPlayer.alive && now >= humanPlayer.stealthUntil) {
      distToHuman = Math.hypot(humanPlayer.x - bot.x, humanPlayer.y - bot.y);
      if (distToHuman < closestEnemyHeadDist) {
        closestEnemyHeadDist = distToHuman;
      }
      // If Strong or Titan hunter, actively target human player from a larger distance (up to 850px)!
      if ((tier === 'strong' || tier === 'titan') && distToHuman < 850 && bot.score >= 35) {
        const scoreVal = (950 - distToHuman) + 260;
        if (scoreVal > huntTargetScore) {
          huntTargetScore = scoreVal;
          huntTarget = humanPlayer;
        }
      }
    }

    for (let i = 0; i < nearSegs.length; i++) {
      const ref = nearSegs[i];
      if (!ref.isHead) continue;
      const other = ref.snake;
      if (other.id === bot.id || other.ownerId === bot.id || now < other.stealthUntil) {
        continue;
      }
      const d = Math.hypot(other.x - bot.x, other.y - bot.y);
      if (d < closestEnemyHeadDist) {
        closestEnemyHeadDist = d;
      }

      // Strong & Titan hunters actively target players and nearby snakes to cut them off!
      if ((tier === 'strong' || tier === 'titan') && d < 660 && bot.score >= 40) {
        // Prefer human player or high-value targets within striking range
        const humanBonus = !other.isBot ? 180 : 0;
        const scoreVal = (700 - d) + humanBonus + Math.min(160, other.score * 0.08);
        if (scoreVal > huntTargetScore) {
          huntTargetScore = scoreVal;
          huntTarget = other;
        }
      }
    }

    // 2. Compute desired goal angle (Hunting cut-off vs High-value loot vs Orb farming)
    let desiredAngle = bot.angle + (Math.random() - 0.5) * 0.28;
    let wantsBoost = false;
    let isGreedyDive = false;

    // Check for juicy loot orbs first
    let bestLootOrb: Orb | null = null;
    let bestLootPriority = -Infinity;
    for (let i = 0; i < nearOrbs.length; i++) {
      const orb = nearOrbs[i];
      const d2 = distSq(bot.x, bot.y, orb.x, orb.y);
      if (d2 > 500 * 500) continue;
      const d = Math.sqrt(d2) + 24;
      const mult = orb.kind === 'loot' || orb.kind === 'star' ? 3.8 : orb.kind === 'core' ? 4.2 : 1.1;
      const prio = (orb.value * mult) / d;
      if (prio > bestLootPriority) {
        bestLootPriority = prio;
        bestLootOrb = orb;
      }
    }

    if (
      bestLootOrb &&
      (bestLootOrb.kind === 'loot' || bestLootOrb.kind === 'star' || bestLootOrb.value >= 10)
    ) {
      desiredAngle = Math.atan2(bestLootOrb.y - bot.y, bestLootOrb.x - bot.x);
      wantsBoost = tier !== 'weak' && bot.score > 35 && bestLootOrb.value >= 8 && Math.random() < 0.65;
      // Weak bots occasionally tunnel-vision onto shiny loot piles
      isGreedyDive = tier === 'weak' && Math.random() < 0.35;
    } else if (huntTarget && (tier === 'strong' || tier === 'titan')) {
      // Tactical Cut-Off / Ambush Maneuver: sprint ahead of target's nose, then cut across!
      const toMeX = bot.x - huntTarget.x;
      const toMeY = bot.y - huntTarget.y;
      const tCos = Math.cos(huntTarget.angle);
      const tSin = Math.sin(huntTarget.angle);
      const forwardLead = toMeX * tCos + toMeY * tSin; // > 0 means bot is already ahead of target's head!
      const lateralOffset = toMeX * -tSin + toMeY * tCos;

      if (forwardLead > 45 && Math.abs(lateralOffset) < 210) {
        // Already ahead of target's nose — swerve sharply across their path to cut them off!
        const cutSign = lateralOffset >= 0 ? -1 : 1;
        desiredAngle = normalizeAngle(huntTarget.angle + cutSign * 1.18);
        wantsBoost = bot.score > 35;
        if (now >= bot.abilityCooldownUntil && Math.random() < 0.22) {
          this.castAbility(bot, now);
        }
      } else {
        // Sprint toward an intercept point ahead of the target's trajectory
        const leadDist = tier === 'titan' ? 235 : 185;
        const sideSign = lateralOffset >= 0 ? 1 : -1;
        const flankOffset = Math.max(55, bot.radius + huntTarget.radius + 38) * sideSign;
        const ix = huntTarget.x + tCos * leadDist + -tSin * flankOffset;
        const iy = huntTarget.y + tSin * leadDist + tCos * flankOffset;
        desiredAngle = Math.atan2(iy - bot.y, ix - bot.x);
        wantsBoost =
          bot.score > 50 &&
          closestEnemyHeadDist < 420 &&
          Math.random() < (tier === 'titan' ? 0.68 : 0.52);
      }
    } else if (bestLootOrb && (bestLootOrb.value >= 4 || !humanPlayer || distToHuman > 1850)) {
      desiredAngle = Math.atan2(bestLootOrb.y - bot.y, bestLootOrb.x - bot.x);
      wantsBoost = false;
    } else if (humanPlayer && distToHuman < 1850 && distToHuman > 260) {
      // Natural approach towards player: Bots gravitate towards the player's sector!
      const angleToPlayer = Math.atan2(humanPlayer.y - bot.y, humanPlayer.x - bot.x);
      const wander = (Math.random() - 0.5) * (tier === 'weak' ? 0.65 : 0.35);
      desiredAngle = angleToPlayer + wander;
      wantsBoost = tier === 'strong' && distToHuman < 700 && Math.random() < 0.45;
    } else if (bestLootOrb) {
      desiredAngle = Math.atan2(bestLootOrb.y - bot.y, bestLootOrb.x - bot.x);
      wantsBoost = false;
    } else {
      // Gently steer back toward central arena if drifting far out
      const distFromCenter = Math.hypot(bot.x, bot.y);
      if (distFromCenter > this.worldHalfSize * 0.78) {
        desiredAngle = Math.atan2(-bot.y, -bot.x) + (Math.random() - 0.5) * 0.5;
      }
    }

    // 3. Multi-Ray Obstacle & Body Avoidance (prevents bots from crashing into bodies!)
    const effectiveLookAhead = isGreedyDive ? lookAhead * 0.52 : lookAhead;
    const forwardClearance = this.measureRayClearance(
      bot,
      bot.angle,
      effectiveLookAhead,
      nearSegs,
      now,
      safetyPad
    );
    const desiredClearance = this.measureRayClearance(
      bot,
      desiredAngle,
      effectiveLookAhead,
      nearSegs,
      now,
      safetyPad
    );

    const dangerThreshold = effectiveLookAhead * (tier === 'weak' ? 0.58 : 0.76);

    if (desiredClearance >= dangerThreshold && forwardClearance >= dangerThreshold * 0.65) {
      // Desired path is safe and clear!
      bot.targetAngle = normalizeAngle(desiredAngle);
      bot.isBoosting = wantsBoost;
      return;
    }

    // Danger ahead! Scan 10 candidate steering angles to find the widest safe escape corridor
    const candidateOffsets = [
      0,
      -0.36,
      0.36,
      -0.74,
      0.74,
      -1.18,
      1.18,
      -1.68,
      1.68,
      -2.35,
      2.35,
    ];

    let bestEscapeAngle = bot.angle;
    let bestEscapeScore = -Infinity;
    let bestRawClearance = 0;

    for (let c = 0; c < candidateOffsets.length; c++) {
      const candAngle = normalizeAngle(bot.angle + candidateOffsets[c]);
      const clearance = this.measureRayClearance(
        bot,
        candAngle,
        lookAhead * 1.1,
        nearSegs,
        now,
        safetyPad
      );
      const goalDiff = Math.abs(shortestAngleDiff(candAngle, desiredAngle));
      const turnPenalty = Math.abs(candidateOffsets[c]) * 14 + goalDiff * 12;
      const score = clearance - turnPenalty;

      if (score > bestEscapeScore) {
        bestEscapeScore = score;
        bestEscapeAngle = candAngle;
        bestRawClearance = clearance;
      }
    }

    bot.targetAngle = bestEscapeAngle;

    // Never boost blindly INTO an obstacle; only boost if escape corridor is open & an enemy is right on us!
    const turnNeeded = Math.abs(shortestAngleDiff(bot.angle, bestEscapeAngle));
    if (forwardClearance < bot.radius * 3.2 + 70 || turnNeeded > 0.65) {
      bot.isBoosting = false;
    } else if (
      tier !== 'weak' &&
      bestRawClearance > lookAhead * 0.7 &&
      closestEnemyHeadDist < 220 &&
      bot.score > 45
    ) {
      bot.isBoosting = true;
    } else {
      bot.isBoosting = false;
    }

    // Smart defensive ability cast when cornered!
    if (
      (tier === 'strong' || tier === 'titan') &&
      forwardClearance < bot.radius * 2.5 + 55 &&
      now >= bot.abilityCooldownUntil &&
      Math.random() < 0.35
    ) {
      this.castAbility(bot, now);
    }
  }

  public getHumanCount(): number {
    let count = 0;
    for (const s of this.snakes.values()) {
      if (s.alive && !s.isBot) count++;
    }
    return count;
  }

  public getTotalActiveSnakes(): number {
    return this.cachedTotalPlayers || this.snakes.size;
  }

  public getRankForId(id: string): number {
    return this.cachedRanks[id] || this.cachedTotalPlayers || 1;
  }

  public buildSnapshot(
    now = Date.now(),
    viewport?: { x: number; y: number; halfW: number; halfH: number },
    consumeEvents = true,
    selfId?: string
  ): WorldSnapshot {
    const events = consumeEvents
      ? this.pendingEvents.splice(0, this.pendingEvents.length)
      : [...this.pendingEvents];

    const visibleSnakes: SnakeEntity[] = [];

    for (const s of this.snakes.values()) {
      if (!s.alive) continue;
      if (!viewport || s.id === selfId) {
        visibleSnakes.push(s);
      } else {
        const margin = s.segments.length * s.radius * 0.75 + 260;
        if (
          Math.abs(s.x - viewport.x) <= viewport.halfW + margin &&
          Math.abs(s.y - viewport.y) <= viewport.halfH + margin
        ) {
          visibleSnakes.push(s);
        }
      }
    }

    let visibleOrbs: Orb[];
    if (!viewport) {
      visibleOrbs = Array.from(this.orbs.values());
    } else {
      visibleOrbs = [];
      const minCx = Math.floor((viewport.x - viewport.halfW) / CELL_SIZE);
      const maxCx = Math.floor((viewport.x + viewport.halfW) / CELL_SIZE);
      const minCy = Math.floor((viewport.y - viewport.halfH) / CELL_SIZE);
      const maxCy = Math.floor((viewport.y + viewport.halfH) / CELL_SIZE);
      for (let cx = minCx; cx <= maxCx; cx++) {
        for (let cy = minCy; cy <= maxCy; cy++) {
          const bucket = this.orbGrid.get(cellKey(cx, cy));
          if (!bucket) continue;
          for (let i = 0; i < bucket.length; i++) {
            const o = bucket[i];
            if (
              Math.abs(o.x - viewport.x) <= viewport.halfW &&
              Math.abs(o.y - viewport.y) <= viewport.halfH
            ) {
              visibleOrbs.push(o);
            }
          }
        }
      }
    }

    return {
      now,
      mapId: this.map.id,
      worldHalfSize: this.worldHalfSize,
      totalPlayers: this.cachedTotalPlayers,
      serverInstanceIndex: this.serverInstanceIndex,
      snakes: visibleSnakes,
      orbs: visibleOrbs,
      hazards: Array.from(this.hazards.values()),
      leaderboard: this.cachedLeaderboard,
      ranksById: this.cachedRanks,
      minimapDots: this.cachedMinimapDots,
      events,
    };
  }
}

export function getAllMapIds(): MapId[] {
  return ARENA_MAPS.map((m) => m.id);
}

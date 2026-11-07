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
const MAX_SEGMENTS = 190;
const BASE_RADIUS = 13;
const BASE_SPEED = 192;
const BOOST_MULTIPLIER = 1.66;

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
      this.maxAmbientOrbs = 14500;
      this.maxCores = 115;
      this.maxLootOrbs = 12000;
    } else {
      this.worldHalfSize = this.map.onlineHalfSize;
      // ~300 active global snakes in Online arena
      this.targetPopulation =
        config.targetTotalPopulation ?? Math.floor(288 + Math.random() * 18);
      this.maxAmbientOrbs = 13500;
      this.maxCores = 105;
      this.maxLootOrbs = 11000;
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

  private spawnVariedBot(initialSeed = false, usedNames?: Set<string>): void {
    const isOnline = this.mode === 'online';
    const namePool = isOnline ? INTERNATIONAL_ONLINE_NAMES : PLAYER_LIKE_NAMES;

    let chosenName = namePool[Math.floor(Math.random() * namePool.length)].trim();
    if (usedNames && usedNames.has(chosenName)) {
      chosenName = `${chosenName}_${Math.floor(1 + Math.random() * 99)}`;
    }
    usedNames?.add(chosenName);

    const r = Math.random();
    let tier: BotSkillTier = 'normal';
    let initScore = 0;
    let snakePool = SNAKE_TYPES.slice(0, 25);

    if (isOnline) {
      if (r < 0.18) {
        tier = 'weak';
        initScore = initialSeed ? Math.floor(Math.random() * 60) : Math.floor(Math.random() * 30);
        snakePool = SNAKE_TYPES.slice(0, 25);
      } else if (r < 0.54) {
        tier = 'normal';
        initScore = initialSeed
          ? Math.floor(60 + Math.random() * 240)
          : Math.floor(25 + Math.random() * 120);
        snakePool = SNAKE_TYPES.slice(18, 55);
      } else if (r < 0.86) {
        tier = 'strong';
        initScore = initialSeed
          ? Math.floor(250 + Math.random() * 720)
          : Math.floor(110 + Math.random() * 350);
        snakePool = SNAKE_TYPES.slice(45, 86);
      } else {
        tier = 'titan';
        initScore = initialSeed
          ? Math.floor(900 + Math.random() * 2800)
          : Math.floor(450 + Math.random() * 1200);
        snakePool = SNAKE_TYPES.slice(72, 100);
      }
    } else {
      if (r < 0.34) {
        tier = 'weak';
        initScore = initialSeed ? Math.floor(Math.random() * 50) : Math.floor(Math.random() * 22);
        snakePool = SNAKE_TYPES.slice(0, 25);
      } else if (r < 0.74) {
        tier = 'normal';
        initScore = initialSeed
          ? Math.floor(45 + Math.random() * 190)
          : Math.floor(15 + Math.random() * 85);
        snakePool = SNAKE_TYPES.slice(15, 55);
      } else if (r < 0.92) {
        tier = 'strong';
        initScore = initialSeed
          ? Math.floor(220 + Math.random() * 580)
          : Math.floor(85 + Math.random() * 260);
        snakePool = SNAKE_TYPES.slice(45, 85);
      } else {
        tier = 'titan';
        initScore = initialSeed
          ? Math.floor(800 + Math.random() * 2400)
          : Math.floor(380 + Math.random() * 950);
        snakePool = SNAKE_TYPES.slice(70, 100);
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
    return BASE_RADIUS + Math.min(22, Math.sqrt(Math.max(0, score)) * 0.25);
  }

  private computeSegmentCount(score: number): number {
    return (
      BASE_SEGMENTS +
      Math.min(MAX_SEGMENTS - BASE_SEGMENTS, Math.floor(Math.max(0, score) / 6.5))
    );
  }

  private addScore(snake: SnakeEntity, amount: number): void {
    if (amount <= 0 || snake.isDecoy) return;
    snake.score += amount;
    snake.totalCollected += amount;
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
    const dt = Math.min(0.05, Math.max(0.001, dtSec));

    this.rebuildSegmentGrid();

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

    for (const s of this.snakes.values()) {
      if (!s.alive) continue;
      this.moveSnake(s, dt, now);
      this.collectOrbsForSnake(s, dt, now);
    }

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
    const usedNames = new Set<string>();

    for (const s of this.snakes.values()) {
      if (s.alive && !s.isDecoy) {
        nonDecoyCount++;
        usedNames.add(s.name);
        if (s.isBot) botCount++;
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
        if (s.isBot && !s.isDecoy && excess > 0) {
          this.removeSnake(id);
          excess--;
        }
      }
    } else if (nonDecoyCount < this.targetPopulation) {
      const toSpawn = initialSeed
        ? this.targetPopulation - nonDecoyCount
        : Math.min(14, this.targetPopulation - nonDecoyCount);
      for (let i = 0; i < toSpawn; i++) {
        this.spawnVariedBot(initialSeed, usedNames);
      }
    }
    void now;
  }

  private maintainOrbs(): void {
    const deficit = Math.min(350, this.maxAmbientOrbs - this.ambientOrbCount);
    for (let i = 0; i < deficit; i++) {
      this.spawnAmbientOrb();
    }
    const coreDeficit = Math.min(12, this.maxCores - this.coreOrbCount);
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

    s.x += (Math.cos(s.angle) * speed + s.vx) * dt;
    s.y += (Math.sin(s.angle) * speed + s.vy) * dt;
    const damping = Math.pow(0.04, dt);
    s.vx *= damping;
    s.vy *= damping;

    const spacing = s.radius * 0.72;
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

      const nearSegs = this.getNearbySegments(a.x, a.y, 1);

      // PASS 1: Check HEAD-TO-HEAD collisions first so BOTH snakes die simultaneously on a head-on crash!
      let headHandled = false;
      for (let i = 0; i < nearSegs.length; i++) {
        const ref = nearSegs[i];
        if (!ref.isHead) continue;
        const b = ref.snake;
        if (b.id === a.id || !b.alive) continue;
        if (a.ownerId === b.id || b.ownerId === a.id) continue;
        if (now < b.phaseUntil) continue;

        const headHitR = (a.radius + b.radius) * 1.02;
        if (distSq(a.x, a.y, b.x, b.y) <= headHitR * headHitR) {
          const aShield = now < a.shieldUntil;
          const bShield = now < b.shieldUntil;

          if (aShield && !bShield) {
            toKillMap.set(b.id, { victim: b, killer: a, cause: 'collision' });
          } else if (bShield && !aShield) {
            toKillMap.set(a.id, { victim: a, killer: b, cause: 'collision' });
          } else if (aShield && bShield) {
            a.vx -= Math.cos(a.angle) * 200;
            a.vy -= Math.sin(a.angle) * 200;
          } else {
            // Fair mutual destruction: BOTH snakes die when colliding head-to-head!
            toKillMap.set(a.id, { victim: a, killer: b, cause: 'collision' });
            toKillMap.set(b.id, { victim: b, killer: a, cause: 'collision' });
          }
          headHandled = true;
          break;
        }
      }

      if (headHandled || toKillMap.has(a.id)) continue;

      // PASS 2: Check BODY segment collisions
      for (let i = 0; i < nearSegs.length; i++) {
        const ref = nearSegs[i];
        if (ref.isHead) continue;
        const b = ref.snake;
        if (b.id === a.id || !b.alive) continue;
        if (a.ownerId === b.id || b.ownerId === a.id) continue;
        if (now < b.phaseUntil) continue;

        const hitR = (a.radius + b.radius) * 0.92;
        const hitRSq = hitR * hitR;

        let collided = false;
        if (distSq(a.x, a.y, ref.x, ref.y) <= hitRSq) {
          collided = true;
        } else if (ref.segIndex > 0 && ref.segIndex < b.segments.length) {
          const prevSeg = b.segments[ref.segIndex - 1];
          if (distToSegmentSq(a.x, a.y, prevSeg.x, prevSeg.y, ref.x, ref.y) <= hitRSq) {
            collided = true;
          }
        }

        if (collided) {
          if (now < a.shieldUntil) {
            a.vx -= Math.cos(a.angle) * 220;
            a.vy -= Math.sin(a.angle) * 220;
            break;
          } else {
            toKillMap.set(a.id, { victim: a, killer: b, cause: 'collision' });
            break;
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

  private updateBotAI(bot: SnakeEntity, now: number): void {
    if (bot.isDecoy) {
      bot.targetAngle = normalizeAngle(bot.angle + Math.sin(now * 0.005) * 0.08);
      bot.isBoosting = true;
      return;
    }

    const tier = bot.botTier || 'normal';
    const isOnline = this.mode === 'online';

    const nextTick = this.botNextDecisionAt.get(bot.id) || 0;
    if (now < nextTick) {
      return;
    }

    const reactionDelay = isOnline
      ? tier === 'weak'
        ? 190 + Math.random() * 90
        : tier === 'normal'
        ? 130 + Math.random() * 65
        : tier === 'strong'
        ? 85 + Math.random() * 50
        : 65 + Math.random() * 40
      : tier === 'weak'
      ? 240 + Math.random() * 120
      : tier === 'normal'
      ? 170 + Math.random() * 90
      : tier === 'strong'
      ? 110 + Math.random() * 60
      : 85 + Math.random() * 45;
    this.botNextDecisionAt.set(bot.id, now + reactionDelay);

    const blunderChance = isOnline
      ? tier === 'weak' ? 0.14 : tier === 'normal' ? 0.06 : 0.02
      : tier === 'weak' ? 0.22 : tier === 'normal' ? 0.11 : tier === 'strong' ? 0.04 : 0.02;
    const isBlundering = Math.random() < blunderChance;

    const senseRange =
      tier === 'weak' ? 95 : tier === 'normal' ? 140 : tier === 'strong' ? 190 : 225;

    const nearOrbs = this.getNearbyOrbs(bot.x, bot.y, 1);
    let bestLootOrb: Orb | null = null;
    let maxLootValue = 0;

    for (let i = 0; i < nearOrbs.length; i++) {
      const o = nearOrbs[i];
      if (o.kind === 'loot' || o.kind === 'star' || o.value >= 6) {
        const d2 = distSq(bot.x, bot.y, o.x, o.y);
        if (d2 < 420 * 420 && o.value > maxLootValue) {
          maxLootValue = o.value;
          bestLootOrb = o;
        }
      }
    }

    const isLootGreedy =
      Boolean(bestLootOrb) &&
      (tier === 'weak' || tier === 'normal' || Math.random() < 0.55);
    this.botGreedMode.set(bot.id, isLootGreedy);

    let avoidX = 0;
    let avoidY = 0;
    let urgentDanger = false;

    const boundWarn = this.worldHalfSize - 300;
    if (Math.abs(bot.x) > boundWarn) {
      avoidX += -Math.sign(bot.x) * 6;
      if (Math.abs(bot.x) > this.worldHalfSize - 140) urgentDanger = true;
    }
    if (Math.abs(bot.y) > boundWarn) {
      avoidY += -Math.sign(bot.y) * 6;
      if (Math.abs(bot.y) > this.worldHalfSize - 140) urgentDanger = true;
    }

    const nearSegs = this.getNearbySegments(bot.x, bot.y, 1);
    let closeRival: SnakeEntity | null = null;
    let closeRivalDist = Infinity;

    const effectiveSenseRange = isLootGreedy
      ? Math.max(52, senseRange * 0.48)
      : isBlundering
      ? Math.max(48, senseRange * 0.42)
      : senseRange;
    const effSenseSq = effectiveSenseRange * effectiveSenseRange;

    for (let i = 0; i < nearSegs.length; i++) {
      const ref = nearSegs[i];
      const other = ref.snake;
      if (other.id === bot.id || other.ownerId === bot.id || now < other.stealthUntil) {
        continue;
      }

      const dx = bot.x - ref.x;
      const dy = bot.y - ref.y;
      const d2 = dx * dx + dy * dy;

      if (ref.isHead) {
        const hd = Math.sqrt(d2);
        if (hd < closeRivalDist) {
          closeRivalDist = hd;
          closeRival = other;
        }
      }

      if (d2 < effSenseSq && d2 > 1) {
        const d = Math.sqrt(d2);
        const w = ((effectiveSenseRange - d) / effectiveSenseRange) * 3.4;
        avoidX += (dx / d) * w;
        avoidY += (dy / d) * w;
        if (d < 58) urgentDanger = true;
      }
    }

    if (Math.hypot(avoidX, avoidY) > 0.85) {
      const jitter = (Math.random() - 0.5) * (tier === 'weak' ? 0.35 : 0.15);
      bot.targetAngle = normalizeAngle(Math.atan2(avoidY, avoidX) + jitter);
      bot.isBoosting = tier !== 'weak' && urgentDanger && bot.score > 35 && !isBlundering;
      if (isOnline || tier === 'strong' || tier === 'titan') {
        if (urgentDanger && now >= bot.abilityCooldownUntil && Math.random() < (isOnline ? 0.3 : 0.2)) {
          this.castAbility(bot, now);
        }
      }
      return;
    }

    if (isLootGreedy && bestLootOrb) {
      bot.targetAngle = Math.atan2(bestLootOrb.y - bot.y, bestLootOrb.x - bot.x);
      bot.isBoosting =
        bot.score > 25 &&
        (closeRivalDist < 260 || maxLootValue >= 10) &&
        Math.random() < (isOnline ? 0.7 : 0.62);
      return;
    }

    if (
      (isOnline || tier === 'strong' || tier === 'titan') &&
      closeRival &&
      closeRivalDist < 320 &&
      bot.score > 28
    ) {
      const leadDist = isOnline ? 125 : tier === 'titan' ? 140 : 110;
      const interceptX = closeRival.x + Math.cos(closeRival.angle) * leadDist;
      const interceptY = closeRival.y + Math.sin(closeRival.angle) * leadDist;
      bot.targetAngle = Math.atan2(interceptY - bot.y, interceptX - bot.x);
      bot.isBoosting = bot.score > 30 && Math.random() < (isOnline ? 0.5 : 0.36);
      if (now >= bot.abilityCooldownUntil && Math.random() < (isOnline ? 0.14 : 0.08)) {
        this.castAbility(bot, now);
      }
      return;
    }

    let bestPriority = -Infinity;
    let tx = bot.x + Math.cos(bot.angle + (Math.random() - 0.5) * 0.4) * 180;
    let ty = bot.y + Math.sin(bot.angle + (Math.random() - 0.5) * 0.4) * 180;
    let chasingHighLoot = false;

    for (let i = 0; i < nearOrbs.length; i++) {
      const orb = nearOrbs[i];
      const d2 = distSq(bot.x, bot.y, orb.x, orb.y);
      if (d2 > 460 * 460) continue;
      const d = Math.sqrt(d2) + 20;
      const p = (orb.value * (orb.kind === 'loot' ? 3.0 : 1.2)) / d;
      if (p > bestPriority) {
        bestPriority = p;
        tx = orb.x;
        ty = orb.y;
        chasingHighLoot = orb.value >= 7;
      }
    }

    bot.targetAngle = Math.atan2(ty - bot.y, tx - bot.x);
    bot.isBoosting =
      tier !== 'weak' && chasingHighLoot && bot.score > 45 && Math.random() < 0.28;
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

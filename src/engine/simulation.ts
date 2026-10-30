import { PLAYER_LIKE_NAMES } from '@/data/achievements';
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
const BASE_SPEED = 190;
const BOOST_MULTIPLIER = 1.65;

const CELL_SIZE = 420;

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

function cellKey(cx: number, cy: number): number {
  // Fast integer spatial hash key (supports coordinates from -65000 to +65000)
  return ((cx + 512) << 10) ^ (cy + 512);
}

export interface SimulationConfig {
  mapId: MapId;
  mode: GameMode;
  targetTotalPopulation?: number; // Offline: 80-150 (default ~112); Online: ~55 (50-60)
  serverInstanceIndex?: number;
}

interface SegRef {
  snake: SnakeEntity;
  x: number;
  y: number;
  isHead: boolean;
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

  private orbGrid: Map<number, Orb[]> = new Map();
  private segGrid: Map<number, SegRef[]> = new Map();
  private cachedRanks: Record<string, number> = {};
  private cachedLeaderboard: LeaderboardEntry[] = [];
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
      // Dynamic offline bot count inside 80-150 range (e.g. 105-128)
      this.targetPopulation =
        config.targetTotalPopulation ?? Math.floor(105 + Math.random() * 24);
      this.maxAmbientOrbs = 5850; // 3x increased ground score orbs (was 1950)
      this.maxCores = 42;         // 3x increased core energy stars (was 14)
      this.maxLootOrbs = 2700;    // 3x capacity for death loot (was 900)
    } else {
      this.worldHalfSize = this.map.onlineHalfSize;
      // Online target total population: 52-58 snakes (blending humans + seamless bots)
      this.targetPopulation =
        config.targetTotalPopulation ?? Math.floor(53 + Math.random() * 5);
      this.maxAmbientOrbs = 3150; // 3x increased ground score orbs (was 1050)
      this.maxCores = 24;         // 3x increased core energy stars (was 8)
      this.maxLootOrbs = 1650;    // 3x capacity for death loot (was 550)
    }

    this.seedInitialOrbs();
    this.maintainPopulation(Date.now(), true);
    this.recomputeRanks();
  }

  private nextId(prefix: string): string {
    this.idCounter += 1;
    return `${prefix}_${this.idCounter.toString(36)}`;
  }

  private rebuildSpatialGrids(): void {
    this.orbGrid.clear();
    this.segGrid.clear();

    for (const orb of this.orbs.values()) {
      const cx = Math.floor(orb.x / CELL_SIZE);
      const cy = Math.floor(orb.y / CELL_SIZE);
      const key = cellKey(cx, cy);
      let bucket = this.orbGrid.get(key);
      if (!bucket) {
        bucket = [];
        this.orbGrid.set(key, bucket);
      }
      bucket.push(orb);
    }

    for (const s of this.snakes.values()) {
      if (!s.alive) continue;
      // Index head + every 2nd segment (since spacing is ~0.7*radius, every 2nd segment still overlaps cleanly with generous hit radius!)
      for (let i = 0; i < s.segments.length; i++) {
        if (i > 2 && i % 2 !== 0 && i !== s.segments.length - 1) continue;
        const seg = s.segments[i];
        const cx = Math.floor(seg.x / CELL_SIZE);
        const cy = Math.floor(seg.y / CELL_SIZE);
        const key = cellKey(cx, cy);
        let bucket = this.segGrid.get(key);
        if (!bucket) {
          bucket = [];
          this.segGrid.set(key, bucket);
        }
        bucket.push({
          snake: s,
          x: seg.x,
          y: seg.y,
          isHead: i === 0,
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
        if (b) {
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
        if (b) {
          for (let i = 0; i < b.length; i++) result.push(b[i]);
        }
      }
    }
    return result;
  }

  private findSafePoint(marginFromBorder = 360): { x: number; y: number } {
    const bound = this.worldHalfSize - marginFromBorder;
    for (let attempt = 0; attempt < 24; attempt++) {
      const x = (Math.random() * 2 - 1) * bound;
      const y = (Math.random() * 2 - 1) * bound;

      let crowded = false;
      for (const s of this.snakes.values()) {
        if (!s.alive) continue;
        if (distSq(x, y, s.x, s.y) < 260 * 260) {
          crowded = true;
          break;
        }
      }
      if (!crowded) return { x, y };
    }
    return {
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
    const bound = this.worldHalfSize - 70;
    const x = (Math.random() * 2 - 1) * bound;
    const y = (Math.random() * 2 - 1) * bound;
    const roll = Math.random();
    const value = roll > 0.9 ? 5 : roll > 0.55 ? 3 : 2;
    const palette = this.map.orbPalette;
    const color = palette[Math.floor(Math.random() * palette.length)];
    const id = this.nextId('orb');
    this.orbs.set(id, {
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
    const zone = this.worldHalfSize * 0.45;
    const x = (Math.random() * 2 - 1) * zone;
    const y = (Math.random() * 2 - 1) * zone;
    const id = this.nextId('core');
    this.orbs.set(id, {
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
    const maxB = this.worldHalfSize - 35;
    const cx = Math.max(-maxB, Math.min(maxB, x));
    const cy = Math.max(-maxB, Math.min(maxB, y));
    const id = this.nextId('loot');
    const radius = Math.min(13, 5.4 + Math.sqrt(value) * 1.05);
    this.orbs.set(id, {
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
    const pos = this.findSafePoint(360);
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
      shieldUntil: now + 1800, // Spawn safety
      phaseUntil: 0,
      freeBoostUntil: 0,
      wideViewUntil: 0,
      alive: true,
    };

    this.snakes.set(id, snake);
    return snake;
  }

  private spawnVariedBot(initialSeed = false): void {
    const usedNames = new Set<string>();
    for (const s of this.snakes.values()) {
      if (s.alive) usedNames.add(s.name);
    }

    let chosenName =
      PLAYER_LIKE_NAMES[Math.floor(Math.random() * PLAYER_LIKE_NAMES.length)];
    if (usedNames.has(chosenName)) {
      chosenName = `${chosenName}${Math.floor(1 + Math.random() * 99)}`;
    }

    // Skill & Strength distribution:
    // 36% Weak, 40% Normal, 17% Strong, 7% Titan Boss!
    const r = Math.random();
    let tier: BotSkillTier = 'normal';
    let initScore = 0;
    let snakePool = SNAKE_TYPES.slice(0, 13);

    if (r < 0.36) {
      tier = 'weak';
      initScore = initialSeed ? Math.floor(Math.random() * 45) : Math.floor(Math.random() * 20);
      snakePool = SNAKE_TYPES.slice(0, 8);
    } else if (r < 0.76) {
      tier = 'normal';
      initScore = initialSeed
        ? Math.floor(40 + Math.random() * 170)
        : Math.floor(15 + Math.random() * 80);
      snakePool = SNAKE_TYPES.slice(3, 20);
    } else if (r < 0.93) {
      tier = 'strong';
      initScore = initialSeed
        ? Math.floor(200 + Math.random() * 520)
        : Math.floor(80 + Math.random() * 240);
      snakePool = SNAKE_TYPES.slice(12, 30);
    } else {
      tier = 'titan';
      initScore = initialSeed
        ? Math.floor(750 + Math.random() * 1950)
        : Math.floor(350 + Math.random() * 850);
      snakePool = SNAKE_TYPES.slice(20, 35);
    }

    const pickedSnake = snakePool[Math.floor(Math.random() * snakePool.length)] || SNAKE_TYPES[0];
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
    return BASE_RADIUS + Math.min(20, Math.sqrt(Math.max(0, score)) * 0.25);
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

  /**
   * 50% ECONOMY BALANCE RULE:
   * Exact 50% of victim's score drops as loot orbs on death.
   */
  public killSnake(
    victim: SnakeEntity,
    cause: 'collision' | 'border' | 'ability',
    killer?: SnakeEntity,
    now = Date.now()
  ): number {
    if (!victim.alive) return 0;
    victim.alive = false;

    if (victim.isDecoy) {
      this.snakes.delete(victim.id);
      return 0;
    }

    const spec = getSnakeSpec(victim.snakeTypeId);
    const exactHalfScore = Math.floor(Math.max(0, victim.score) * 0.5);

    if (exactHalfScore > 0) {
      this.trimExcessLootOrbs();

      const maxPieces = Math.max(
        1,
        Math.min(victim.segments.length, 26, exactHalfScore)
      );
      const basePieceValue = Math.max(1, Math.floor(exactHalfScore / maxPieces));
      let remaining = exactHalfScore;

      for (let i = 0; i < maxPieces && remaining > 0; i++) {
        const pieceVal =
          i === maxPieces - 1 ? remaining : Math.min(remaining, basePieceValue);
        remaining -= pieceVal;

        const segIdx = Math.min(
          victim.segments.length - 1,
          Math.floor((i / maxPieces) * victim.segments.length)
        );
        const seg = victim.segments[segIdx] || { x: victim.x, y: victim.y };
        const jitterX = (Math.random() - 0.5) * 18;
        const jitterY = (Math.random() - 0.5) * 18;
        this.spawnOrbAt(
          seg.x + jitterX,
          seg.y + jitterY,
          pieceVal,
          'loot',
          spec.primaryColor
        );
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
        value: exactHalfScore,
        color: spec.primaryColor,
      });
    }

    this.pendingEvents.push({
      type: 'death',
      actorId: victim.id,
      targetId: killer?.id,
      x: victim.x,
      y: victim.y,
      value: exactHalfScore,
      color: spec.primaryColor,
    });

    void cause;
    return exactHalfScore;
  }

  private trimExcessLootOrbs(): void {
    let lootCount = 0;
    for (const o of this.orbs.values()) {
      if (o.kind === 'loot') lootCount++;
    }
    if (lootCount <= this.maxLootOrbs) return;
    let toRemove = lootCount - this.maxLootOrbs;
    for (const [id, o] of this.orbs.entries()) {
      if (o.kind === 'loot') {
        this.orbs.delete(id);
        toRemove--;
        if (toRemove <= 0) break;
      }
    }
  }

  private spawnLaserWave(snake: SnakeEntity, angleOffset: number, now: number, color: string): void {
    const a = snake.angle + angleOffset;
    const speed = 660;
    const hid = this.nextId('hz');
    this.hazards.set(hid, {
      id: hid,
      ownerId: snake.id,
      kind: 'laser_wave',
      x: snake.x + Math.cos(a) * (snake.radius + 16),
      y: snake.y + Math.sin(a) * (snake.radius + 16),
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      radius: 34,
      createdAt: now,
      expiresAt: now + 1500,
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
    const near = this.getNearbySegments(snake.x, snake.y, 1);
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
    const orbs = this.getNearbyOrbs(x, y, 1);
    let converted = 0;
    const rSq = radius * radius;
    for (const orb of orbs) {
      if (orb.kind === 'ambient' && distSq(x, y, orb.x, orb.y) <= rSq) {
        orb.kind = 'star';
        orb.value = 10;
        orb.color = '#facc15';
        orb.radius = 9.2;
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
          if (o.id !== snake.id && now >= o.shieldUntil && distSq(snake.x, snake.y, o.x, o.y) <= 340 * 340) {
            o.slowedUntil = Math.max(o.slowedUntil, now + durMs);
          }
        }
        break;
      }

      case 'ghost_phase':
        snake.phaseUntil = Math.max(snake.phaseUntil, now + durMs);
        break;

      case 'forward_blink': {
        const blinkDist = 250;
        const safeB = this.worldHalfSize - 55;
        const nx = Math.max(-safeB, Math.min(safeB, snake.x + Math.cos(snake.angle) * blinkDist));
        const ny = Math.max(-safeB, Math.min(safeB, snake.y + Math.sin(snake.angle) * blinkDist));
        const dx = nx - snake.x;
        const dy = ny - snake.y;
        snake.x = nx;
        snake.y = ny;
        for (let i = 0; i < snake.segments.length; i++) {
          const factor = Math.max(0.25, 1 - i / (snake.segments.length + 4));
          snake.segments[i].x += dx * factor;
          snake.segments[i].y += dy * factor;
        }
        snake.phaseUntil = Math.max(snake.phaseUntil, now + 700);
        break;
      }

      case 'shock_push':
        this.pushNearbyEnemies(snake, 330, 520, now);
        break;

      case 'eagle_vision':
        snake.wideViewUntil = Math.max(snake.wideViewUntil, now + durMs);
        break;

      case 'decoy_clone':
        snake.stealthUntil = Math.max(snake.stealthUntil, now + 3200);
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
          radius: 250,
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
        this.upgradeNearbyOrbsToStars(snake.x, snake.y, 360, 12);
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
          radius: 230,
          createdAt: now,
          expiresAt: now + durMs,
          color: '#dc2626',
        });
        break;
      }

      case 'thorn_reflect':
        snake.shieldUntil = Math.max(snake.shieldUntil, now + durMs);
        this.pushNearbyEnemies(snake, 260, 420, now);
        break;

      case 'sunflare_nova': {
        snake.freeBoostUntil = Math.max(snake.freeBoostUntil, now + durMs);
        const near = this.getNearbySegments(snake.x, snake.y, 1);
        const hit = new Set<string>();
        for (const ref of near) {
          if (!ref.isHead) continue;
          const o = ref.snake;
          if (o.id === snake.id || hit.has(o.id) || now < o.shieldUntil) continue;
          if (distSq(snake.x, snake.y, o.x, o.y) <= 340 * 340) {
            hit.add(o.id);
            const cut = Math.min(40, Math.floor(o.score * 0.16));
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
          if (!ref.isHead || struck.size >= 4) break;
          const o = ref.snake;
          if (o.id === snake.id || struck.has(o.id) || now < o.shieldUntil) continue;
          if (distSq(snake.x, snake.y, o.x, o.y) <= 390 * 390) {
            struck.add(o.id);
            o.slowedUntil = Math.max(o.slowedUntil, now + 2600);
            const cut = Math.min(60, Math.floor(o.score * 0.2));
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
        this.pushNearbyEnemies(snake, 360, 560, now);
        this.upgradeNearbyOrbsToStars(snake.x, snake.y, 380, 16);
        snake.shieldUntil = Math.max(snake.shieldUntil, now + durMs);
        break;

      case 'supernova_collapse':
        this.pushNearbyEnemies(snake, 360, 540, now);
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

      case 'sovereign_dominion':
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

    // Rebuild spatial grid for O(1) neighbor queries
    this.rebuildSpatialGrids();

    if (now - this.lastMaintainAt > 1000) {
      this.lastMaintainAt = now;
      this.maintainPopulation(now, false);
      this.maintainOrbs();
    }

    for (const s of this.snakes.values()) {
      if (!s.alive) continue;
      if (s.isDecoy && now - s.spawnedAt > 4000) {
        this.snakes.delete(s.id);
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
      this.collectOrbsForSnake(s, now);
    }

    this.resolveCollisions(now);

    if (now - this.lastRankSortAt > 250) {
      this.lastRankSortAt = now;
      this.recomputeRanks();
    }
  }

  private recomputeRanks(): void {
    const aliveList = Array.from(this.snakes.values())
      .filter((s) => s.alive && !s.isDecoy)
      .sort((a, b) => b.score - a.score);

    this.cachedTotalPlayers = aliveList.length;
    const ranks: Record<string, number> = {};
    for (let i = 0; i < aliveList.length; i++) {
      const rank = i + 1;
      const s = aliveList[i];
      ranks[s.id] = rank;
      if (rank < s.bestRank) {
        s.bestRank = rank;
      }
    }
    this.cachedRanks = ranks;
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
    for (const s of this.snakes.values()) {
      if (s.alive && !s.isDecoy) {
        nonDecoyCount++;
        if (s.isBot) botCount++;
      }
    }

    // Gently fluctuate target in Offline (85..140) and Online (52..58)
    if (!initialSeed && Math.random() < 0.08) {
      if (this.mode === 'offline') {
        this.targetPopulation = Math.max(
          85,
          Math.min(140, this.targetPopulation + (Math.random() < 0.5 ? -2 : 2))
        );
      } else {
        this.targetPopulation = Math.max(
          52,
          Math.min(58, this.targetPopulation + (Math.random() < 0.5 ? -1 : 1))
        );
      }
    }

    // If total exceeds target (e.g. more humans joined in Online mode), remove excess bots seamlessly
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
        : Math.min(8, this.targetPopulation - nonDecoyCount);
      for (let i = 0; i < toSpawn; i++) {
        this.spawnVariedBot(initialSeed);
      }
    }
    void now;
  }

  private maintainOrbs(): void {
    let ambientCount = 0;
    let coreCount = 0;
    for (const o of this.orbs.values()) {
      if (o.kind === 'ambient') ambientCount++;
      else if (o.kind === 'core') coreCount++;
    }
    const deficit = Math.min(180, this.maxAmbientOrbs - ambientCount);
    for (let i = 0; i < deficit; i++) {
      this.spawnAmbientOrb();
    }
    const coreDeficit = Math.min(6, this.maxCores - coreCount);
    for (let i = 0; i < coreDeficit; i++) {
      this.spawnCoreOrb();
    }
  }

  private updateContinuousAbilities(dt: number, now: number): void {
    for (const s of this.snakes.values()) {
      if (!s.alive) continue;

      // Magnet effect
      if (now < s.magnetUntil) {
        const isSuper =
          s.activeEffect === 'supernova_collapse' ||
          s.activeEffect === 'sovereign_dominion' ||
          s.activeEffect === 'soul_scythe';
        const pullR = isSuper ? 440 : 350;
        const pullSpd = isSuper ? 540 : 430;
        const rSq = pullR * pullR;
        const nearOrbs = this.getNearbyOrbs(s.x, s.y, 1);
        for (const orb of nearOrbs) {
          const d2 = distSq(s.x, s.y, orb.x, orb.y);
          if (d2 > 1 && d2 <= rSq) {
            const d = Math.sqrt(d2);
            orb.x += ((s.x - orb.x) / d) * pullSpd * dt;
            orb.y += ((s.y - orb.y) / d) * pullSpd * dt;
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
          this.pushNearbyEnemies(s, 160, 320, now);
          break;
        }

        case 'time_shift':
        case 'abyssal_whirlpool':
        case 'chronos_stop': {
          const r = s.activeEffect === 'chronos_stop' ? 340 : 280;
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
        case 'sovereign_dominion': {
          const accum = (this.passiveScoreAccum.get(s.id) || 0) + dt;
          if (accum >= 0.25) {
            this.passiveScoreAccum.set(s.id, 0);
            const near = this.getNearbySegments(s.x, s.y, 1);
            const drainedIds = new Set<string>();
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
              if (distSq(s.x, s.y, o.x, o.y) <= 290 * 290) {
                drainedIds.add(o.id);
                const amt = Math.min(4, o.score);
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
          if (accum >= 0.45) {
            this.passiveScoreAccum.set(s.id, 0);
            this.addScore(s, 4);
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
            orb.x += ((hz.x - orb.x) / d) * 230 * dt;
            orb.y += ((hz.y - orb.y) / d) * 230 * dt;
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
            const cut = Math.min(80, Math.floor(s.score * 0.25));
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

    const sizePenalty = Math.max(0.55, 1 - Math.sqrt(s.score) * 0.0075);
    let turnRate = (3.4 + spec.turnStat * 0.16) * sizePenalty;
    if (s.isBot && s.botTier === 'weak') turnRate *= 0.78;
    if (s.isBot && s.isBoosting) turnRate *= 0.84; // Natural turning inertia so bots can't snap-turn while boosting
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

    let speed = BASE_SPEED + (spec.speedStat - 7) * 5;
    const freeBoost = now < s.freeBoostUntil;
    const canBoost =
      now >= s.webbedUntil && (freeBoost || (s.isBoosting && s.score >= 6));

    if (freeBoost) {
      speed *= 1.72;
    } else if (canBoost && s.isBoosting) {
      speed *= BOOST_MULTIPLIER;
      const drain = (this.boostDrainAccum.get(s.id) || 0) + dt * 6;
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

    for (let i = 1; i < s.segments.length; i++) {
      const prev = s.segments[i - 1];
      const curr = s.segments[i];
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.0001) {
        curr.x = prev.x + (dx / d) * spacing;
        curr.y = prev.y + (dy / d) * spacing;
      }
    }

    const desiredSegs = this.computeSegmentCount(s.score);
    while (s.segments.length < desiredSegs) {
      const last = s.segments[s.segments.length - 1];
      s.segments.push({ x: last.x, y: last.y });
    }
    if (s.segments.length > desiredSegs) {
      s.segments.length = desiredSegs;
    }
  }

  private collectOrbsForSnake(s: SnakeEntity, now: number): void {
    if (s.isDecoy) return;
    const eatRadius = s.radius + 16;
    const eatSq = eatRadius * eatRadius;
    const multiplier = now < s.doubleScoreUntil ? 2 : 1;

    const nearby = this.getNearbyOrbs(s.x, s.y, 1);
    for (let i = 0; i < nearby.length; i++) {
      const orb = nearby[i];
      if (!this.orbs.has(orb.id)) continue;
      const limitSq = eatSq + orb.radius * orb.radius;
      if (distSq(s.x, s.y, orb.x, orb.y) <= limitSq) {
        const gained = orb.value * multiplier;
        this.addScore(s, gained);
        this.orbs.delete(orb.id);

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
      }
    }
  }

  private resolveCollisions(now: number): void {
    const half = this.worldHalfSize;
    const toKill: Array<{
      victim: SnakeEntity;
      killer?: SnakeEntity;
      cause: 'collision' | 'border';
    }> = [];

    for (const a of this.snakes.values()) {
      if (!a.alive) continue;

      if (
        Math.abs(a.x) + a.radius * 0.65 >= half ||
        Math.abs(a.y) + a.radius * 0.65 >= half
      ) {
        toKill.push({ victim: a, cause: 'border' });
        continue;
      }

      if (now < a.phaseUntil || now < a.shieldUntil) continue;

      const nearSegs = this.getNearbySegments(a.x, a.y, 1);
      for (let i = 0; i < nearSegs.length; i++) {
        const ref = nearSegs[i];
        const b = ref.snake;
        if (b.id === a.id || !b.alive) continue;
        if (a.ownerId === b.id || b.ownerId === a.id) continue;
        if (now < b.phaseUntil) continue;

        const hitR = (a.radius + b.radius) * 0.78;
        if (distSq(a.x, a.y, ref.x, ref.y) <= hitR * hitR) {
          if (ref.isHead) {
            if (now < b.shieldUntil || b.score > a.score * 1.2 + 12) {
              toKill.push({ victim: a, killer: b, cause: 'collision' });
              break;
            } else if (a.score <= b.score * 1.2 + 12) {
              toKill.push({ victim: a, killer: b, cause: 'collision' });
              break;
            }
          } else {
            toKill.push({ victim: a, killer: b, cause: 'collision' });
            break;
          }
        }
      }
    }

    for (const item of toKill) {
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

    // Human-like reaction latency (bots do not execute 60Hz machine reflexes)
    const nextTick = this.botNextDecisionAt.get(bot.id) || 0;
    if (now < nextTick) {
      return;
    }

    // Schedule next decision with tier-specific reaction latency
    const reactionDelay =
      tier === 'weak'
        ? 240 + Math.random() * 120
        : tier === 'normal'
        ? 170 + Math.random() * 90
        : tier === 'strong'
        ? 110 + Math.random() * 60
        : 85 + Math.random() * 45;
    this.botNextDecisionAt.set(bot.id, now + reactionDelay);

    // Natural blunder chance: occasionally bot gets distracted or misses a turn
    const blunderChance =
      tier === 'weak' ? 0.22 : tier === 'normal' ? 0.11 : tier === 'strong' ? 0.04 : 0.02;
    const isBlundering = Math.random() < blunderChance;

    // Forgiving sense range so bots don't coward away from 300px afar
    const senseRange =
      tier === 'weak' ? 95 : tier === 'normal' ? 140 : tier === 'strong' ? 190 : 225;

    // Check for nearby juicy loot (e.g. from a recently deceased snake)
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

    // Loot Greed: when bots smell big food drops, they rush in and often crash into each other!
    const isLootGreedy =
      Boolean(bestLootOrb) &&
      (tier === 'weak' || tier === 'normal' || Math.random() < 0.55);
    this.botGreedMode.set(bot.id, isLootGreedy);

    let avoidX = 0;
    let avoidY = 0;
    let urgentDanger = false;

    // Arena boundary soft avoidance
    const boundWarn = this.worldHalfSize - 260;
    if (Math.abs(bot.x) > boundWarn) {
      avoidX += -Math.sign(bot.x) * 6;
      if (Math.abs(bot.x) > this.worldHalfSize - 120) urgentDanger = true;
    }
    if (Math.abs(bot.y) > boundWarn) {
      avoidY += -Math.sign(bot.y) * 6;
      if (Math.abs(bot.y) > this.worldHalfSize - 120) urgentDanger = true;
    }

    // Body segment obstacle avoidance
    const nearSegs = this.getNearbySegments(bot.x, bot.y, 1);
    let closeRival: SnakeEntity | null = null;
    let closeRivalDist = Infinity;

    // If loot greedy or blundering, effective sense range shrinks drastically
    const effectiveSenseRange = isLootGreedy
      ? Math.max(52, senseRange * 0.48)
      : isBlundering
      ? Math.max(48, senseRange * 0.42)
      : senseRange;

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

      if (d2 < effectiveSenseRange * effectiveSenseRange && d2 > 1) {
        const d = Math.sqrt(d2);
        const w = ((effectiveSenseRange - d) / effectiveSenseRange) * 3.4;
        avoidX += (dx / d) * w;
        avoidY += (dy / d) * w;
        if (d < 58) urgentDanger = true;
      }
    }

    // Apply obstacle avoidance if threatened
    if (Math.hypot(avoidX, avoidY) > 0.85) {
      // Add slight steering noise to avoid robotic identical paths
      const jitter = (Math.random() - 0.5) * (tier === 'weak' ? 0.35 : 0.15);
      bot.targetAngle = normalizeAngle(Math.atan2(avoidY, avoidX) + jitter);
      // Weak bots don't always boost-escape; higher tier bots boost if in dire danger
      bot.isBoosting = tier !== 'weak' && urgentDanger && bot.score > 35 && !isBlundering;
      if (tier === 'strong' || tier === 'titan') {
        if (urgentDanger && now >= bot.abilityCooldownUntil && Math.random() < 0.25) {
          this.castAbility(bot, now);
        }
      }
      return;
    }

    // If Loot Greed is active, rush directly toward the high value food pile!
    if (isLootGreedy && bestLootOrb) {
      const angleToFood = Math.atan2(bestLootOrb.y - bot.y, bestLootOrb.x - bot.x);
      bot.targetAngle = angleToFood;
      // Boost into food pile if rival is nearby (causes chaotic clashes and collisions!)
      bot.isBoosting =
        bot.score > 25 &&
        (closeRivalDist < 260 || maxLootValue >= 10) &&
        Math.random() < 0.65;
      return;
    }

    // Strong & Titan bots attempt calculated cuts on nearby rivals
    if (
      (tier === 'strong' || tier === 'titan') &&
      closeRival &&
      closeRivalDist < 290 &&
      bot.score > closeRival.score * 1.2 + 25
    ) {
      const leadDist = tier === 'titan' ? 140 : 110;
      const interceptX = closeRival.x + Math.cos(closeRival.angle) * leadDist;
      const interceptY = closeRival.y + Math.sin(closeRival.angle) * leadDist;
      bot.targetAngle = Math.atan2(interceptY - bot.y, interceptX - bot.x);
      bot.isBoosting = bot.score > 55 && Math.random() < 0.38;
      if (now >= bot.abilityCooldownUntil && Math.random() < 0.08) {
        this.castAbility(bot, now);
      }
      return;
    }

    // Ambient Food Grazing
    let bestPriority = -Infinity;
    let tx = bot.x + Math.cos(bot.angle + (Math.random() - 0.5) * 0.4) * 160;
    let ty = bot.y + Math.sin(bot.angle + (Math.random() - 0.5) * 0.4) * 160;
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
    consumeEvents = true
  ): WorldSnapshot {
    const events = consumeEvents
      ? this.pendingEvents.splice(0, this.pendingEvents.length)
      : [...this.pendingEvents];

    const leaderId = this.cachedLeaderboard[0]?.id;
    const minimapDots: MinimapDot[] = [];
    const visibleSnakes: SnakeEntity[] = [];

    for (const s of this.snakes.values()) {
      if (!s.alive) continue;
      if (!s.isDecoy && now >= s.stealthUntil) {
        minimapDots.push({
          id: s.id,
          x: Math.round(s.x),
          y: Math.round(s.y),
          isLeader: s.id === leaderId,
        });
      }

      if (!viewport) {
        visibleSnakes.push(s);
      } else {
        const margin = s.segments.length * s.radius * 0.75 + 240;
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
      minimapDots,
      events,
    };
  }
}

export function getAllMapIds(): MapId[] {
  return ARENA_MAPS.map((m) => m.id);
}

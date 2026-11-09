import { getSnakeSpec } from '@/data/snakes';
import {
  ArenaMapSpec,
  ControlMode,
  HazardZone,
  HudItemPlacement,
  Orb,
  Point2D,
  SimulationEvent,
  SnakeEntity,
  SnakeTypeSpec,
  WorldSnapshot,
} from '@/types/game';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  decay: number;
}

export interface RenderOptions {
  showPlayerNames?: boolean;
  fadeMyName?: boolean;
  bestGraphics?: boolean;
  wigglingFood?: boolean;
  mapOnTop?: boolean;
  lookAhead?: boolean;
  controlMode?: ControlMode;
  minimapPlacement?: HudItemPlacement | null;
}

export function drawSnakeSegments(
  ctx: CanvasRenderingContext2D,
  spec: SnakeTypeSpec,
  segments: Point2D[],
  radius: number,
  angle: number,
  timeMs: number,
  options?: {
    isBoosting?: boolean;
    isPhased?: boolean;
    isShielded?: boolean;
    isStealthed?: boolean;
    isSelf?: boolean;
    name?: string;
    showPlayerNames?: boolean;
    fadeMyName?: boolean;
    bestGraphics?: boolean;
    showArrowGuide?: boolean;
    viewBounds?: { minX: number; maxX: number; minY: number; maxY: number };
  }
): void {
  if (segments.length === 0) return;

  const isPhased = Boolean(options?.isPhased);
  const isShielded = Boolean(options?.isShielded);
  const isStealthed = Boolean(options?.isStealthed);
  const baseAlpha = isPhased ? 0.52 : isStealthed ? (options?.isSelf ? 0.5 : 0.16) : 1;
  const vb = options?.viewBounds;

  ctx.save();
  ctx.globalAlpha = baseAlpha;

  const rarity = spec.rarity;
  const isOmega100 = spec.id === 'apex-omega-100';

  // Draw segments from tail to head
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    if (
      vb &&
      (seg.x < vb.minX || seg.x > vb.maxX || seg.y < vb.minY || seg.y > vb.maxY)
    ) {
      continue;
    }

    const t = i / Math.max(1, segments.length - 1);
    const taper = t > 0.85 ? 1 - (t - 0.85) * 2.5 : 1;
    const segR = Math.max(4, radius * taper);

    // Base fill by rarity style
    let fill = i % 2 === 0 ? spec.primaryColor : spec.secondaryColor;
    if (isOmega100) {
      const hue = (timeMs * 0.08 + i * 14) % 360;
      fill = i % 2 === 0 ? `hsl(${hue}, 88%, 56%)` : '#09090b';
    } else if (rarity === 'mythic' && spec.id === 'aurora-serpent') {
      const hue = (165 + Math.sin(timeMs * 0.003 + i * 0.25) * 55 + 360) % 360;
      fill = i % 2 === 0 ? `hsl(${hue}, 74%, 52%)` : spec.secondaryColor;
    } else if (rarity === 'divine') {
      fill =
        i % 3 === 0
          ? spec.primaryColor
          : i % 3 === 1
          ? spec.secondaryColor
          : spec.accentColor;
    }

    ctx.beginPath();
    ctx.arc(seg.x, seg.y, segR, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();

    // Escalating Premium Trim & Scale Ornamentation by Rarity (Zero blurry neon!)
    if (i > 0 && i % 2 === 0) {
      if (rarity === 'rare') {
        ctx.beginPath();
        ctx.arc(seg.x, seg.y, segR * 0.34, 0, Math.PI * 2);
        ctx.fillStyle = spec.accentColor;
        ctx.fill();
      } else if (rarity === 'epic') {
        ctx.strokeStyle = spec.trimColor;
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.save();
        ctx.translate(seg.x, seg.y);
        ctx.rotate(Math.PI / 4);
        const d = segR * 0.48;
        ctx.fillStyle = spec.accentColor;
        ctx.fillRect(-d / 2, -d / 2, d, d);
        ctx.restore();
      } else if (rarity === 'legendary') {
        // Luxury metallic rim + inner jewel
        ctx.strokeStyle = spec.trimColor;
        ctx.lineWidth = 2.0;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(seg.x, seg.y, segR * 0.42, 0, Math.PI * 2);
        ctx.fillStyle = spec.accentColor;
        ctx.fill();
      } else if (rarity === 'mythic') {
        ctx.strokeStyle = spec.trimColor;
        ctx.lineWidth = 2.1;
        ctx.stroke();

        ctx.save();
        ctx.translate(seg.x, seg.y);
        ctx.rotate(timeMs * 0.002 + i * 0.3);
        const d = segR * 0.56;
        ctx.fillStyle = spec.accentColor;
        ctx.fillRect(-d / 2, -d / 2, d, d);
        ctx.restore();
      } else if (rarity === 'divine') {
        // Imperial dual-ringed royal armor scale
        ctx.strokeStyle = spec.trimColor;
        ctx.lineWidth = 2.3;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(seg.x, seg.y, segR * 0.62, 0, Math.PI * 2);
        ctx.strokeStyle = spec.secondaryColor;
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(seg.x, seg.y, segR * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
    }

    if (isShielded && i % 2 === 0) {
      ctx.beginPath();
      ctx.arc(seg.x, seg.y, segR, 0, Math.PI * 2);
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    } else if (options?.isBoosting && i % 3 === 0) {
      ctx.beginPath();
      ctx.arc(seg.x, seg.y, segR * 0.85, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.fill();
    }
  }

  // Head Details, Rarity Crests & Eyes
  const head = segments[0];
  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(angle);

  // Legendary / Mythic / Divine Head Crests
  if (rarity === 'legendary' || rarity === 'mythic' || rarity === 'divine') {
    ctx.strokeStyle = spec.trimColor;
    ctx.lineWidth = rarity === 'divine' ? 2.4 : 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.02, 0, Math.PI * 2);
    ctx.stroke();

    if (rarity === 'divine') {
      // Regal 3-point crown emblem on back of head
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(-radius * 0.15, -radius * 0.55);
      ctx.lineTo(-radius * 0.68, -radius * 0.38);
      ctx.lineTo(-radius * 0.42, 0);
      ctx.lineTo(-radius * 0.75, 0);
      ctx.lineTo(-radius * 0.42, 0);
      ctx.lineTo(-radius * 0.68, radius * 0.38);
      ctx.lineTo(-radius * 0.15, radius * 0.55);
      ctx.closePath();
      ctx.fill();
    }
  }

  const eyeForward = radius * 0.34;
  const eyeSpread = radius * 0.44;
  const eyeR = Math.max(2.6, radius * 0.25);

  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(eyeForward, dir * eyeSpread, eyeR, 0, Math.PI * 2);
    ctx.fillStyle = spec.eyeColor;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(eyeForward + eyeR * 0.32, dir * eyeSpread, eyeR * 0.48, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
  }
  ctx.restore();

  // Clean player nickname above head (respecting showPlayerNames and fadeMyName)
  if (
    options?.showPlayerNames !== false &&
    options?.name &&
    (!isStealthed || options?.isSelf)
  ) {
    ctx.save();
    if (options.isSelf && options.fadeMyName) {
      ctx.globalAlpha = 0.16; // Faded so player has unobstructed forward vision
    }
    ctx.font = '600 12px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillText(options.name, head.x + 1, head.y - radius - 9);
    ctx.fillStyle = options.isSelf ? '#ffffff' : '#cbd5e1';
    ctx.fillText(options.name, head.x, head.y - radius - 10);
    ctx.restore();
  }

  // Arrow mode guide arrow: subtle, elegant glowing arrow floating ahead of snake head
  if (options?.isSelf && options?.showArrowGuide) {
    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(angle);
    const arrowDist = radius + 26;
    ctx.translate(arrowDist, 0);
    ctx.fillStyle = '#34d399';
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-6, -6);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

export class ArenaRenderer {
  private particles: Particle[] = [];
  private camX = 0;
  private camY = 0;
  private camZoom = 0.67;
  private smoothScore = 0;
  private lookAheadOffsetX = 0;
  private lookAheadOffsetY = 0;
  private initializedCam = false;

  public resetCamera(x = 0, y = 0): void {
    this.camX = x;
    this.camY = y;
    this.camZoom = 0.67;
    this.smoothScore = 0;
    this.lookAheadOffsetX = 0;
    this.lookAheadOffsetY = 0;
    this.initializedCam = false;
    this.particles = [];
  }

  public getCameraCenter(): { x: number; y: number } {
    return { x: this.camX, y: this.camY };
  }

  public getCameraZoom(): number {
    return this.camZoom;
  }

  public ingestEvents(events: SimulationEvent[], myId: string): void {
    for (const ev of events) {
      if (ev.type === 'death') {
        if (Math.hypot(ev.x - this.camX, ev.y - this.camY) < 1600) {
          this.spawnBurst(ev.x, ev.y, ev.color || '#cbd5e1', 14);
        }
      } else if (ev.type === 'ability_cast' && ev.actorId === myId) {
        this.spawnBurst(ev.x, ev.y, ev.color || '#ffffff', 10);
      }
    }
  }

  private spawnBurst(x: number, y: number, color: string, count: number): void {
    if (this.particles.length > 160) {
      this.particles.splice(0, count);
    }
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 140;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        radius: 2 + Math.random() * 2.5,
        color,
        alpha: 0.9,
        decay: 1.6 + Math.random() * 0.8,
      });
    }
  }

  public renderFrame(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    map: ArenaMapSpec,
    snapshot: WorldSnapshot,
    myId: string,
    dtSec: number,
    renderOptions?: RenderOptions
  ): void {
    const timeMs = snapshot.now;
    const half = snapshot.worldHalfSize || map.offlineHalfSize;
    const me = snapshot.snakes.find((s) => s.id === myId);

    if (me) {
      if (!this.initializedCam) {
        this.camX = me.x;
        this.camY = me.y;
        this.smoothScore = me.score;
        this.initializedCam = true;
      }

      if (renderOptions?.lookAhead) {
        const lookDist = 140;
        const targetOffsetX = Math.cos(me.angle) * lookDist;
        const targetOffsetY = Math.sin(me.angle) * lookDist;
        const offsetLerp = Math.min(1, dtSec * 5.0);
        this.lookAheadOffsetX += (targetOffsetX - this.lookAheadOffsetX) * offsetLerp;
        this.lookAheadOffsetY += (targetOffsetY - this.lookAheadOffsetY) * offsetLerp;
        this.camX = me.x + this.lookAheadOffsetX;
        this.camY = me.y + this.lookAheadOffsetY;
      } else {
        // Direct 1:1 camera lock to player head!
        // Anchors the head rock-solid at viewport center — zero judder, zero "kare-kare" lag!
        this.lookAheadOffsetX = 0;
        this.lookAheadOffsetY = 0;
        this.camX = me.x;
        this.camY = me.y;
      }

      // Tactical field of view: 1.5x wider base view (0.67) so players detect rivals from afar
      const baseZoom = 0.67;
      if (this.smoothScore <= 0) {
        this.smoothScore = me.score;
      } else {
        // High inertia against short-term boost score drain so zoom doesn't pump or jitter
        const diff = me.score - this.smoothScore;
        const rate = diff > 0 ? 0.85 : 0.12;
        this.smoothScore += diff * Math.min(1, dtSec * rate);
      }
      const scoreZoom = baseZoom / Math.pow(1 + Math.sqrt(this.smoothScore) * 0.022, 0.55);
      const sizeZoom = Math.max(0.24, scoreZoom);
      const wideBonus = timeMs < me.wideViewUntil ? 0.8 : 1;
      const desiredZoom = sizeZoom * wideBonus;
      this.camZoom += (desiredZoom - this.camZoom) * Math.min(1, dtSec * 3.5);
    }

    if (renderOptions?.bestGraphics !== false && map.bgAccentColor) {
      const grad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        Math.min(width, height) * 0.08,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.78
      );
      grad.addColorStop(0, map.bgAccentColor);
      grad.addColorStop(1, map.bgColor);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = map.bgColor;
    }
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(this.camZoom, this.camZoom);
    ctx.translate(-this.camX, -this.camY);

    const viewHalfW = width / 2 / this.camZoom + 120;
    const viewHalfH = height / 2 / this.camZoom + 120;
    const segBounds = {
      minX: this.camX - viewHalfW - 45,
      maxX: this.camX + viewHalfW + 45,
      minY: this.camY - viewHalfH - 45,
      maxY: this.camY + viewHalfH + 45,
    };

    this.drawWorldGrid(ctx, map, half, viewHalfW, viewHalfH);
    this.drawWorldBoundary(ctx, map, half);
    this.drawHazards(ctx, snapshot.hazards, viewHalfW, viewHalfH);
    this.drawOrbs(
      ctx,
      snapshot.orbs,
      viewHalfW,
      viewHalfH,
      timeMs,
      renderOptions?.wigglingFood !== false
    );

    // Frustum-cull snakes so off-screen snakes cost 0 GPU time!
    const visibleSnakes: SnakeEntity[] = [];
    for (let i = 0; i < snapshot.snakes.length; i++) {
      const s = snapshot.snakes[i];
      const maxSpan = s.segments.length * s.radius * 0.75 + 160;
      if (
        Math.abs(s.x - this.camX) <= viewHalfW + maxSpan &&
        Math.abs(s.y - this.camY) <= viewHalfH + maxSpan
      ) {
        visibleSnakes.push(s);
      }
    }

    visibleSnakes.sort((a, b) =>
      a.id === myId ? 1 : b.id === myId ? -1 : a.score - b.score
    );

    for (const s of visibleSnakes) {
      const spec = getSnakeSpec(s.snakeTypeId);
      drawSnakeSegments(ctx, spec, s.segments, s.radius, s.angle, timeMs, {
        isBoosting: s.isBoosting || timeMs < s.freeBoostUntil,
        isPhased: timeMs < s.phaseUntil,
        isShielded: timeMs < s.shieldUntil,
        isStealthed: timeMs < s.stealthUntil,
        isSelf: s.id === myId,
        name: s.name,
        showPlayerNames: renderOptions?.showPlayerNames ?? true,
        fadeMyName: renderOptions?.fadeMyName ?? true,
        bestGraphics: renderOptions?.bestGraphics ?? true,
        showArrowGuide:
          s.id === myId &&
          (renderOptions?.controlMode === 'arrow' || !renderOptions?.controlMode),
        viewBounds: segBounds,
      });
    }

    if (renderOptions?.bestGraphics !== false) {
      this.updateAndDrawParticles(ctx, dtSec);
    }
    ctx.restore();

    this.drawSquareMinimap(
      ctx,
      width,
      height,
      half,
      snapshot,
      myId,
      renderOptions?.mapOnTop !== false,
      renderOptions?.minimapPlacement
    );
  }

  private drawWorldGrid(
    ctx: CanvasRenderingContext2D,
    map: ArenaMapSpec,
    half: number,
    viewHalfW: number,
    viewHalfH: number
  ): void {
    const style = map.patternStyle || 'grid';

    if (style === 'hex') {
      // Classic Honeycomb Hexagonal Pattern (batched single stroke for 60 FPS!)
      const r = 72;
      const dx = r * 1.5;
      const dy = r * Math.sqrt(3);
      const minCol = Math.floor(Math.max(-half, this.camX - viewHalfW) / dx) - 1;
      const maxCol = Math.ceil(Math.min(half, this.camX + viewHalfW) / dx) + 1;
      const minRow = Math.floor(Math.max(-half, this.camY - viewHalfH) / dy) - 1;
      const maxRow = Math.ceil(Math.min(half, this.camY + viewHalfH) / dy) + 1;

      ctx.beginPath();
      const h2 = dy * 0.5;
      for (let col = minCol; col <= maxCol; col++) {
        const cx = col * dx;
        const yOffset = (col & 1) !== 0 ? h2 : 0;
        for (let row = minRow; row <= maxRow; row++) {
          const cy = row * dy + yOffset;
          if (Math.abs(cx) > half || Math.abs(cy) > half) continue;
          // Draw 3 non-duplicate edges per hex cell to tessellate cleanly
          ctx.moveTo(cx - r * 0.5, cy - h2);
          ctx.lineTo(cx + r * 0.5, cy - h2);
          ctx.lineTo(cx + r, cy);
          ctx.lineTo(cx + r * 0.5, cy + h2);
        }
      }
      ctx.strokeStyle = map.gridColor;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      return;
    }

    if (style === 'diamond') {
      const step = 140;
      const startX = Math.max(-half, Math.floor((this.camX - viewHalfW) / step) * step);
      const endX = Math.min(half, Math.ceil((this.camX + viewHalfW) / step) * step);
      const startY = Math.max(-half, Math.floor((this.camY - viewHalfH) / step) * step);
      const endY = Math.min(half, Math.ceil((this.camY + viewHalfH) / step) * step);

      ctx.beginPath();
      for (let x = startX; x <= endX; x += step) {
        for (let y = startY; y <= endY; y += step) {
          const hs = step * 0.5;
          ctx.moveTo(x, y - hs);
          ctx.lineTo(x + hs, y);
          ctx.lineTo(x, y + hs);
          ctx.lineTo(x - hs, y);
          ctx.closePath();
        }
      }
      ctx.strokeStyle = map.gridColor;
      ctx.lineWidth = 1.3;
      ctx.stroke();
      return;
    }

    // 'grid' and 'stars'
    const step = style === 'stars' ? 160 : 115;
    const startX = Math.max(-half, Math.floor((this.camX - viewHalfW) / step) * step);
    const endX = Math.min(half, Math.ceil((this.camX + viewHalfW) / step) * step);
    const startY = Math.max(-half, Math.floor((this.camY - viewHalfH) / step) * step);
    const endY = Math.min(half, Math.ceil((this.camY + viewHalfH) / step) * step);

    ctx.beginPath();
    for (let x = startX; x <= endX; x += step) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += step) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.strokeStyle = map.gridColor;
    ctx.lineWidth = 1.1;
    ctx.stroke();

    if (style === 'stars') {
      // Deterministic procedural starfield / bioluminescent specks
      const starCell = 260;
      const sx0 = Math.floor(Math.max(-half, this.camX - viewHalfW) / starCell);
      const sx1 = Math.ceil(Math.min(half, this.camX + viewHalfW) / starCell);
      const sy0 = Math.floor(Math.max(-half, this.camY - viewHalfH) / starCell);
      const sy1 = Math.ceil(Math.min(half, this.camY + viewHalfH) / starCell);

      ctx.fillStyle = map.borderColor;
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      for (let gx = sx0; gx <= sx1; gx++) {
        for (let gy = sy0; gy <= sy1; gy++) {
          const h = Math.abs(Math.sin(gx * 127.1 + gy * 311.7) * 43758.5453);
          const fx = h - Math.floor(h);
          const h2 = Math.abs(Math.sin(gx * 269.5 + gy * 183.3) * 24634.6345);
          const fy = h2 - Math.floor(h2);
          const px = gx * starCell + fx * starCell;
          const py = gy * starCell + fy * starCell;
          const r = 1.4 + (fx * 1.8);
          ctx.moveTo(px + r, py);
          ctx.arc(px, py, r, 0, Math.PI * 2);
        }
      }
      ctx.fill();
      ctx.restore();
    }
  }

  private drawWorldBoundary(
    ctx: CanvasRenderingContext2D,
    map: ArenaMapSpec,
    half: number
  ): void {
    ctx.strokeStyle = map.borderColor;
    ctx.lineWidth = 6;
    ctx.strokeRect(-half, -half, half * 2, half * 2);
  }

  private drawOrbs(
    ctx: CanvasRenderingContext2D,
    orbs: Orb[],
    viewHalfW: number,
    viewHalfH: number,
    timeMs: number,
    wiggling = true
  ): void {
    const minX = this.camX - viewHalfW;
    const maxX = this.camX + viewHalfW;
    const minY = this.camY - viewHalfH;
    const maxY = this.camY + viewHalfH;

    for (let i = 0; i < orbs.length; i++) {
      const orb = orbs[i];
      if (orb.x < minX || orb.x > maxX || orb.y < minY || orb.y > maxY) continue;
      ctx.beginPath();
      if (wiggling) {
        const bob = Math.sin(timeMs * 0.005 + (orb.x % 19)) * 1.5;
        const pulseR = Math.max(
          2.5,
          orb.radius + Math.sin(timeMs * 0.004 + (orb.y % 13)) * 0.7
        );
        ctx.arc(orb.x + bob, orb.y, pulseR, 0, Math.PI * 2);
      } else {
        ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
      }
      ctx.fillStyle = orb.color;
      ctx.fill();
    }
  }

  private drawHazards(
    ctx: CanvasRenderingContext2D,
    hazards: HazardZone[],
    viewHalfW: number,
    viewHalfH: number
  ): void {
    const minX = this.camX - viewHalfW - 100;
    const maxX = this.camX + viewHalfW + 100;
    const minY = this.camY - viewHalfH - 100;
    const maxY = this.camY + viewHalfH + 100;

    for (const hz of hazards) {
      if (hz.x < minX || hz.x > maxX || hz.y < minY || hz.y > maxY) continue;
      ctx.save();
      if (hz.kind === 'venom_pool' || hz.kind === 'fireball' || hz.kind === 'aurora_pool') {
        ctx.beginPath();
        ctx.arc(hz.x, hz.y, hz.radius, 0, Math.PI * 2);
        ctx.fillStyle = hz.color;
        ctx.globalAlpha = 0.65;
        ctx.fill();
      } else if (hz.kind === 'laser_wave') {
        const angle = Math.atan2(hz.vy, hz.vx);
        ctx.translate(hz.x, hz.y);
        ctx.rotate(angle);
        ctx.strokeStyle = hz.color;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(13, 0);
        ctx.lineTo(0, 18);
        ctx.stroke();
      } else if (hz.kind === 'vortex' || hz.kind === 'acid_web') {
        ctx.translate(hz.x, hz.y);
        ctx.fillStyle = hz.color;
        ctx.globalAlpha = 0.72;
        ctx.fillRect(-7, -7, 14, 14);
      }
      ctx.restore();
    }
  }

  private updateAndDrawParticles(ctx: CanvasRenderingContext2D, dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.alpha -= p.decay * dt;
      if (p.alpha <= 0.02) {
        this.particles.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.restore();
    }
  }

  private drawSquareMinimap(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    half: number,
    snapshot: WorldSnapshot,
    myId: string,
    mapOnTop = true,
    placement?: HudItemPlacement | null
  ): void {
    const baseSize = width < 640 ? 90 : 114;
    const size = placement ? baseSize * placement.scale : baseSize;
    const x0 = placement
      ? Math.max(6, Math.min(width - size - 6, (placement.xPct / 100) * width - size / 2))
      : 14;
    const y0 = placement
      ? Math.max(6, Math.min(height - size - 6, (placement.yPct / 100) * height - size / 2))
      : mapOnTop
      ? 14
      : Math.max(14, height - size - 14);
    const scale = size / (half * 2);

    ctx.save();
    if (placement) {
      ctx.globalAlpha = Math.max(0.2, Math.min(1, placement.opacity));
    }
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x0, y0, size, size, 8);
    ctx.fill();
    ctx.stroke();

    const dots = snapshot.minimapDots || [];
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      const sx = x0 + (d.x + half) * scale;
      const sy = y0 + (d.y + half) * scale;
      if (d.id === myId) {
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(sx - 3, sy - 3, 6, 6);
      } else if (d.isLeader) {
        ctx.fillStyle = '#facc15';
        ctx.fillRect(sx - 2.2, sy - 2.2, 4.4, 4.4);
      } else {
        ctx.fillStyle = 'rgba(203, 213, 225, 0.45)';
        ctx.fillRect(sx - 1.2, sy - 1.2, 2.4, 2.4);
      }
    }
    ctx.restore();
  }
}

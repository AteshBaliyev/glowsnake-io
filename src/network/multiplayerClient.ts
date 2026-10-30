import { io, Socket } from 'socket.io-client';
import {
  MapId,
  RoomSummary,
  SnakeEntity,
  WorldSnapshot,
} from '@/types/game';

export interface ServerDeathPayload {
  finalScore: number;
  peakScore: number;
  totalCollected: number;
  kills: number;
  durationSec: number;
  finalRank: number;
  bestRank: number;
  totalPlayers: number;
}

export class MultiplayerClient {
  private socket: Socket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  public playerId = '';
  public connected = false;
  public pingMs = 0;

  private latestSnapshot: WorldSnapshot | null = null;
  private smoothedSnakes: Map<string, SnakeEntity> = new Map();

  private onRoomsCallback?: (rooms: RoomSummary[]) => void;
  private onStatusCallback?: (connected: boolean, error?: string) => void;
  private onDeathCallback?: (payload: ServerDeathPayload) => void;
  private onEventsCallback?: (snapshot: WorldSnapshot) => void;

  public connectLobby(
    customServerUrl: string,
    callbacks: {
      onRooms?: (rooms: RoomSummary[]) => void;
      onStatus?: (connected: boolean, error?: string) => void;
    }
  ): void {
    this.onRoomsCallback = callbacks.onRooms;
    this.onStatusCallback = callbacks.onStatus;

    this.disconnect();

    const targetUrl =
      customServerUrl.trim() ||
      process.env.NEXT_PUBLIC_SERVER_URL ||
      undefined;
    const socket = io(targetUrl, {
      path: '/api/socketio',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      timeout: 6000,
    });

    this.socket = socket;

    socket.on('connect', () => {
      this.connected = true;
      this.playerId = socket.id || '';
      this.onStatusCallback?.(true);
      socket.emit('get_rooms');
    });

    socket.on('connect_error', (err) => {
      this.connected = false;
      this.onStatusCallback?.(false, err.message || 'Connection error');
    });

    socket.on('disconnect', () => {
      this.connected = false;
      this.onStatusCallback?.(false);
    });

    socket.on('rooms_update', (rooms: RoomSummary[]) => {
      this.onRoomsCallback?.(rooms);
    });

    socket.on('pong_check', (sentAt: number) => {
      this.pingMs = Math.max(1, Date.now() - sentAt);
    });

    socket.on(
      'joined_arena',
      (data: { playerId: string; mapId: MapId; snapshot: WorldSnapshot }) => {
        this.playerId = data.playerId;
        this.ingestSnapshot(data.snapshot);
      }
    );

    socket.on('world_snapshot', (snap: WorldSnapshot) => {
      this.ingestSnapshot(snap);
    });

    socket.on('player_died', (payload: ServerDeathPayload) => {
      this.onDeathCallback?.(payload);
    });

    this.pingTimer = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping_check', Date.now());
      }
    }, 2000);
  }

  private ingestSnapshot(snap: WorldSnapshot): void {
    this.latestSnapshot = snap;
    if (snap.events && snap.events.length > 0) {
      this.onEventsCallback?.(snap);
    }

    const activeIds = new Set(snap.snakes.map((s) => s.id));
    for (const id of this.smoothedSnakes.keys()) {
      if (!activeIds.has(id)) {
        this.smoothedSnakes.delete(id);
      }
    }

    for (const incoming of snap.snakes) {
      const existing = this.smoothedSnakes.get(incoming.id);
      if (!existing || Math.hypot(incoming.x - existing.x, incoming.y - existing.y) > 280) {
        this.smoothedSnakes.set(incoming.id, {
          ...incoming,
          segments: incoming.segments.map((p) => ({ x: p.x, y: p.y })),
        });
      } else {
        existing.score = incoming.score;
        existing.peakScore = incoming.peakScore;
        existing.totalCollected = incoming.totalCollected;
        existing.kills = incoming.kills;
        existing.bestRank = incoming.bestRank;
        existing.isBoosting = incoming.isBoosting;
        existing.radius = incoming.radius;
        existing.abilityCooldownUntil = incoming.abilityCooldownUntil;
        existing.abilityActiveUntil = incoming.abilityActiveUntil;
        existing.activeEffect = incoming.activeEffect;
        existing.slowedUntil = incoming.slowedUntil;
        existing.webbedUntil = incoming.webbedUntil;
        existing.stealthUntil = incoming.stealthUntil;
        existing.doubleScoreUntil = incoming.doubleScoreUntil;
        existing.magnetUntil = incoming.magnetUntil;
        existing.shieldUntil = incoming.shieldUntil;
        existing.phaseUntil = incoming.phaseUntil;
        existing.freeBoostUntil = incoming.freeBoostUntil;
        existing.wideViewUntil = incoming.wideViewUntil;
      }
    }
  }

  public joinMatch(
    params: { name: string; snakeTypeId: string; mapId: MapId },
    callbacks: {
      onDeath: (payload: ServerDeathPayload) => void;
      onEvents: (snap: WorldSnapshot) => void;
    }
  ): void {
    this.onDeathCallback = callbacks.onDeath;
    this.onEventsCallback = callbacks.onEvents;
    this.smoothedSnakes.clear();
    this.latestSnapshot = null;

    if (this.socket) {
      if (this.socket.connected) {
        this.socket.emit('join_arena', params);
      } else {
        this.socket.once('connect', () => {
          this.socket?.emit('join_arena', params);
        });
      }
    }
  }

  public sendInput(angle: number, boost: boolean, ability = false): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('player_input', { angle, boost, ability });
  }

  public leaveMatch(): void {
    if (this.socket?.connected) {
      this.socket.emit('leave_arena');
    }
    this.latestSnapshot = null;
    this.smoothedSnakes.clear();
  }

  public getInterpolatedSnapshot(dtSec: number): WorldSnapshot | null {
    if (!this.latestSnapshot) return null;
    const blend = Math.min(1, dtSec * 15);

    for (const target of this.latestSnapshot.snakes) {
      const smooth = this.smoothedSnakes.get(target.id);
      if (!smooth) continue;

      smooth.x += (target.x - smooth.x) * blend;
      smooth.y += (target.y - smooth.y) * blend;

      let dAngle = target.angle - smooth.angle;
      while (dAngle > Math.PI) dAngle -= Math.PI * 2;
      while (dAngle < -Math.PI) dAngle += Math.PI * 2;
      smooth.angle += dAngle * blend;

      while (smooth.segments.length < target.segments.length) {
        const tail =
          smooth.segments[smooth.segments.length - 1] || { x: smooth.x, y: smooth.y };
        smooth.segments.push({ x: tail.x, y: tail.y });
      }
      if (smooth.segments.length > target.segments.length) {
        smooth.segments.length = target.segments.length;
      }

      for (let i = 0; i < target.segments.length; i++) {
        smooth.segments[i].x += (target.segments[i].x - smooth.segments[i].x) * blend;
        smooth.segments[i].y += (target.segments[i].y - smooth.segments[i].y) * blend;
      }
    }

    return {
      ...this.latestSnapshot,
      now: Date.now(),
      snakes: Array.from(this.smoothedSnakes.values()),
      events: [],
    };
  }

  public disconnect(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
    this.latestSnapshot = null;
    this.smoothedSnakes.clear();
  }
}

export class FirebaseRealtimeSync {
  private baseUrl: string;
  private mapId: MapId;
  private localId: string;
  private timer: ReturnType<typeof setInterval> | null = null;
  private remotePeers: Map<string, SnakeEntity & { updatedAt: number }> = new Map();

  constructor(firebaseDbUrl: string, mapId: MapId, localId: string) {
    this.baseUrl = firebaseDbUrl.replace(/\/+$/, '');
    this.mapId = mapId;
    this.localId = localId;
  }

  public start(getLocalSnake: () => SnakeEntity | undefined): void {
    const syncTick = async () => {
      const me = getLocalSnake();
      try {
        if (me && me.alive) {
          const compact = {
            ...me,
            segments: me.segments.slice(0, 50),
            updatedAt: Date.now(),
          };
          await fetch(
            `${this.baseUrl}/glowsnake_arenas/${this.mapId}/players/${this.localId}.json`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(compact),
            }
          );
        }
        const res = await fetch(
          `${this.baseUrl}/glowsnake_arenas/${this.mapId}/players.json`
        );
        if (res.ok) {
          const data = (await res.json()) as Record<
            string,
            SnakeEntity & { updatedAt: number }
          > | null;
          this.remotePeers.clear();
          const now = Date.now();
          if (data) {
            for (const [id, peer] of Object.entries(data)) {
              if (id === this.localId) continue;
              if (peer && peer.alive && now - (peer.updatedAt || 0) < 6000) {
                this.remotePeers.set(id, peer);
              }
            }
          }
        }
      } catch {
        // Ignore network errors
      }
    };

    syncTick();
    this.timer = setInterval(syncTick, 280);
  }

  public getRemoteSnakes(): SnakeEntity[] {
    return Array.from(this.remotePeers.values());
  }

  public async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    try {
      await fetch(
        `${this.baseUrl}/glowsnake_arenas/${this.mapId}/players/${this.localId}.json`,
        { method: 'DELETE' }
      );
    } catch {
      // Ignore cleanup errors
    }
  }
}

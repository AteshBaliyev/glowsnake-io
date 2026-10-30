import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { ARENA_MAPS } from './src/data/maps';
import { SimulationWorld } from './src/engine/simulation';
import { MapId, RoomSummary } from './src/types/game';

const isProdFlag = process.argv.includes('--prod');
if (isProdFlag) {
  (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
}

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const MAX_HUMANS_PER_SERVER = 60; // Auto-spawn 2nd server when 60+ live players!

const app = next({ dev, port });
const handle = app.getRequestHandler();

interface ServerInstance {
  roomKey: string;
  mapId: MapId;
  instanceIndex: number;
  world: SimulationWorld;
}

interface ConnectedPlayerMeta {
  socketId: string;
  roomKey: string;
  mapId: MapId;
  instanceIndex: number;
  playerName: string;
  snakeTypeId: string;
  joinedAt: number;
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url || '/', true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    path: '/api/socketio',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  const instancesByMap = new Map<MapId, ServerInstance[]>();
  const instanceByKey = new Map<string, ServerInstance>();

  function createRoomInstance(mapId: MapId, instanceIndex: number): ServerInstance {
    const roomKey = `${mapId}#${instanceIndex}`;
    const inst: ServerInstance = {
      roomKey,
      mapId,
      instanceIndex,
      world: new SimulationWorld({
        mapId,
        mode: 'online',
        serverInstanceIndex: instanceIndex,
      }),
    };
    const arr = instancesByMap.get(mapId) || [];
    arr.push(inst);
    instancesByMap.set(mapId, arr);
    instanceByKey.set(roomKey, inst);
    return inst;
  }

  // Initialize Server #1 for each Arena Map
  for (const m of ARENA_MAPS) {
    createRoomInstance(m.id, 1);
  }

  function pickAvailableInstance(mapId: MapId): ServerInstance {
    const list = instancesByMap.get(mapId) || [];
    for (const inst of list) {
      if (inst.world.getHumanCount() < MAX_HUMANS_PER_SERVER) {
        return inst;
      }
    }
    // All existing servers for this map have 60+ live players -> spin up next server!
    const nextIdx = list.length + 1;
    return createRoomInstance(mapId, nextIdx);
  }

  const players = new Map<string, ConnectedPlayerMeta>();

  function getRoomsSummary(): RoomSummary[] {
    return ARENA_MAPS.map((m) => {
      const list = instancesByMap.get(m.id) || [];
      let activePlayers = 0;
      for (const inst of list) {
        activePlayers += inst.world.getTotalActiveSnakes();
      }
      return {
        mapId: m.id,
        activePlayers,
        instanceCount: list.length,
      };
    });
  }

  io.on('connection', (socket) => {
    socket.emit('rooms_update', getRoomsSummary());

    socket.on('get_rooms', () => {
      socket.emit('rooms_update', getRoomsSummary());
    });

    socket.on('ping_check', (clientTs: number) => {
      socket.emit('pong_check', clientTs);
    });

    socket.on(
      'join_arena',
      (payload: { name: string; snakeTypeId: string; mapId: MapId }) => {
        const prev = players.get(socket.id);
        if (prev) {
          const prevInst = instanceByKey.get(prev.roomKey);
          prevInst?.world.removeSnake(socket.id);
          socket.leave(prev.roomKey);
        }

        const validMapId: MapId = instancesByMap.has(payload.mapId)
          ? payload.mapId
          : 'cyberpunk-city';

        const targetInst = pickAvailableInstance(validMapId);
        const cleanName = (payload.name || 'Player').trim().slice(0, 18) || 'Player';

        const spawned = targetInst.world.spawnSnake({
          id: socket.id,
          name: cleanName,
          snakeTypeId: payload.snakeTypeId || 'swift-viper',
          isBot: false,
          initialScore: 0,
        });

        players.set(socket.id, {
          socketId: socket.id,
          roomKey: targetInst.roomKey,
          mapId: validMapId,
          instanceIndex: targetInst.instanceIndex,
          playerName: spawned.name,
          snakeTypeId: spawned.snakeTypeId,
          joinedAt: Date.now(),
        });

        socket.join(targetInst.roomKey);
        socket.emit('joined_arena', {
          playerId: socket.id,
          mapId: validMapId,
          instanceIndex: targetInst.instanceIndex,
          snapshot: targetInst.world.buildSnapshot(
            Date.now(),
            { x: spawned.x, y: spawned.y, halfW: 1650, halfH: 1150 },
            false
          ),
        });
        io.emit('rooms_update', getRoomsSummary());
      }
    );

    socket.on(
      'player_input',
      (input: { angle: number; boost: boolean; ability?: boolean }) => {
        const meta = players.get(socket.id);
        if (!meta) return;
        const inst = instanceByKey.get(meta.roomKey);
        if (!inst) return;
        inst.world.setSnakeInput(
          socket.id,
          input.angle,
          input.boost,
          Boolean(input.ability)
        );
      }
    );

    socket.on('leave_arena', () => {
      const meta = players.get(socket.id);
      if (!meta) return;
      const inst = instanceByKey.get(meta.roomKey);
      inst?.world.removeSnake(socket.id);
      socket.leave(meta.roomKey);
      players.delete(socket.id);
    });

    socket.on('disconnect', () => {
      const meta = players.get(socket.id);
      if (meta) {
        const inst = instanceByKey.get(meta.roomKey);
        inst?.world.removeSnake(socket.id);
        players.delete(socket.id);
      }
    });
  });

  // Simulation Loop (30 Hz) & Per-Player Viewport Snapshot Broadcast (15 Hz)
  let lastTick = Date.now();
  let tickCount = 0;

  setInterval(() => {
    const now = Date.now();
    const dt = (now - lastTick) / 1000;
    lastTick = now;
    tickCount++;

    for (const inst of instanceByKey.values()) {
      const world = inst.world;
      const hasHumans = world.getHumanCount() > 0;
      if (!hasHumans && tickCount % 4 !== 0) continue;

      const aliveHumansBefore = new Map<
        string,
        {
          score: number;
          peakScore: number;
          totalCollected: number;
          kills: number;
          bestRank: number;
          finalRank: number;
          spawnedAt: number;
        }
      >();

      for (const [sid, meta] of players.entries()) {
        if (meta.roomKey === inst.roomKey) {
          const ent = world.snakes.get(sid);
          if (ent && ent.alive) {
            aliveHumansBefore.set(sid, {
              score: ent.score,
              peakScore: ent.peakScore,
              totalCollected: ent.totalCollected,
              kills: ent.kills,
              bestRank: ent.bestRank,
              finalRank: world.getRankForId(sid),
              spawnedAt: ent.spawnedAt,
            });
          }
        }
      }

      world.step(hasHumans ? dt : dt * 4, now);

      for (const [sid, prevStats] of aliveHumansBefore.entries()) {
        const ent = world.snakes.get(sid);
        if (!ent || !ent.alive) {
          const finalScore = Math.floor(ent ? ent.score : prevStats.score);
          const durationSec = Math.max(
            1,
            Math.round((now - prevStats.spawnedAt) / 1000)
          );
          io.to(sid).emit('player_died', {
            finalScore,
            peakScore: Math.floor(ent ? ent.peakScore : prevStats.peakScore),
            totalCollected: Math.floor(
              ent ? ent.totalCollected : prevStats.totalCollected
            ),
            kills: ent ? ent.kills : prevStats.kills,
            durationSec,
            finalRank: prevStats.finalRank,
            bestRank: Math.min(
              prevStats.bestRank,
              prevStats.finalRank,
              ent ? ent.bestRank : 999
            ),
            totalPlayers: world.getTotalActiveSnakes(),
          });
          world.removeSnake(sid);
          players.delete(sid);
        }
      }

      if (hasHumans && tickCount % 2 === 0) {
        const sharedEvents = world.pendingEvents.splice(
          0,
          world.pendingEvents.length
        );
        for (const [sid, meta] of players.entries()) {
          if (meta.roomKey !== inst.roomKey) continue;
          const me = world.snakes.get(sid);
          const cx = me ? me.x : 0;
          const cy = me ? me.y : 0;
          const snap = world.buildSnapshot(
            now,
            { x: cx, y: cy, halfW: 1750, halfH: 1200 },
            false
          );
          snap.events = sharedEvents;
          io.to(sid).emit('world_snapshot', snap);
        }
      } else if (!hasHumans) {
        world.pendingEvents.length = 0;
      }
    }
  }, 33);

  // Clean up empty overflow servers (#2, #3...) and broadcast room summaries
  setInterval(() => {
    for (const [mapId, list] of instancesByMap.entries()) {
      if (list.length > 1) {
        for (let i = list.length - 1; i >= 1; i--) {
          if (list[i].world.getHumanCount() === 0) {
            instanceByKey.delete(list[i].roomKey);
            list.splice(i, 1);
          }
        }
        instancesByMap.set(mapId, list);
      }
    }
    io.emit('rooms_update', getRoomsSummary());
  }, 3000);

  httpServer.listen(port, hostname, () => {
    console.log(
      `> GlowSnake.io Multi-Room Server: http://localhost:${port} (${
        dev ? 'development' : 'production'
      })`
    );
  });
});

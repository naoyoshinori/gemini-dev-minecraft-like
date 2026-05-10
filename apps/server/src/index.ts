import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { BlockUpdate, BlockType, CHUNK_SIZE, getBlockIndex, PlayerData } from '@voxel/shared';
import { createNoise2D, createNoise3D } from 'simplex-noise';
import Database from 'better-sqlite3';
import { MobManager } from './MobManager.js';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const port = process.env.PORT || 3000;

const noise2D = createNoise2D();
const humidNoise = createNoise2D();
const noise3D = createNoise3D();

const mobManager = new MobManager();
const players = new Map<string, PlayerData>();

let currentWeather = 'CLEAR';

// SQLite Setup
const db = new Database('world.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS chunks (
    x INTEGER, y INTEGER, z INTEGER, blocks BLOB, PRIMARY KEY (x, y, z)
  )
`);

const saveChunkStmt = db.prepare('INSERT OR REPLACE INTO chunks (x, y, z, blocks) VALUES (?, ?, ?, ?)');
const loadChunkStmt = db.prepare('SELECT blocks FROM chunks WHERE x = ? AND y = ? AND z = ?');

// Biome Types
enum Biome { PLAINS, FOREST, DESERT }

function getBiome(x: number, z: number): Biome {
  const h = humidNoise(x / 300, z / 300);
  if (h > 0.3) return Biome.FOREST;
  if (h < -0.3) return Biome.DESERT;
  return Biome.PLAINS;
}

// Chunk-based storage in memory (cache)
const chunks = new Map<string, Uint8Array>();

function generateChunk(cx: number, cy: number, cz: number): Uint8Array {
  const chunk = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE);
  const setBlock = (lx: number, ly: number, lz: number, type: BlockType) => {
    if (lx >= 0 && lx < CHUNK_SIZE && ly >= 0 && ly < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
      chunk[getBlockIndex(lx, ly, lz)] = type;
    }
  };

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const x = cx * CHUNK_SIZE + lx;
      const z = cz * CHUNK_SIZE + lz;
      const biome = getBiome(x, z);
      const n1 = noise2D(x / 100, z / 100) * 20;
      const n2 = noise2D(x / 50, z / 50) * 10;
      const n3 = noise2D(x / 25, z / 25) * 5;
      const height = Math.floor(n1 + n2 + n3 + 15);

      for (let ly = 0; ly < CHUNK_SIZE; ly++) {
        const y = cy * CHUNK_SIZE + ly;
        let type = BlockType.AIR;
        if (y < height - 5) type = BlockType.STONE;
        else if (y < height - 1) type = BlockType.DIRT;
        else if (y < height) {
          if (biome === Biome.DESERT) type = BlockType.SAND;
          else type = BlockType.GRASS;
        }
        if (type !== BlockType.AIR && y < height - 2) {
          const n3d = noise3D(x / 20, y / 20, z / 20);
          if (n3d > 0.4) type = BlockType.AIR;
        }
        if (type === BlockType.AIR && y <= 10) type = BlockType.WATER;
        if (type !== BlockType.AIR) setBlock(lx, ly, lz, type);
      }
      if (biome === Biome.FOREST && height > 10 && height < 30) {
        if (Math.random() < 0.02) {
          const treeY = height;
          if (treeY >= cy * CHUNK_SIZE && treeY < (cy + 1) * CHUNK_SIZE) {
            const ly = treeY - cy * CHUNK_SIZE;
            for (let th = 0; th < 5; th++) setBlock(lx, ly + th, lz, BlockType.LOG);
            for (let ox = -2; ox <= 2; ox++) {
              for (let oy = 3; oy <= 5; oy++) {
                for (let oz = -2; oz <= 2; oz++) {
                  if (Math.abs(ox) + Math.abs(oz) + Math.abs(oy-4) < 4) setBlock(lx + ox, ly + oy, lz + oz, BlockType.LEAVES);
                }
              }
            }
          }
        }
      }
    }
  }
  return chunk;
}

function getChunk(cx: number, cy: number, cz: number): Uint8Array {
  const key = `${cx},${cy},${cz}`;
  let chunk = chunks.get(key);
  if (!chunk) {
    const row = loadChunkStmt.get(cx, cy, cz) as { blocks: Buffer } | undefined;
    if (row) chunk = new Uint8Array(row.blocks);
    else { chunk = generateChunk(cx, cy, cz); saveChunk(cx, cy, cz, chunk); }
    chunks.set(key, chunk);
  }
  return chunk;
}

function saveChunk(cx: number, cy: number, cz: number, blocks: Uint8Array) {
  saveChunkStmt.run(cx, cy, cz, Buffer.from(blocks));
}

function updateBlockInChunk(x: number, y: number, z: number, type: BlockType) {
  const cx = Math.floor(x / CHUNK_SIZE), cy = Math.floor(y / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
  const chunk = getChunk(cx, cy, cz);
  const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const ly = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  chunk[getBlockIndex(lx, ly, lz)] = type;
  saveChunk(cx, cy, cz, chunk);
}

// Server Tick (20Hz)
setInterval(() => {
  mobManager.update(0.05, (x, y, z) => {
    const cx = Math.floor(x / CHUNK_SIZE), cy = Math.floor(y / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
    const chunk = chunks.get(`${cx},${cy},${cz}`);
    if (!chunk) return BlockType.AIR;
    return chunk[getBlockIndex(((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE, ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE, ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE)];
  });

  const mobData = mobManager.getMobData();
  const playerData = Array.from(players.values());
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'mob_update', data: { mobs: mobData } }));
      client.send(JSON.stringify({ type: 'player_update', data: { players: playerData } }));
      client.send(JSON.stringify({ type: 'weather_update', data: { weather: currentWeather } }));
    }
  });
}, 50);

// Weather Cycle (Every 2 minutes)
setInterval(() => {
  const r = Math.random();
  if (r < 0.6) currentWeather = 'CLEAR';
  else if (r < 0.8) currentWeather = 'RAIN';
  else currentWeather = 'SNOW';
  console.log(`Weather changed to: ${currentWeather}`);
}, 120000);

// Water Diffusion (Every 1 second)
setInterval(() => {
  const updates: { x: number, y: number, z: number, type: BlockType }[] = [];
  chunks.forEach((blocks, key) => {
    const [cx, cy, cz] = key.split(',').map(Number);
    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i] === BlockType.WATER) {
        const lx = i % CHUNK_SIZE;
        const ly = Math.floor(i / CHUNK_SIZE) % CHUNK_SIZE;
        const lz = Math.floor(i / (CHUNK_SIZE * CHUNK_SIZE));
        const gx = cx * CHUNK_SIZE + lx;
        const gy = cy * CHUNK_SIZE + ly;
        const gz = cz * CHUNK_SIZE + lz;

        const neighbors = [[gx, gy - 1, gz], [gx + 1, gy, gz], [gx - 1, gy, gz], [gx, gy, gz + 1], [gx, gy, gz - 1]];
        neighbors.forEach(([nx, ny, nz], idx) => {
           if (idx > 0 && Math.random() < 0.8) return; 
           const ncx = Math.floor(nx / CHUNK_SIZE), ncy = Math.floor(ny / CHUNK_SIZE), ncz = Math.floor(nz / CHUNK_SIZE);
           const nkey = `${ncx},${ncy},${ncz}`;
           const nchunk = chunks.get(nkey);
           if (nchunk) {
             const nidx = getBlockIndex(((nx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE, ((ny % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE, ((nz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE);
             if (nchunk[nidx] === BlockType.AIR) {
               updates.push({ x: nx, y: ny, z: nz, type: BlockType.WATER });
             }
           }
        });
      }
    }
  });
  updates.forEach(u => {
    updateBlockInChunk(u.x, u.y, u.z, u.type);
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'block_update', data: { pos: { x: u.x, y: u.y, z: u.z }, type: u.type } }));
      }
    });
  });
}, 1000);

wss.on('connection', (ws: WebSocket) => {
  const playerId = Math.random().toString(36).substring(7);
  console.log(`Client connected: ${playerId}`);

  ws.on('message', (data: string) => {
    try {
      const message = JSON.parse(data);
      if (message.type === 'player_move') {
        players.set(playerId, { id: playerId, ...message.data });
      } else if (message.type === 'chat_message') {
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'chat_message', data: { sender: playerId, text: message.data.text } }));
          }
        });
      } else if (message.type === 'request_chunk') {
        const { x, y, z } = message.data;
        const chunk = getChunk(x, y, z);
        ws.send(JSON.stringify({ type: 'chunk_data', data: { x, y, z, blocks: Array.from(chunk) } }));
      } else if (message.type === 'block_update') {
        const { pos, type } = message.data as BlockUpdate;
        updateBlockInChunk(pos.x, pos.y, pos.z, type);
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'block_update', data: message.data }));
          }
        });
      }
    } catch (e) { console.error('Failed to parse message', e); }
  });

  ws.on('close', () => {
    console.log(`Client disconnected: ${playerId}`);
    players.delete(playerId);
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'player_leave', data: { id: playerId } }));
      }
    });
  });
});

server.listen(port, () => { console.log(`Server listening on port ${port} (Persistent)`); });

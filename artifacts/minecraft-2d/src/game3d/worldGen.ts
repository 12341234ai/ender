import { BLOCKS, CHUNK_HEIGHT, CHUNK_SIZE, WORLD_CHUNKS, WORLD_SIZE, BlockId } from "./constants";

// Simple seeded PRNG
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Simple noise using hash
function hash2(x: number, z: number, seed: number): number {
  let h = seed;
  h = Math.imul(h ^ x, 0x517cc1b727220a95 | 0);
  h = Math.imul(h ^ z, 0x6c62272e07bb0142 | 0);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function smoothNoise(x: number, z: number, seed: number, scale: number): number {
  const sx = x / scale, sz = z / scale;
  const ix = Math.floor(sx), iz = Math.floor(sz);
  const fx = sx - ix, fz = sz - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * ux + (c - a) * uz + (d + a - b - c) * ux * uz;
}

function fbm(x: number, z: number, seed: number, scale: number, octaves: number): number {
  let val = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    val += smoothNoise(x * freq, z * freq, seed + i * 1000, scale) * amp;
    max += amp; amp *= 0.5; freq *= 2;
  }
  return val / max;
}

export type ChunkData = Uint8Array;
export type WorldChunks = Map<string, ChunkData>;

function chunkKey(cx: number, cz: number): string { return `${cx},${cz}`; }

function getChunk(world: WorldChunks, cx: number, cz: number): ChunkData {
  const key = chunkKey(cx, cz);
  let chunk = world.get(key);
  if (!chunk) { chunk = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE); world.set(key, chunk); }
  return chunk;
}

export function getBlock(world: WorldChunks, wx: number, wy: number, wz: number): BlockId {
  if (wx < 0 || wx >= WORLD_SIZE || wy < 0 || wy >= CHUNK_HEIGHT || wz < 0 || wz >= WORLD_SIZE) return BLOCKS.AIR;
  const cx = Math.floor(wx / CHUNK_SIZE), cz = Math.floor(wz / CHUNK_SIZE);
  const chunk = world.get(chunkKey(cx, cz));
  if (!chunk) return BLOCKS.AIR;
  const lx = wx - cx * CHUNK_SIZE, lz = wz - cz * CHUNK_SIZE;
  return chunk[wy * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx] as BlockId;
}

export function setBlock(world: WorldChunks, wx: number, wy: number, wz: number, block: number): void {
  if (wx < 0 || wx >= WORLD_SIZE || wy < 0 || wy >= CHUNK_HEIGHT || wz < 0 || wz >= WORLD_SIZE) return;
  const cx = Math.floor(wx / CHUNK_SIZE), cz = Math.floor(wz / CHUNK_SIZE);
  const chunk = getChunk(world, cx, cz);
  const lx = wx - cx * CHUNK_SIZE, lz = wz - cz * CHUNK_SIZE;
  chunk[wy * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx] = block;
}

// Biome types
enum Biome { Plains, Desert, Snow, Forest }

function getBiome(wx: number, wz: number, seed: number): Biome {
  const temp = fbm(wx, wz, seed + 500, 80, 2);
  if (temp < 0.3) return Biome.Snow;
  if (temp > 0.7) return Biome.Desert;
  const forest = fbm(wx, wz, seed + 900, 60, 2);
  return forest > 0.55 ? Biome.Forest : Biome.Plains;
}

function getHeight(wx: number, wz: number, seed: number): number {
  const base = fbm(wx, wz, seed, 80, 4);
  const hills = fbm(wx, wz, seed + 200, 40, 3);
  const mountain = fbm(wx, wz, seed + 400, 30, 2);
  return Math.floor(24 + base * 10 + hills * 6 + mountain * 4);
}

function placeTree(world: WorldChunks, wx: number, wy: number, wz: number): void {
  const h = 4 + Math.floor(Math.random() * 3);
  for (let y = wy; y < wy + h; y++) setBlock(world, wx, y, wz, BLOCKS.LOG);
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = h - 2; dy <= h + 1; dy++) {
    if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
    if (getBlock(world, wx + dx, wy + dy, wz + dz) === BLOCKS.AIR)
      setBlock(world, wx + dx, wy + dy, wz + dz, BLOCKS.LEAVES);
  }
}

function placeCactus(world: WorldChunks, wx: number, wy: number, wz: number): void {
  const h = 2 + Math.floor(Math.random() * 2);
  for (let y = wy; y < wy + h; y++) setBlock(world, wx, y, wz, BLOCKS.CACTUS);
}

export function generateChunk(world: WorldChunks, cx: number, cz: number, seed: number): ChunkData {
  const chunk = getChunk(world, cx, cz);
  const rng = mulberry32(seed ^ (cx * 1234567) ^ (cz * 7654321));

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wx = cx * CHUNK_SIZE + lx, wz = cz * CHUNK_SIZE + lz;
      const surfaceY = getHeight(wx, wz, seed);
      const biome = getBiome(wx, wz, seed);

      // Bedrock
      setBlock(world, wx, 0, wz, BLOCKS.BEDROCK);

      for (let wy = 1; wy < CHUNK_HEIGHT; wy++) {
        let block: BlockId = BLOCKS.AIR;
        if (wy < surfaceY - 4) {
          block = BLOCKS.STONE;
          // Ores
          const oreRoll = rng();
          if (wy < 8 && oreRoll < 0.015) block = BLOCKS.DIAMOND;
          else if (wy < 16 && oreRoll < 0.04) block = BLOCKS.REDSTONE;
          else if (wy < 28 && oreRoll < 0.06) block = BLOCKS.GOLD;
          else if (wy < 40 && oreRoll < 0.08) block = BLOCKS.IRON;
          else if (oreRoll < 0.10) block = BLOCKS.COAL;
          else if (wy < 20 && oreRoll < 0.11) block = BLOCKS.EMERALD;
        } else if (wy < surfaceY - 1) {
          block = biome === Biome.Desert ? BLOCKS.SAND : BLOCKS.DIRT;
        } else if (wy === surfaceY - 1) {
          if (biome === Biome.Desert) block = BLOCKS.SAND;
          else if (biome === Biome.Snow) block = BLOCKS.SNOW;
          else block = BLOCKS.GRASS;
        }
        // Caves
        if (block !== BLOCKS.AIR && wy > 4 && wy < surfaceY - 2) {
          const cave = fbm(wx, wz, seed + wy * 100, 12, 3);
          const caveY = fbm(wy, wx, seed + wz * 77, 8, 2);
          if (cave > 0.72 && caveY > 0.4) block = BLOCKS.AIR;
        }
        if (block !== BLOCKS.AIR) setBlock(world, wx, wy, wz, block);
      }

      // Surface features
      if (rng() < 0.005 && biome !== Biome.Desert) {
        placeTree(world, wx, surfaceY, wz);
      }
      if (biome === Biome.Desert && rng() < 0.004) {
        placeCactus(world, wx, surfaceY, wz);
      }
      if ((biome === Biome.Plains || biome === Biome.Forest) && rng() < 0.02) {
        setBlock(world, wx, surfaceY, wz, BLOCKS.FLOWER);
      }
    }
  }
  return chunk;
}

export function generateWorld(seed: number): WorldChunks {
  const world: WorldChunks = new Map();
  for (let cx = 0; cx < WORLD_CHUNKS; cx++) {
    for (let cz = 0; cz < WORLD_CHUNKS; cz++) {
      generateChunk(world, cx, cz, seed);
    }
  }
  return world;
}

export function getSpawnY(world: WorldChunks, wx: number, wz: number): number {
  for (let y = CHUNK_HEIGHT - 2; y >= 1; y--) {
    if (getBlock(world, wx, y, wz) !== BLOCKS.AIR && getBlock(world, wx, y + 1, wz) === BLOCKS.AIR) {
      return y + 1;
    }
  }
  return 40;
}

export function serializeWorld(world: WorldChunks): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  world.forEach((chunk, key) => { out[key] = Array.from(chunk); });
  return out;
}

export function deserializeWorld(data: Record<string, number[]>): WorldChunks {
  const world: WorldChunks = new Map();
  for (const [key, arr] of Object.entries(data)) {
    world.set(key, new Uint8Array(arr));
  }
  return world;
}

import { BLOCKS, BlockType, WORLD_HEIGHT, WORLD_WIDTH, SURFACE_BASE_Y } from "./constants";

function seededRand(seed: number) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}

function smoothNoise(x: number, scale: number, seed: number): number {
  const ix = Math.floor(x * scale);
  const fx = x * scale - ix;
  const r0 = seededRand(ix * 374761393 + seed * 6271);
  const r1 = seededRand((ix + 1) * 374761393 + seed * 6271);
  r0(); r0(); const a = r0() * 2 - 1;
  r1(); r1(); const b = r1() * 2 - 1;
  const t = fx * fx * (3 - 2 * fx);
  return a + (b - a) * t;
}

function getHeight(x: number, seed: number): number {
  let h = 0;
  h += smoothNoise(x, 0.004, seed) * 12;
  h += smoothNoise(x, 0.015, seed + 1) * 5;
  h += smoothNoise(x, 0.06, seed + 2) * 2;
  return Math.round(SURFACE_BASE_Y + h);
}

function caveNoise(x: number, y: number, seed: number): number {
  const s1 = smoothNoise(x + y * 0.3, 0.025, seed + 10);
  const s2 = smoothNoise(x * 0.4 + y, 0.025, seed + 20);
  return Math.abs(s1) + Math.abs(s2);
}

export enum Biome { PLAINS, DESERT, SNOW }

function getBiome(x: number, seed: number): Biome {
  const v = smoothNoise(x, 0.003, seed + 99);
  if (v < -0.3) return Biome.DESERT;
  if (v > 0.3) return Biome.SNOW;
  return Biome.PLAINS;
}

function getBlock(
  x: number, y: number,
  surface: number, biome: Biome,
  rand: () => number
): BlockType {
  if (y === WORLD_HEIGHT - 1) return BLOCKS.BEDROCK;
  if (y >= WORLD_HEIGHT - 4 && rand() < 0.7) return BLOCKS.BEDROCK;

  if (y < surface) return BLOCKS.AIR;

  const depth = y - surface;

  if (depth === 0) {
    if (biome === Biome.DESERT) return BLOCKS.SAND;
    if (biome === Biome.SNOW) return BLOCKS.SNOW;
    return BLOCKS.GRASS;
  }
  if (depth <= 5) {
    if (biome === Biome.DESERT) return BLOCKS.SAND;
    if (biome === Biome.SNOW) return depth <= 2 ? BLOCKS.SNOW : BLOCKS.DIRT;
    return BLOCKS.DIRT;
  }
  if (depth <= 8 && biome === Biome.DESERT) {
    return rand() < 0.5 ? BLOCKS.SAND : BLOCKS.GRAVEL;
  }

  const r = rand();
  if (depth >= 60 && r < 0.006) return BLOCKS.DIAMOND;
  if (depth >= 50 && r < 0.008) return BLOCKS.EMERALD_ORE;
  if (depth >= 30 && r < 0.01) return BLOCKS.REDSTONE_ORE;
  if (depth >= 20 && r < 0.018) return BLOCKS.GOLD_ORE;
  if (depth >= 14 && r < 0.03) return BLOCKS.IRON;
  if (depth >= 6 && r < 0.055) return BLOCKS.COAL;

  if (depth >= 10 && r < 0.003) return BLOCKS.OBSIDIAN;
  if (depth >= 8 && rand() < 0.008) return BLOCKS.GRAVEL;
  return BLOCKS.STONE;
}

function placeTrees(world: Uint8Array, heights: number[], biomes: Biome[], seed: number): void {
  const r = seededRand(seed + 99);
  for (let x = 4; x < WORLD_WIDTH - 4; x++) {
    const biome = biomes[x];
    if (biome === Biome.DESERT) {
      if (r() < 0.018) {
        const sy = heights[x];
        const h = 2 + Math.floor(r() * 3);
        for (let ty = sy - h; ty < sy; ty++) {
          if (ty >= 0) world[ty * WORLD_WIDTH + x] = BLOCKS.CACTUS;
        }
      }
      continue;
    }

    const prob = biome === Biome.SNOW ? 0.02 : 0.032;
    if (r() < prob) {
      const sy = heights[x];
      if (sy < 5 || sy >= WORLD_HEIGHT - 12) continue;
      const treeH = 4 + Math.floor(r() * 4);
      for (let ty = sy - treeH; ty < sy; ty++) {
        if (ty >= 0) world[ty * WORLD_WIDTH + x] = BLOCKS.WOOD;
      }
      const leafTop = sy - treeH;
      const leafR = Math.min(3, Math.max(2, Math.floor(treeH * 0.6)));
      for (let ly = leafTop - 2; ly <= leafTop + 2; ly++) {
        for (let lx = x - leafR; lx <= x + leafR; lx++) {
          if (lx < 0 || lx >= WORLD_WIDTH || ly < 0 || ly >= WORLD_HEIGHT) continue;
          const idx = ly * WORLD_WIDTH + lx;
          if (world[idx] === BLOCKS.AIR) {
            const dist = Math.sqrt((lx - x) ** 2 + (ly - leafTop) ** 2);
            if (dist <= leafR + 0.5 && r() > 0.1) {
              world[idx] = BLOCKS.LEAVES;
            }
          }
        }
      }
    }
  }
}

function placeFlowers(world: Uint8Array, heights: number[], biomes: Biome[], seed: number): void {
  const r = seededRand(seed + 777);
  for (let x = 1; x < WORLD_WIDTH - 1; x++) {
    if (biomes[x] === Biome.PLAINS && r() < 0.04) {
      const sy = heights[x];
      if (sy >= 1) {
        const idx = (sy - 1) * WORLD_WIDTH + x;
        if (world[idx] === BLOCKS.AIR) world[idx] = BLOCKS.FLOWER;
      }
    }
  }
}

function addTorchesInCaves(world: Uint8Array, seed: number): void {
  const r = seededRand(seed + 555);
  for (let y = 10; y < WORLD_HEIGHT - 5; y++) {
    for (let x = 5; x < WORLD_WIDTH - 5; x++) {
      if (world[y * WORLD_WIDTH + x] === BLOCKS.AIR && r() < 0.001) {
        const below = world[(y + 1) * WORLD_WIDTH + x];
        if (below !== BLOCKS.AIR) {
          world[y * WORLD_WIDTH + x] = BLOCKS.TORCH;
        }
      }
    }
  }
}

export function generateWorld(seed: number): { world: Uint8Array; heights: number[]; biomes: Biome[] } {
  const world = new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT);
  const heights: number[] = [];
  const biomes: Biome[] = [];
  const rand = seededRand(seed);

  for (let x = 0; x < WORLD_WIDTH; x++) {
    let h = getHeight(x, seed);
    h = Math.max(8, Math.min(WORLD_HEIGHT - 14, h));
    heights[x] = h;
    biomes[x] = getBiome(x, seed);
  }

  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let x = 0; x < WORLD_WIDTH; x++) {
      const surface = heights[x];
      let block = getBlock(x, y, surface, biomes[x], rand);

      if (block !== BLOCKS.AIR && block !== BLOCKS.BEDROCK) {
        const cv = caveNoise(x, y, seed);
        const depth = y - surface;
        if (depth > 3 && cv < 0.08) {
          block = BLOCKS.AIR;
        }
      }

      world[y * WORLD_WIDTH + x] = block;
    }
  }

  // Water in desert valleys
  for (let x = 1; x < WORLD_WIDTH - 1; x++) {
    if (biomes[x] === Biome.DESERT) {
      const sy = heights[x];
      const syL = heights[x - 1];
      const syR = heights[x + 1];
      if (sy > syL && sy > syR && sy > SURFACE_BASE_Y + 4) {
        for (let wy = syL; wy < sy; wy++) {
          if (world[wy * WORLD_WIDTH + x] === BLOCKS.AIR) {
            world[wy * WORLD_WIDTH + x] = BLOCKS.WATER;
          }
        }
      }
    }
  }

  // Snow biome ice lakes
  for (let x = 1; x < WORLD_WIDTH - 1; x++) {
    if (biomes[x] === Biome.SNOW) {
      const sy = heights[x];
      if (sy > SURFACE_BASE_Y + 3) {
        const idx = (sy - 1) * WORLD_WIDTH + x;
        if (world[idx] === BLOCKS.AIR) world[idx] = BLOCKS.ICE;
      }
    }
  }

  placeTrees(world, heights, biomes, seed);
  placeFlowers(world, heights, biomes, seed);
  addTorchesInCaves(world, seed);

  return { world, heights, biomes };
}

export function getSpawnPoint(heights: number[]): { x: number; y: number } {
  const cx = Math.floor(WORLD_WIDTH / 2);
  const sy = heights[cx];
  return {
    x: cx * 32 - 14,
    y: (sy - 3) * 32,
  };
}

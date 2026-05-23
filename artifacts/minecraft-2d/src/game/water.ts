import { BLOCKS, WORLD_HEIGHT, WORLD_WIDTH } from "./constants";

export function tickWater(world: Uint8Array): boolean {
  let changed = false;
  // Iterate bottom-up so water falls correctly in one pass
  for (let y = WORLD_HEIGHT - 2; y >= 0; y--) {
    for (let x = 0; x < WORLD_WIDTH; x++) {
      const b = world[y * WORLD_WIDTH + x];
      if (b !== BLOCKS.WATER && b !== BLOCKS.LAVA) continue;

      const isLava = b === BLOCKS.LAVA;
      const spread = isLava ? BLOCKS.LAVA : BLOCKS.WATER;

      // Fall down
      if (y + 1 < WORLD_HEIGHT) {
        const below = world[(y + 1) * WORLD_WIDTH + x];
        if (below === BLOCKS.AIR) {
          world[(y + 1) * WORLD_WIDTH + x] = spread;
          changed = true;
          continue;
        }
        // Water + lava = obsidian/stone
        if (!isLava && below === BLOCKS.LAVA) {
          world[(y + 1) * WORLD_WIDTH + x] = BLOCKS.OBSIDIAN;
          world[y * WORLD_WIDTH + x] = BLOCKS.AIR;
          changed = true;
          continue;
        }
        if (isLava && below === BLOCKS.WATER) {
          world[(y + 1) * WORLD_WIDTH + x] = BLOCKS.STONE;
          world[y * WORLD_WIDTH + x] = BLOCKS.AIR;
          changed = true;
          continue;
        }
      }

      // Spread sideways (only if not falling, i.e. has solid/liquid below)
      const below2 = y + 1 < WORLD_HEIGHT ? world[(y + 1) * WORLD_WIDTH + x] : BLOCKS.STONE;
      if (below2 !== BLOCKS.AIR) {
        const trySpread = (tx: number) => {
          if (tx < 0 || tx >= WORLD_WIDTH) return;
          const tb = world[y * WORLD_WIDTH + tx];
          if (tb === BLOCKS.AIR) {
            world[y * WORLD_WIDTH + tx] = spread;
            changed = true;
          }
        };
        // Only spread with 40% chance each tick to slow spread
        if (Math.random() < 0.4) trySpread(x - 1);
        if (Math.random() < 0.4) trySpread(x + 1);
      }
    }
  }
  return changed;
}

import { BLOCK_SIZE, BLOCKS, GRAVITY, MAX_FALL_SPEED, PLAYER_H, PLAYER_W, WORLD_HEIGHT, WORLD_WIDTH, NON_SOLID_BLOCKS, LIQUID_BLOCKS, CREATIVE_FLY_SPEED, GameMode } from "./constants";

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  facing: "left" | "right";
  hp: number;
  hunger: number;
  maxHp: number;
  maxHunger: number;
  inWater: boolean;
  inLava: boolean;
  flying: boolean;
}

export function createPlayer(x: number, y: number): Player {
  return { x, y, vx: 0, vy: 0, onGround: false, facing: "right", hp: 20, hunger: 20, maxHp: 20, maxHunger: 20, inWater: false, inLava: false, flying: false };
}

function getBlock(world: Uint8Array, bx: number, by: number): number {
  if (bx < 0 || bx >= WORLD_WIDTH || by < 0 || by >= WORLD_HEIGHT) return BLOCKS.STONE;
  return world[by * WORLD_WIDTH + bx];
}

function isSolid(world: Uint8Array, bx: number, by: number): boolean {
  return !NON_SOLID_BLOCKS.has(getBlock(world, bx, by));
}

function isLiquid(world: Uint8Array, bx: number, by: number): boolean {
  return LIQUID_BLOCKS.has(getBlock(world, bx, by));
}

export function updatePhysics(
  player: Player,
  world: Uint8Array,
  keys: Set<string>,
  dt: number,
  gameMode: GameMode,
  onFallDamage: (dmg: number) => void
): Player {
  let { x, y, vx, vy, onGround, facing, hp, hunger, inWater, inLava, flying } = player;

  const creative = gameMode === GameMode.CREATIVE;

  // Check if player center is in liquid
  const centerBX = Math.floor((x + PLAYER_W / 2) / BLOCK_SIZE);
  const centerBY = Math.floor((y + PLAYER_H * 0.6) / BLOCK_SIZE);
  const blockAtCenter = getBlock(world, centerBX, centerBY);
  inWater = blockAtCenter === BLOCKS.WATER;
  inLava = blockAtCenter === BLOCKS.LAVA;

  if (creative) {
    // Creative mode: free fly
    const speed = CREATIVE_FLY_SPEED;
    if (keys.has("w") || keys.has("arrowup") || keys.has(" ")) { vy = -speed; flying = true; }
    else if (keys.has("s") || keys.has("arrowdown")) { vy = speed; flying = true; }
    else { vy *= 0.7; }

    if (keys.has("a") || keys.has("arrowleft")) { vx = -speed; facing = "left"; }
    else if (keys.has("d") || keys.has("arrowright")) { vx = speed; facing = "right"; }
    else { vx *= 0.8; }

    x += vx * dt;
    y += vy * dt;
    x = resolveXCreative(x, y, world);
    y = resolveYCreative(x, y, world);
  } else {
    // Survival physics
    const waterDrag = inWater ? 0.85 : 1;
    const grav = inWater ? GRAVITY * 0.25 : inLava ? GRAVITY * 0.15 : GRAVITY;
    const maxFall = inWater ? 4 : inLava ? 2 : MAX_FALL_SPEED;

    vy += grav * dt;
    if (vy > maxFall) vy = maxFall;

    const moveSpeed = inWater || inLava ? 3 : 4.5;
    if (keys.has("a") || keys.has("arrowleft")) { vx = -moveSpeed * waterDrag; facing = "left"; }
    else if (keys.has("d") || keys.has("arrowright")) { vx = moveSpeed * waterDrag; facing = "right"; }
    else { vx *= inWater ? 0.7 : 0.75; if (Math.abs(vx) < 0.05) vx = 0; }

    const canJump = (keys.has("w") || keys.has(" ") || keys.has("arrowup"));
    if (canJump && onGround) { vy = inWater ? -7 : -11.5; onGround = false; }
    if (canJump && inWater) { vy -= 0.8 * dt; }

    const prevVy = vy;
    x += vx * dt;
    x = resolveX(x, y, vx, world);
    const prevY = y;
    y += vy * dt;
    const res = resolveY(x, y, vy, world);
    y = res.y; vy = res.vy; onGround = res.onGround;

    // Fall damage
    if (onGround && !res.wasOnGround && prevVy > 10 && !inWater && !inLava) {
      const dmg = Math.floor((prevVy - 10) * 1.5);
      if (dmg > 0) onFallDamage(dmg);
    }

    // Lava damage
    if (inLava) { hp = Math.max(0, hp - 0.1 * dt); }
  }

  // World clamp
  if (x < 0) { x = 0; vx = 0; }
  if (x + PLAYER_W > WORLD_WIDTH * BLOCK_SIZE) { x = WORLD_WIDTH * BLOCK_SIZE - PLAYER_W; vx = 0; }
  if (y < 0) { y = 0; vy = 0; }
  if (y + PLAYER_H > WORLD_HEIGHT * BLOCK_SIZE) { y = WORLD_HEIGHT * BLOCK_SIZE - PLAYER_H; vy = 0; onGround = true; }

  return { x, y, vx, vy, onGround, facing, hp, hunger, maxHp: player.maxHp, maxHunger: player.maxHunger, inWater, inLava, flying };
}

function resolveX(x: number, y: number, vx: number, world: Uint8Array): number {
  if (vx === 0) return x;
  const top = y + 2, bottom = y + PLAYER_H - 2;
  const topB = Math.floor(top / BLOCK_SIZE), botB = Math.floor(bottom / BLOCK_SIZE);
  if (vx > 0) {
    const bx = Math.floor((x + PLAYER_W) / BLOCK_SIZE);
    for (let by = topB; by <= botB; by++) if (isSolid(world, bx, by)) return bx * BLOCK_SIZE - PLAYER_W - 0.01;
  } else {
    const bx = Math.floor(x / BLOCK_SIZE);
    for (let by = topB; by <= botB; by++) if (isSolid(world, bx, by)) return (bx + 1) * BLOCK_SIZE + 0.01;
  }
  return x;
}

function resolveY(x: number, y: number, vy: number, world: Uint8Array): { y: number; vy: number; onGround: boolean; wasOnGround: boolean } {
  const left = x + 2, right = x + PLAYER_W - 2;
  const lB = Math.floor(left / BLOCK_SIZE), rB = Math.floor(right / BLOCK_SIZE);
  const wasOnGround = isSolid(world, lB, Math.floor((y + PLAYER_H) / BLOCK_SIZE)) ||
    isSolid(world, rB, Math.floor((y + PLAYER_H) / BLOCK_SIZE));

  if (vy > 0) {
    const by = Math.floor((y + PLAYER_H) / BLOCK_SIZE);
    for (let bx = lB; bx <= rB; bx++) {
      if (isSolid(world, bx, by)) return { y: by * BLOCK_SIZE - PLAYER_H - 0.01, vy: 0, onGround: true, wasOnGround };
    }
    return { y, vy, onGround: false, wasOnGround };
  } else if (vy < 0) {
    const by = Math.floor(y / BLOCK_SIZE);
    for (let bx = lB; bx <= rB; bx++) {
      if (isSolid(world, bx, by)) return { y: (by + 1) * BLOCK_SIZE + 0.01, vy: 0, onGround: false, wasOnGround };
    }
    return { y, vy, onGround: false, wasOnGround };
  }
  const by = Math.floor((y + PLAYER_H) / BLOCK_SIZE);
  for (let bx = lB; bx <= rB; bx++) if (isSolid(world, bx, by)) return { y, vy, onGround: true, wasOnGround };
  return { y, vy, onGround: false, wasOnGround };
}

function resolveXCreative(x: number, y: number, world: Uint8Array): number {
  const top = y + 2, bottom = y + PLAYER_H - 2;
  const topB = Math.floor(top / BLOCK_SIZE), botB = Math.floor(bottom / BLOCK_SIZE);
  const bxR = Math.floor((x + PLAYER_W) / BLOCK_SIZE);
  const bxL = Math.floor(x / BLOCK_SIZE);
  for (let by = topB; by <= botB; by++) {
    if (isSolid(world, bxR, by)) return bxR * BLOCK_SIZE - PLAYER_W - 0.01;
    if (isSolid(world, bxL, by)) return (bxL + 1) * BLOCK_SIZE + 0.01;
  }
  return x;
}

function resolveYCreative(x: number, y: number, world: Uint8Array): number {
  const left = x + 2, right = x + PLAYER_W - 2;
  const lB = Math.floor(left / BLOCK_SIZE), rB = Math.floor(right / BLOCK_SIZE);
  const byB = Math.floor((y + PLAYER_H) / BLOCK_SIZE);
  const byT = Math.floor(y / BLOCK_SIZE);
  for (let bx = lB; bx <= rB; bx++) {
    if (isSolid(world, bx, byB)) return byB * BLOCK_SIZE - PLAYER_H - 0.01;
    if (isSolid(world, bx, byT)) return (byT + 1) * BLOCK_SIZE + 0.01;
  }
  return y;
}

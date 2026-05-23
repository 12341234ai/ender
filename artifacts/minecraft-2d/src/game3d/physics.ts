import { CHUNK_HEIGHT, NON_SOLID, PLAYER_HEIGHT, PLAYER_WIDTH, WORLD_SIZE } from "./constants";
import { WorldChunks, getBlock } from "./worldGen";

export interface Player3D {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  yaw: number; pitch: number;
  onGround: boolean;
  flying: boolean;
  health: number; hunger: number;
  lastFallY: number;
}

export function createPlayer(x: number, y: number, z: number): Player3D {
  return { x, y, z, vx:0, vy:0, vz:0, yaw:0, pitch:0, onGround:false, flying:false, health:20, hunger:20, lastFallY: y };
}

const HW = PLAYER_WIDTH / 2;

function isSolidAt(world: WorldChunks, wx: number, wy: number, wz: number): boolean {
  const block = getBlock(world, Math.floor(wx), Math.floor(wy), Math.floor(wz));
  return !NON_SOLID.has(block);
}

function overlapsBlock(px: number, py: number, pz: number, bx: number, by: number, bz: number): boolean {
  return px - HW < bx + 1 && px + HW > bx &&
         py < by + 1 && py + PLAYER_HEIGHT > by &&
         pz - HW < bz + 1 && pz + HW > bz;
}

function collidesY(world: WorldChunks, px: number, py: number, pz: number): boolean {
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    const bx = Math.floor(px + dx * HW), bz = Math.floor(pz + dz * HW);
    for (let by = Math.floor(py); by <= Math.floor(py + PLAYER_HEIGHT); by++) {
      if (isSolidAt(world, bx, by, bz) && overlapsBlock(px, py, pz, bx, by, bz)) return true;
    }
  }
  return false;
}

function collidesX(world: WorldChunks, px: number, py: number, pz: number): boolean {
  for (let dz = -1; dz <= 1; dz++) {
    const bz = Math.floor(pz + dz * HW);
    for (let by = Math.floor(py); by <= Math.floor(py + PLAYER_HEIGHT); by++) {
      const bx = Math.floor(px);
      if (isSolidAt(world, bx, by, bz) && overlapsBlock(px, py, pz, bx, by, bz)) return true;
      const bxN = Math.floor(px - HW); const bxP = Math.floor(px + HW);
      if (bxN !== bx && isSolidAt(world, bxN, by, bz) && overlapsBlock(px, py, pz, bxN, by, bz)) return true;
      if (bxP !== bx && isSolidAt(world, bxP, by, bz) && overlapsBlock(px, py, pz, bxP, by, bz)) return true;
    }
  }
  return false;
}

function collidesZ(world: WorldChunks, px: number, py: number, pz: number): boolean {
  for (let dx = -1; dx <= 1; dx++) {
    const bx = Math.floor(px + dx * HW);
    for (let by = Math.floor(py); by <= Math.floor(py + PLAYER_HEIGHT); by++) {
      const bz = Math.floor(pz);
      if (isSolidAt(world, bx, by, bz) && overlapsBlock(px, py, pz, bx, by, bz)) return true;
      const bzN = Math.floor(pz - HW); const bzP = Math.floor(pz + HW);
      if (bzN !== bz && isSolidAt(world, bx, by, bzN) && overlapsBlock(px, py, pz, bx, by, bzN)) return true;
      if (bzP !== bz && isSolidAt(world, bx, by, bzP) && overlapsBlock(px, py, pz, bx, by, bzP)) return true;
    }
  }
  return false;
}

export function stepPhysics(
  player: Player3D,
  world: WorldChunks,
  keys: Set<string>,
  dt: number,
  creative: boolean,
  sprinting = false,
): void {
  dt = Math.min(dt, 0.05);

  const GRAVITY = creative ? 0 : 28;
  const SPEED = creative ? 10 : (sprinting ? 7.2 : 4.8);
  const JUMP_V = 9;

  // Movement direction from yaw
  const cos = Math.cos(player.yaw), sin = Math.sin(player.yaw);

  let mx = 0, mz = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp"))    { mx += sin; mz += cos; }
  if (keys.has("KeyS") || keys.has("ArrowDown"))  { mx -= sin; mz -= cos; }
  if (keys.has("KeyA") || keys.has("ArrowLeft"))  { mx -= cos; mz += sin; }
  if (keys.has("KeyD") || keys.has("ArrowRight")) { mx += cos; mz -= sin; }

  const len = Math.sqrt(mx * mx + mz * mz);
  if (len > 0) { mx /= len; mz /= len; }

  if (creative) {
    player.vx = mx * SPEED;
    player.vz = mz * SPEED;
    player.vy = 0;
    if (keys.has("Space"))       player.vy =  SPEED;
    if (keys.has("ShiftLeft") || keys.has("ShiftRight")) player.vy = -SPEED;

    player.x = Math.max(HW, Math.min(WORLD_SIZE - HW, player.x + player.vx * dt));
    player.y = Math.max(0, Math.min(CHUNK_HEIGHT - 2, player.y + player.vy * dt));
    player.z = Math.max(HW, Math.min(WORLD_SIZE - HW, player.z + player.vz * dt));
    player.onGround = false;
    return;
  }

  // Survival physics
  player.vx = mx * SPEED;
  player.vz = mz * SPEED;

  if (keys.has("Space") && player.onGround) {
    player.vy = JUMP_V;
    player.onGround = false;
  }

  player.vy -= GRAVITY * dt;
  player.vy = Math.max(player.vy, -50);

  // X movement
  const nx = player.x + player.vx * dt;
  if (!collidesX(world, nx, player.y, player.z)) {
    player.x = Math.max(HW, Math.min(WORLD_SIZE - HW, nx));
  } else { player.vx = 0; }

  // Y movement
  const ny = player.y + player.vy * dt;
  if (!collidesY(world, player.x, ny, player.z)) {
    player.y = Math.max(0, Math.min(CHUNK_HEIGHT - 2, ny));
    if (player.vy < -8) player.onGround = false;
  } else {
    if (player.vy < 0) {
      // Fall damage
      const fallDist = player.lastFallY - player.y;
      if (fallDist > 4) {
        const dmg = Math.floor((fallDist - 3) * 2);
        player.health = Math.max(0, player.health - dmg);
      }
      player.onGround = true;
      player.lastFallY = player.y;
    }
    player.vy = 0;
  }
  if (player.vy < 0) {
    // track fall for damage
  } else {
    player.lastFallY = player.y;
  }

  // Z movement
  const nz = player.z + player.vz * dt;
  if (!collidesZ(world, player.x, player.y, nz)) {
    player.z = Math.max(HW, Math.min(WORLD_SIZE - HW, nz));
  } else { player.vz = 0; }
}

// DDA ray-block intersection
export function raycastBlock(
  world: WorldChunks,
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  maxDist: number,
): { wx: number; wy: number; wz: number; faceNx: number; faceNy: number; faceNz: number } | null {
  let bx = Math.floor(ox), by = Math.floor(oy), bz = Math.floor(oz);
  const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
  const tDX = Math.abs(1 / (dx || 1e-9));
  const tDY = Math.abs(1 / (dy || 1e-9));
  const tDZ = Math.abs(1 / (dz || 1e-9));
  let tX = dx !== 0 ? (dx > 0 ? (bx + 1 - ox) : (ox - bx)) * tDX : 1e18;
  let tY = dy !== 0 ? (dy > 0 ? (by + 1 - oy) : (oy - by)) * tDY : 1e18;
  let tZ = dz !== 0 ? (dz > 0 ? (bz + 1 - oz) : (oz - bz)) * tDZ : 1e18;

  let fNx = 0, fNy = 0, fNz = 0;
  for (let i = 0; i < 64; i++) {
    const block = getBlock(world, bx, by, bz);
    if (block !== 0 && !NON_SOLID.has(block)) {
      return { wx: bx, wy: by, wz: bz, faceNx: fNx, faceNy: fNy, faceNz: fNz };
    }
    const t = Math.min(tX, tY, tZ);
    if (t > maxDist) break;
    if (tX <= tY && tX <= tZ) { bx += stepX; fNx = -stepX; fNy = 0; fNz = 0; tX += tDX; }
    else if (tY <= tX && tY <= tZ) { by += stepY; fNy = -stepY; fNx = 0; fNz = 0; tY += tDY; }
    else { bz += stepZ; fNz = -stepZ; fNx = 0; fNy = 0; tZ += tDZ; }
  }
  return null;
}

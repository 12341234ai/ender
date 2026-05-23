import {
  BLOCK_SIZE, BLOCKS, BlockType, WORLD_HEIGHT, WORLD_WIDTH,
  PLAYER_W, PLAYER_H, GameMode, CREATIVE_PALETTE, BLOCK_NAMES,
} from "./constants";
import type { RemotePlayer } from "./multiplayer";
import type { Player } from "./physics";

// ── Block colour table ────────────────────────────────────────────────────────
type BC = { base: string; top?: string; acc?: string; glow?: string };
const BC: Record<number, BC> = {
  [BLOCKS.AIR]:          { base: "transparent" },
  [BLOCKS.GRASS]:        { base: "#6e4a1f", top: "#5da832", acc: "#4e9028" },
  [BLOCKS.DIRT]:         { base: "#8b5e3c", acc: "#7a5233" },
  [BLOCKS.STONE]:        { base: "#808080", acc: "#636363" },
  [BLOCKS.COAL]:         { base: "#6f6f6f", acc: "#1a1a1a" },
  [BLOCKS.IRON]:         { base: "#8c7f6e", acc: "#c87941" },
  [BLOCKS.GOLD_ORE]:     { base: "#8c7f6e", acc: "#f5c518" },
  [BLOCKS.DIAMOND]:      { base: "#5bcfcf", acc: "#2fa8b8" },
  [BLOCKS.EMERALD_ORE]:  { base: "#6f6f6f", acc: "#2ecc71" },
  [BLOCKS.REDSTONE_ORE]: { base: "#6f6f6f", acc: "#e74c3c" },
  [BLOCKS.WOOD]:         { base: "#7c5a2a", acc: "#5a3e1a" },
  [BLOCKS.PLANKS]:       { base: "#c49a3c", acc: "#a07830" },
  [BLOCKS.LEAVES]:       { base: "#2d7a1f", acc: "#1f5c12" },
  [BLOCKS.SAND]:         { base: "#d9c47a", acc: "#c4ae60" },
  [BLOCKS.GRAVEL]:       { base: "#8a8070", acc: "#6e6558" },
  [BLOCKS.WATER]:        { base: "#1a6eb5", acc: "#1456a0", glow: "rgba(100,180,255,0.22)" },
  [BLOCKS.LAVA]:         { base: "#e05010", acc: "#b03800", glow: "rgba(255,140,0,0.4)" },
  [BLOCKS.GLASS]:        { base: "#a8d8f0", acc: "#88b8d0" },
  [BLOCKS.BRICK]:        { base: "#9e4c30", acc: "#7a3820" },
  [BLOCKS.OBSIDIAN]:     { base: "#1a0d2e", acc: "#0d0620" },
  [BLOCKS.SNOW]:         { base: "#e8f0f8", acc: "#c0ccd8" },
  [BLOCKS.ICE]:          { base: "#88c0e8", acc: "#6090c0" },
  [BLOCKS.BEDROCK]:      { base: "#303030", acc: "#1a1a1a" },
  [BLOCKS.FLOWER]:       { base: "#e83030", acc: "#28a028" },
  [BLOCKS.CACTUS]:       { base: "#2d8c1f", acc: "#1f6012" },
  [BLOCKS.TORCH]:        { base: "#c8a040", acc: "#f0e060", glow: "rgba(255,220,100,0.35)" },
  [BLOCKS.CHEST]:        { base: "#8b6914", acc: "#c49a3c" },
  [BLOCKS.CRAFTING]:     { base: "#7c5a2a", acc: "#5a3e1a" },
  [BLOCKS.SPONGE]:       { base: "#d4c820", acc: "#b0a818" },
  [BLOCKS.TNT]:          { base: "#d02020", acc: "#e8e8e8" },
};

// ── 3-D face shading helpers ──────────────────────────────────────────────────
function lighten(col: string, a: number): string { return `rgba(255,255,255,${a})`; }
function darken(col: string, a: number): string { return `rgba(0,0,0,${a})`; }

function fill3DFaces(
  ctx: CanvasRenderingContext2D,
  px: number, py: number, size: number
): void {
  const topH = Math.max(3, Math.floor(size * 0.22));
  const sideW = Math.max(3, Math.floor(size * 0.14));

  // top highlight
  ctx.fillStyle = lighten("", 0.28);
  ctx.fillRect(px, py, size, topH);

  // left shadow
  ctx.fillStyle = darken("", 0.16);
  ctx.fillRect(px, py, sideW, size);

  // bottom shadow
  ctx.fillStyle = darken("", 0.22);
  ctx.fillRect(px, py + size - 3, size, 3);

  // right edge thin highlight
  ctx.fillStyle = lighten("", 0.08);
  ctx.fillRect(px + size - 2, py, 2, size);
}

// ── Block-specific texture patterns ──────────────────────────────────────────
function drawTexture(ctx: CanvasRenderingContext2D, bt: number, px: number, py: number, size: number): void {
  const c = BC[bt];
  if (!c || bt === BLOCKS.AIR) return;

  const s = size;

  if (bt === BLOCKS.WATER || bt === BLOCKS.LAVA) {
    ctx.globalAlpha = bt === BLOCKS.WATER ? 0.82 : 0.94;
    ctx.fillStyle = c.base;
    ctx.fillRect(px, py, s, s);
    ctx.globalAlpha = 1;
    if (c.glow) {
      ctx.fillStyle = c.glow;
      ctx.fillRect(px, py, s, s);
    }
    // animated wave lines
    const t = performance.now() * 0.001;
    ctx.strokeStyle = bt === BLOCKS.WATER ? "rgba(100,200,255,0.4)" : "rgba(255,180,60,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < s; i++) {
      const wy = py + s * 0.4 + Math.sin(t * 2 + (px + i) * 0.4) * 2;
      i === 0 ? ctx.moveTo(px + i, wy) : ctx.lineTo(px + i, wy);
    }
    ctx.stroke();
    return;
  }

  if (bt === BLOCKS.GLASS) {
    ctx.strokeStyle = c.base;
    ctx.lineWidth = Math.max(2, s * 0.08);
    ctx.strokeRect(px + 1, py + 1, s - 2, s - 2);
    ctx.fillStyle = "rgba(168,216,240,0.22)";
    ctx.fillRect(px, py, s, s);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(px + 2, py + 2, s * 0.3, s * 0.3);
    return;
  }

  if (bt === BLOCKS.TORCH) {
    // thin stick + flame
    const sw = Math.max(3, s * 0.18);
    ctx.fillStyle = c.base;
    ctx.fillRect(px + s / 2 - sw / 2, py + s * 0.3, sw, s * 0.65);
    // flame
    ctx.fillStyle = "#f5a623";
    ctx.fillRect(px + s / 2 - sw / 2 - 1, py + s * 0.12, sw + 2, s * 0.22);
    ctx.fillStyle = "#fff";
    ctx.fillRect(px + s / 2 - 1, py + s * 0.14, 2, s * 0.1);
    if (c.glow) {
      ctx.fillStyle = c.glow;
      ctx.fillRect(px - 4, py - 4, s + 8, s + 8);
    }
    return;
  }

  if (bt === BLOCKS.FLOWER) {
    // stem
    ctx.fillStyle = "#3a8c1f";
    ctx.fillRect(px + s * 0.45, py + s * 0.45, s * 0.1, s * 0.55);
    // petals
    ctx.fillStyle = c.base;
    ctx.fillRect(px + s * 0.3, py + s * 0.15, s * 0.4, s * 0.3);
    ctx.fillRect(px + s * 0.2, py + s * 0.25, s * 0.6, s * 0.15);
    // center
    ctx.fillStyle = "#f5e020";
    ctx.fillRect(px + s * 0.38, py + s * 0.18, s * 0.24, s * 0.24);
    return;
  }

  if (bt === BLOCKS.CACTUS) {
    ctx.fillStyle = c.base;
    ctx.fillRect(px + s * 0.2, py, s * 0.6, s);
    ctx.fillStyle = c.acc;
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(px + s * 0.05, py + s * (0.15 + i * 0.2), s * 0.15, 3);
      ctx.fillRect(px + s * 0.8, py + s * (0.22 + i * 0.2), s * 0.15, 3);
    }
    return;
  }

  // Generic block base
  ctx.fillStyle = c.base;
  ctx.fillRect(px, py, s, s);

  // Specific overlays
  if (bt === BLOCKS.GRASS) {
    ctx.fillStyle = c.top!;
    ctx.fillRect(px, py, s, Math.floor(s * 0.28));
    ctx.fillStyle = c.acc!;
    ctx.fillRect(px + s * 0.14, py + s * 0.06, s * 0.18, s * 0.12);
    ctx.fillRect(px + s * 0.58, py + s * 0.08, s * 0.18, s * 0.12);
  } else if (bt === BLOCKS.DIRT) {
    ctx.fillStyle = c.acc!;
    const ds = Math.max(2, s * 0.18);
    ctx.fillRect(px + s * 0.14, py + s * 0.18, ds, ds);
    ctx.fillRect(px + s * 0.58, py + s * 0.55, ds, ds);
    ctx.fillRect(px + s * 0.36, py + s * 0.65, ds * 0.8, ds * 0.8);
  } else if (bt === BLOCKS.STONE) {
    ctx.fillStyle = c.acc!;
    const cw = Math.max(1, s * 0.08);
    ctx.fillRect(px + s * 0.18, py + s * 0.14, s * 0.42, cw);
    ctx.fillRect(px + s * 0.54, py + s * 0.38, cw, s * 0.38);
    ctx.fillRect(px + s * 0.08, py + s * 0.6, s * 0.36, cw);
  } else if (bt === BLOCKS.COAL) {
    ctx.fillStyle = c.acc!;
    const os = Math.max(3, s * 0.2);
    ctx.fillRect(px + s * 0.18, py + s * 0.18, os, os);
    ctx.fillRect(px + s * 0.55, py + s * 0.5, os, os);
    ctx.fillRect(px + s * 0.28, py + s * 0.62, os * 0.7, os * 0.7);
  } else if (bt === BLOCKS.IRON) {
    ctx.fillStyle = c.acc!;
    const os = Math.max(3, s * 0.22);
    ctx.fillRect(px + s * 0.2, py + s * 0.2, os, os);
    ctx.fillRect(px + s * 0.54, py + s * 0.48, os, os);
    ctx.fillRect(px + s * 0.3, py + s * 0.64, os * 0.8, os * 0.8);
  } else if (bt === BLOCKS.GOLD_ORE) {
    ctx.fillStyle = c.acc!;
    const os = Math.max(3, s * 0.22);
    ctx.fillRect(px + s * 0.2, py + s * 0.2, os, os);
    ctx.fillRect(px + s * 0.54, py + s * 0.5, os, os);
    ctx.fillRect(px + s * 0.3, py + s * 0.64, os * 0.8, os * 0.8);
  } else if (bt === BLOCKS.DIAMOND) {
    ctx.fillStyle = "#a8ffff";
    const os = Math.max(3, s * 0.22);
    ctx.fillRect(px + s * 0.2, py + s * 0.2, os, os);
    ctx.fillRect(px + s * 0.55, py + s * 0.5, os, os);
    ctx.fillStyle = c.acc!;
    ctx.fillRect(px + s * 0.3, py + s * 0.62, os * 0.8, os * 0.8);
  } else if (bt === BLOCKS.EMERALD_ORE || bt === BLOCKS.REDSTONE_ORE) {
    ctx.fillStyle = c.acc!;
    const os = Math.max(3, s * 0.22);
    ctx.fillRect(px + s * 0.18, py + s * 0.2, os, os);
    ctx.fillRect(px + s * 0.55, py + s * 0.52, os, os);
    ctx.fillRect(px + s * 0.3, py + s * 0.64, os * 0.8, os * 0.8);
  } else if (bt === BLOCKS.WOOD) {
    ctx.fillStyle = c.acc!;
    const lw = Math.max(1, s * 0.06);
    ctx.fillRect(px + s * 0.18, py, lw, s);
    ctx.fillRect(px + s * 0.72, py, lw, s);
    ctx.fillRect(px + s * 0.42, py, lw * 0.7, s);
  } else if (bt === BLOCKS.PLANKS) {
    ctx.fillStyle = c.acc!;
    ctx.fillRect(px, py + Math.floor(s * 0.48), s, 2);
    ctx.fillRect(px + Math.floor(s * 0.48), py, 2, Math.floor(s * 0.48));
    ctx.fillRect(px, py + Math.floor(s * 0.74), s, 2);
  } else if (bt === BLOCKS.LEAVES) {
    ctx.fillStyle = c.acc!;
    const ls = Math.max(2, s * 0.14);
    for (let i = 0; i < 6; i++) ctx.fillRect(px + s * (0.1 + (i % 3) * 0.34), py + s * (0.1 + Math.floor(i / 3) * 0.44), ls, ls);
  } else if (bt === BLOCKS.SAND) {
    ctx.fillStyle = c.acc!;
    for (let i = 0; i < 5; i++) ctx.fillRect(px + s * (0.1 + i * 0.18), py + s * (0.2 + (i % 2) * 0.4), s * 0.1, s * 0.1);
  } else if (bt === BLOCKS.GRAVEL) {
    ctx.fillStyle = c.acc!;
    const gs = Math.max(3, s * 0.22);
    ctx.fillRect(px + s * 0.12, py + s * 0.12, gs, gs);
    ctx.fillRect(px + s * 0.56, py + s * 0.48, gs, gs);
    ctx.fillRect(px + s * 0.3, py + s * 0.62, gs * 0.8, gs * 0.8);
  } else if (bt === BLOCKS.BRICK) {
    ctx.fillStyle = c.acc!;
    const bh = Math.max(1, s * 0.08);
    ctx.fillRect(px, py + s * 0.32, s, bh);
    ctx.fillRect(px, py + s * 0.64, s, bh);
    ctx.fillRect(px + s * 0.5, py, 2, s * 0.32);
    ctx.fillRect(px, py + s * 0.32 + bh, 2, s * 0.32);
    ctx.fillRect(px + s * 0.5, py + s * 0.64 + bh, 2, s * 0.36);
  } else if (bt === BLOCKS.OBSIDIAN) {
    ctx.fillStyle = c.acc!;
    ctx.fillRect(px + s * 0.2, py + s * 0.2, s * 0.16, s * 0.16);
    ctx.fillRect(px + s * 0.55, py + s * 0.55, s * 0.2, s * 0.12);
    ctx.fillStyle = "rgba(180,100,255,0.18)";
    ctx.fillRect(px, py, s, s);
  } else if (bt === BLOCKS.SNOW) {
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillRect(px, py, s, s * 0.18);
  } else if (bt === BLOCKS.ICE) {
    ctx.fillStyle = "rgba(160,210,240,0.35)";
    ctx.fillRect(px, py, s, s);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(px + s * 0.1, py + s * 0.1, s * 0.28, s * 0.14);
  } else if (bt === BLOCKS.BEDROCK) {
    ctx.fillStyle = c.acc!;
    const bs = Math.max(2, s * 0.16);
    ctx.fillRect(px + s * 0.14, py + s * 0.14, bs, bs);
    ctx.fillRect(px + s * 0.52, py + s * 0.5, bs, bs);
    ctx.fillRect(px + s * 0.3, py + s * 0.66, bs * 0.8, bs * 0.8);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(px, py, s, s);
  } else if (bt === BLOCKS.CHEST) {
    ctx.fillStyle = c.acc!;
    ctx.fillRect(px + s * 0.08, py + s * 0.08, s * 0.84, s * 0.4);
    ctx.fillStyle = "#8b6914";
    ctx.fillRect(px + s * 0.35, py + s * 0.4, s * 0.3, s * 0.1);
    ctx.fillStyle = "#f0c030";
    ctx.fillRect(px + s * 0.42, py + s * 0.42, s * 0.16, s * 0.06);
  } else if (bt === BLOCKS.CRAFTING) {
    ctx.fillStyle = "#5a3e1a";
    ctx.fillRect(px, py, s, s);
    ctx.fillStyle = "#c49a3c";
    ctx.fillRect(px + s * 0.08, py + s * 0.08, s * 0.38, s * 0.38);
    ctx.fillRect(px + s * 0.54, py + s * 0.08, s * 0.38, s * 0.38);
    ctx.fillRect(px + s * 0.08, py + s * 0.54, s * 0.38, s * 0.38);
    ctx.fillRect(px + s * 0.54, py + s * 0.54, s * 0.38, s * 0.38);
  } else if (bt === BLOCKS.TNT) {
    ctx.fillStyle = c.acc!;
    ctx.fillRect(px, py, s, s * 0.22);
    ctx.fillRect(px, py + s * 0.78, s, s * 0.22);
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.floor(s * 0.28)}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText("TNT", px + s / 2, py + s * 0.6);
    ctx.textAlign = "left";
  }

  // 3-D shading overlay on solid blocks
  if (bt !== BLOCKS.AIR && bt !== BLOCKS.WATER && bt !== BLOCKS.LAVA && bt !== BLOCKS.GLASS && bt !== BLOCKS.TORCH && bt !== BLOCKS.FLOWER && bt !== BLOCKS.CACTUS) {
    fill3DFaces(ctx, px, py, s);
  }

  // border
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.lineWidth = 0.8;
  ctx.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
}

export function drawBlock(ctx: CanvasRenderingContext2D, bt: BlockType, px: number, py: number, size: number): void {
  drawTexture(ctx, bt, px, py, size);
}

// ── World ─────────────────────────────────────────────────────────────────────
export function drawWorld(
  ctx: CanvasRenderingContext2D,
  world: Uint8Array,
  camX: number, camY: number,
  canvasW: number, canvasH: number
): void {
  const x0 = Math.max(0, Math.floor(camX / BLOCK_SIZE) - 1);
  const x1 = Math.min(WORLD_WIDTH - 1, Math.ceil((camX + canvasW) / BLOCK_SIZE) + 1);
  const y0 = Math.max(0, Math.floor(camY / BLOCK_SIZE) - 1);
  const y1 = Math.min(WORLD_HEIGHT - 1, Math.ceil((camY + canvasH) / BLOCK_SIZE) + 1);

  // draw opaque blocks first, then liquids on top
  for (let pass = 0; pass < 2; pass++) {
    for (let by = y0; by <= y1; by++) {
      for (let bx = x0; bx <= x1; bx++) {
        const bt = world[by * WORLD_WIDTH + bx] as BlockType;
        if (bt === BLOCKS.AIR) continue;
        const isLiquid = bt === BLOCKS.WATER || bt === BLOCKS.LAVA;
        if (pass === 0 && isLiquid) continue;
        if (pass === 1 && !isLiquid) continue;
        drawTexture(ctx, bt, Math.floor(bx * BLOCK_SIZE - camX), Math.floor(by * BLOCK_SIZE - camY), BLOCK_SIZE);
      }
    }
  }
}

// ── Player character ──────────────────────────────────────────────────────────
function drawCharSprite(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  facing: string, isMoving: boolean,
  time: number, bodyColor: string,
  name?: string, isCreative?: boolean, inWater?: boolean
): void {
  const ls = isMoving ? Math.sin(time * 0.2) * 0.38 : 0;
  const as = isMoving ? Math.sin(time * 0.2 + Math.PI) * 0.3 : 0;
  const fd = facing === "right" ? 1 : -1;
  const bw = PLAYER_W, bh = PLAYER_H;

  ctx.save();
  ctx.translate(x + bw / 2, y + bh / 2);

  if (inWater) {
    ctx.globalAlpha = 0.78;
  }

  // legs
  ctx.fillStyle = darkenHex(bodyColor, 45);
  ctx.save(); ctx.translate(-bw * 0.15, bh * 0.28); ctx.rotate(ls);
  ctx.fillRect(-bw * 0.13, 0, bw * 0.26, bh * 0.26); ctx.restore();
  ctx.save(); ctx.translate(bw * 0.15, bh * 0.28); ctx.rotate(-ls);
  ctx.fillRect(-bw * 0.13, 0, bw * 0.26, bh * 0.26); ctx.restore();

  // body
  ctx.fillStyle = bodyColor;
  ctx.fillRect(-bw * 0.34, -bh * 0.1, bw * 0.68, bh * 0.38);

  // creative badge
  if (isCreative) {
    ctx.fillStyle = "#a020f0";
    ctx.fillRect(-bw * 0.34, -bh * 0.1, bw * 0.68, 3);
  }

  // arms
  ctx.fillStyle = darkenHex(bodyColor, 22);
  ctx.save(); ctx.translate(-bw * 0.44, -bh * 0.1); ctx.rotate(-as);
  ctx.fillRect(-bw * 0.1, 0, bw * 0.18, bh * 0.3); ctx.restore();
  ctx.save(); ctx.translate(bw * 0.44, -bh * 0.1); ctx.rotate(as);
  ctx.fillRect(-bw * 0.1, 0, bw * 0.18, bh * 0.3); ctx.restore();

  // head
  ctx.fillStyle = "#f0c080";
  ctx.fillRect(-bw * 0.32, -bh * 0.5, bw * 0.64, bh * 0.4);
  ctx.fillStyle = "#5c3a1a";
  ctx.fillRect(-bw * 0.32, -bh * 0.5, bw * 0.64, bh * 0.1);
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(fd * bw * 0.06, -bh * 0.34, bw * 0.11, bh * 0.08);

  ctx.globalAlpha = 1;
  ctx.restore();

  // name tag
  if (name) {
    ctx.save();
    ctx.font = "bold 10px monospace";
    const tw = ctx.measureText(name).width;
    const nx = x + bw / 2, ny = y - 6;
    ctx.fillStyle = "rgba(0,0,0,0.62)";
    roundRect(ctx, nx - tw / 2 - 5, ny - 13, tw + 10, 17, 4);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText(name, nx, ny);
    ctx.textAlign = "left";
    ctx.restore();
  }
}

function darkenHex(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.max(0, r - amount)},${Math.max(0, g - amount)},${Math.max(0, b - amount)})`;
}

export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: Player,
  camX: number, camY: number,
  time: number, color: string, gameMode: GameMode
): void {
  drawCharSprite(
    ctx,
    Math.floor(player.x - camX), Math.floor(player.y - camY),
    player.facing, Math.abs(player.vx) > 0.5,
    time, color, undefined,
    gameMode === GameMode.CREATIVE, player.inWater
  );
}

export function drawRemotePlayers(
  ctx: CanvasRenderingContext2D,
  players: Map<string, RemotePlayer>,
  camX: number, camY: number, time: number
): void {
  for (const p of players.values()) {
    const px = Math.floor(p.x - camX), py = Math.floor(p.y - camY);
    if (px < -80 || px > ctx.canvas.width + 80) continue;
    drawCharSprite(ctx, px, py, p.facing, Math.abs(p.vx) > 0.5, time, p.color, p.name);
  }
}

// ── Hotbar ────────────────────────────────────────────────────────────────────
export function drawHotbar(
  ctx: CanvasRenderingContext2D,
  canvasW: number, canvasH: number,
  selectedSlot: number,
  hotbar: BlockType[],
  inventory: Record<number, number>,
  gameMode: GameMode
): void {
  const slots = hotbar.length;
  const ss = 46, pad = 4;
  const totalW = slots * (ss + pad) - pad;
  const sx = Math.floor((canvasW - totalW) / 2);
  const sy = canvasH - ss - 12;

  ctx.fillStyle = "rgba(0,0,0,0.7)";
  roundRect(ctx, sx - 8, sy - 8, totalW + 16, ss + 16, 8);
  ctx.fill();
  ctx.strokeStyle = gameMode === GameMode.CREATIVE ? "rgba(160,32,240,0.5)" : "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, sx - 8, sy - 8, totalW + 16, ss + 16, 8);
  ctx.stroke();

  for (let i = 0; i < slots; i++) {
    const bx = sx + i * (ss + pad), by = sy;
    const bt = hotbar[i];
    const sel = i === selectedSlot;

    ctx.fillStyle = sel ? "rgba(255,255,255,0.22)" : "rgba(60,60,60,0.55)";
    roundRect(ctx, bx, by, ss, ss, 5); ctx.fill();
    ctx.strokeStyle = sel ? "#fff" : "rgba(255,255,255,0.25)";
    ctx.lineWidth = sel ? 2 : 1;
    roundRect(ctx, bx, by, ss, ss, 5); ctx.stroke();

    const iconSz = 24;
    drawTexture(ctx, bt, Math.floor(bx + (ss - iconSz) / 2), Math.floor(by + 5), iconSz);

    ctx.fillStyle = "rgba(200,200,200,0.6)";
    ctx.font = "bold 8px monospace";
    ctx.fillText(`${i + 1}`, bx + 3, by + 11);

    const count = gameMode === GameMode.CREATIVE ? "∞" : String(inventory[bt] || 0);
    if (count !== "0") {
      ctx.fillStyle = "#fff";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "right";
      ctx.fillText(count, bx + ss - 2, by + ss - 3);
      ctx.textAlign = "left";
    }

    ctx.fillStyle = sel ? "#fff" : "rgba(180,180,180,0.65)";
    ctx.font = "6px monospace";
    ctx.textAlign = "center";
    const label = BLOCK_NAMES[bt] ?? "";
    ctx.fillText(label.slice(0, 8), bx + ss / 2, by + ss + 11);
    ctx.textAlign = "left";
  }
}

// ── Creative palette ──────────────────────────────────────────────────────────
export function drawCreativePalette(
  ctx: CanvasRenderingContext2D,
  canvasW: number, canvasH: number,
  selectedBlock: BlockType,
  visible: boolean
): { blocks: Array<{ bt: BlockType; x: number; y: number; size: number }> } {
  if (!visible) return { blocks: [] };

  const ss = 36, pad = 4, cols = 10;
  const palette = CREATIVE_PALETTE;
  const rows = Math.ceil(palette.length / cols);
  const pw = cols * (ss + pad) - pad + 20;
  const ph = rows * (ss + pad) - pad + 60;
  const px = Math.floor((canvasW - pw) / 2);
  const py = Math.floor(canvasH / 2 - ph / 2);

  ctx.fillStyle = "rgba(0,0,0,0.88)";
  roundRect(ctx, px, py, pw, ph, 10); ctx.fill();
  ctx.strokeStyle = "rgba(160,32,240,0.5)";
  ctx.lineWidth = 2;
  roundRect(ctx, px, py, pw, ph, 10); ctx.stroke();

  ctx.fillStyle = "#a020f0";
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "center";
  ctx.fillText("CREATIVE INVENTORY — press C to close", px + pw / 2, py + 22);
  ctx.textAlign = "left";

  const blocks: Array<{ bt: BlockType; x: number; y: number; size: number }> = [];
  for (let i = 0; i < palette.length; i++) {
    const bt = palette[i];
    const bx = px + 10 + (i % cols) * (ss + pad);
    const by = py + 36 + Math.floor(i / cols) * (ss + pad);

    const sel = bt === selectedBlock;
    ctx.fillStyle = sel ? "rgba(160,32,240,0.3)" : "rgba(60,60,60,0.6)";
    roundRect(ctx, bx, by, ss, ss, 4); ctx.fill();
    ctx.strokeStyle = sel ? "#a020f0" : "rgba(255,255,255,0.2)";
    ctx.lineWidth = sel ? 2 : 1;
    roundRect(ctx, bx, by, ss, ss, 4); ctx.stroke();

    drawTexture(ctx, bt, bx + 4, by + 4, ss - 8);
    blocks.push({ bt, x: bx, y: by, size: ss });
  }
  return { blocks };
}

// ── HUD overlays ──────────────────────────────────────────────────────────────
export function drawHUD(
  ctx: CanvasRenderingContext2D,
  canvasW: number, canvasH: number,
  player: Player,
  dayTime: number,
  profileName: string,
  profileColor: string,
  onlinePlayers: number,
  gameMode: GameMode
): void {
  ctx.save();
  const bx = Math.floor(player.x / BLOCK_SIZE), by2 = Math.floor(player.y / BLOCK_SIZE);
  const phase = dayTime < 0.25 ? "☀ Day" : dayTime < 0.5 ? "🌅 Sunset" : dayTime < 0.75 ? "🌙 Night" : "🌄 Dawn";

  // Left panel
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  roundRect(ctx, 10, 10, 186, 80, 7); ctx.fill();

  ctx.fillStyle = profileColor;
  ctx.fillRect(17, 17, 13, 13);
  ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1;
  ctx.strokeRect(17, 17, 13, 13);

  ctx.fillStyle = gameMode === GameMode.CREATIVE ? "#a020f0" : "#fff";
  ctx.font = "bold 11px monospace";
  ctx.fillText(profileName, 35, 27);

  if (gameMode === GameMode.CREATIVE) {
    ctx.fillStyle = "#d060ff";
    ctx.font = "9px monospace";
    ctx.fillText("✦ CREATIVE MODE", 35, 40);
  }

  ctx.fillStyle = "#7eff7e";
  ctx.font = "10px monospace";
  ctx.fillText(`X:${bx}  Y:${by2}`, 17, gameMode === GameMode.CREATIVE ? 56 : 46);
  ctx.fillStyle = "#ffe37e";
  ctx.fillText(phase, 17, gameMode === GameMode.CREATIVE ? 70 : 62);

  // Online badge
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  roundRect(ctx, canvasW - 132, 10, 122, 34, 7); ctx.fill();
  ctx.fillStyle = onlinePlayers > 0 ? "#7eff7e" : "#888";
  ctx.beginPath(); ctx.arc(canvasW - 120, 27, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = onlinePlayers > 0 ? "#7eff7e" : "#888";
  ctx.font = "10px monospace";
  ctx.fillText(onlinePlayers > 0 ? `${onlinePlayers + 1} online` : "Solo", canvasW - 110, 31);

  // Health + Hunger bars (survival only)
  if (gameMode === GameMode.SURVIVAL) {
    const barY = canvasH - 80;
    const barX = Math.floor((canvasW - 200) / 2);

    // HP hearts
    for (let i = 0; i < 10; i++) {
      const full = player.hp >= (i + 1) * 2;
      const half = !full && player.hp > i * 2;
      ctx.fillStyle = full ? "#e03030" : half ? "#e08080" : "#444";
      ctx.font = "14px monospace";
      ctx.fillText("♥", barX + i * 20, barY);
    }

    // Hunger
    for (let i = 0; i < 10; i++) {
      const full = player.hunger >= (i + 1) * 2;
      ctx.fillStyle = full ? "#c87018" : "#444";
      ctx.font = "14px monospace";
      ctx.textAlign = "right";
      ctx.fillText("🍗", barX + 200 - i * 20, barY);
    }
    ctx.textAlign = "left";
  }

  ctx.restore();
}

// ── Night overlay + stars ─────────────────────────────────────────────────────
export function drawDayNightOverlay(
  ctx: CanvasRenderingContext2D,
  canvasW: number, canvasH: number,
  dayTime: number
): void {
  let alpha = 0;
  if (dayTime < 0.25) alpha = 0;
  else if (dayTime < 0.35) alpha = ((dayTime - 0.25) / 0.1) * 0.75;
  else if (dayTime < 0.65) alpha = 0.75;
  else if (dayTime < 0.75) alpha = (1 - (dayTime - 0.65) / 0.1) * 0.75;

  if (alpha > 0.01) {
    ctx.fillStyle = `rgba(2,4,32,${alpha})`;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }
  if (alpha > 0.15) {
    const sa = Math.min(1, (alpha - 0.15) * 4);
    const stars = [
      [0.08,0.04],[0.22,0.11],[0.38,0.02],[0.52,0.08],[0.68,0.14],
      [0.84,0.03],[0.13,0.19],[0.44,0.17],[0.72,0.06],[0.31,0.21],
      [0.78,0.18],[0.47,0.13],[0.04,0.17],[0.9,0.1],[0.28,0.08],
      [0.61,0.05],[0.16,0.09],[0.55,0.22],[0.87,0.16],[0.05,0.24],
    ];
    ctx.fillStyle = `rgba(255,255,255,${sa})`;
    for (const [sx, sy] of stars) ctx.fillRect(Math.floor(sx * canvasW), Math.floor(sy * canvasH * 0.38), 2, 2);
  }
}

export function getSkyColor(dayTime: number): string {
  if (dayTime < 0.12) return lerp([255,120,60],[100,180,255], dayTime / 0.12);
  if (dayTime < 0.38) return "rgb(100,180,255)";
  if (dayTime < 0.5)  return lerp([100,180,255],[255,90,40], (dayTime-0.38)/0.12);
  if (dayTime < 0.62) return lerp([255,90,40],[6,6,28],     (dayTime-0.5)/0.12);
  if (dayTime < 0.88) return "rgb(6,6,28)";
  return lerp([6,6,28],[255,120,60], (dayTime-0.88)/0.12);
}
function lerp(a: number[], b: number[], t: number): string {
  return `rgb(${Math.round(a[0]+(b[0]-a[0])*t)},${Math.round(a[1]+(b[1]-a[1])*t)},${Math.round(a[2]+(b[2]-a[2])*t)})`;
}

// ── Block cursor ──────────────────────────────────────────────────────────────
export function drawBlockIndicator(
  ctx: CanvasRenderingContext2D,
  blockX: number, blockY: number,
  camX: number, camY: number, color: string
): void {
  const px = Math.floor(blockX * BLOCK_SIZE - camX), py = Math.floor(blockY * BLOCK_SIZE - camY);
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.setLineDash([4, 2]);
  ctx.strokeRect(px + 1, py + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
  ctx.setLineDash([]);
}

// ── Util ──────────────────────────────────────────────────────────────────────
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}

import * as THREE from "three";
import { ATLAS_COLS, ATLAS_SIZE, TEX, TEX_SIZE } from "./constants";

type DrawFn = (ctx: CanvasRenderingContext2D, x: number, y: number) => void;

// ── Pixel helpers ──────────────────────────────────────────────────────────
function fill(ctx: CanvasRenderingContext2D, ax: number, ay: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(ax, ay, TEX_SIZE, TEX_SIZE);
}

function rect(ctx: CanvasRenderingContext2D, ax: number, ay: number, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(ax + x, ay + y, w, h);
}

function speckle(ctx: CanvasRenderingContext2D, ax: number, ay: number, color: string, n: number, rng: () => number) {
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    ctx.fillRect(ax + Math.floor(rng() * TEX_SIZE), ay + Math.floor(rng() * TEX_SIZE), 1 + (i % 2), 1);
  }
}

// Seeded RNG so textures are deterministic
function makeRng(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

// ── Texture Definitions ────────────────────────────────────────────────────
const TEXTURES: Record<number, DrawFn> = {
  // GRASS TOP — bright green with variation
  [TEX.GRASS_TOP]: (ctx, ax, ay) => {
    const rng = makeRng(1);
    fill(ctx, ax, ay, "#6abf3a");
    speckle(ctx, ax, ay, "#52a028", 30, rng);
    speckle(ctx, ax, ay, "#7dd44a", 20, rng);
    speckle(ctx, ax, ay, "#8ce05a", 8, rng);
  },

  // GRASS SIDE — brown with green cap
  [TEX.GRASS_SIDE]: (ctx, ax, ay) => {
    const rng = makeRng(2);
    fill(ctx, ax, ay, "#9e7155");
    speckle(ctx, ax, ay, "#8a5c3f", 18, rng);
    speckle(ctx, ax, ay, "#b08060", 10, rng);
    ctx.fillStyle = "#6abf3a"; ctx.fillRect(ax, ay, TEX_SIZE, 4);
    ctx.fillStyle = "#52a028"; ctx.fillRect(ax, ay, TEX_SIZE, 2);
    speckle(ctx, ax, ay, "#7dd44a", 4, rng);
  },

  // DIRT — warm brown
  [TEX.DIRT]: (ctx, ax, ay) => {
    const rng = makeRng(3);
    fill(ctx, ax, ay, "#9e7155");
    speckle(ctx, ax, ay, "#8a5c3f", 25, rng);
    speckle(ctx, ax, ay, "#b28868", 18, rng);
    speckle(ctx, ax, ay, "#7a4c30", 8, rng);
  },

  // STONE — medium gray with cracks
  [TEX.STONE]: (ctx, ax, ay) => {
    const rng = makeRng(4);
    fill(ctx, ax, ay, "#929292");
    speckle(ctx, ax, ay, "#7e7e7e", 18, rng);
    speckle(ctx, ax, ay, "#a4a4a4", 12, rng);
    speckle(ctx, ax, ay, "#686868", 6, rng);
  },

  // COAL — stone with black ore spots
  [TEX.COAL]: (ctx, ax, ay) => {
    const rng = makeRng(5);
    fill(ctx, ax, ay, "#929292");
    speckle(ctx, ax, ay, "#7e7e7e", 15, rng);
    speckle(ctx, ax, ay, "#282828", 20, rng);
    speckle(ctx, ax, ay, "#101010", 8, rng);
  },

  // IRON — stone with orange veins
  [TEX.IRON]: (ctx, ax, ay) => {
    const rng = makeRng(6);
    fill(ctx, ax, ay, "#929292");
    speckle(ctx, ax, ay, "#7e7e7e", 15, rng);
    speckle(ctx, ax, ay, "#d4956a", 18, rng);
    speckle(ctx, ax, ay, "#e8a870", 8, rng);
  },

  // GOLD — stone with bright gold veins
  [TEX.GOLD]: (ctx, ax, ay) => {
    const rng = makeRng(7);
    fill(ctx, ax, ay, "#929292");
    speckle(ctx, ax, ay, "#7e7e7e", 15, rng);
    speckle(ctx, ax, ay, "#f8d030", 20, rng);
    speckle(ctx, ax, ay, "#e8b800", 8, rng);
  },

  // DIAMOND — stone with bright cyan veins
  [TEX.DIAMOND]: (ctx, ax, ay) => {
    const rng = makeRng(8);
    fill(ctx, ax, ay, "#929292");
    speckle(ctx, ax, ay, "#7e7e7e", 15, rng);
    speckle(ctx, ax, ay, "#4ae8f8", 20, rng);
    speckle(ctx, ax, ay, "#00d0e8", 8, rng);
  },

  // LOG SIDE — wood bark rings
  [TEX.LOG_SIDE]: (ctx, ax, ay) => {
    const rng = makeRng(9);
    fill(ctx, ax, ay, "#8c6030");
    speckle(ctx, ax, ay, "#7a4c20", 20, rng);
    speckle(ctx, ax, ay, "#a07040", 12, rng);
    // vertical grain lines
    for (let x = 2; x < TEX_SIZE; x += 4) {
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(ax + x, ay, 1, TEX_SIZE);
    }
  },

  // LOG TOP — end-grain rings
  [TEX.LOG_TOP]: (ctx, ax, ay) => {
    fill(ctx, ax, ay, "#6a4020");
    ctx.strokeStyle = "#8c6030"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(ax+8, ay+8, 5, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(ax+8, ay+8, 3, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = "#a07040"; ctx.fillRect(ax+6, ay+6, 4, 4);
    ctx.fillStyle = "#8c6030"; ctx.fillRect(ax+7, ay+7, 2, 2);
  },

  // LEAVES — dense green
  [TEX.LEAVES]: (ctx, ax, ay) => {
    const rng = makeRng(10);
    fill(ctx, ax, ay, "#3a8c22");
    speckle(ctx, ax, ay, "#2a7010", 30, rng);
    speckle(ctx, ax, ay, "#4aaa30", 25, rng);
    speckle(ctx, ax, ay, "#5ab83c", 10, rng);
    speckle(ctx, ax, ay, "#1a5808", 8, rng);
  },

  // SAND — warm yellow
  [TEX.SAND]: (ctx, ax, ay) => {
    const rng = makeRng(11);
    fill(ctx, ax, ay, "#e8d060");
    speckle(ctx, ax, ay, "#d8b840", 20, rng);
    speckle(ctx, ax, ay, "#f0dc80", 18, rng);
    speckle(ctx, ax, ay, "#c8a830", 8, rng);
  },

  // GRAVEL — dark gray with pebbles
  [TEX.GRAVEL]: (ctx, ax, ay) => {
    const rng = makeRng(12);
    fill(ctx, ax, ay, "#888080");
    speckle(ctx, ax, ay, "#706868", 25, rng);
    speckle(ctx, ax, ay, "#9a9090", 18, rng);
    speckle(ctx, ax, ay, "#585050", 8, rng);
  },

  // GLASS — light blue, semi-transparent
  [TEX.GLASS]: (ctx, ax, ay) => {
    fill(ctx, ax, ay, "#a0d8f0");
    ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(ax+1, ay+1, TEX_SIZE-2, 3);
    ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.fillRect(ax+1, ay+5, TEX_SIZE-2, TEX_SIZE-6);
    ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 0.5;
    ctx.strokeRect(ax+0.5, ay+0.5, TEX_SIZE-1, TEX_SIZE-1);
  },

  // BRICK — warm red bricks
  [TEX.BRICK]: (ctx, ax, ay) => {
    fill(ctx, ax, ay, "#c04030");
    ctx.fillStyle = "#702020"; // mortar
    ctx.fillRect(ax, ay+4, TEX_SIZE, 1); ctx.fillRect(ax, ay+9, TEX_SIZE, 1); ctx.fillRect(ax, ay+13, TEX_SIZE, 1);
    ctx.fillRect(ax+4, ay, 1, 4); ctx.fillRect(ax+12, ay, 1, 4);
    ctx.fillRect(ax, ay+5, 1, 4); ctx.fillRect(ax+8, ay+5, 1, 4);
    ctx.fillRect(ax+4, ay+10, 1, 3); ctx.fillRect(ax+12, ay+10, 1, 3);
    ctx.fillStyle = "#d85040";
    ctx.fillRect(ax+1, ay+1, 3, 3); ctx.fillRect(ax+5, ay+1, 6, 3);
    ctx.fillRect(ax+13, ay+1, 3, 3);
  },

  // PLANKS — light wood with grain
  [TEX.PLANKS]: (ctx, ax, ay) => {
    const rng = makeRng(13);
    fill(ctx, ax, ay, "#c89050");
    speckle(ctx, ax, ay, "#b07840", 12, rng);
    speckle(ctx, ax, ay, "#d8a860", 8, rng);
    ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.fillRect(ax, ay+7, TEX_SIZE, 1); ctx.fillRect(ax, ay+8, TEX_SIZE, 1);
    for (let x = 0; x < TEX_SIZE; x += 2) {
      ctx.fillStyle = "rgba(0,0,0,0.08)"; ctx.fillRect(ax+x, ay, 1, 7); ctx.fillRect(ax+x, ay+9, 1, 7);
    }
  },

  // OBSIDIAN — deep purple-black
  [TEX.OBSIDIAN]: (ctx, ax, ay) => {
    const rng = makeRng(14);
    fill(ctx, ax, ay, "#1a0e28");
    speckle(ctx, ax, ay, "#120a1e", 20, rng);
    speckle(ctx, ax, ay, "#280f40", 15, rng);
    speckle(ctx, ax, ay, "#3a1858", 6, rng);
    speckle(ctx, ax, ay, "#402060", 3, rng);
  },

  // SNOW — pure white with light blue tint
  [TEX.SNOW]: (ctx, ax, ay) => {
    const rng = makeRng(15);
    fill(ctx, ax, ay, "#eef4ff");
    speckle(ctx, ax, ay, "#dce8ff", 15, rng);
    speckle(ctx, ax, ay, "#ffffff", 12, rng);
  },

  // BEDROCK — very dark with angular cracks
  [TEX.BEDROCK]: (ctx, ax, ay) => {
    const rng = makeRng(16);
    fill(ctx, ax, ay, "#282828");
    speckle(ctx, ax, ay, "#1a1a1a", 20, rng);
    speckle(ctx, ax, ay, "#383838", 15, rng);
    speckle(ctx, ax, ay, "#484848", 5, rng);
  },

  // WATER — blue with ripples
  [TEX.WATER]: (ctx, ax, ay) => {
    const rng = makeRng(17);
    fill(ctx, ax, ay, "#1a68c0");
    speckle(ctx, ax, ay, "#2880e0", 20, rng);
    speckle(ctx, ax, ay, "#0a50a0", 15, rng);
    // wave lines
    ctx.fillStyle = "rgba(100,180,255,0.3)";
    for (let y = 2; y < TEX_SIZE; y += 5) ctx.fillRect(ax, ay+y, TEX_SIZE, 1);
  },

  // EMERALD — green ore veins in stone
  [TEX.EMERALD]: (ctx, ax, ay) => {
    const rng = makeRng(18);
    fill(ctx, ax, ay, "#929292");
    speckle(ctx, ax, ay, "#7e7e7e", 12, rng);
    speckle(ctx, ax, ay, "#18d060", 20, rng);
    speckle(ctx, ax, ay, "#10a040", 10, rng);
  },

  // REDSTONE — red ore veins in stone
  [TEX.REDSTONE]: (ctx, ax, ay) => {
    const rng = makeRng(19);
    fill(ctx, ax, ay, "#929292");
    speckle(ctx, ax, ay, "#7e7e7e", 12, rng);
    speckle(ctx, ax, ay, "#e82020", 20, rng);
    speckle(ctx, ax, ay, "#c01010", 10, rng);
  },

  // CRAFTING TABLE TOP
  [TEX.CRAFTING_TOP]: (ctx, ax, ay) => {
    fill(ctx, ax, ay, "#c89050");
    ctx.fillStyle = "#8a4010"; ctx.fillRect(ax+2, ay+2, 12, 12);
    ctx.fillStyle = "#603008"; ctx.fillRect(ax+4, ay+4, 3, 3); ctx.fillRect(ax+9, ay+4, 3, 3);
    ctx.fillRect(ax+4, ay+9, 3, 3); ctx.fillRect(ax+9, ay+9, 3, 3);
    ctx.fillStyle = "#c04010"; ctx.fillRect(ax+2, ay+6, 12, 4);
  },

  // CRAFTING TABLE SIDE
  [TEX.CRAFTING_SIDE]: (ctx, ax, ay) => {
    const rng = makeRng(20);
    fill(ctx, ax, ay, "#c89050");
    speckle(ctx, ax, ay, "#b07840", 8, rng);
    ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.fillRect(ax, ay+7, TEX_SIZE, 2);
    ctx.fillStyle = "#8a4010"; ctx.fillRect(ax+2, ay+1, 4, 5);
    ctx.fillStyle = "#a05018"; ctx.fillRect(ax+3, ay+2, 2, 3);
  },

  // CHEST TOP — wooden lid
  [TEX.CHEST_TOP]: (ctx, ax, ay) => {
    const rng = makeRng(20);
    fill(ctx, ax, ay, "#c89050");
    speckle(ctx, ax, ay, "#b07840", 8, rng);
    ctx.fillStyle = "#804020"; ctx.fillRect(ax+5, ay+5, 6, 6);
    ctx.fillStyle = "#a05030"; ctx.fillRect(ax+6, ay+6, 4, 4);
  },

  // CHEST FRONT — wooden with latch
  [TEX.CHEST_FRONT]: (ctx, ax, ay) => {
    fill(ctx, ax, ay, "#c89050");
    ctx.fillStyle = "#7a4820"; ctx.fillRect(ax, ay+8, TEX_SIZE, 1);
    ctx.fillStyle = "#d4a060"; ctx.fillRect(ax+1, ay+1, TEX_SIZE-2, 6);
    ctx.fillStyle = "#b07040"; ctx.fillRect(ax+1, ay+10, TEX_SIZE-2, TEX_SIZE-11);
    ctx.fillStyle = "#c85020"; ctx.fillRect(ax+6, ay+6, 4, 4);
    ctx.fillStyle = "#e87030"; ctx.fillRect(ax+7, ay+7, 2, 2);
  },

  // CHEST SIDE — plain wood panels
  [TEX.CHEST_SIDE]: (ctx, ax, ay) => {
    const rng = makeRng(21);
    fill(ctx, ax, ay, "#c89050");
    speckle(ctx, ax, ay, "#b07840", 10, rng);
    ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(ax, ay+7, TEX_SIZE, 2);
    ctx.fillStyle = "#d4a060"; ctx.fillRect(ax+1, ay+1, TEX_SIZE-2, 5);
    ctx.fillStyle = "#b07040"; ctx.fillRect(ax+1, ay+9, TEX_SIZE-2, TEX_SIZE-10);
  },
};

// ── Atlas singleton ────────────────────────────────────────────────────────
let atlasTexture: THREE.CanvasTexture | null = null;

// Reset on hot-module-reload so texture rebuilds
if (import.meta.hot) {
  import.meta.hot.dispose(() => { atlasTexture = null; });
}

export function getAtlasTexture(): THREE.CanvasTexture {
  if (atlasTexture) return atlasTexture;

  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  // Fill with magenta for debugging unmapped tiles
  ctx.fillStyle = "#ff00ff";
  ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

  for (const [idxStr, drawFn] of Object.entries(TEXTURES)) {
    const idx = parseInt(idxStr);
    const col = idx % ATLAS_COLS;
    const row = Math.floor(idx / ATLAS_COLS);
    drawFn(ctx, col * TEX_SIZE, row * TEX_SIZE);
  }

  atlasTexture = new THREE.CanvasTexture(canvas);
  atlasTexture.magFilter = THREE.NearestFilter;
  atlasTexture.minFilter = THREE.NearestFilter;
  atlasTexture.needsUpdate = true;
  return atlasTexture;
}

// Returns [u0, v0, u1, v1] for atlas tile index
export function getUV(texIdx: number): [number, number, number, number] {
  const col = texIdx % ATLAS_COLS;
  const row = Math.floor(texIdx / ATLAS_COLS);
  const u0 = col / ATLAS_COLS,       u1 = (col + 1) / ATLAS_COLS;
  const v0 = 1 - (row + 1) / ATLAS_COLS, v1 = 1 - row / ATLAS_COLS;
  return [u0, v0, u1, v1];
}

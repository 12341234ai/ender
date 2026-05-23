import { useEffect, useRef, useCallback, useState } from "react";
import {
  BLOCK_SIZE, BLOCKS, BlockType, DAY_LENGTH,
  MINE_RADIUS, PLAYER_H, PLAYER_W, WORLD_HEIGHT, WORLD_WIDTH,
  GameMode, CREATIVE_PALETTE, DEFAULT_HOTBAR, HOTBAR_SLOTS, NON_SOLID_BLOCKS,
} from "./game/constants";
import { generateWorld, getSpawnPoint } from "./game/worldGen";
import { updatePhysics, createPlayer, Player } from "./game/physics";
import { tickWater } from "./game/water";
import {
  drawWorld, drawPlayer, drawHotbar, drawDayNightOverlay,
  getSkyColor, drawBlockIndicator, drawHUD, drawRemotePlayers,
  drawCreativePalette,
} from "./game/renderer";
import { MultiplayerClient, RemotePlayer } from "./game/multiplayer";
import { Profile } from "./ProfileScreen";
import HelpBot from "./HelpBot";

interface ProfileSave {
  playerX: number; playerY: number;
  inventory: Record<number, number>;
  hotbar: BlockType[];
  dayTick: number;
  gameMode: GameMode;
}

const saveKey = (name: string) => `mc2d_profile_${name}`;

function saveProfile(profile: Profile, player: Player, inventory: Record<number, number>, hotbar: BlockType[], dayTick: number, gameMode: GameMode) {
  try {
    localStorage.setItem(saveKey(profile.name), JSON.stringify({ playerX: player.x, playerY: player.y, inventory, hotbar, dayTick, gameMode } as ProfileSave));
  } catch { /* ignore */ }
}

function loadProfileSave(name: string): ProfileSave | null {
  try { return JSON.parse(localStorage.getItem(saveKey(name)) ?? "null"); } catch { return null; }
}

interface Props { profile: Profile; onExit: () => void }

export default function Game({ profile, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showHelp, setShowHelp] = useState(false);

  const stateRef = useRef({
    world: new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT),
    player: createPlayer(0, 0),
    camera: { x: 0, y: 0 },
    inventory: {} as Record<number, number>,
    hotbar: [...DEFAULT_HOTBAR] as BlockType[],
    selectedSlot: 0,
    dayTick: 0,
    keys: new Set<string>(),
    mousePos: { x: 0, y: 0 },
    time: 0,
    lastSave: 0,
    lastWaterTick: 0,
    targetBlock: null as { bx: number; by: number; type: "mine" | "place" } | null,
    remotePlayers: new Map<string, RemotePlayer>(),
    mp: null as MultiplayerClient | null,
    gameMode: GameMode.SURVIVAL as GameMode,
    showCreative: false,
    creativePaletteBlocks: [] as Array<{ bt: BlockType; x: number; y: number; size: number }>,
    showHelpRef: false,
  });

  const initGame = useCallback(() => {
    const st = stateRef.current;
    const { world, heights } = generateWorld(42);
    const spawn = getSpawnPoint(heights);
    const saved = loadProfileSave(profile.name);

    st.world = world;
    if (saved) {
      st.player = { ...createPlayer(saved.playerX, saved.playerY), hp: 20, hunger: 20 };
      st.inventory = saved.inventory ?? {};
      st.hotbar = (saved.hotbar ?? DEFAULT_HOTBAR) as BlockType[];
      st.dayTick = saved.dayTick ?? 0;
      st.gameMode = saved.gameMode ?? GameMode.SURVIVAL;
    } else {
      st.player = createPlayer(spawn.x, spawn.y);
      st.inventory = {
        [BLOCKS.DIRT]: 64, [BLOCKS.STONE]: 32, [BLOCKS.WOOD]: 16,
        [BLOCKS.PLANKS]: 16, [BLOCKS.GLASS]: 8, [BLOCKS.BRICK]: 8,
        [BLOCKS.SAND]: 16, [BLOCKS.TORCH]: 8, [BLOCKS.DIAMOND]: 4,
      };
      st.hotbar = [...DEFAULT_HOTBAR] as BlockType[];
    }
  }, [profile.name]);

  useEffect(() => {
    initGame();
    const canvas = canvasRef.current!;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    const st = stateRef.current;

    // Multiplayer
    const mp = new MultiplayerClient(
      profile.name, profile.color,
      (worldData) => { st.world = new Uint8Array(worldData); },
      (bx, by, bt) => { st.world[by * WORLD_WIDTH + bx] = bt; },
      (players) => { st.remotePlayers = players; }
    );
    st.mp = mp;
    if (!profile.isGuest) mp.connect();

    // ── Input ──────────────────────────────────────────────────────────────
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      st.keys.add(k);

      // slot selection 1-9
      if (k >= "1" && k <= "9") st.selectedSlot = parseInt(k) - 1;

      // toggle creative
      if (k === "c") {
        st.gameMode = st.gameMode === GameMode.CREATIVE ? GameMode.SURVIVAL : GameMode.CREATIVE;
        st.showCreative = st.gameMode === GameMode.CREATIVE;
        if (st.gameMode === GameMode.CREATIVE) st.player.flying = true;
      }

      // help
      if (k === "h" || k === "?") {
        st.showHelpRef = !st.showHelpRef;
        setShowHelp(st.showHelpRef);
      }

      if (k === "escape") {
        if (st.showHelpRef) { st.showHelpRef = false; setShowHelp(false); return; }
        if (st.showCreative) { st.showCreative = false; return; }
        saveProfile(profile, st.player, st.inventory, st.hotbar, st.dayTick, st.gameMode);
        onExit();
      }

      if (["arrowup","arrowdown","arrowleft","arrowright"," "].includes(e.key)) e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => st.keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // ── Mouse helpers ──────────────────────────────────────────────────────
    const worldBlock = (cx: number, cy: number) => ({
      bx: Math.floor((cx + st.camera.x) / BLOCK_SIZE),
      by: Math.floor((cy + st.camera.y) / BLOCK_SIZE),
    });

    const playerDist = (bx: number, by: number) => {
      const pcx = (st.player.x + PLAYER_W / 2) / BLOCK_SIZE;
      const pcy = (st.player.y + PLAYER_H / 2) / BLOCK_SIZE;
      return Math.sqrt((bx - pcx) ** 2 + (by - pcy) ** 2);
    };

    const updateTarget = (cx: number, cy: number) => {
      st.mousePos = { x: cx, y: cy };
      const { bx, by } = worldBlock(cx, cy);
      if (bx < 0 || bx >= WORLD_WIDTH || by < 0 || by >= WORLD_HEIGHT) { st.targetBlock = null; return; }
      if (playerDist(bx, by) > MINE_RADIUS) { st.targetBlock = null; return; }
      const bt = st.world[by * WORLD_WIDTH + bx];
      st.targetBlock = { bx, by, type: bt !== BLOCKS.AIR && !NON_SOLID_BLOCKS.has(bt) ? "mine" : "place" };
    };

    const onMouseMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      updateTarget(e.clientX - r.left, e.clientY - r.top);
    };

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const cx = e.clientX - r.left, cy = e.clientY - r.top;

      // Creative palette click
      if (st.showCreative && e.button === 0) {
        for (const slot of st.creativePaletteBlocks) {
          if (cx >= slot.x && cx <= slot.x + slot.size && cy >= slot.y && cy <= slot.y + slot.size) {
            st.hotbar[st.selectedSlot] = slot.bt;
            return;
          }
        }
      }

      const { bx, by } = worldBlock(cx, cy);
      if (bx < 0 || bx >= WORLD_WIDTH || by < 0 || by >= WORLD_HEIGHT) return;
      if (playerDist(bx, by) > MINE_RADIUS) return;

      if (e.button === 0) {
        const bt = st.world[by * WORLD_WIDTH + bx] as BlockType;
        if (!NON_SOLID_BLOCKS.has(bt) && bt !== BLOCKS.AIR) {
          st.world[by * WORLD_WIDTH + bx] = BLOCKS.AIR;
          if (st.gameMode === GameMode.SURVIVAL) {
            st.inventory[bt] = (st.inventory[bt] || 0) + 1;
          }
          mp.sendBlockChange(bx, by, BLOCKS.AIR);
          updateTarget(cx, cy);
        }
      } else if (e.button === 2) {
        const existing = st.world[by * WORLD_WIDTH + bx];
        if (existing !== BLOCKS.AIR) return;

        const placeBlock = st.hotbar[st.selectedSlot];
        if (st.gameMode === GameMode.SURVIVAL && (st.inventory[placeBlock] || 0) <= 0) return;

        const neighbors: [number, number][] = [[bx-1,by],[bx+1,by],[bx,by-1],[bx,by+1]];
        const adjacent = neighbors.some(([nx,ny]) =>
          nx >= 0 && nx < WORLD_WIDTH && ny >= 0 && ny < WORLD_HEIGHT &&
          st.world[ny * WORLD_WIDTH + nx] !== BLOCKS.AIR
        );
        if (!adjacent) return;

        // Don't place inside player
        const ppx1 = st.player.x + 2, ppy1 = st.player.y + 2;
        const ppx2 = st.player.x + PLAYER_W - 2, ppy2 = st.player.y + PLAYER_H - 2;
        const bpx = bx * BLOCK_SIZE, bpy = by * BLOCK_SIZE;
        if (ppx1 < bpx + BLOCK_SIZE && ppx2 > bpx && ppy1 < bpy + BLOCK_SIZE && ppy2 > bpy) return;

        st.world[by * WORLD_WIDTH + bx] = placeBlock;
        if (st.gameMode === GameMode.SURVIVAL) st.inventory[placeBlock]--;
        mp.sendBlockChange(bx, by, placeBlock);
        updateTarget(cx, cy);
      }
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      st.selectedSlot = (st.selectedSlot + (e.deltaY > 0 ? 1 : -1) + HOTBAR_SLOTS) % HOTBAR_SLOTS;
    };

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("wheel", onWheel, { passive: false });

    // ── Game loop ──────────────────────────────────────────────────────────
    let rafId = 0;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 16.67, 3);
      lastTime = now;
      st.time++;

      const cvs = canvasRef.current;
      if (!cvs) return;
      const ctx = cvs.getContext("2d")!;
      const W = cvs.width, H = cvs.height;

      // Water simulation every 8 frames
      if (st.time - st.lastWaterTick > 8) {
        tickWater(st.world);
        st.lastWaterTick = st.time;
      }

      // Physics
      st.player = updatePhysics(
        st.player, st.world, st.keys, dt, st.gameMode,
        (dmg) => {
          if (st.gameMode === GameMode.SURVIVAL) {
            st.player.hp = Math.max(0, st.player.hp - dmg);
          }
        }
      );

      // Camera
      const tcx = st.player.x + PLAYER_W / 2 - W / 2;
      const tcy = st.player.y + PLAYER_H / 2 - H / 2;
      st.camera.x += (tcx - st.camera.x) * 0.12;
      st.camera.y += (tcy - st.camera.y) * 0.12;
      st.camera.x = Math.max(0, Math.min(WORLD_WIDTH * BLOCK_SIZE - W, st.camera.x));
      st.camera.y = Math.max(0, Math.min(WORLD_HEIGHT * BLOCK_SIZE - H, st.camera.y));

      // Day/night
      st.dayTick = (st.dayTick + 1) % DAY_LENGTH;
      const dayTime = st.dayTick / DAY_LENGTH;

      // Multiplayer position sync
      mp.sendMove(st.player.x, st.player.y, st.player.vx, st.player.vy, st.player.facing);

      // Auto-save (every 10 s)
      if (st.time - st.lastSave > 600) {
        saveProfile(profile, st.player, st.inventory, st.hotbar, st.dayTick, st.gameMode);
        st.lastSave = st.time;
      }

      // ── RENDER ────────────────────────────────────────────────────────
      ctx.imageSmoothingEnabled = false;

      // Sky gradient
      ctx.fillStyle = getSkyColor(dayTime);
      ctx.fillRect(0, 0, W, H);

      // Subtle parallax cloud-like background for depth
      const cOff = st.camera.x * 0.05;
      ctx.fillStyle = "rgba(255,255,255,0.035)";
      for (let i = 0; i < 6; i++) {
        const cx2 = ((i * 240 - cOff % 240) + W) % (W + 240) - 120;
        const cy2 = 40 + i * 28;
        ctx.fillRect(cx2, cy2, 120 + i * 20, 18);
        ctx.fillRect(cx2 + 20, cy2 - 10, 80, 14);
      }

      // World blocks
      drawWorld(ctx, st.world, st.camera.x, st.camera.y, W, H);

      // Target cursor
      if (st.targetBlock) {
        const col = st.targetBlock.type === "mine" ? "rgba(255,80,80,0.9)" : "rgba(80,255,120,0.9)";
        drawBlockIndicator(ctx, st.targetBlock.bx, st.targetBlock.by, st.camera.x, st.camera.y, col);
      }

      // Remote players
      drawRemotePlayers(ctx, st.remotePlayers, st.camera.x, st.camera.y, st.time);

      // Local player
      drawPlayer(ctx, st.player, st.camera.x, st.camera.y, st.time, profile.color, st.gameMode);

      // Night overlay + stars
      drawDayNightOverlay(ctx, W, H, dayTime);

      // Creative palette
      if (st.showCreative) {
        const result = drawCreativePalette(ctx, W, H, st.hotbar[st.selectedSlot], true);
        st.creativePaletteBlocks = result.blocks;
      }

      // HUD
      drawHUD(ctx, W, H, st.player, dayTime, profile.name, profile.color, st.remotePlayers.size, st.gameMode);
      drawHotbar(ctx, W, H, st.selectedSlot, st.hotbar, st.inventory, st.gameMode);

      // Help/controls hint (top right)
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath(); ctx.roundRect(W - 182, 10, 172, 100, 7); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "9px monospace";
      const hints = ["WASD / Arrows — Move/Jump","Left Click — Mine","Right Click — Place","1–9 / Scroll — Hotbar","C — Creative Mode","H — Help Bot"];
      hints.forEach((h, i) => ctx.fillText(h, W - 176, 26 + i * 14));
      ctx.restore();

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      saveProfile(profile, st.player, st.inventory, st.hotbar, st.dayTick, st.gameMode);
      mp.disconnect();
      st.mp = null;
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("contextmenu", onContextMenu);
    };
  }, [profile, initGame, onExit]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-black select-none">
      <canvas
        ref={canvasRef}
        style={{ display: "block", imageRendering: "pixelated", cursor: "crosshair" }}
      />
      {showHelp && <HelpBot onClose={() => { stateRef.current.showHelpRef = false; setShowHelp(false); }} />}
    </div>
  );
}

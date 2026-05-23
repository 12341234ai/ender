import { WebSocket, WebSocketServer } from "ws";
import { IncomingMessage, Server } from "http";
import { logger } from "../lib/logger";

const WORLD_WIDTH = 400;
const WORLD_HEIGHT = 80;
const SURFACE_BASE_Y = 28;

const BLOCKS = { AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COAL: 4, IRON: 5, DIAMOND: 6, WOOD: 7, LEAVES: 8 };

function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function smoothHeight(x: number, seed: number): number {
  const h =
    Math.sin(x * 0.04 + seed) * 6 +
    Math.sin(x * 0.12 + seed * 1.3) * 3 +
    Math.sin(x * 0.3 + seed * 0.7) * 1.5;
  return Math.round(SURFACE_BASE_Y + h);
}

function generateWorld(): Uint8Array {
  const seed = 42;
  const world = new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT);
  const heights: number[] = [];
  const rand = seededRand(seed);

  for (let x = 0; x < WORLD_WIDTH; x++) {
    let h = smoothHeight(x, seed);
    if (h < 5) h = 5;
    if (h > WORLD_HEIGHT - 10) h = WORLD_HEIGHT - 10;
    heights[x] = h;
  }

  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let x = 0; x < WORLD_WIDTH; x++) {
      const surface = heights[x];
      let block = BLOCKS.AIR;
      if (y === surface) block = BLOCKS.GRASS;
      else if (y <= surface + 4) block = BLOCKS.DIRT;
      else if (y > surface + 4) {
        const depth = y - surface;
        const r = rand();
        if (depth >= 30 && r < 0.012) block = BLOCKS.DIAMOND;
        else if (depth >= 14 && r < 0.03) block = BLOCKS.IRON;
        else if (depth >= 7 && r < 0.055) block = BLOCKS.COAL;
        else block = BLOCKS.STONE;
      }
      world[y * WORLD_WIDTH + x] = block;
    }
  }

  // Trees
  const tr = seededRand(seed + 99);
  for (let x = 3; x < WORLD_WIDTH - 3; x++) {
    if (tr() < 0.035) {
      const sy = heights[x];
      if (sy < 2 || sy >= WORLD_HEIGHT - 8) continue;
      const treeH = 4 + Math.floor(tr() * 3);
      for (let ty = sy - treeH; ty < sy; ty++) {
        if (ty >= 0) world[ty * WORLD_WIDTH + x] = BLOCKS.WOOD;
      }
      const leafTop = sy - treeH;
      for (let ly = leafTop - 2; ly <= leafTop + 1; ly++) {
        for (let lx = x - 2; lx <= x + 2; lx++) {
          if (lx < 0 || lx >= WORLD_WIDTH || ly < 0 || ly >= WORLD_HEIGHT) continue;
          const idx = ly * WORLD_WIDTH + lx;
          if (world[idx] === BLOCKS.AIR) {
            const dist = Math.abs(lx - x) + Math.abs(ly - leafTop);
            if (dist < 4 && tr() > 0.15) world[idx] = BLOCKS.LEAVES;
          }
        }
      }
    }
  }

  return world;
}

interface PlayerState {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: string;
  ws: WebSocket;
}

const world = generateWorld();
const players = new Map<string, PlayerState>();

function broadcast(msg: object, excludeId?: string) {
  const data = JSON.stringify(msg);
  for (const [id, p] of players) {
    if (id !== excludeId && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(data);
    }
  }
}

function send(ws: WebSocket, msg: object) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export function attachGameWebSocket(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req: IncomingMessage, socket, head) => {
    const url = req.url ?? "";
    if (url === "/api/ws" || url.startsWith("/api/ws?")) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", (ws: WebSocket) => {
    const playerId = crypto.randomUUID();
    logger.info({ playerId }, "Player connecting");

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>;

        if (msg.type === "join") {
          const name = String(msg.name || "Player").slice(0, 20);
          const color = String(msg.color || "#e05a2b");

          const player: PlayerState = {
            id: playerId, name, color,
            x: 200 * 32, y: 20 * 32,
            vx: 0, vy: 0, facing: "right",
            ws,
          };
          players.set(playerId, player);

          // Send welcome with world state and existing players
          send(ws, {
            type: "welcome",
            playerId,
            world: Array.from(world),
            players: Array.from(players.values())
              .filter((p) => p.id !== playerId)
              .map((p) => ({ id: p.id, name: p.name, color: p.color, x: p.x, y: p.y, facing: p.facing })),
          });

          // Notify others
          broadcast({ type: "player_join", id: playerId, name, color, x: player.x, y: player.y, facing: "right" }, playerId);
          logger.info({ playerId, name }, "Player joined");
        }

        else if (msg.type === "move") {
          const p = players.get(playerId);
          if (!p) return;
          p.x = Number(msg.x) || p.x;
          p.y = Number(msg.y) || p.y;
          p.vx = Number(msg.vx) || 0;
          p.vy = Number(msg.vy) || 0;
          p.facing = String(msg.facing || "right");
          broadcast({ type: "player_move", id: playerId, x: p.x, y: p.y, vx: p.vx, vy: p.vy, facing: p.facing }, playerId);
        }

        else if (msg.type === "block_change") {
          const bx = Number(msg.bx);
          const by = Number(msg.by);
          const blockType = Number(msg.blockType);
          if (bx >= 0 && bx < WORLD_WIDTH && by >= 0 && by < WORLD_HEIGHT && blockType >= 0 && blockType <= 8) {
            world[by * WORLD_WIDTH + bx] = blockType;
            broadcast({ type: "block_change", bx, by, blockType }, playerId);
          }
        }

      } catch (err) {
        logger.warn({ err }, "Bad WS message");
      }
    });

    ws.on("close", () => {
      players.delete(playerId);
      broadcast({ type: "player_leave", id: playerId });
      logger.info({ playerId }, "Player left");
    });

    ws.on("error", (err) => {
      logger.warn({ err, playerId }, "WS error");
    });
  });

  logger.info("Game WebSocket server attached at /api/ws");
}

export interface RemotePlayer {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: string;
}

export type OnWorldSync = (world: number[]) => void;
export type OnBlockChange = (bx: number, by: number, blockType: number) => void;
export type OnPlayersUpdate = (players: Map<string, RemotePlayer>) => void;

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private playerId: string | null = null;
  private remotePlayers = new Map<string, RemotePlayer>();
  private onWorldSync: OnWorldSync;
  private onBlockChange: OnBlockChange;
  private onPlayersUpdate: OnPlayersUpdate;
  private name: string;
  private color: string;
  private moveThrottle = 0;

  constructor(
    name: string,
    color: string,
    onWorldSync: OnWorldSync,
    onBlockChange: OnBlockChange,
    onPlayersUpdate: OnPlayersUpdate
  ) {
    this.name = name;
    this.color = color;
    this.onWorldSync = onWorldSync;
    this.onBlockChange = onBlockChange;
    this.onPlayersUpdate = onPlayersUpdate;
  }

  connect(): void {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/api/ws`;

    try {
      this.ws = new WebSocket(url);
    } catch {
      return;
    }

    this.ws.onopen = () => {
      this.send({ type: "join", name: this.name, color: this.color });
    };

    this.ws.onmessage = (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(ev.data as string) as Record<string, unknown>;
        this.handleMessage(msg);
      } catch {
        // ignore parse errors
      }
    };

    this.ws.onclose = () => {
      this.remotePlayers.clear();
      this.onPlayersUpdate(new Map(this.remotePlayers));
    };

    this.ws.onerror = () => {
      // silently ignore — game still works in single-player
    };
  }

  private handleMessage(msg: Record<string, unknown>): void {
    switch (msg.type) {
      case "welcome": {
        this.playerId = String(msg.playerId);
        const world = msg.world as number[];
        if (Array.isArray(world)) this.onWorldSync(world);
        const players = msg.players as RemotePlayer[];
        if (Array.isArray(players)) {
          for (const p of players) this.remotePlayers.set(p.id, p);
          this.onPlayersUpdate(new Map(this.remotePlayers));
        }
        break;
      }
      case "player_join": {
        const p = msg as unknown as RemotePlayer;
        this.remotePlayers.set(p.id, p);
        this.onPlayersUpdate(new Map(this.remotePlayers));
        break;
      }
      case "player_move": {
        const p = this.remotePlayers.get(String(msg.id));
        if (p) {
          p.x = Number(msg.x);
          p.y = Number(msg.y);
          p.vx = Number(msg.vx);
          p.vy = Number(msg.vy);
          p.facing = String(msg.facing);
          this.onPlayersUpdate(new Map(this.remotePlayers));
        }
        break;
      }
      case "player_leave": {
        this.remotePlayers.delete(String(msg.id));
        this.onPlayersUpdate(new Map(this.remotePlayers));
        break;
      }
      case "block_change": {
        this.onBlockChange(Number(msg.bx), Number(msg.by), Number(msg.blockType));
        break;
      }
    }
  }

  sendMove(x: number, y: number, vx: number, vy: number, facing: string): void {
    this.moveThrottle++;
    if (this.moveThrottle % 3 !== 0) return;
    this.send({ type: "move", x, y, vx, vy, facing });
  }

  sendBlockChange(bx: number, by: number, blockType: number): void {
    this.send({ type: "block_change", bx, by, blockType });
  }

  private send(msg: object): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }

  getPlayerId(): string | null {
    return this.playerId;
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

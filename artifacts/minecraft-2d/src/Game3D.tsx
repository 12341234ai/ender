import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { Profile } from "./ProfileScreen";
import {
  BLOCKS, BLOCK_NAMES, CHUNK_HEIGHT, CHUNK_SIZE, GameMode,
  HOTBAR, PLAYER_EYE_HEIGHT, REACH, RENDER_DISTANCE, WORLD_CHUNKS,
} from "./game3d/constants";
import { Player3D, createPlayer, raycastBlock, stepPhysics } from "./game3d/physics";
import { WorldChunks, generateWorld, getBlock, getSpawnY, setBlock } from "./game3d/worldGen";
import { ChunkMeshes, buildChunkMeshes, disposeChunkMeshes } from "./game3d/chunkBuilder";

interface Props { profile: Profile; onExit: () => void; }

const BLOCK_COLORS: Record<number, [string, string]> = {
  1:  ["#5da832","#3d7a1e"],  // grass
  2:  ["#9b6f47","#7a5535"],  // dirt
  3:  ["#8a8a8a","#6b6b6b"],  // stone
  4:  ["#6b6b6b","#444"],     // coal
  5:  ["#b07850","#8a5c38"],  // iron
  6:  ["#d4aa18","#a88010"],  // gold
  7:  ["#44d8e8","#22b8c8"],  // diamond
  8:  ["#7a5530","#5a3a18"],  // log
  9:  ["#2d8a22","#1d6a14"],  // leaves
  10: ["#e8d890","#c8b870"],  // sand
  11: ["#909090","#707070"],  // gravel
  12: ["#b8e8f8","#88c8e8"],  // glass
  13: ["#aa2828","#882020"],  // brick
  14: ["#d4a840","#b08828"],  // planks
  15: ["#181020","#100818"],  // obsidian
  16: ["#f0f4ff","#d8e0f0"],  // snow
  17: ["#282828","#181818"],  // bedrock
  18: ["#2068c0","#1048a0"],  // water
  19: ["#18aa44","#108830"],  // emerald
  20: ["#c01818","#900808"],  // redstone
  21: ["#c4a040","#8a7030"],  // crafting
  22: ["#a86030","#784018"],  // chest
  23: ["#f0a020","#d08010"],  // torch
  24: ["#ff8899","#dd6677"],  // flower
  25: ["#2d7a1e","#1d5a0e"],  // cactus
};

const SAVE_KEY = "mc3d_v1";

function HotbarBlock({ block, selected }: { block: number; selected: boolean }) {
  const colors = BLOCK_COLORS[block] ?? ["#888","#666"];
  return (
    <div style={{
      width:48, height:48,
      border: selected ? "2.5px solid #fff" : "2px solid rgba(255,255,255,0.3)",
      background:"rgba(0,0,0,0.75)", borderRadius:5,
      display:"flex", alignItems:"center", justifyContent:"center",
      boxSizing:"border-box", position:"relative",
      boxShadow: selected ? "0 0 8px rgba(255,255,255,0.4)" : "none",
      transition:"border-color 0.1s",
    }}>
      <div style={{
        width:32, height:32, borderRadius:3, position:"relative", overflow:"hidden",
        background: colors[0],
        boxShadow:`inset -5px -5px 0 ${colors[1]}, inset 2px 2px 0 rgba(255,255,255,0.25)`,
      }}>
        {/* Block face detail lines */}
        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"40%", background:colors[1], opacity:0.6 }}/>
        <div style={{ position:"absolute", top:0, left:0, right:"60%", bottom:0, background:"rgba(255,255,255,0.05)" }}/>
      </div>
    </div>
  );
}

export default function Game3D({ profile, onExit }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.SURVIVAL);
  const [blockName, setBlockName] = useState("");
  const [health, setHealth] = useState(20);
  const [tracking, setTracking] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0, z: 0 });
  const [mineProgress, setMineProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [fps, setFps] = useState(0);
  const trackingRef = useRef(false);

  useEffect(() => {
    const mount = mountRef.current!;
    let animId = 0;

    // ── Three.js ──────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x87ceeb);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, RENDER_DISTANCE * CHUNK_SIZE * 0.65, RENDER_DISTANCE * CHUNK_SIZE + 8);

    const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.05, 512);
    camera.rotation.order = "YXZ";

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);
    const sunLight = new THREE.DirectionalLight(0xfff8e0, 0.8);
    sunLight.position.set(100, 200, 80);
    scene.add(sunLight);
    scene.add(new THREE.HemisphereLight(0xc0d8ff, 0xa07048, 0.3));

    // Selection wireframe
    const selMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.007, 1.007, 1.007),
      new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true }),
    );
    selMesh.visible = false;
    scene.add(selMesh);

    // ── World ─────────────────────────────────────────────────
    const worldChanges = new Map<string, number>();
    const world: WorldChunks = generateWorld(42);
    setIsLoading(false);

    const saveKey = `${SAVE_KEY}_${profile.name}`;
    let savedPlayer: Player3D | null = null;
    let savedSlot = 0;
    let savedMode: GameMode = GameMode.SURVIVAL;

    if (!profile.isGuest) {
      try {
        const raw = localStorage.getItem(saveKey);
        if (raw) {
          const sv = JSON.parse(raw);
          if (sv.changes) {
            for (const [k, v] of Object.entries(sv.changes as Record<string, number>)) {
              const [wx, wy, wz] = k.split(",").map(Number);
              setBlock(world, wx, wy, wz, v); worldChanges.set(k, v);
            }
          }
          if (sv.player) savedPlayer = sv.player as Player3D;
          if (sv.slot != null) { savedSlot = sv.slot as number; setSelectedSlot(savedSlot); }
          if (sv.mode) { savedMode = sv.mode as GameMode; setGameMode(savedMode); }
        }
      } catch { /* ignore */ }
    }

    // ── Player ────────────────────────────────────────────────
    const CENTER = Math.floor((WORLD_CHUNKS * CHUNK_SIZE) / 2);
    const player: Player3D = savedPlayer
      ?? createPlayer(CENTER, getSpawnY(world, CENTER, CENTER) + 0.5, CENTER);
    player.flying = savedMode === GameMode.CREATIVE;

    const st = { slot: savedSlot, mode: savedMode };

    // ── Chunks ────────────────────────────────────────────────
    const meshMap = new Map<string, ChunkMeshes>();
    function ck(cx: number, cz: number) { return `${cx},${cz}`; }

    function rebuildChunk(cx: number, cz: number) {
      if (cx < 0 || cx >= WORLD_CHUNKS || cz < 0 || cz >= WORLD_CHUNKS) return;
      const key = ck(cx, cz);
      const old = meshMap.get(key);
      if (old) { scene.remove(old.opaque); scene.remove(old.transparent); disposeChunkMeshes(old); }
      const m = buildChunkMeshes(world, cx, cz);
      scene.add(m.opaque); scene.add(m.transparent);
      meshMap.set(key, m);
    }

    function ensureChunk(cx: number, cz: number) {
      if (cx < 0 || cx >= WORLD_CHUNKS || cz < 0 || cz >= WORLD_CHUNKS) return;
      if (!meshMap.has(ck(cx, cz))) rebuildChunk(cx, cz);
    }

    function updateChunks() {
      const pcx = Math.floor(player.x / CHUNK_SIZE), pcz = Math.floor(player.z / CHUNK_SIZE);
      const RD = RENDER_DISTANCE;
      for (let dx = -RD; dx <= RD; dx++) for (let dz = -RD; dz <= RD; dz++) {
        if (dx*dx+dz*dz <= RD*RD) ensureChunk(pcx+dx, pcz+dz);
      }
      for (const [key, m] of meshMap) {
        const [cx, cz] = key.split(",").map(Number);
        if ((cx-pcx)**2+(cz-pcz)**2 > (RD+2)**2) {
          scene.remove(m.opaque); scene.remove(m.transparent); disposeChunkMeshes(m); meshMap.delete(key);
        }
      }
    }
    updateChunks();

    // ── Input ─────────────────────────────────────────────────
    const keys = new Set<string>();
    function onKD(e: KeyboardEvent) {
      if (["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code)) e.preventDefault();
      keys.add(e.code);
      if (e.code === "Escape") {
        trackingRef.current = false; setTracking(false);
        document.exitPointerLock();
      }
      if (e.code === "KeyC" && trackingRef.current) {
        const next = st.mode === GameMode.CREATIVE ? GameMode.SURVIVAL : GameMode.CREATIVE;
        st.mode = next; player.flying = next === GameMode.CREATIVE; setGameMode(next);
      }
      if (e.code.startsWith("Digit")) {
        const n = parseInt(e.code.slice(5)) - 1;
        if (n >= 0 && n <= 8) { st.slot = n; setSelectedSlot(n); }
      }
    }
    function onKU(e: KeyboardEvent) { keys.delete(e.code); }
    document.addEventListener("keydown", onKD);
    document.addEventListener("keyup", onKU);

    // Mouse look (works with or without pointer lock via movementX/Y)
    let yD = 0, pD = 0;
    function onMM(e: MouseEvent) {
      if (!trackingRef.current) return;
      yD -= e.movementX * 0.002;
      pD -= e.movementY * 0.002;
    }
    document.addEventListener("mousemove", onMM);

    // Click to start tracking
    let justStarted = false;
    function onCanvasClick() {
      if (!trackingRef.current) {
        trackingRef.current = true; setTracking(true); justStarted = true;
        setTimeout(() => { justStarted = false; }, 200);
        // Bonus: try pointer lock
        try { mount.requestPointerLock?.(); } catch { /* no-op */ }
      }
    }
    mount.addEventListener("click", onCanvasClick);
    document.addEventListener("pointerlockchange", () => {
      // keep tracking synced with pointer lock if it works
    });

    // ── Block interactions ────────────────────────────────────
    function getViewDir() {
      const cp = Math.cos(player.pitch);
      return { x: Math.sin(player.yaw)*cp, y: Math.sin(player.pitch), z: Math.cos(player.yaw)*cp };
    }

    function applyBlock(wx: number, wy: number, wz: number, block: number) {
      setBlock(world, wx, wy, wz, block);
      worldChanges.set(`${wx},${wy},${wz}`, block);
      const cx = Math.floor(wx/CHUNK_SIZE), cz = Math.floor(wz/CHUNK_SIZE);
      rebuildChunk(cx, cz);
      if (wx%CHUNK_SIZE===0) rebuildChunk(cx-1,cz);
      if (wx%CHUNK_SIZE===CHUNK_SIZE-1) rebuildChunk(cx+1,cz);
      if (wz%CHUNK_SIZE===0) rebuildChunk(cx,cz-1);
      if (wz%CHUNK_SIZE===CHUNK_SIZE-1) rebuildChunk(cx,cz+1);
    }

    function hardness(block: number) {
      if (block === BLOCKS.OBSIDIAN) return 5.0;
      if (block === BLOCKS.BEDROCK) return 1e9;
      if (([BLOCKS.STONE,BLOCKS.COAL,BLOCKS.IRON,BLOCKS.GOLD,BLOCKS.DIAMOND,BLOCKS.EMERALD,BLOCKS.REDSTONE] as number[]).includes(block)) return 1.5;
      if (block === BLOCKS.SAND || block === BLOCKS.GRAVEL) return 0.5;
      return 0.9;
    }

    const mining = { active: false, wx:0, wy:0, wz:0, progress:0, total:0 };
    let holdLMB = false;

    function onMD(e: MouseEvent) {
      if (!trackingRef.current || justStarted) return;
      const d = getViewDir();
      const hit = raycastBlock(world, player.x, player.y+PLAYER_EYE_HEIGHT, player.z, d.x, d.y, d.z, REACH);

      if (e.button === 0) {
        holdLMB = true;
        if (st.mode === GameMode.CREATIVE && hit && getBlock(world,hit.wx,hit.wy,hit.wz) !== BLOCKS.BEDROCK) {
          applyBlock(hit.wx, hit.wy, hit.wz, BLOCKS.AIR);
        }
      }
      if (e.button === 2 && hit) {
        const px=hit.wx+hit.faceNx, py=hit.wy+hit.faceNy, pz=hit.wz+hit.faceNz;
        if (py<0||py>=CHUNK_HEIGHT) return;
        if (getBlock(world,px,py,pz)!==BLOCKS.AIR) return;
        // Don't place inside player
        const feetY = Math.floor(player.y), headY = Math.floor(player.y+1);
        const bx = Math.floor(player.x), bz = Math.floor(player.z);
        if (px===bx && (py===feetY||py===headY) && pz===bz) return;
        applyBlock(px, py, pz, HOTBAR[st.slot]);
      }
    }
    function onMU(e: MouseEvent) {
      if (e.button===0) { holdLMB=false; mining.active=false; mining.progress=0; setMineProgress(0); }
    }
    function onCM(e: Event) { e.preventDefault(); }
    document.addEventListener("mousedown", onMD);
    document.addEventListener("mouseup", onMU);
    document.addEventListener("contextmenu", onCM);

    mount.addEventListener("wheel", (e: WheelEvent) => {
      if (!trackingRef.current) return;
      e.preventDefault();
      const n = (st.slot+(e.deltaY>0?1:-1)+9)%9;
      st.slot=n; setSelectedSlot(n);
    }, { passive:false });

    // ── Sky ───────────────────────────────────────────────────
    function updateSky(t: number) {
      const f = t%1;
      let r:number,g:number,b:number,sunI:number,ambI:number;
      if (f<0.2)       {const q=f/0.2;       r=0.10+q*0.43; g=0.05+q*0.76; b=0.18+q*0.80; sunI=q*0.8; ambI=0.2+q*0.5;}
      else if (f<0.55) { r=0.53; g=0.81; b=0.98; sunI=0.8; ambI=0.7; }
      else if (f<0.75) {const q=(f-0.55)/0.2; r=0.53+q*0.47; g=0.81-q*0.61; b=0.98-q*0.82; sunI=0.8-q*0.7; ambI=0.7-q*0.6;}
      else             { r=0.02; g=0.03; b=0.08; sunI=0.05; ambI=0.08; }
      const col = new THREE.Color(r,g,b);
      scene.background = col; (scene.fog as THREE.Fog).color = col;
      sunLight.intensity = sunI; ambient.intensity = ambI;
      sunLight.position.set(Math.sin(f*Math.PI*2)*300, Math.cos(f*Math.PI*2)*300, 80);
    }

    // ── Save ──────────────────────────────────────────────────
    function saveGame() {
      if (profile.isGuest) return;
      try {
        const changes: Record<string,number> = {};
        worldChanges.forEach((v,k)=>{ changes[k]=v; });
        localStorage.setItem(saveKey, JSON.stringify({ player, changes, slot:st.slot, mode:st.mode }));
      } catch { /* quota */ }
    }

    // ── Game loop ─────────────────────────────────────────────
    let last=performance.now(), dayFrac=0.25;
    let chunkT=0, saveT=0, fpsT=0, fpsCount=0;

    function loop(now: number) {
      animId = requestAnimationFrame(loop);
      const dt = Math.min((now-last)/1000, 0.05); last=now;
      dayFrac += dt/600;

      // FPS counter
      fpsCount++; fpsT+=dt;
      if (fpsT>=1) { setFps(Math.round(fpsCount/fpsT)); fpsCount=0; fpsT=0; }

      // Apply mouse look
      if (trackingRef.current) {
        player.yaw += yD; yD=0;
        player.pitch = Math.max(-1.55, Math.min(1.55, player.pitch+pD)); pD=0;
      } else { yD=0; pD=0; }

      // Sprint: hold Shift in survival
      const sprinting = keys.has("ShiftLeft") && st.mode===GameMode.SURVIVAL;

      // Physics
      stepPhysics(player, world, keys, dt, st.mode===GameMode.CREATIVE, sprinting);

      // Survival hold-to-mine
      if (holdLMB && st.mode===GameMode.SURVIVAL && trackingRef.current) {
        const d=getViewDir();
        const hit=raycastBlock(world,player.x,player.y+PLAYER_EYE_HEIGHT,player.z,d.x,d.y,d.z,REACH);
        if (hit) {
          const same=mining.active&&mining.wx===hit.wx&&mining.wy===hit.wy&&mining.wz===hit.wz;
          if (!same) { mining.active=true; mining.wx=hit.wx; mining.wy=hit.wy; mining.wz=hit.wz; mining.progress=0; mining.total=hardness(getBlock(world,hit.wx,hit.wy,hit.wz)); }
          mining.progress+=dt;
          setMineProgress(mining.total>0?Math.min(mining.progress/mining.total,1):0);
          if (mining.progress>=mining.total) {
            applyBlock(hit.wx,hit.wy,hit.wz,BLOCKS.AIR);
            mining.active=false; mining.progress=0; setMineProgress(0);
          }
        } else { mining.active=false; mining.progress=0; setMineProgress(0); }
      }

      // Sky
      updateSky(dayFrac);

      // Camera
      camera.position.set(player.x, player.y+PLAYER_EYE_HEIGHT, player.z);
      camera.rotation.y = Math.PI+player.yaw;
      camera.rotation.x = -player.pitch;

      // Block highlight
      const d=getViewDir();
      const hit=raycastBlock(world,player.x,player.y+PLAYER_EYE_HEIGHT,player.z,d.x,d.y,d.z,REACH);
      if (hit) {
        selMesh.visible=true;
        selMesh.position.set(hit.wx+0.5,hit.wy+0.5,hit.wz+0.5);
        setBlockName(BLOCK_NAMES[getBlock(world,hit.wx,hit.wy,hit.wz)]??"");
      } else { selMesh.visible=false; setBlockName(""); }

      // Coords
      setCoords({ x:Math.floor(player.x), y:Math.floor(player.y), z:Math.floor(player.z) });
      setHealth(player.health);

      // Housekeeping
      chunkT+=dt; if(chunkT>1.0){ chunkT=0; updateChunks(); }
      saveT+=dt;  if(saveT>30)  { saveT=0;  saveGame(); }

      renderer.render(scene, camera);
    }
    animId = requestAnimationFrame(loop);

    function onResize() {
      const w=mount.clientWidth, h=mount.clientHeight;
      camera.aspect=w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h);
    }
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      document.removeEventListener("keydown", onKD);
      document.removeEventListener("keyup", onKU);
      document.removeEventListener("mousemove", onMM);
      document.removeEventListener("mousedown", onMD);
      document.removeEventListener("mouseup", onMU);
      document.removeEventListener("contextmenu", onCM);
      window.removeEventListener("resize", onResize);
      mount.removeEventListener("click", onCanvasClick);
      saveGame();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div style={{ width:"100vw", height:"100vh", overflow:"hidden", position:"relative", background:"#87ceeb", userSelect:"none", cursor: tracking ? "none" : "default" }}>
      <div ref={mountRef} style={{ width:"100%", height:"100%" }} />

      {/* Loading screen */}
      {isLoading && (
        <div style={{ position:"absolute", inset:0, background:"#000", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"#fff", fontFamily:"monospace" }}>
          <div style={{ fontSize:24, marginBottom:16, color:"#5dff8a" }}>MINECRAFT 3D</div>
          <div style={{ fontSize:14, color:"#888" }}>Generating world...</div>
        </div>
      )}

      {/* Crosshair */}
      {tracking && (
        <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", pointerEvents:"none" }}>
          <div style={{ position:"absolute", width:2, height:22, background:"rgba(255,255,255,0.9)", top:"50%", left:"50%", transform:"translate(-50%,-50%)", boxShadow:"0 0 2px rgba(0,0,0,0.8)" }}/>
          <div style={{ position:"absolute", width:22, height:2, background:"rgba(255,255,255,0.9)", top:"50%", left:"50%", transform:"translate(-50%,-50%)", boxShadow:"0 0 2px rgba(0,0,0,0.8)" }}/>
        </div>
      )}

      {/* Block tooltip */}
      {tracking && blockName && (
        <div style={{ position:"absolute", top:"58%", left:"50%", transform:"translateX(-50%)", color:"#fff", fontFamily:"monospace", fontSize:13, background:"rgba(0,0,0,0.55)", padding:"2px 12px", borderRadius:4, pointerEvents:"none", textShadow:"1px 1px 2px #000" }}>
          {blockName}
        </div>
      )}

      {/* Mining progress bar */}
      {tracking && mineProgress > 0 && (
        <div style={{ position:"absolute", bottom:78, left:"50%", transform:"translateX(-50%)", width:200, height:6, background:"rgba(0,0,0,0.5)", borderRadius:3, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${mineProgress*100}%`, background:"#f0a020", borderRadius:3, transition:"width 0.05s linear" }}/>
        </div>
      )}

      {/* Creative mode badge */}
      {gameMode===GameMode.CREATIVE && (
        <div style={{ position:"absolute", top:10, left:"50%", transform:"translateX(-50%)", color:"#ffe066", fontFamily:"monospace", fontSize:11, letterSpacing:2, background:"rgba(0,0,0,0.7)", padding:"3px 14px", borderRadius:4 }}>
          ✦ CREATIVE MODE ✦
        </div>
      )}

      {/* HUD: top-left debug */}
      <div style={{ position:"absolute", top:10, left:10, fontFamily:"monospace", fontSize:11, color:"#fff", lineHeight:1.7, background:"rgba(0,0,0,0.4)", padding:"4px 10px", borderRadius:4, pointerEvents:"none", textShadow:"1px 1px 2px #000" }}>
        <div style={{ color:"#afffaf" }}><b>MINECRAFT 3D</b></div>
        <div>{fps} fps</div>
        <div>X:{coords.x} Y:{coords.y} Z:{coords.z}</div>
        {gameMode===GameMode.SURVIVAL && <div>Profile: {profile.name}</div>}
      </div>

      {/* Health (survival) */}
      {gameMode===GameMode.SURVIVAL && tracking && (
        <div style={{ position:"absolute", bottom:72, left:"50%", transform:"translateX(-50%)", display:"flex", gap:3, pointerEvents:"none" }}>
          {Array.from({length:10}).map((_,i)=>(
            <div key={i} style={{ fontSize:15, filter: health>i*2?"none":"grayscale(1) opacity(0.3)", textShadow:"1px 1px 2px #000" }}>❤️</div>
          ))}
        </div>
      )}

      {/* Hotbar */}
      <div style={{ position:"absolute", bottom:10, left:"50%", transform:"translateX(-50%)", display:"flex", gap:3 }}>
        {HOTBAR.map((block, i) => (
          <div key={i} onClick={() => { setSelectedSlot(i); }}>
            <HotbarBlock block={block} selected={i===selectedSlot} />
          </div>
        ))}
      </div>

      {/* Block name under hotbar */}
      {tracking && (
        <div style={{ position:"absolute", bottom:64, left:"50%", transform:"translateX(-50%)", fontFamily:"monospace", fontSize:11, color:"#ddd", textShadow:"1px 1px 2px #000" }}>
          {BLOCK_NAMES[HOTBAR[selectedSlot]]}
        </div>
      )}

      {/* Click to play overlay — small, semi-transparent, bottom-right */}
      {!tracking && !isLoading && (
        <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
          <div style={{ pointerEvents:"all", background:"rgba(0,0,0,0.72)", padding:"32px 44px", borderRadius:12, color:"#fff", fontFamily:"monospace", textAlign:"center", border:"1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ fontSize:30, fontWeight:700, color:"#5dff8a", letterSpacing:3, marginBottom:8 }}>MINECRAFT 3D</div>
            <div style={{ color:"#aaa", fontSize:13, marginBottom:20 }}>Profile: <b style={{ color:"#fff" }}>{profile.name}</b></div>
            <button
              onClick={() => { /* handled by mount click */ }}
              style={{ fontSize:16, color:"#fff", background:"rgba(93,168,50,0.35)", border:"2px solid #5da832", padding:"10px 30px", borderRadius:6, cursor:"pointer", fontFamily:"monospace", letterSpacing:1, marginBottom:20, display:"block", width:"100%" }}
              onMouseDown={(e) => {
                e.stopPropagation();
                // Directly set tracking since the mount click handler might not fire
                trackingRef.current = true; setTracking(true);
              }}
            >
              ▶ Click to Play
            </button>
            <div style={{ fontSize:11, color:"#888", lineHeight:2 }}>
              WASD — Move &nbsp;·&nbsp; Space — Jump<br/>
              Mouse — Look &nbsp;·&nbsp; Shift — Sprint (survival)<br/>
              Left click — Mine (hold) &nbsp;·&nbsp; Right click — Place<br/>
              1–9 / Scroll — Select &nbsp;·&nbsp; C — Creative<br/>
              ESC — Release mouse
            </div>
            <button onClick={onExit} style={{ marginTop:18, padding:"6px 18px", background:"transparent", border:"1px solid #444", color:"#888", cursor:"pointer", fontFamily:"monospace", fontSize:11, borderRadius:4 }}>
              ← Back to profiles
            </button>
          </div>
        </div>
      )}

      {/* ESC hint when playing */}
      {tracking && (
        <div style={{ position:"absolute", top:10, right:10, fontFamily:"monospace", fontSize:10, color:"rgba(255,255,255,0.5)", pointerEvents:"none" }}>
          ESC to release mouse
        </div>
      )}
    </div>
  );
}

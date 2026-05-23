import { useState } from "react";

export interface Profile {
  name: string;
  color: string;
  createdAt: number;
  isGuest?: boolean;
}

const PROFILE_LIST_KEY = "mc2d_profiles_v1";
const COLORS = [
  "#e05a2b","#2be07a","#2b7ae0","#e02bb5",
  "#e0c42b","#2be0d4","#9b2be0","#e0572b",
];

function loadProfiles(): Profile[] {
  try { return JSON.parse(localStorage.getItem(PROFILE_LIST_KEY) ?? "[]"); } catch { return []; }
}
function saveProfiles(p: Profile[]) { localStorage.setItem(PROFILE_LIST_KEY, JSON.stringify(p)); }

export default function ProfileScreen({ onSelect }: { onSelect: (p: Profile) => void }) {
  const [profiles, setProfiles] = useState<Profile[]>(loadProfiles);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [err, setErr] = useState("");

  const handleCreate = () => {
    const n = name.trim();
    if (!n) { setErr("Name cannot be empty."); return; }
    if (n.length > 18) { setErr("Max 18 characters."); return; }
    if (profiles.some((p) => p.name.toLowerCase() === n.toLowerCase())) { setErr("That name is taken."); return; }
    const p: Profile = { name: n, color, createdAt: Date.now() };
    const updated = [...profiles, p];
    saveProfiles(updated);
    setProfiles(updated);
    setCreating(false); setName(""); setErr("");
    onSelect(p);
  };

  const handleDelete = (pname: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${pname}"? All save data will be lost.`)) return;
    localStorage.removeItem(`mc2d_profile_${pname}`);
    const updated = profiles.filter((p) => p.name !== pname);
    saveProfiles(updated); setProfiles(updated);
  };

  const playAsGuest = () => {
    onSelect({ name: "Guest", color: "#888888", createdAt: Date.now(), isGuest: true });
  };

  return (
    <div style={{ position:"fixed",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"linear-gradient(180deg,#0d1f12 0%,#091408 100%)",fontFamily:"monospace" }}>
      {/* grass top bar */}
      <div style={{ position:"absolute",top:0,left:0,right:0,height:8,background:"linear-gradient(90deg,#5da832 0%,#4e9028 100%)" }} />

      {/* Title */}
      <div style={{ marginBottom:32,textAlign:"center" }}>
        <div style={{ fontSize:"clamp(18px,4vw,38px)",fontWeight:"bold",color:"#7eff7e",textShadow:"3px 3px 0 #003300,-1px -1px 0 #003300",letterSpacing:2 }}>
          MINECRAFT 3D
        </div>
        <div style={{ color:"#5da832",fontSize:11,marginTop:6,letterSpacing:1 }}>SELECT A PROFILE</div>
      </div>

      {/* Profile list */}
      <div style={{ width:"min(500px,92vw)",maxHeight:"44vh",overflowY:"auto",display:"flex",flexDirection:"column",gap:8,marginBottom:14 }}>
        {profiles.length === 0 && !creating && (
          <div style={{ color:"#555",textAlign:"center",padding:"20px 0",fontSize:12 }}>No profiles yet. Create one below!</div>
        )}
        {profiles.map((p) => (
          <button key={p.name} onClick={() => onSelect(p)}
            style={{ display:"flex",alignItems:"center",gap:14,background:"rgba(255,255,255,0.05)",border:"2px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"11px 15px",cursor:"pointer",color:"#fff",textAlign:"left",transition:"all 0.12s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background="rgba(93,168,50,0.15)"; e.currentTarget.style.borderColor=p.color; }}
            onMouseLeave={(e) => { e.currentTarget.style.background="rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor="rgba(255,255,255,0.1)"; }}
          >
            <div style={{ width:40,height:40,borderRadius:6,background:p.color,border:"2px solid rgba(255,255,255,0.3)",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:"bold",color:"#fff",textShadow:"1px 1px 0 rgba(0,0,0,0.6)" }}>
              {p.name[0].toUpperCase()}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:"bold",fontSize:14 }}>{p.name}</div>
              <div style={{ color:"#666",fontSize:10,marginTop:2 }}>Created {new Date(p.createdAt).toLocaleDateString()}</div>
            </div>
            <button onClick={(e) => handleDelete(p.name, e)}
              style={{ background:"rgba(255,60,60,0.15)",border:"1px solid rgba(255,60,60,0.35)",borderRadius:4,color:"#ff8080",padding:"3px 9px",cursor:"pointer",fontSize:10 }}>✕</button>
          </button>
        ))}
      </div>

      {/* Create form */}
      {creating ? (
        <div style={{ width:"min(500px,92vw)",background:"rgba(0,0,0,0.6)",border:"2px solid rgba(93,168,50,0.35)",borderRadius:10,padding:20,display:"flex",flexDirection:"column",gap:12 }}>
          <div style={{ color:"#7eff7e",fontWeight:"bold",fontSize:13 }}>New Profile</div>
          <input autoFocus placeholder="Enter name…" value={name}
            onChange={(e) => { setName(e.target.value); setErr(""); }}
            onKeyDown={(e) => { if (e.key==="Enter") handleCreate(); if (e.key==="Escape") setCreating(false); }}
            maxLength={18}
            style={{ background:"rgba(255,255,255,0.08)",border:"2px solid rgba(255,255,255,0.2)",borderRadius:6,color:"#fff",padding:"9px 13px",fontSize:14,outline:"none",fontFamily:"monospace" }}
          />
          <div style={{ display:"flex",gap:7,flexWrap:"wrap" }}>
            {COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)}
                style={{ width:30,height:30,background:c,borderRadius:4,border:color===c?"3px solid #fff":"2px solid rgba(255,255,255,0.2)",cursor:"pointer" }} />
            ))}
          </div>
          {err && <div style={{ color:"#ff8080",fontSize:11 }}>{err}</div>}
          <div style={{ display:"flex",gap:8 }}>
            <button onClick={handleCreate}
              style={{ flex:1,background:"#2d7a1f",border:"2px solid #5da832",borderRadius:6,color:"#fff",padding:10,cursor:"pointer",fontWeight:"bold",fontSize:13,fontFamily:"monospace" }}>
              Create &amp; Play
            </button>
            <button onClick={() => { setCreating(false); setErr(""); }}
              style={{ background:"rgba(255,255,255,0.07)",border:"2px solid rgba(255,255,255,0.15)",borderRadius:6,color:"#aaa",padding:"10px 14px",cursor:"pointer",fontSize:13,fontFamily:"monospace" }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={{ width:"min(500px,92vw)",display:"flex",flexDirection:"column",gap:8 }}>
          <button onClick={() => setCreating(true)}
            style={{ padding:13,background:"rgba(45,122,31,0.45)",border:"2px solid #5da832",borderRadius:8,color:"#7eff7e",fontWeight:"bold",fontSize:14,cursor:"pointer",fontFamily:"monospace",letterSpacing:1 }}>
            + New Profile
          </button>
          <button onClick={playAsGuest}
            style={{ padding:11,background:"rgba(80,80,80,0.3)",border:"2px solid rgba(150,150,150,0.35)",borderRadius:8,color:"#bbb",fontSize:13,cursor:"pointer",fontFamily:"monospace" }}>
            👤 Play as Guest (no save needed)
          </button>
        </div>
      )}

      <div style={{ color:"#333",fontSize:9,marginTop:22,letterSpacing:1 }}>PROFILES STORED IN YOUR BROWSER · PRESS ESC IN-GAME TO EXIT</div>

      {/* Controls reminder */}
      <div style={{ position:"absolute",bottom:12,right:14,color:"#2d5a1f",fontSize:9,textAlign:"right",lineHeight:1.8 }}>
        <div>WASD / Arrows — Move · Space — Jump</div>
        <div>Left click — Mine · Right click — Place</div>
        <div>C — Creative Mode · 1–9 / Scroll — Hotbar</div>
        <div>Click to capture mouse · ESC to release</div>
      </div>
    </div>
  );
}

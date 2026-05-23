import { useState, useRef, useEffect } from "react";

interface QA { q: string; a: string; keywords: string[] }

const FAQ: QA[] = [
  { q: "How do I move?", a: "Press A / D or Arrow Left / Right to walk. W, Space, or Up Arrow to jump. In Creative mode, W/S flies you up and down.", keywords: ["move","walk","run","control","keys","wasd","arrow"] },
  { q: "How do I jump?", a: "Press W, Space, or the Up Arrow key. In water you can hold jump to swim upward. In Creative mode, W flies upward.", keywords: ["jump","fly","swim","space"] },
  { q: "How do I mine blocks?", a: "Left-click on any block within about 5 blocks of your character to break it. A red dashed outline shows the block you're targeting. The mined block goes into your inventory.", keywords: ["mine","break","dig","left click","destroy","remove"] },
  { q: "How do I place blocks?", a: "Right-click on an empty space adjacent to an existing block. Make sure you have the block selected in your hotbar (keys 1–9 or scroll wheel) and have enough of that block in your inventory.", keywords: ["place","build","right click","put"] },
  { q: "What are the block types?", a: "There are 29 block types: Grass, Dirt, Stone, Coal Ore, Iron Ore, Gold Ore, Diamond Ore, Emerald, Redstone, Wood Log, Planks, Leaves, Sand, Gravel, Water, Lava, Glass, Brick, Obsidian, Snow, Ice, Bedrock, Flower, Cactus, Torch, Chest, Crafting Table, Sponge, and TNT.", keywords: ["blocks","types","what blocks","list","all blocks"] },
  { q: "How do I switch hotbar slots?", a: "Press number keys 1–9, or scroll the mouse wheel to cycle through your 9 hotbar slots. The selected slot is highlighted in white.", keywords: ["hotbar","slot","select","switch","scroll","number key"] },
  { q: "What is Creative Mode?", a: "Press C to toggle Creative Mode. In Creative mode you have infinite blocks of every type, you can fly freely, and you take no fall damage or lava damage. A purple Creative Inventory panel opens — click any block to add it to your hotbar.", keywords: ["creative","mode","infinite","fly","toggle","c key"] },
  { q: "How do I access the Creative Inventory?", a: "Switch to Creative mode with C. The Creative Inventory panel appears automatically. Click any block icon to select it. Press C again to close the panel and play.", keywords: ["creative inventory","palette","all blocks","pick block"] },
  { q: "How do I save my progress?", a: "Progress saves automatically every 10 seconds and also when you press Escape. Your position and inventory are saved per profile in your browser's localStorage.", keywords: ["save","progress","autosave","localStorage"] },
  { q: "How do I switch profiles?", a: "Press Escape to exit to the Profile screen. Select a different profile or create a new one. Each profile has its own save data.", keywords: ["profile","switch","change","escape","exit"] },
  { q: "What is the Guest profile?", a: "The Guest profile lets you jump in immediately without creating an account. Progress is still saved in your browser under the 'Guest' name, but it's shared for all guests on the same browser.", keywords: ["guest","quick play","no profile"] },
  { q: "Is there multiplayer?", a: "Yes! Anyone who opens the same published app URL joins the same shared world in real-time. You'll see other players' characters (in their chosen color) with name tags. Block changes are visible to everyone.", keywords: ["multiplayer","friends","online","other players","play together"] },
  { q: "What is the day/night cycle?", a: "The sky transitions through dawn (orange), day (blue), sunset (red/orange), and night (dark blue with stars). A full cycle takes about 5 minutes. Stars appear at night.", keywords: ["day","night","cycle","sky","stars","time"] },
  { q: "How does water work?", a: "Water flows downward first, then spreads sideways over time. You swim slower in water. Jumping in water makes you float upward. Water + lava creates Obsidian.", keywords: ["water","swim","liquid","flow"] },
  { q: "How does lava work?", a: "Lava slowly damages you if you stand in it. Lava flows like water but slower. Lava + water creates Stone or Obsidian. Avoid lava in Survival mode!", keywords: ["lava","fire","damage","hot"] },
  { q: "How does fall damage work?", a: "In Survival mode, falling from a height causes damage proportional to your fall speed. Landing in water or on soft surfaces (sand) reduces impact. Creative mode has no fall damage.", keywords: ["fall","fall damage","height","die","death","hp","health"] },
  { q: "How do I read the HUD?", a: "Top-left shows your profile name, coordinates (X/Y), and time of day. Top-right shows online player count. Bottom-center is your 9-slot hotbar. In Survival mode, red hearts show HP and orange drumsticks show hunger.", keywords: ["hud","hearts","health","hunger","coordinates","interface"] },
  { q: "What biomes are there?", a: "Three biomes are generated: Plains (green with flowers and trees), Desert (sand, cacti, occasional water pools), and Snow (snow surface, ice lakes, sparse trees).", keywords: ["biome","desert","snow","plains","terrain"] },
  { q: "Are there caves?", a: "Yes! Caves are carved naturally underground using noise-based generation. You'll find ores like Coal, Iron, Gold, Diamond, Emerald, and Redstone inside. Torches are sometimes placed in caves.", keywords: ["cave","underground","mining","explore"] },
  { q: "What are the ore depths?", a: "Coal: just below surface. Iron: deeper. Gold: mid-deep. Redstone & Emerald: deep. Diamond: very deep (near bedrock). Obsidian: found rarely underground.", keywords: ["ore","diamond","iron","gold","coal","depth","find"] },
  { q: "What does TNT do?", a: "TNT is a placeable block — full TNT explosion effects aren't implemented yet, but it's a decorative block you can place in Creative mode!", keywords: ["tnt","explode","explosion","bomb"] },
  { q: "How do I use torches?", a: "Select Torch in your hotbar and right-click to place it on any surface. Torches glow and emit a light effect to illuminate dark caves.", keywords: ["torch","light","dark","illuminate"] },
];

interface Msg { from: "user" | "bot"; text: string }

function findAnswer(q: string): string {
  const lower = q.toLowerCase();
  // keyword match
  let best: QA | null = null;
  let bestScore = 0;
  for (const faq of FAQ) {
    let score = 0;
    for (const kw of faq.keywords) {
      if (lower.includes(kw)) score += kw.length;
    }
    if (score > bestScore) { bestScore = score; best = faq; }
  }
  if (best && bestScore > 2) return best.a;

  // fallback
  return "I'm not sure about that! Try asking about controls, mining, placing, Creative mode, water, biomes, ores, or multiplayer. Type 'help' to see all topics.";
}

interface Props { onClose: () => void }

export default function HelpBot({ onClose }: Props) {
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: "bot", text: "Hi! I'm the Minecraft 2D help assistant 👋 Ask me anything about the game, or type 'help' to see all topics." },
  ]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = () => {
    const q = input.trim();
    if (!q) return;
    const lower = q.toLowerCase();
    let answer: string;

    if (lower === "help" || lower === "topics" || lower === "list") {
      answer = "I can help with: **Controls**, **Mining & Placing**, **Block Types**, **Creative Mode**, **Inventory & Hotbar**, **Save & Profiles**, **Multiplayer**, **Day/Night**, **Water & Lava**, **Fall Damage**, **HUD**, **Biomes**, **Caves & Ores**, **Torches**, **TNT**. Just ask!";
    } else {
      answer = findAnswer(q);
    }

    setMsgs((m) => [...m, { from: "user", text: q }, { from: "bot", text: answer }]);
    setInput("");
  };

  const quickAsk = (q: string) => {
    const answer = findAnswer(q);
    setMsgs((m) => [...m, { from: "user", text: q }, { from: "bot", text: answer }]);
  };

  const quick = ["How do I mine?", "How do I place blocks?", "What is Creative mode?", "How does water work?", "What ores exist?", "Is there multiplayer?"];

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(520px,92vw)", height: "min(600px,88vh)",
          background: "linear-gradient(160deg,#0d1f2d,#0a1520)",
          border: "2px solid rgba(93,168,50,0.5)", borderRadius: 14,
          display: "flex", flexDirection: "column", overflow: "hidden",
          fontFamily: "monospace",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 22 }}>🤖</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: "bold", color: "#7eff7e", fontSize: 14 }}>Help Assistant</div>
            <div style={{ color: "#666", fontSize: 10 }}>Ask anything about the game</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#888", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.from === "user" ? "flex-end" : "flex-start" }}>
              <div
                style={{
                  maxWidth: "82%", padding: "9px 13px", borderRadius: m.from === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  background: m.from === "user" ? "rgba(93,168,50,0.28)" : "rgba(255,255,255,0.07)",
                  border: m.from === "user" ? "1px solid rgba(93,168,50,0.4)" : "1px solid rgba(255,255,255,0.1)",
                  color: "#eee", fontSize: 12, lineHeight: 1.65,
                }}
              >
                {m.text}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Quick questions */}
        <div style={{ padding: "8px 14px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", flexWrap: "wrap", gap: 5 }}>
          {quick.map((q) => (
            <button
              key={q}
              onClick={() => quickAsk(q)}
              style={{
                background: "rgba(93,168,50,0.15)", border: "1px solid rgba(93,168,50,0.3)",
                borderRadius: 20, color: "#9eff9e", fontSize: 10, padding: "4px 10px", cursor: "pointer",
              }}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 8 }}>
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); if (e.key === "Escape") onClose(); }}
            placeholder="Ask a question…"
            style={{
              flex: 1, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 8, color: "#fff", padding: "9px 12px", fontSize: 12, outline: "none", fontFamily: "monospace",
            }}
          />
          <button
            onClick={send}
            style={{
              background: "rgba(93,168,50,0.5)", border: "1px solid rgba(93,168,50,0.6)",
              borderRadius: 8, color: "#fff", padding: "9px 14px", cursor: "pointer", fontSize: 14, fontWeight: "bold",
            }}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

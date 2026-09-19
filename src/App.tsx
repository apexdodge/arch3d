import { Canvas } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { FlyCamera } from "./FlyCamera.tsx";
import { facingDegrees, frameModel, headingLabel, lookYaw } from "./fly.ts";
import { HouseView } from "./HouseView.tsx";
import {
  houseView,
  parseHouse,
  roomAt,
  starterHouse,
  wallColorName,
  type House,
  type Side,
} from "./house.ts";

const storageKey = "arch3d-house";
const marks = ["N", "E", "S", "W"];
const wallSides: Side[] = ["north", "south", "east", "west"];

type ChatLine = {
  role: "user" | "assistant";
  text: string;
};

function loadHouse(): House {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return starterHouse();
    }
    const parsed: unknown = JSON.parse(raw);
    return parseHouse(parsed) ?? starterHouse();
  } catch {
    return starterHouse();
  }
}

function firstHere(house: House): string | null {
  const view = houseView(house);
  return roomAt(house, view.center.x, view.center.z)?.id ?? house.rooms[0]?.id ?? null;
}

function localCommand(text: string): "undo" | "reset" | "clear" | null {
  const lower = text.trim().toLowerCase().replace(/[.!?]+$/g, "");
  if (lower === "undo" || lower === "undo that" || lower === "undo last") {
    return "undo";
  }
  if (lower === "reset" || lower === "reset the house" || lower === "start over") {
    return "reset";
  }
  if (lower === "clear" || lower === "clear chat" || lower === "clear the chat") {
    return "clear";
  }
  return null;
}

export default function App() {
  const [house, setHouse] = useState(loadHouse);
  const [past, setPast] = useState<House[]>([]);
  const [hereId, setHereId] = useState<string | null>(() => firstHere(loadHouse()));
  const [frameNonce, setFrameNonce] = useState(0);
  const [draft, setDraft] = useState("");
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [looking, setLooking] = useState(false);
  const houseRef = useRef(house);
  const linesRef = useRef(lines);
  const pastRef = useRef(past);
  const needleRef = useRef<HTMLSpanElement>(null);
  const facingRef = useRef<HTMLSpanElement>(null);
  houseRef.current = house;
  linesRef.current = lines;
  pastRef.current = past;

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(house));
  }, [house]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing =
        event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if (typing || event.shiftKey || (!event.ctrlKey && !event.metaKey) || event.code !== "KeyZ") {
        return;
      }
      event.preventDefault();
      undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const view = houseView(house);
  const framing = frameModel(view.size);
  const here = house.rooms.find((room) => room.id === hereId) ?? house.rooms[0];

  function onMove(x: number, z: number) {
    const found = roomAt(houseRef.current, x, z);
    if (!found) {
      return;
    }
    setHereId((current) => (current === found.id ? current : found.id));
  }

  function commit(next: House) {
    setPast((prev) => [...prev, houseRef.current].slice(-50));
    setHouse(next);
    setHereId((current) =>
      current && next.rooms.some((room) => room.id === current) ? current : next.rooms[0]?.id ?? null,
    );
  }

  function undo() {
    setPast((prev) => {
      const previous = prev[prev.length - 1];
      if (!previous) {
        return prev;
      }
      setHouse(previous);
      return prev.slice(0, -1);
    });
  }

  function reset() {
    const starter = starterHouse();
    setPast([]);
    setHouse(starter);
    setHereId(firstHere(starter));
    setFrameNonce((value) => value + 1);
    localStorage.removeItem(storageKey);
  }

  function say(text: string) {
    setLines((prev) => [...prev, { role: "assistant", text }]);
  }

  async function sendChat(event: { preventDefault: () => void }) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy) {
      return;
    }
    const command = localCommand(message);
    setDraft("");
    if (command === "clear") {
      setLines([]);
      return;
    }
    setLines((prev) => [...prev, { role: "user", text: message }]);
    if (command === "undo") {
      const previous = pastRef.current[pastRef.current.length - 1];
      if (!previous) {
        say("Nothing to undo.");
      } else {
        undo();
        say("Undone.");
      }
      return;
    }
    if (command === "reset") {
      reset();
      say("The house is back to the start.");
      return;
    }

    const snapshot = JSON.stringify(houseRef.current);
    const history = linesRef.current.slice(-12);
    setBusy(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          house: houseRef.current,
          message,
          history,
        }),
      });
      const body: unknown = await response.json();
      const parsed = parseChatReply(body);
      if (!parsed) {
        say("The chat request failed.");
        return;
      }
      say(parsed.reply);
      const unchanged = JSON.stringify(houseRef.current) === snapshot;
      if (unchanged && parsed.house && JSON.stringify(parsed.house) !== snapshot) {
        commit(parsed.house);
      }
    } catch {
      say("The chat request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Canvas shadows camera={{ fov: 70 }} gl={{ antialias: true }}>
        <color attach="background" args={["#0e1210"]} />
        <ambientLight intensity={0.28} />
        <hemisphereLight color="#f7f1e6" groundColor="#1d2420" intensity={0.35} />
        <directionalLight
          castShadow
          position={[7, 11, 3]}
          intensity={1.55}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-near={0.5}
          shadow-camera-far={40}
          shadow-camera-left={-14}
          shadow-camera-right={14}
          shadow-camera-top={14}
          shadow-camera-bottom={-14}
        />
        <HouseView house={house} />
        <FlyCamera
          center={view.center}
          framing={framing}
          frameNonce={frameNonce}
          needle={needleRef}
          facing={facingRef}
          onMove={onMove}
          onFlying={setLooking}
        />
      </Canvas>
      <header className="hud">
        <p className="room">{here ? here.name : "Outside"}</p>
        <p className="fly">{looking ? "Looking" : "F to look"}</p>
        {here ? (
          <div className="card">
            <span>Floor {here.color ?? "plain"}</span>
            {wallSides.map((side) => (
              <span key={side}>
                {side} {wallColorName(house, here, side) ?? "plaster"}
              </span>
            ))}
          </div>
        ) : null}
      </header>
      <div className="compass" aria-label="Compass">
        {marks.map((mark) => (
          <span key={mark} className={`mark ${mark.toLowerCase()}`}>
            {mark}
          </span>
        ))}
        <span ref={needleRef} className="needle" style={{ transform: `rotate(${facingDegrees(lookYaw)}deg)` }} />
        <span ref={facingRef} className="facing">
          {headingLabel(lookYaw)}
        </span>
      </div>
      <aside className={busy ? "panel waiting" : "panel"}>
        <div className="log">
          {lines.length === 0 && !busy ? (
            <p className="hint">
              Dress the bedroom. Paint the kitchen walls terracotta. Move the sofa north.
            </p>
          ) : (
            lines.map((line, index) => (
              <p key={`${line.role}-${index}`} className={line.role}>
                {line.text}
              </p>
            ))
          )}
          {busy ? (
            <p className="assistant wait" aria-label="Waiting for a reply">
              <span />
              <span />
              <span />
            </p>
          ) : null}
        </div>
        <form onSubmit={(event) => void sendChat(event)}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask for the next change"
            disabled={busy}
          />
          <button type="submit" disabled={busy || draft.trim().length === 0}>
            Send
          </button>
        </form>
      </aside>
    </>
  );
}

function parseChatReply(value: unknown): { reply: string; house: House | null } | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const reply = "reply" in value && typeof value.reply === "string" ? value.reply : null;
  if (!reply) {
    return null;
  }
  if (!("house" in value)) {
    return { reply, house: null };
  }
  const house = parseHouse(value.house);
  if (!house) {
    return null;
  }
  return { reply, house };
}

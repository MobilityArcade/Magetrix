import { useEffect, useRef, useState } from "react";

type Zone =
  | "UP_LEFT" | "UP" | "UP_RIGHT"
  | "LEFT" | "CENTER" | "RIGHT"
  | "DOWN_LEFT" | "DOWN" | "DOWN_RIGHT";

type Target = { zone: Zone; value: number; collected?: boolean };
type HandId = "left" | "right";
type HandCursor = { id: HandId; zone: Zone; color: string };
type SmoothPoint = { x: number; y: number; ready: boolean };

const zones: Zone[] = [
  "UP_LEFT", "UP", "UP_RIGHT",
  "LEFT", "CENTER", "RIGHT",
  "DOWN_LEFT", "DOWN", "DOWN_RIGHT",
];

const zoneStyles: Record<number, string> = {
  100: "white",
  200: "red",
  300: "#3b82f6",
  400: "#22c55e",
  500: "purple",
  1000: "#facc15",
};

const HAND_SCRIPT_URLS = [
  "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js",
  "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js",
];

function randomValue() {
  const vals = [100, 200, 300, 400, 500, 1000];
  return vals[Math.floor(Math.random() * vals.length)];
}

function getGridPosition(zone: Zone) {
  const base = {
    position: "absolute" as const,
    width: "33.333%",
    height: "33.333%",
    boxSizing: "border-box" as const,
  };

  const map: Record<Zone, [number, number]> = {
    UP_LEFT: [0, 0], UP: [0, 1], UP_RIGHT: [0, 2],
    LEFT: [1, 0], CENTER: [1, 1], RIGHT: [1, 2],
    DOWN_LEFT: [2, 0], DOWN: [2, 1], DOWN_RIGHT: [2, 2],
  };

  const [row, col] = map[zone];
  return { ...base, top: `${row * 33.333}%`, left: `${col * 33.333}%` };
}

function zoneFromPoint(x: number, y: number): Zone {
  const col = x < 1 / 3 ? 0 : x > 2 / 3 ? 2 : 1;
  const row = y < 1 / 3 ? 0 : y > 2 / 3 ? 2 : 1;
  return zones[row * 3 + col];
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });
}

function getPalmCenter(landmarks: Array<{ x: number; y: number }>) {
  const palmPoints = [0, 5, 9, 13, 17];
  const total = palmPoints.reduce(
    (acc, i) => {
      acc.x += landmarks[i].x;
      acc.y += landmarks[i].y;
      return acc;
    },
    { x: 0, y: 0 }
  );

  return { x: total.x / palmPoints.length, y: total.y / palmPoints.length };
}

function playBeep(frequency = 880, duration = 0.08) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "square";
    oscillator.frequency.value = frequency;
    gain.gain.value = 0.08;

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();

    window.setTimeout(() => {
      oscillator.stop();
      ctx.close();
    }, duration * 1000);
  } catch {}
}

function neonTunnelShadow(color: string) {
  return `
    0 0 10px ${color},
    0 0 22px ${color},
    inset 0 0 0 3px rgba(0,0,0,0.85),
    inset 0 0 0 7px ${color},
    inset 0 0 0 11px rgba(0,0,0,0.82),
    inset 0 0 0 15px ${color},
    inset 0 0 0 19px rgba(0,0,0,0.78),
    inset 0 0 0 23px ${color},
    inset 0 0 24px ${color}
  `;
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraRef = useRef<any>(null);
  const handsModelRef = useRef<any>(null);
  const smoothRef = useRef<Record<HandId, SmoothPoint>>({
    left: { x: 0.5, y: 0.5, ready: false },
    right: { x: 0.5, y: 0.5, ready: false },
  });
  const lastZoneRef = useRef<Record<HandId, Zone | null>>({ left: null, right: null });
  const lockRef = useRef<Record<HandId, number>>({ left: 0, right: 0 });
  const collectedThisFrameRef = useRef<Set<Zone>>(new Set());
  const playingRef = useRef(false);
  const scoreRef = useRef(0);

  const [active, setActive] = useState<Target[]>([]);
  const [hands, setHands] = useState<HandCursor[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [trackingStatus, setTrackingStatus] = useState("Hand tracking off");
  const [timeLeft, setTimeLeft] = useState(60);
  const [best, setBest] = useState(() => Number(localStorage.getItem("magetrix-best") || 0));
  const [flash, setFlash] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  const spawn = () => {
    const count = Math.floor(Math.random() * 5) + 3;
    const shuffled = [...zones].sort(() => Math.random() - 0.5);
    setActive(shuffled.slice(0, count).map((zone) => ({ zone, value: randomValue(), collected: false })));
  };

  const collect = (zone: Zone) => {
    if (!playingRef.current) return;
    if (collectedThisFrameRef.current.has(zone)) return;
    collectedThisFrameRef.current.add(zone);

    setActive((prev) => {
      const hit = prev.find((target) => target.zone === zone && !target.collected);
      if (!hit) return prev;

      setCombo((oldCombo) => {
        const nextCombo = oldCombo + 1;
        const multiplier = 1 + Math.floor(nextCombo / 5);
        setScore((s) => s + hit.value * multiplier);
        playBeep(520 + Math.min(nextCombo, 20) * 35, 0.07);
        return nextCombo;
      });

      window.setTimeout(() => {
        setActive((current) => current.filter((target) => target.zone !== zone));
      }, 130);

      return prev.map((target) =>
        target.zone === zone ? { ...target, collected: true } : target
      );
    });
  };

  const startHandTracking = async () => {
    try {
      setTrackingStatus("Loading hand tracker...");
      await Promise.all(HAND_SCRIPT_URLS.map(loadScript));

      const Hands = (window as any).Hands;
      const Camera = (window as any).Camera;

      if (!Hands || !Camera || !videoRef.current) {
        setTrackingStatus("Hand tracker failed to load");
        return;
      }

      const handsModel = new Hands({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      handsModel.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7,
      });

      handsModel.onResults((results: any) => {
        const nextHands: HandCursor[] = [];
        collectedThisFrameRef.current = new Set();

        if (results.multiHandLandmarks && results.multiHandedness) {
          results.multiHandLandmarks.forEach((landmarks: Array<{ x: number; y: number }>, index: number) => {
            const label = results.multiHandedness[index]?.label;
            const handId: HandId = label === "Left" ? "left" : "right";
            const center = getPalmCenter(landmarks);

            const rawX = 1 - center.x;
            const rawY = center.y;
            const smooth = smoothRef.current[handId];

            if (!smooth.ready) {
              smooth.x = rawX;
              smooth.y = rawY;
              smooth.ready = true;
            } else {
              smooth.x = smooth.x * 0.55 + rawX * 0.45;
              smooth.y = smooth.y * 0.55 + rawY * 0.45;
            }

            const zone = zoneFromPoint(smooth.x, smooth.y);

            if (lastZoneRef.current[handId] === zone) {
              lockRef.current[handId] += 1;
            } else {
              lastZoneRef.current[handId] = zone;
              lockRef.current[handId] = 0;
            }

            nextHands.push({
              id: handId,
              zone,
              color: handId === "left" ? "#22d3ee" : "#f472b6",
            });

            if (lockRef.current[handId] >= 1) collect(zone);
          });
        }

        setHands(nextHands);
      });

      handsModelRef.current = handsModel;

      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current && handsModelRef.current) {
            await handsModelRef.current.send({ image: videoRef.current });
          }
        },
        width: 640,
        height: 480,
      });

      cameraRef.current = camera;
      await camera.start();
      setTracking(true);
      setTrackingStatus("Two-hand tracking on");
    } catch (err) {
      console.error(err);
      setTracking(false);
      setTrackingStatus("Camera permission or tracker load failed");
    }
  };

  const stopHandTracking = () => {
    try {
      if (cameraRef.current) cameraRef.current.stop();
    } catch {}

    cameraRef.current = null;
    handsModelRef.current = null;
    setHands([]);
    setTracking(false);
    setTrackingStatus("Hand tracking off");
    smoothRef.current.left.ready = false;
    smoothRef.current.right.ready = false;
  };

  useEffect(() => {
    if (!playing) return;

    const interval = window.setInterval(() => spawn(), 2000);
    return () => window.clearInterval(interval);
  }, [playing]);

  useEffect(() => {
    if (!playing) return;
    if (active.length > 0) return;

    const refill = window.setTimeout(() => spawn(), 250);
    return () => window.clearTimeout(refill);
  }, [playing, active.length]);

  useEffect(() => {
    if (!playing) return;

    const timer = window.setInterval(() => {
      setTimeLeft((time) => {
        if (time <= 1) {
          setPlaying(false);
          setActive([]);
          setHands([]);
          setFlash(true);
          window.setTimeout(() => setFlash(false), 500);
          setBest((b) => {
            const next = Math.max(b, scoreRef.current);
            localStorage.setItem("magetrix-best", String(next));
            return next;
          });
          return 0;
        }

        return time - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    if (playing && timeLeft <= 10 && timeLeft > 0) playBeep(900, 0.06);
  }, [timeLeft, playing]);

  const startGame = () => {
    setScore(0);
    setCombo(0);
    setTimeLeft(60);
    setActive([]);
    setHands([]);
    setPlaying(false);

    let count = 3;
    setCountdown(count);
    playBeep(600, 0.08);

    const interval = window.setInterval(() => {
      count -= 1;

      if (count > 0) {
        setCountdown(count);
        playBeep(600, 0.08);
      } else if (count === 0) {
        setCountdown(0);
        playBeep(1000, 0.12);
      } else {
        window.clearInterval(interval);
        setCountdown(null);
        setPlaying(true);
        spawn();
      }
    }, 1000);
  };

  const stopGame = () => {
    setPlaying(false);
    setCountdown(null);
    setActive([]);
    setHands([]);
  };

  const showGameGrid = playing || countdown !== null;

  return (
    <div style={{ height: "100vh", background: "black", color: "white", overflow: "hidden", fontFamily: "monospace" }}>
      <video ref={videoRef} playsInline muted style={{ display: "none" }} />

      <div style={{ textAlign: "center", padding: 10, display: "flex", gap: 12, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
        <button
          onClick={playing || countdown !== null ? stopGame : startGame}
          style={{ background: "black", color: "white", border: "2px solid #00ffff", borderRadius: 8, padding: "6px 14px", fontWeight: 900, textShadow: "0 0 8px #0ff", boxShadow: "0 0 12px #0ff" }}
        >
          {playing || countdown !== null ? "STOP" : "START"}
        </button>
        <button
          onClick={tracking ? stopHandTracking : startHandTracking}
          style={{ background: "black", color: "white", border: "2px solid #00ffff", borderRadius: 8, padding: "6px 14px", fontWeight: 900, textShadow: "0 0 8px #0ff", boxShadow: "0 0 12px #0ff" }}
        >
          {tracking ? "STOP HAND TRACKING" : "START HAND TRACKING"}
        </button>
        <span style={{ opacity: 0.9, color: "white", textShadow: "0 0 8px #0ff" }}>{trackingStatus}</span>
      </div>

      <div style={{ textAlign: "center", fontSize: 22, marginBottom: 6, color: "white", textShadow: "0 0 8px #0ff, 0 0 16px #0ff" }}>
        ⏱ {timeLeft}s | Score {score} | Combo {combo} | Best {best}
      </div>

      <div style={{ position: "relative", height: "70%", border: "4px solid white", borderRadius: 20, margin: 20, overflow: "hidden", boxShadow: flash ? "0 0 80px white" : "0 0 18px #fff, 0 0 36px #0ff" }}>
        {showGameGrid && zones.map((zone) => (
          <div
            key={`grid-${zone}`}
            style={{
              ...getGridPosition(zone),
              border: "2px solid rgba(0,255,255,0.38)",
              borderRadius: 16,
              background: "transparent",
              boxShadow: "inset 0 0 16px rgba(0,255,255,0.22), 0 0 10px rgba(0,255,255,0.35)",
              zIndex: 1,
            }}
          />
        ))}

        {!playing && countdown === null && active.length === 0 && hands.length === 0 && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", zIndex: 3 }}>
            <div style={{ fontSize: "clamp(64px, 10vw, 140px)", fontWeight: 900, color: "white", textShadow: "0 0 10px #fff, 0 0 20px #0ff, 0 0 40px #0ff" }}>
              MAGETRIX
            </div>
            <div style={{
              fontSize: "clamp(22px, 2.5vw, 34px)",
              marginTop: 50,
              letterSpacing: 6,
              color: "#0ff",
              fontWeight: 800,
              textShadow: "0 0 6px #0ff, 0 0 12px #0ff, 0 0 22px #0ff",
              opacity: 0,
              transform: "translateY(18px)",
              animation: "subtitleFadeIn 1.25s ease-out 1.15s forwards"
            }}>
              CONTROL THE GRID
            </div>
          </div>
        )}

        <style>{`
          @keyframes subtitleFadeIn {
            0% { opacity: 0; transform: translateY(18px); letter-spacing: 14px; }
            60% { opacity: 1; transform: translateY(0); letter-spacing: 7px; }
            100% { opacity: 1; transform: translateY(0); letter-spacing: 6px; }
          }
        `}</style>

        {countdown !== null && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 130, fontWeight: 900, color: countdown === 0 ? "#00ffcc" : "white", textShadow: "0 0 25px #0ff", zIndex: 50 }}>
            {countdown === 0 ? "GO" : countdown}
          </div>
        )}

        {active.map((target) => {
          const color = zoneStyles[target.value];
          const isCollected = target.collected;

          return (
            <div
              key={target.zone}
              style={{
                ...getGridPosition(target.zone),
                margin: "1.1%",
                width: "31.1%",
                height: "31.1%",
                background: isCollected ? color : "rgba(0,0,0,0.45)",
                border: `4px solid ${color}`,
                borderRadius: 18,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isCollected ? "black" : color,
                fontWeight: 900,
                fontSize: 36,
                boxShadow: isCollected ? `0 0 45px ${color}, inset 0 0 20px rgba(255,255,255,0.5)` : neonTunnelShadow(color),
                transform: isCollected ? "scale(1.04)" : "scale(1)",
                transition: "all 0.12s ease",
                zIndex: 5,
              }}
            >
              {target.value}
            </div>
          );
        })}

        

        {flash && <div style={{ position: "absolute", inset: 0, background: "white", opacity: 0.55, pointerEvents: "none", zIndex: 100 }} />}
      </div>
    </div>
  );
}

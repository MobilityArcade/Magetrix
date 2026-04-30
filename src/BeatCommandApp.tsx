import { useEffect, useRef, useState } from "react";

type Zone =
  | "UP_LEFT" | "UP" | "UP_RIGHT"
  | "LEFT" | "CENTER" | "RIGHT"
  | "DOWN_LEFT" | "DOWN" | "DOWN_RIGHT";

const zones: Zone[] = [
  "UP_LEFT","UP","UP_RIGHT",
  "LEFT","CENTER","RIGHT",
  "DOWN_LEFT","DOWN","DOWN_RIGHT"
];

function getPosition(zone: Zone) {
  const base = { position: "absolute" as const };
  switch (zone) {
    case "UP_LEFT": return { ...base, top: "10%", left: "10%" };
    case "UP": return { ...base, top: "10%", left: "50%", transform: "translateX(-50%)" };
    case "UP_RIGHT": return { ...base, top: "10%", right: "10%" };
    case "LEFT": return { ...base, top: "50%", left: "10%", transform: "translateY(-50%)" };
    case "CENTER": return { ...base, top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    case "RIGHT": return { ...base, top: "50%", right: "10%", transform: "translateY(-50%)" };
    case "DOWN_LEFT": return { ...base, bottom: "10%", left: "10%" };
    case "DOWN": return { ...base, bottom: "10%", left: "50%", transform: "translateX(-50%)" };
    case "DOWN_RIGHT": return { ...base, bottom: "10%", right: "10%" };
  }
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevFrame = useRef<ImageData | null>(null);

  const [active, setActive] = useState<Zone[]>([]);
  const [score, setScore] = useState(0);
  const [tracking, setTracking] = useState(false);

  const spawn = () => {
    const count = Math.floor(Math.random() * 5) + 1;
    const shuffled = [...zones].sort(() => Math.random() - 0.5);
    setActive(shuffled.slice(0, count));
  };

  // ✅ FINAL FIX: correct left/right mapping
  const getZone = (x: number, y: number): Zone => {
    const rawCol = x < 0.33 ? 0 : x > 0.66 ? 2 : 1;
    const col = 2 - rawCol; // FIX
    const row = y < 0.33 ? 0 : y > 0.66 ? 2 : 1;
    return zones[row * 3 + col];
  };

  const startTracking = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
    setTracking(true);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const v = videoRef.current;
      const c = canvasRef.current;
      if (!v || !c || v.readyState < 2) return;

      c.width = 96;
      c.height = 72;

      const ctx = c.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(v, 0, 0, 96, 72);
      const frame = ctx.getImageData(0, 0, 96, 72);

      if (prevFrame.current) {
        let tx = 0, ty = 0, count = 0;

        for (let i = 0; i < frame.data.length; i += 4) {
          const diff = Math.abs(frame.data[i] - prevFrame.current.data[i]);
          if (diff > 50) {
            const p = i / 4;
            tx += p % 96;
            ty += Math.floor(p / 96);
            count++;
          }
        }

        if (count > 20) {
          const x = tx / count / 96;
          const y = ty / count / 72;

          const zone = getZone(x, y);

          setActive(prev => {
            if (prev.includes(zone)) {
              setScore(s => s + 100);
              return prev.filter(z => z !== zone);
            }
            return prev;
          });
        }
      }

      prevFrame.current = frame;
    }, 80);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const game = setInterval(spawn, 2000);
    return () => clearInterval(game);
  }, []);

  return (
    <div style={{ height: "100vh", background: "black", color: "white" }}>
      <video ref={videoRef} style={{ display: "none" }} />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      <div style={{ padding: 10, textAlign: "center" }}>
        <button onClick={startTracking}>
          {tracking ? "TRACKING ON" : "START TRACKING"}
        </button>
      </div>

      <div style={{
        position: "relative",
        height: "70%",
        border: "4px solid white",
        margin: 20
      }}>
        {active.map(z => (
          <div
            key={z}
            style={{
              ...getPosition(z),
              width: 200,
              height: 100,
              border: "3px solid white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28
            }}
          >
            100
          </div>
        ))}
      </div>

      <div style={{ textAlign: "center", fontSize: 20 }}>
        Score: {score}
      </div>
    </div>
  );
}

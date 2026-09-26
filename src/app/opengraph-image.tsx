import { ImageResponse } from "next/og";

export const alt = "Floating Bridge – play Singapore Bridge online with friends";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CARDS = [
  { rank: "A", suit: "♠", red: false },
  { rank: "K", suit: "♥", red: true },
  { rank: "Q", suit: "♦", red: true },
  { rank: "J", suit: "♣", red: false },
];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(ellipse at center, #1d5a41 0%, #123a2a 100%)",
          color: "#fbf8f1",
        }}
      >
        <div style={{ display: "flex", marginBottom: 48 }}>
          {CARDS.map((c, i) => (
            <div
              key={c.rank}
              style={{
                width: 130,
                height: 182,
                margin: "0 -10px",
                borderRadius: 14,
                background: "#fbf8f1",
                border: "3px solid #e2b75c",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 64,
                fontWeight: 700,
                color: c.red ? "#c8323c" : "#1c1f22",
                transform: `rotate(${(i - 1.5) * 8}deg) translateY(${Math.abs(i - 1.5) * 12}px)`,
                boxShadow: "0 12px 30px rgba(0,0,0,0.4)",
              }}
            >
              <div>{c.rank}</div>
              <div style={{ fontSize: 56 }}>{c.suit}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 88, fontWeight: 700, letterSpacing: -2 }}>Floating Bridge</div>
        <div style={{ fontSize: 36, color: "#f3d99b", marginTop: 12 }}>
          Play Singapore Bridge online with friends · free, no sign-up
        </div>
      </div>
    ),
    size,
  );
}

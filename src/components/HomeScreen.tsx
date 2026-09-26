"use client";

import { motion } from "framer-motion";
import { ArrowRight, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PlayingCard } from "@/components/PlayingCard";
import { toast } from "@/components/Toaster";
import { api, loadNickname, saveNickname } from "@/lib/api";
import { CODE_LENGTH, NICKNAME_MAX, normaliseCode } from "@/lib/rows";

const HERO_CARDS = ["AS", "KH", "QD", "JC", "TS"];

export function HomeScreen() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);

  useEffect(() => setNickname(loadNickname()), []);

  async function go(kind: "create" | "join") {
    const name = nickname.trim();
    if (!name) return toast.error("Enter a nickname first.");
    if (kind === "join" && normaliseCode(code).length !== CODE_LENGTH) {
      return toast.error(`Room codes are ${CODE_LENGTH} characters.`);
    }
    saveNickname(name);
    setBusy(kind);
    try {
      const { code: roomCode } = await api<{ code: string }>(`/api/rooms/${kind}`, {
        nickname: name,
        code: normaliseCode(code),
      });
      router.push(`/room/${roomCode}`);
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(null);
    }
  }

  return (
    <main className="felt felt-texture relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex h-32 items-end justify-center" aria-hidden>
          {HERO_CARDS.map((card, i) => (
            <motion.div
              key={card}
              initial={{ opacity: 0, y: 40, rotate: 0 }}
              animate={{ opacity: 1, y: Math.abs(i - 2) * 6, rotate: (i - 2) * 9 }}
              transition={{ delay: 0.08 * i, type: "spring", stiffness: 140, damping: 16 }}
              className="-mx-3 origin-bottom"
            >
              <PlayingCard card={card} size="lg" />
            </motion.div>
          ))}
        </div>

        <h1 className="text-center font-display text-5xl font-semibold tracking-tight text-card">Floating Bridge</h1>
        <p className="mt-2 text-center text-card/70">Singapore bridge for four. Make a room, share the code, deal.</p>

        <div className="mt-8 rounded-2xl border border-white/10 bg-ink/70 p-6 shadow-2xl backdrop-blur">
          <label className="block text-xs font-medium tracking-wider text-muted uppercase" htmlFor="nick">
            Your name
          </label>
          <input
            id="nick"
            value={nickname}
            maxLength={NICKNAME_MAX}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="e.g. Ah Beng"
            className="mt-2 w-full rounded-lg border border-line bg-panel px-3 py-2.5 text-base outline-none focus:border-gold"
            autoComplete="nickname"
          />

          <button
            onClick={() => go("create")}
            disabled={busy !== null}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-4 py-3 font-semibold text-ink transition hover:bg-gold-soft disabled:opacity-60"
          >
            <Plus className="size-4" /> {busy === "create" ? "Creating…" : "Create a room"}
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted">
            <div className="h-px flex-1 bg-line" /> or join one <div className="h-px flex-1 bg-line" />
          </div>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              go("join");
            }}
          >
            <input
              value={code}
              onChange={(e) => setCode(normaliseCode(e.target.value).slice(0, CODE_LENGTH))}
              placeholder="ROOM CODE"
              aria-label="Room code"
              className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-3 py-2.5 font-mono text-base tracking-[0.3em] uppercase outline-none placeholder:tracking-widest focus:border-gold"
              autoCapitalize="characters"
            />
            <button
              type="submit"
              disabled={busy !== null}
              className="flex items-center gap-1 rounded-lg border border-gold/60 px-4 font-semibold text-gold transition hover:bg-gold/10 disabled:opacity-60"
            >
              {busy === "join" ? "Joining…" : "Join"} <ArrowRight className="size-4" />
            </button>
          </form>
        </div>

        <details className="mt-6 text-sm text-card/70">
          <summary className="cursor-pointer text-center text-card/80 hover:text-card">How to play</summary>
          <ul className="mt-3 list-disc space-y-1.5 rounded-xl bg-ink/50 p-4 pl-8">
            <li>Four players, 13 cards each. Bid from 1♣ up to 7NT (♣ &lt; ♦ &lt; ♥ &lt; ♠ &lt; NT).</li>
            <li>Bidding ends after three passes. The top bidder picks trump and calls a card. Whoever holds it is their secret partner.</li>
            <li>The bidder&apos;s side needs 6 + bid tricks. Everyone else teams up to stop them.</li>
            <li>Follow suit if you can. Trump can&apos;t be led until someone has played one.</li>
            <li>With 4 points or fewer (A=4, K=3, Q=2, J=1) you may call a wash to redeal.</li>
          </ul>
        </details>
      </div>
    </main>
  );
}

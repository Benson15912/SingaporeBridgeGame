"use client";

import clsx from "clsx";
import { Send, Trophy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "@/components/Toaster";
import type { RoomData } from "@/hooks/useRoom";
import { computeInsights, rate, type Tally } from "@/lib/insights";
import { DEFAULT_TARGET } from "@/lib/rows";
import { supabaseBrowser } from "@/lib/supabase/client";

export function Sidebar({ data, userId }: { data: RoomData; userId: string }) {
  const [tab, setTab] = useState<"chat" | "insights">("chat");
  return (
    <div className="flex min-h-0 w-full flex-col">
      <Scoreboard data={data} userId={userId} />
      <div className="flex border-b border-line text-sm" role="tablist">
        {(["chat", "insights"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={clsx(
              "flex-1 py-2 font-medium capitalize transition",
              tab === t ? "border-b-2 border-gold text-gold" : "text-muted hover:text-card",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "chat" ? <Chat data={data} userId={userId} /> : <Insights data={data} userId={userId} />}
    </div>
  );
}

function Scoreboard({ data, userId }: { data: RoomData; userId: string }) {
  const target = data.room.target_score ?? DEFAULT_TARGET;
  const rows = data.players
    .map((p) => {
      const s = data.scores.find((x) => x.user_id === p.user_id);
      return { ...p, points: s?.points ?? 0, won: s?.games_won ?? 0, matches: s?.matches_won ?? 0 };
    })
    .sort((a, b) => b.points - a.points || b.won - a.won);

  return (
    <section className="border-b border-line p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg text-card">Scoreboard</h2>
        <span className="text-xs text-gold">First to {target}</span>
      </div>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="py-1 font-normal">Player</th>
            <th className="py-1 text-right font-normal">Rounds</th>
            <th className="py-1 text-right font-normal">Points</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.user_id} className={clsx(r.user_id === userId && "text-gold")}>
              <td className="truncate py-1">
                <span className="mr-2 text-muted tabular-nums">{i + 1}</span>
                {r.nickname}
                {r.matches > 0 && (
                  <span className="ml-1.5 text-xs text-gold" title={`${r.matches} match wins`}>
                    <Trophy className="mb-0.5 inline size-3" />
                    {r.matches}
                  </span>
                )}
                <div className="mt-0.5 h-1 rounded bg-panel-2">
                  <div
                    className="h-1 rounded bg-gold/70"
                    style={{ width: `${Math.min(100, (r.points / target) * 100)}%` }}
                  />
                </div>
              </td>
              <td className="py-1 text-right tabular-nums">{r.won}</td>
              <td className="py-1 text-right font-semibold tabular-nums">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">Each winner scores the bid level (e.g. 3 points for a 3-level bid). First to {target} wins the match.</p>
    </section>
  );
}

function Chat({ data, userId }: { data: RoomData; userId: string }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const first = useRef(true);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    // Jump straight to the latest message when the panel opens, glide for new ones.
    el.scrollTo({ top: el.scrollHeight, behavior: first.current ? "instant" : "smooth" });
    first.current = false;
  }, [data.chat.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim().slice(0, 500);
    if (!body || sending) return;
    setSending(true);
    const { error } = await supabaseBrowser().from("chat_messages").insert({ room_id: data.room.id, body });
    setSending(false);
    if (error) toast.error("Message not sent.");
    else setText("");
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <h2 className="px-4 pt-4 font-display text-lg text-card">Chat</h2>
      <div ref={listRef} className="min-h-40 flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {data.chat.length === 0 && <p className="text-sm text-muted">No messages yet. Say hi 👋</p>}
        {data.chat.map((m) => (
          <div key={m.id} className="text-sm leading-snug break-words">
            <span className={clsx("font-semibold", m.user_id === userId ? "text-gold" : "text-emerald-300")}>
              {m.nickname || "Player"}
            </span>{" "}
            <span className="text-card/90">{m.body}</span>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="Message"
          aria-label="Chat message"
          className="min-w-0 flex-1 rounded-lg border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-gold"
        />
        <button
          disabled={sending || !text.trim()}
          className="rounded-lg bg-panel-2 px-3 text-gold transition hover:bg-line disabled:opacity-40"
          aria-label="Send"
        >
          <Send className="size-4" />
        </button>
      </form>
    </section>
  );
}

const pct = (t: Tally) => (t.played ? `${Math.round(rate(t) * 100)}%` : "–");
const record = (t: Tally) => (t.played ? `${t.won}/${t.played}` : "–");

function Insights({ data, userId }: { data: RoomData; userId: string }) {
  const name = (id: string) => data.players.find((p) => p.user_id === id)?.nickname ?? "Player";
  const ins = computeInsights(
    data.history,
    data.players.map((p) => p.user_id),
  );

  if (ins.rounds === 0) {
    return (
      <p className="p-4 text-sm text-muted">
        Insights appear after the first round: who makes the best partner, strongest declarers and winning duos.
      </p>
    );
  }

  const best = ins.bestPartners[0];
  const duo = ins.duos.find((d) => d.tally.played >= 2) ?? ins.duos[0];

  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 text-sm">
      <div className="space-y-2">
        {best && (
          <p className="rounded-lg bg-gold/10 p-2.5 text-card/90">
            🤝 <span className="font-semibold text-gold">{name(best.userId)}</span> is the best partner:{" "}
            {pct(best.partner)} wins as partner ({record(best.partner)}).
          </p>
        )}
        {ins.bestDeclarers[0] && (
          <p className="rounded-lg bg-panel-2 p-2.5 text-card/90">
            🎯 <span className="font-semibold text-gold">{name(ins.bestDeclarers[0].userId)}</span> is the best declarer:{" "}
            {pct(ins.bestDeclarers[0].declarer)} ({record(ins.bestDeclarers[0].declarer)}).
          </p>
        )}
        {duo && (
          <p className="rounded-lg bg-panel-2 p-2.5 text-card/90">
            🔥 Top duo: <span className="font-semibold text-gold">{name(duo.a)}</span> &amp;{" "}
            <span className="font-semibold text-gold">{name(duo.b)}</span> win {pct(duo.tally)} ({record(duo.tally)}).
          </p>
        )}
      </div>

      <section>
        <h3 className="mb-1 text-xs tracking-wider text-muted uppercase">Win record by role</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-1 font-normal">Player</th>
              <th className="py-1 text-right font-normal">Declarer</th>
              <th className="py-1 text-right font-normal">Partner</th>
              <th className="py-1 text-right font-normal">Defender</th>
            </tr>
          </thead>
          <tbody>
            {ins.players.map((p) => (
              <tr key={p.userId} className={clsx(p.userId === userId && "text-gold")}>
                <td className="max-w-20 truncate py-1">{name(p.userId)}</td>
                {[p.declarer, p.partner, p.defender].map((t, i) => (
                  <td key={i} className="py-1 text-right tabular-nums">
                    {pct(t)} <span className="text-muted">{record(t)}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h3 className="mb-1 text-xs tracking-wider text-muted uppercase">Duos (declarer + partner)</h3>
        <ul className="space-y-1">
          {ins.duos.map((d) => (
            <li key={`${d.a}${d.b}`} className="flex items-center justify-between gap-2">
              <span className="truncate">
                {name(d.a)} &amp; {name(d.b)}
              </span>
              <span className="shrink-0 tabular-nums">
                {pct(d.tally)} <span className="text-muted">{record(d.tally)}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

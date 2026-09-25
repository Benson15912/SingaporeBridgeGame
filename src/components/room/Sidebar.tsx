"use client";

import clsx from "clsx";
import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "@/components/Toaster";
import type { RoomData } from "@/hooks/useRoom";
import { supabaseBrowser } from "@/lib/supabase/client";

export function Sidebar({ data, userId }: { data: RoomData; userId: string }) {
  return (
    <div className="flex min-h-0 w-full flex-col">
      <Scoreboard data={data} userId={userId} />
      <Chat data={data} userId={userId} />
    </div>
  );
}

function Scoreboard({ data, userId }: { data: RoomData; userId: string }) {
  const rows = data.players
    .map((p) => {
      const s = data.scores.find((x) => x.user_id === p.user_id);
      return { ...p, points: s?.points ?? 0, won: s?.games_won ?? 0 };
    })
    .sort((a, b) => b.points - a.points || b.won - a.won);

  return (
    <section className="border-b border-line p-4">
      <h2 className="font-display text-lg text-card">Scoreboard</h2>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="py-1 font-normal">Player</th>
            <th className="py-1 text-right font-normal">Won</th>
            <th className="py-1 text-right font-normal">Points</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.user_id} className={clsx(r.user_id === userId && "text-gold")}>
              <td className="truncate py-1">
                <span className="mr-2 text-muted tabular-nums">{i + 1}</span>
                {r.nickname}
              </td>
              <td className="py-1 text-right tabular-nums">{r.won}</td>
              <td className="py-1 text-right font-semibold tabular-nums">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">Each winner scores the bid level (e.g. 3 points for a 3-level bid).</p>
    </section>
  );
}

function Chat({ data, userId }: { data: RoomData; userId: string }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
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

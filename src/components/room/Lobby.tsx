"use client";

import clsx from "clsx";
import { Crown, Play } from "lucide-react";
import { useState } from "react";
import { toast } from "@/components/Toaster";
import { api } from "@/lib/api";
import type { Seat } from "@/lib/game";
import type { PlayerRow } from "@/lib/rows";
import type { RoomData } from "@/hooks/useRoom";
import { CodeChip } from "./RoomScreen";
import { SEAT_WIND } from "./util";

// Screen placement of each seat around the lobby table.
const LAYOUT: Record<Seat, string> = {
  0: "col-start-2 row-start-1",
  1: "col-start-3 row-start-2",
  2: "col-start-2 row-start-3",
  3: "col-start-1 row-start-2",
};

export function Lobby({
  code,
  data,
  me,
  isHost,
  online,
}: {
  code: string;
  data: RoomData;
  me: PlayerRow;
  isHost: boolean;
  online: Set<string>;
}) {
  const [starting, setStarting] = useState(false);
  const full = data.players.length === 4;

  async function sit(seat: Seat) {
    try {
      await api("/api/rooms/seat", { code, seat });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function start() {
    setStarting(true);
    try {
      await api("/api/game/start", { code });
    } catch (err) {
      toast.error((err as Error).message);
      setStarting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-8">
      <p className="text-sm tracking-wider text-muted uppercase">Invite friends with this code</p>
      <div className="mt-3">
        <CodeChip code={code} large />
      </div>
      <p className="mt-2 text-xs text-muted">Click to copy an invite link</p>

      <div className="mt-8 grid w-full max-w-md grid-cols-3 grid-rows-3 gap-2 sm:gap-3">
        <div className="felt felt-texture col-start-2 row-start-2 grid aspect-square place-items-center rounded-2xl border border-white/10 shadow-inner">
          <span className="font-display text-sm text-card/60">{data.players.length}/4</span>
        </div>
        {([0, 1, 2, 3] as Seat[]).map((seat) => {
          const p = data.players.find((x) => x.seat === seat);
          const mine = p?.user_id === me.user_id;
          return (
            <button
              key={seat}
              onClick={() => !p && sit(seat)}
              disabled={!!p}
              className={clsx(
                LAYOUT[seat],
                "flex aspect-square flex-col items-center justify-center rounded-2xl border p-2 text-center transition",
                p
                  ? mine
                    ? "border-gold bg-gold/10"
                    : "border-line bg-panel"
                  : "border-dashed border-line text-muted hover:border-gold/60 hover:text-gold",
              )}
            >
              <span className="text-[10px] tracking-widest text-muted">{SEAT_WIND[seat]}</span>
              {p ? (
                <>
                  <span className="mt-1 flex max-w-full items-center gap-1 truncate font-medium text-card">
                    {p.user_id === data.room.host_id && <Crown className="size-3.5 shrink-0 text-gold" />}
                    <span className="truncate">{p.nickname}</span>
                  </span>
                  <span
                    className={clsx(
                      "mt-1 text-[11px]",
                      online.has(p.user_id) ? "text-emerald-400" : "text-muted",
                    )}
                  >
                    {mine ? "You" : online.has(p.user_id) ? "Online" : "Away"}
                  </span>
                </>
              ) : (
                <span className="mt-1 text-sm">Sit here</span>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-center text-sm text-muted">
        Players opposite each other aren&apos;t fixed partners. The winning bidder calls a card, and whoever holds it becomes their partner.
      </p>

      <div className="mt-8">
        {isHost ? (
          <button
            onClick={start}
            disabled={!full || starting}
            className="flex items-center gap-2 rounded-xl bg-gold px-8 py-3 text-lg font-semibold text-ink shadow-lg transition hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Play className="size-5" />
            {starting ? "Dealing…" : full ? "Deal the cards" : `Waiting for ${4 - data.players.length} more`}
          </button>
        ) : (
          <p className="text-muted">
            {full ? "Waiting for the host to deal…" : `Waiting for ${4 - data.players.length} more player(s)…`}
          </p>
        )}
      </div>
    </div>
  );
}

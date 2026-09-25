"use client";

import clsx from "clsx";
import { Crown } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { BidText, CardBack, CardText } from "@/components/PlayingCard";
import { toast } from "@/components/Toaster";
import type { RoomData } from "@/hooks/useRoom";
import { api } from "@/lib/api";
import { SUIT_NAME, tricksNeeded, type Action, type GameState, type Seat } from "@/lib/game";
import type { PlayerRow } from "@/lib/rows";
import { Hand } from "./Hand";
import { BiddingPanel, PartnerPicker, ResultPanel, WashPrompt } from "./Panels";
import { TrickArea } from "./TrickArea";
import { cardsLeft, nameOf, positionOf, type Position } from "./util";

export type Act = (action: Action) => Promise<boolean>;

export function GameTable({
  code,
  data,
  me,
  online,
}: {
  code: string;
  data: RoomData;
  me: PlayerRow;
  online: Set<string>;
}) {
  const game = data.game!;
  const state = game.state;
  const mySeat = me.seat;
  const myTurn = state.turn === mySeat;

  const act: Act = useCallback(
    async (action) => {
      try {
        await api("/api/game/action", { code, action });
        return true;
      } catch (err) {
        toast.error((err as Error).message);
        return false;
      }
    },
    [code],
  );

  // Announce redeals once.
  const lastNotice = useRef<string | null>(null);
  useEffect(() => {
    const key = state.notice ? `${game.round_no}:${game.version}` : null;
    if (key && key !== lastNotice.current) toast.info(state.notice!);
    lastNotice.current = key;
  }, [state.notice, game.round_no, game.version]);

  // Show whose turn it is in the browser tab.
  useEffect(() => {
    document.title = myTurn ? "● Your turn · Floating Bridge" : "Floating Bridge";
    return () => {
      document.title = "Floating Bridge";
    };
  }, [myTurn]);

  const seatsAround: Seat[] = [1, 2, 3].map((o) => ((mySeat + o) % 4) as Seat);

  return (
    <div className="mx-auto flex h-full min-h-[36rem] max-w-5xl flex-col gap-3 p-3 sm:p-4">
      <StatusBar state={state} players={data.players} mySeat={mySeat} />

      <div className="felt felt-texture relative min-h-[24rem] flex-1 overflow-hidden rounded-[2rem] border border-white/10 shadow-[inset_0_0_60px_rgb(0_0_0/0.45)]">
        {seatsAround.map((seat) => (
          <SeatBadge
            key={seat}
            seat={seat}
            position={positionOf(seat, mySeat)}
            state={state}
            players={data.players}
            hostId={data.room.host_id}
            online={online}
          />
        ))}

        <div className="absolute inset-x-2 top-20 bottom-4 grid place-items-center sm:inset-x-28 sm:top-16">
          <CenterPanel state={state} data={data} mySeat={mySeat} act={act} code={code} />
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 text-sm">
        <span className={clsx("font-medium", myTurn ? "text-gold" : "text-card/80")}>
          {me.nickname} (you)
        </span>
        <SeatTags state={state} seat={mySeat} />
        {state.phase === "playing" || state.phase === "done" ? (
          <span className="text-muted">
            Tricks <span className="font-semibold text-card tabular-nums">{state.tricksWon[mySeat]}</span>
          </span>
        ) : null}
        {myTurn && <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-semibold text-ink">Your turn</span>}
      </div>

      <Hand cards={data.hand} state={state} mySeat={mySeat} act={act} />
    </div>
  );
}

function CenterPanel({
  state,
  data,
  mySeat,
  act,
  code,
}: {
  state: GameState;
  data: RoomData;
  mySeat: Seat;
  act: Act;
  code: string;
}) {
  switch (state.phase) {
    case "wash":
      return <WashPrompt state={state} hand={data.hand} mySeat={mySeat} act={act} />;
    case "bidding":
      return <BiddingPanel state={state} players={data.players} mySeat={mySeat} act={act} />;
    case "partner":
      return state.turn === mySeat ? (
        <PartnerPicker state={state} hand={data.hand} act={act} />
      ) : (
        <Waiting>
          {nameOf(data.players, state.contract!.declarer)} won with{" "}
          <BidText level={state.contract!.level} suit={state.contract!.suit} /> and is choosing a partner card…
        </Waiting>
      );
    case "playing":
      return <TrickArea state={state} players={data.players} mySeat={mySeat} />;
    case "done":
      return <ResultPanel state={state} players={data.players} code={code} />;
  }
}

export function Waiting({ children }: { children: React.ReactNode }) {
  return <p className="max-w-xs rounded-xl bg-black/25 px-4 py-3 text-center text-card/90">{children}</p>;
}

const BADGE_POSITION: Record<Exclude<Position, "bottom">, string> = {
  top: "top-3 left-1/2 -translate-x-1/2",
  left: "top-3 left-3 sm:top-1/2 sm:-translate-y-1/2",
  right: "top-3 right-3 sm:top-1/2 sm:-translate-y-1/2",
};

function SeatBadge({
  seat,
  position,
  state,
  players,
  hostId,
  online,
}: {
  seat: Seat;
  position: Position;
  state: GameState;
  players: PlayerRow[];
  hostId: string;
  online: Set<string>;
}) {
  const player = players.find((p) => p.seat === seat);
  const isTurn = state.turn === seat;
  const lastBid = state.phase === "bidding" ? [...state.bids].reverse().find((b) => b.seat === seat) : undefined;
  const left = cardsLeft(state, seat);

  return (
    <div
      className={clsx(
        "absolute z-10 flex w-[30%] max-w-40 flex-col items-center gap-1 sm:w-36",
        BADGE_POSITION[position as Exclude<Position, "bottom">],
      )}
    >
      <div
        className={clsx(
          "w-full rounded-xl border px-2.5 py-1.5 text-center shadow-lg backdrop-blur transition",
          isTurn ? "border-gold bg-ink/80 ring-2 ring-gold/60" : "border-white/10 bg-ink/60",
        )}
      >
        <div className="flex items-center justify-center gap-1.5 text-sm font-medium text-card">
          <span
            className={clsx("size-2 shrink-0 rounded-full", player && online.has(player.user_id) ? "bg-emerald-400" : "bg-zinc-500")}
            title={player && online.has(player.user_id) ? "Online" : "Away"}
          />
          {player?.user_id === hostId && <Crown className="size-3 shrink-0 text-gold" />}
          <span className="truncate">{player?.nickname ?? "Empty"}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center justify-center gap-1 text-[11px] text-muted">
          <SeatTags state={state} seat={seat} />
          {(state.phase === "playing" || state.phase === "done") && (
            <span>
              Tricks <span className="font-semibold text-card tabular-nums">{state.tricksWon[seat]}</span>
            </span>
          )}
        </div>
      </div>
      <div className="flex h-6 items-center">
        {lastBid ? (
          <span className="rounded-full bg-ink/70 px-2 py-0.5 text-xs text-card">
            {lastBid.bid ? <BidText {...lastBid.bid} /> : <span className="text-muted">Pass</span>}
          </span>
        ) : (
          left > 0 && (
            <div className="hidden items-center sm:flex" aria-label={`${left} cards`}>
              {Array.from({ length: Math.min(left, 7) }).map((_, i) => (
                <CardBack key={i} size="xs" className="-ml-5 first:ml-0" />
              ))}
              <span className="ml-1.5 text-[11px] text-card/70 tabular-nums">{left}</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function SeatTags({ state, seat }: { state: GameState; seat: Seat }) {
  const tags: { label: string; className: string }[] = [];
  if (state.dealer === seat) tags.push({ label: "Dealer", className: "bg-white/10 text-card/80" });
  if (state.contract?.declarer === seat) tags.push({ label: "Declarer", className: "bg-gold/20 text-gold" });
  if (state.partnerRevealed === seat) tags.push({ label: "Partner", className: "bg-emerald-400/20 text-emerald-300" });
  return (
    <>
      {tags.map((t) => (
        <span key={t.label} className={clsx("rounded px-1.5 py-px text-[10px] font-semibold uppercase", t.className)}>
          {t.label}
        </span>
      ))}
    </>
  );
}

function StatusBar({ state, players, mySeat }: { state: GameState; players: PlayerRow[]; mySeat: Seat }) {
  const c = state.contract;
  const whoseTurn = state.turn === mySeat ? "Your turn" : state.turn !== null ? `${nameOf(players, state.turn)}'s turn` : "";

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-xl border border-line bg-panel px-4 py-2.5 text-sm">
      {c ? (
        <>
          <Stat label="Contract">
            <BidText level={c.level} suit={c.suit} /> <span className="text-muted">by</span> {nameOf(players, c.declarer)}
          </Stat>
          <Stat label="Trump">{c.suit === "NT" ? "None" : SUIT_NAME[c.suit]}</Stat>
          <Stat label="Partner card">
            {state.partnerCard ? (
              <>
                <CardText card={state.partnerCard} />{" "}
                <span className="text-muted">
                  {state.partnerRevealed !== null ? `(${nameOf(players, state.partnerRevealed)})` : "(hidden)"}
                </span>
              </>
            ) : (
              <span className="text-muted">Choosing…</span>
            )}
          </Stat>
          <Stat label="Target">
            {tricksNeeded(c.level)} tricks
          </Stat>
          {c.suit !== "NT" && state.phase === "playing" && (
            <Stat label="Trump broken">{state.trumpBroken ? "Yes" : "No"}</Stat>
          )}
        </>
      ) : (
        <Stat label="Phase">{state.phase === "wash" ? "Checking for washes" : "Bidding"}</Stat>
      )}
      {whoseTurn && <span className={clsx("ml-auto font-medium", state.turn === mySeat ? "text-gold" : "text-card/80")}>{whoseTurn}</span>}
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-[11px] tracking-wider text-muted uppercase">{label}</span>
      <span className="text-card">{children}</span>
    </span>
  );
}

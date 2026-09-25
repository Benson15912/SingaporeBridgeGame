"use client";

import clsx from "clsx";
import { useState } from "react";
import { BidText, CardText, PlayingCard, SuitText } from "@/components/PlayingCard";
import { toast } from "@/components/Toaster";
import { api } from "@/lib/api";
import {
  BID_SUITS,
  canBid,
  canWash,
  highCardPoints,
  highestBid,
  pointsForWin,
  RANKS,
  SUITS,
  tricksNeeded,
  type Card,
  type GameState,
  type Seat,
  type Suit,
} from "@/lib/game";
import type { PlayerRow } from "@/lib/rows";
import type { Act } from "./GameTable";
import { Waiting } from "./GameTable";
import { nameOf } from "./util";

const panel = "w-full max-w-sm rounded-2xl border border-white/10 bg-ink/80 p-4 shadow-2xl backdrop-blur";

export function WashPrompt({ state, hand, mySeat, act }: { state: GameState; hand: Card[]; mySeat: Seat; act: Act }) {
  const [busy, setBusy] = useState(false);
  const pending = state.washPending.includes(mySeat);
  const points = highCardPoints(hand);
  const ready = 4 - state.washPending.length;

  const send = async (type: "wash" | "no-wash") => {
    setBusy(true);
    if (!(await act({ type }))) setBusy(false);
  };

  if (!pending) return <Waiting>Waiting for everyone to check their hands… ({ready}/4 ready)</Waiting>;

  return (
    <div className={clsx(panel, "text-center")}>
      <p className="font-display text-xl text-card">Your hand has {points} points</p>
      {canWash(hand) ? (
        <>
          <p className="mt-1 text-sm text-muted">With 4 points or fewer you may call a wash and have the cards redealt.</p>
          <div className="mt-4 flex gap-2">
            <button
              disabled={busy}
              onClick={() => send("wash")}
              className="flex-1 rounded-lg bg-gold py-2.5 font-semibold text-ink hover:bg-gold-soft disabled:opacity-50"
            >
              Wash (redeal)
            </button>
            <button
              disabled={busy}
              onClick={() => send("no-wash")}
              className="flex-1 rounded-lg border border-line py-2.5 font-semibold text-card hover:bg-panel-2 disabled:opacity-50"
            >
              Keep hand
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">Someone may be able to call a wash. Confirm when you&apos;re ready.</p>
          <button
            disabled={busy}
            onClick={() => send("no-wash")}
            className="mt-4 w-full rounded-lg bg-gold py-2.5 font-semibold text-ink hover:bg-gold-soft disabled:opacity-50"
          >
            Ready
          </button>
        </>
      )}
      <p className="mt-3 text-xs text-muted">{ready}/4 ready</p>
    </div>
  );
}

export function BiddingPanel({
  state,
  players,
  mySeat,
  act,
}: {
  state: GameState;
  players: PlayerRow[];
  mySeat: Seat;
  act: Act;
}) {
  const [busy, setBusy] = useState(false);
  const myTurn = state.turn === mySeat;
  const top = highestBid(state.bids);

  const send = async (action: Parameters<Act>[0]) => {
    setBusy(true);
    await act(action);
    setBusy(false);
  };

  return (
    <div className={panel}>
      <div className="flex items-baseline justify-between">
        <p className="font-display text-lg text-card">Bidding</p>
        <p className="text-sm text-muted">
          High bid:{" "}
          {top ? (
            <>
              <BidText {...top.bid} /> <span className="text-card/80">({nameOf(players, top.seat)})</span>
            </>
          ) : (
            "none"
          )}
        </p>
      </div>

      {state.bids.length > 0 && (
        <div className="mt-2 flex max-h-16 flex-wrap gap-1 overflow-y-auto text-xs">
          {state.bids.map((b, i) => (
            <span key={i} className="rounded bg-panel-2 px-1.5 py-0.5 text-card/80">
              {nameOf(players, b.seat)} {b.bid ? <BidText {...b.bid} /> : <span className="text-muted">pass</span>}
            </span>
          ))}
        </div>
      )}

      {myTurn ? (
        <>
          <div className="mt-3 grid grid-cols-5 gap-1">
            {[1, 2, 3, 4, 5, 6, 7].map((level) =>
              BID_SUITS.map((suit) => {
                const ok = canBid(state.bids, { level, suit });
                return (
                  <button
                    key={`${level}${suit}`}
                    disabled={!ok || busy}
                    onClick={() => send({ type: "bid", bid: { level, suit } })}
                    className={clsx(
                      "rounded-md py-1.5 text-sm transition",
                      ok ? "bg-panel-2 hover:bg-gold hover:text-ink" : "bg-panel/50 text-card/20",
                    )}
                  >
                    {level}
                    <SuitText suit={suit} className={clsx(!ok && "opacity-30", suit === "NT" && "text-xs")} />
                  </button>
                );
              }),
            )}
          </div>
          <button
            disabled={busy}
            onClick={() => send({ type: "pass" })}
            className="mt-2 w-full rounded-lg border border-line py-2 font-semibold text-card hover:bg-panel-2 disabled:opacity-50"
          >
            Pass
          </button>
        </>
      ) : (
        <p className="mt-4 text-center text-sm text-card/80">Waiting for {nameOf(players, state.turn)} to bid…</p>
      )}
    </div>
  );
}

export function PartnerPicker({ state, hand, act }: { state: GameState; hand: Card[]; act: Act }) {
  const trump = state.contract!.suit;
  const [suit, setSuit] = useState<Suit>(trump === "NT" ? "S" : trump);
  const [picked, setPicked] = useState<Card | null>(null);
  const [busy, setBusy] = useState(false);

  const call = async () => {
    if (!picked) return;
    setBusy(true);
    if (!(await act({ type: "call-partner", card: picked }))) setBusy(false);
  };

  return (
    <div className={panel}>
      <p className="font-display text-lg text-card">
        You won with <BidText level={state.contract!.level} suit={trump} />. Call your partner.
      </p>
      <p className="mt-1 text-sm text-muted">Whoever holds this card is secretly on your side.</p>

      <div className="mt-3 grid grid-cols-4 gap-1 rounded-lg bg-panel p-1">
        {[...SUITS].reverse().map((s) => (
          <button
            key={s}
            onClick={() => setSuit(s)}
            className={clsx("rounded-md py-1.5 text-lg", suit === s ? "bg-panel-2" : "opacity-60 hover:opacity-100")}
          >
            <SuitText suit={s} />
          </button>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1">
        {[...RANKS].reverse().map((r) => {
          const card = r + suit;
          const mine = hand.includes(card);
          return (
            <button
              key={card}
              disabled={mine}
              onClick={() => setPicked(card)}
              title={mine ? "In your hand" : undefined}
              className={clsx(
                "rounded-md py-1.5 text-sm font-semibold transition",
                mine
                  ? "bg-panel/50 text-card/20 line-through"
                  : picked === card
                    ? "bg-gold text-ink"
                    : "bg-panel-2 text-card hover:bg-line",
              )}
            >
              {r === "T" ? "10" : r}
            </button>
          );
        })}
      </div>

      <button
        disabled={!picked || busy}
        onClick={call}
        className="mt-3 w-full rounded-lg bg-gold py-2.5 font-semibold text-ink hover:bg-gold-soft disabled:opacity-40"
      >
        {picked ? (
          <>
            Call <CardText card={picked} />
          </>
        ) : (
          "Pick a card"
        )}
      </button>
    </div>
  );
}

export function ResultPanel({ state, players, code }: { state: GameState; players: PlayerRow[]; code: string }) {
  const [busy, setBusy] = useState(false);
  const r = state.result!;
  const c = state.contract!;
  const names = (seats: Seat[]) => seats.map((s) => nameOf(players, s)).join(" & ");
  const winners = r.declarerWon ? r.declarerSide : r.defenders;

  const next = async () => {
    setBusy(true);
    try {
      await api("/api/game/next-round", { code });
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className={clsx(panel, "text-center")}>
      <p className="text-xs tracking-widest text-muted uppercase">Round over</p>
      <p className="mt-1 font-display text-2xl text-card">
        {r.declarerWon ? (
          <>
            {names(r.declarerSide)} made <BidText level={c.level} suit={c.suit} />!
          </>
        ) : (
          <>
            {names(r.defenders)} stopped <BidText level={c.level} suit={c.suit} />!
          </>
        )}
      </p>
      <div className="mt-3 flex justify-center gap-6 text-sm">
        <div>
          <p className="text-muted">Bidder&apos;s side</p>
          <p className="text-lg font-semibold tabular-nums">
            {r.declarerTricks}
            <span className="text-sm text-muted">/{tricksNeeded(c.level)}</span>
          </p>
        </div>
        <div>
          <p className="text-muted">Defenders</p>
          <p className="text-lg font-semibold tabular-nums">
            {r.defenderTricks}
            <span className="text-sm text-muted">/{14 - tricksNeeded(c.level)}</span>
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 text-sm text-card/80">
        <PlayingCard card={state.partnerCard!} size="xs" />
        Partner was <span className="font-semibold text-card">{nameOf(players, state.partnerRevealed)}</span>
      </div>
      <p className="mt-2 text-sm text-gold">
        +{pointsForWin(c)} to {names(winners)}
      </p>
      <button
        disabled={busy}
        onClick={next}
        className="mt-4 w-full rounded-lg bg-gold py-2.5 font-semibold text-ink hover:bg-gold-soft disabled:opacity-50"
      >
        {busy ? "Dealing…" : "Deal next round"}
      </button>
    </div>
  );
}

"use client";

import clsx from "clsx";
import { Crown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { BidText, CardBack, CardText, PlayingCard, SuitText } from "@/components/PlayingCard";
import { toast } from "@/components/Toaster";
import type { RoomData } from "@/hooks/useRoom";
import { api } from "@/lib/api";
import { playSound } from "@/lib/sounds";
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

  const revealed = useRevealedPartner(state);
  const finalReveal = useFinalReveal(state);

  const seatsAround: Seat[] = [1, 2, 3].map((o) => ((mySeat + o) % 4) as Seat);

  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col gap-2 p-2 sm:gap-3 sm:p-4">
      <StatusBar state={state} players={data.players} mySeat={mySeat} />

      <div className="felt felt-texture relative flex min-h-[22rem] flex-1 flex-col overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] border border-white/10 shadow-[inset_0_0_60px_rgb(0_0_0/0.45)]">
        {seatsAround.map((seat) => (
          <SeatBadge
            key={seat}
            seat={seat}
            position={positionOf(seat, mySeat)}
            state={state}
            players={data.players}
            hostId={data.room.host_id}
            online={online}
            revealing={revealed === seat}
          />
        ))}

        <div className="relative z-20 mx-2 mt-[5.5rem] mb-3 flex flex-1 items-center justify-center sm:mx-28 sm:mt-16 sm:mb-4">
          <CenterPanel state={state} data={data} mySeat={mySeat} act={act} code={code} />
        </div>

        <AnimatePresence>
          {revealed !== null && state.partnerCard && (
            <PartnerBanner
              key={`${game.round_no}-${revealed}`}
              card={state.partnerCard}
              name={revealed === mySeat ? "You" : nameOf(data.players, revealed)}
              declarer={
                state.contract!.declarer === mySeat ? "you" : nameOf(data.players, state.contract!.declarer)
              }
              isMe={revealed === mySeat}
            />
          )}
          {finalReveal && state.finalCards && (
            <FinalReveal
              key={`final-${game.round_no}`}
              cards={state.finalCards}
              order={[0, 1, 2, 3].map((o) => (((state.turn ?? 0) + o) % 4) as Seat)}
              players={data.players}
              mySeat={mySeat}
            />
          )}
        </AnimatePresence>
      </div>

      <Insights state={state} hand={data.hand} mySeat={mySeat} />

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm">
        <span
          className={clsx(
            "font-medium",
            myTurn ? "text-gold" : "text-card/80",
            revealed === mySeat && "animate-pulse rounded bg-emerald-400/20 px-2 text-emerald-300",
          )}
        >
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
      return <ResultPanel
          state={state}
          players={data.players}
          code={code}
          isHost={data.room.host_id === data.players.find((p) => p.seat === mySeat)?.user_id}
          target={data.room.target_score ?? 30}
        />;
  }
}

const REVEAL_MS = 3200;

/** The partner's seat for a few seconds after the called card is played, then null. Silent on page load. */
function useRevealedPartner(state: GameState): Seat | null {
  const [seat, setSeat] = useState<Seat | null>(null);
  const prev = useRef(state.partnerRevealed);
  const round = useRef(state.dealer);

  useEffect(() => {
    const was = prev.current;
    prev.current = state.partnerRevealed;
    if (was !== null || state.partnerRevealed === null || state.result) return;
    setSeat(state.partnerRevealed);
    const t = setTimeout(() => setSeat(null), REVEAL_MS);
    return () => clearTimeout(t);
  }, [state.partnerRevealed, state.result]);

  // A new round clears any banner still on screen.
  useEffect(() => {
    if (round.current !== state.dealer) setSeat(null);
    round.current = state.dealer;
  }, [state.dealer]);

  return seat;
}

function PartnerBanner({
  card,
  name,
  declarer,
  isMe,
}: {
  card: string;
  name: string;
  declarer: string;
  isMe: boolean;
}) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-black/55 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
      role="status"
    >
      <motion.div
        className="flex flex-col items-center gap-3 px-4 text-center"
        initial={{ scale: 0.4, rotate: -6 }}
        animate={{ scale: [0.4, 1.18, 1], rotate: 0 }}
        transition={{ duration: 0.55, times: [0, 0.6, 1], ease: "easeOut" }}
      >
        <span className="rounded-full bg-emerald-400 px-4 py-1 text-xs font-bold tracking-[0.3em] text-ink uppercase">
          Partner revealed
        </span>
        <motion.div
          initial={{ rotateY: 180 }}
          animate={{ rotateY: 0 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          style={{ perspective: 600 }}
          className="rounded-lg shadow-[0_0_40px_10px_rgb(52_211_153/0.6)]"
        >
          <PlayingCard card={card} size="lg" highlight />
        </motion.div>
        <p className="font-display text-3xl font-semibold text-card drop-shadow sm:text-5xl">
          {isMe ? "You're the partner!" : `${name} is the partner!`}
        </p>
        <p className="text-sm text-card/80 sm:text-base">
          {isMe ? `You're on ${declarer === "you" ? "your own" : `${declarer}'s`} side.` : `Teaming up with ${declarer}.`}
        </p>
      </motion.div>
    </motion.div>
  );
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
  revealing,
}: {
  seat: Seat;
  position: Position;
  state: GameState;
  players: PlayerRow[];
  hostId: string;
  online: Set<string>;
  revealing: boolean;
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
          isTurn ? "animate-turn border-gold bg-ink/90 ring-2 ring-gold" : "border-white/10 bg-ink/60 opacity-80",
          revealing && "animate-pulse border-emerald-400 ring-4 ring-emerald-400/70",
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
        {isTurn && !lastBid ? (
          <span className="flex items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-[11px] font-bold text-ink">
            <span className="size-1.5 animate-ping rounded-full bg-ink" />
            {state.phase === "playing" ? "Playing" : state.phase === "partner" ? "Choosing" : "Bidding"}…
          </span>
        ) : lastBid ? (
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
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-line bg-panel px-3 py-2 sm:gap-x-8 sm:gap-y-3 sm:px-5 sm:py-3.5">
      {c ? (
        <>
          <Stat label="Contract">
            <BidText level={c.level} suit={c.suit} />{" "}
            <span className="text-base font-normal text-muted">by</span> {nameOf(players, c.declarer)}
          </Stat>
          <Stat label="Trump">
            {c.suit === "NT" ? (
              "None"
            ) : (
              <>
                <SuitText suit={c.suit} /> {SUIT_NAME[c.suit]}
              </>
            )}
          </Stat>
          <Stat label="Partner card">
            {state.partnerCard ? (
              <>
                <CardText card={state.partnerCard} />{" "}
                <span className="text-base font-normal text-muted">
                  {state.partnerRevealed !== null ? nameOf(players, state.partnerRevealed) : "(hidden)"}
                </span>
              </>
            ) : (
              <span className="text-muted">Choosing…</span>
            )}
          </Stat>
          <Stat label="Target">{tricksNeeded(c.level)} tricks</Stat>
          {c.suit !== "NT" && state.phase === "playing" && (
            <Stat label="Trump broken">{state.trumpBroken ? "Yes" : "No"}</Stat>
          )}
        </>
      ) : (
        <Stat label="Phase">{state.phase === "wash" ? "Checking for washes" : "Bidding"}</Stat>
      )}
      {whoseTurn && (
        <span
          className={clsx(
            "ml-auto rounded-full px-3 py-1 text-sm font-semibold sm:text-base",
            state.turn === mySeat ? "bg-gold text-ink" : "bg-panel-2 text-card/90",
          )}
        >
          {whoseTurn}
        </span>
      )}
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium tracking-wider text-muted uppercase sm:text-xs">{label}</span>
      <span className="text-base font-semibold text-card sm:text-xl">{children}</span>
    </div>
  );
}

const FINAL_MS = 6500;

/** True for a few seconds when the table drops to its last trick. Silent on page load. */
function useFinalReveal(state: GameState): boolean {
  const [show, setShow] = useState(false);
  const prev = useRef(state.tricksPlayed);
  useEffect(() => {
    const was = prev.current;
    prev.current = state.tricksPlayed;
    if (was >= 12 || state.tricksPlayed !== 12 || state.result || !state.finalCards) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), FINAL_MS);
    return () => clearTimeout(t);
  }, [state.tricksPlayed, state.result, state.finalCards]);
  return show;
}

function FinalReveal({
  cards,
  order,
  players,
  mySeat,
}: {
  cards: string[];
  order: Seat[];
  players: PlayerRow[];
  mySeat: Seat;
}) {
  const STEP = 1.1;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // On short screens (landscape phones) make sure the reveal is on screen.
    ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);
  useEffect(() => {
    const timers = order.map((_, i) =>
      setTimeout(() => playSound(i === order.length - 1 ? "partnerReveal" : "select"), (0.8 + i * STEP) * 1000),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      ref={ref}
      className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/70 px-2 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.6 } }}
      role="status"
    >
      <motion.span
        className="rounded-full bg-gold px-4 py-1 text-xs font-bold tracking-[0.3em] text-ink uppercase"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        Final trick
      </motion.span>
      <div className="flex flex-wrap justify-center gap-3 sm:gap-5">
        {order.map((seat, i) => (
          <div key={seat} className="flex flex-col items-center gap-2" style={{ perspective: 700 }}>
            <motion.div
              initial={{ rotateY: 180, y: 20, opacity: 0 }}
              animate={{ rotateY: 0, y: 0, opacity: 1 }}
              transition={{ delay: 0.8 + i * STEP, duration: 0.7, type: "spring", damping: 14 }}
              className="relative"
            >
              <motion.div
                className="absolute inset-0 rounded-lg shadow-[0_0_30px_6px_rgb(226_183_92/0.55)]"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ delay: 0.8 + i * STEP + 0.3, duration: 1 }}
              />
              <PlayingCard card={cards[seat]} size="md" />
            </motion.div>
            <motion.span
              className="max-w-20 truncate text-xs font-medium text-card sm:text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 + i * STEP + 0.3 }}
            >
              {seat === mySeat ? "You" : nameOf(players, seat)}
            </motion.span>
          </div>
        ))}
      </div>
      <p className="text-center text-sm text-card/80">Everyone is down to their last card…</p>
    </motion.div>
  );
}

/** What the table can tell me about who is on which side. */
function Insights({ state, hand, mySeat }: { state: GameState; hand: string[]; mySeat: Seat }) {
  const c = state.contract;
  if (!c || !state.partnerCard || state.phase === "done") return null;

  const isDeclarer = c.declarer === mySeat;
  const holdsCard = hand.includes(state.partnerCard);
  const partner = state.partnerRevealed;
  const need = tricksNeeded(c.level);
  const side = (s: Seat) => s === c.declarer || s === partner;
  const declTricks = ([0, 1, 2, 3] as Seat[]).filter(side).reduce<number>((n, s) => n + state.tricksWon[s], 0);
  const defTricks = state.tricksPlayed - declTricks;
  const defNeed = 14 - need;

  const role = isDeclarer
    ? { text: "You're the declarer", tone: "text-gold" }
    : holdsCard
      ? { text: "You hold the partner card, so you're on the declarer's side", tone: "text-emerald-300" }
      : partner !== null
        ? { text: "You're a defender", tone: "text-card" }
        : { text: "You're a defender (partner still hidden)", tone: "text-card" };
  const declSide = isDeclarer || holdsCard;
  const mine = declSide ? declTricks : defTricks;
  const target = declSide ? need : defNeed;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-xl bg-panel/70 px-3 py-1.5 text-xs sm:text-sm">
      <span className={clsx("font-medium", role.tone)}>{role.text}</span>
      <span className="text-muted">
        {!declSide && partner === null ? (
          <>
            Declarer has <span className="font-semibold text-card tabular-nums">{state.tricksWon[c.declarer]}</span> tricks
            (side needs {need})
          </>
        ) : (
          <>
            Your side{" "}
            <span className="font-semibold text-card tabular-nums">
              {mine}/{target}
            </span>{" "}
            tricks
          </>
        )}
      </span>
      {partner === null && !isDeclarer && !holdsCard && (
        <span className="text-muted">
          Partner card <CardText card={state.partnerCard} /> still to be played
        </span>
      )}
    </div>
  );
}

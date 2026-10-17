"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { PlayingCard } from "@/components/PlayingCard";
import { playSound } from "@/lib/sounds";
import { legalPlays, type Card, type GameState, type Seat } from "@/lib/game";
import type { Act } from "./GameTable";

const HAND_SIZE = 13;
const DEAL_STEP = 0.07; // seconds between cards; the deal sound ticks on the same schedule
const DEAL_TOTAL_MS = (HAND_SIZE * DEAL_STEP + 0.6) * 1000;

export function Hand({ cards, state, mySeat, act }: { cards: Card[]; state: GameState; mySeat: Seat; act: Act }) {
  const [pending, setPending] = useState<Card | null>(null);

  // A fresh deal is a full hand that differs from the last one. Opening the page mid-round doesn't count.
  const prevCards = useRef<Card[]>([]);
  const dealOrder = useRef<Map<Card, number>>(new Map());
  const dealFresh = useRef(false);
  const [, rerender] = useState(0);
  const isDeal =
    cards.length === HAND_SIZE &&
    cards.join() !== prevCards.current.join() &&
    (prevCards.current.length > 0 || state.phase === "wash" || state.phase === "bidding");
  if (isDeal && !dealFresh.current) {
    dealOrder.current = new Map(cards.map((c, i) => [c, i]));
    dealFresh.current = true;
  }
  const dealing = dealOrder.current.size > 0;

  // Timers live in a ref and are never cancelled on re-render: a re-delivered hand (same cards, new array)
  // or StrictMode's double effect run must not cut a deal short.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    prevCards.current = cards;
    if (!dealFresh.current) return;
    dealFresh.current = false;
    timers.current.forEach(clearTimeout);
    timers.current = cards.map((_, i) => setTimeout(() => playSound("dealCard"), i * DEAL_STEP * 1000));
    timers.current.push(
      setTimeout(() => {
        dealOrder.current.clear();
        rerender((n) => n + 1);
      }, DEAL_TOTAL_MS),
    );
  }, [cards]);

  const canPlay = state.phase === "playing" && state.turn === mySeat && pending === null && !dealing;
  const legal = canPlay ? legalPlays(cards, state.currentTrick, state.contract!.suit, state.trumpBroken) : [];

  // The play is confirmed once the card leaves our hand.
  useEffect(() => setPending(null), [cards.length]);

  async function play(card: Card) {
    setPending(card);
    if (!(await act({ type: "play", card }))) setPending(null);
  }

  return (
    <div className={clsx("sticky bottom-0 z-30 -mx-2 grid grid-cols-14 justify-items-center border-t bg-ink/90 px-2 pt-4 pb-2 backdrop-blur sm:static sm:mx-0 sm:flex sm:justify-center sm:border-0 sm:bg-transparent sm:px-0 sm:pt-4 sm:backdrop-blur-none", state.turn === mySeat && state.phase !== "done" ? "border-gold shadow-[0_-8px_24px_-6px_rgb(226_183_92/0.45)] sm:rounded-2xl sm:bg-gold/5" : "border-white/10")} role="list" aria-label="Your hand">
      <AnimatePresence>
        {cards.map((card, i) => {
          // Phones: two rows of up to 7, centred on a 14-column grid so every card shows its corner.
          const row = i < 7 ? 0 : 1;
          const inRow = row ? cards.length - 7 : Math.min(cards.length, 7);
          const col = 1 + (7 - inRow) + (i % 7) * 2;
          const isLegal = legal.includes(card);
          const dim = canPlay && !isLegal;
          return (
            <motion.button
              layout
              key={card}
              style={{ gridRow: row + 1, gridColumn: `${col} / span 2` }}
              role="listitem"
              initial={
                dealOrder.current.has(card)
                  ? { opacity: 0, y: -280, scale: 0.5, rotate: -18 }
                  : { opacity: 0, y: 30 }
              }
              animate={{ opacity: 1, y: pending === card ? -40 : 0, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, y: -60 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 28,
                delay: dealOrder.current.get(card) !== undefined ? dealOrder.current.get(card)! * DEAL_STEP : 0,
              }}
              aria-disabled={!isLegal}
              onClick={() => isLegal && play(card)}
              whileHover={{ y: isLegal ? -18 : -8, scale: isLegal ? 1.06 : 1 }}
              whileTap={isLegal ? { y: -24 } : undefined}
              className={clsx(
                "relative hover:z-20 focus-visible:z-20 max-sm:nth-[n+8]:-mt-9 sm:-ml-9 sm:first:ml-0 lg:-ml-6",
                dim && "brightness-50",
                isLegal ? "cursor-pointer drop-shadow-[0_6px_10px_rgb(0_0_0/0.5)]" : "cursor-default",
              )}
              aria-label={card}
            >
              <PlayingCard card={card} size="lg" highlight={isLegal} />
            </motion.button>
          );
        })}
      </AnimatePresence>
      {cards.length === 0 && <p className="py-10 text-sm text-muted">No cards in hand.</p>}
    </div>
  );
}

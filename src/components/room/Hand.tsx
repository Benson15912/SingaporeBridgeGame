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
    (prevCards.current.length > 0 || state.phase === "wash");
  if (isDeal && !dealFresh.current) {
    dealOrder.current = new Map(cards.map((c, i) => [c, i]));
    dealFresh.current = true;
  }
  const dealing = dealOrder.current.size > 0;

  useEffect(() => {
    prevCards.current = cards;
    if (!dealFresh.current) return;
    dealFresh.current = false;
    const timers = cards.map((_, i) => setTimeout(() => playSound("dealCard"), i * DEAL_STEP * 1000));
    timers.push(setTimeout(() => {
        dealOrder.current.clear();
        rerender((n) => n + 1);
      }, DEAL_TOTAL_MS));
    return () => timers.forEach(clearTimeout);
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
    <div className="flex justify-center pt-4 pb-2" role="list" aria-label="Your hand">
      <AnimatePresence initial={false}>
        {cards.map((card) => {
          const isLegal = legal.includes(card);
          const dim = canPlay && !isLegal;
          return (
            <motion.button
              layout
              key={card}
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
              disabled={!isLegal}
              onClick={() => play(card)}
              whileHover={isLegal ? { y: -14 } : undefined}
              className={clsx(
                "-ml-10 first:ml-0 sm:-ml-9 lg:-ml-6",
                dim && "brightness-50",
                isLegal ? "cursor-pointer" : "cursor-default",
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

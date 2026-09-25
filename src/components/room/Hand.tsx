"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { PlayingCard } from "@/components/PlayingCard";
import { legalPlays, type Card, type GameState, type Seat } from "@/lib/game";
import type { Act } from "./GameTable";

export function Hand({ cards, state, mySeat, act }: { cards: Card[]; state: GameState; mySeat: Seat; act: Act }) {
  const [pending, setPending] = useState<Card | null>(null);
  const canPlay = state.phase === "playing" && state.turn === mySeat && pending === null;
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
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: pending === card ? -40 : 0 }}
              exit={{ opacity: 0, y: -60 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
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

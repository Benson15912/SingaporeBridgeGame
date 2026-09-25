"use client";

import { AnimatePresence, motion } from "framer-motion";
import { PlayingCard } from "@/components/PlayingCard";
import type { GameState, Seat } from "@/lib/game";
import type { PlayerRow } from "@/lib/rows";
import { Waiting } from "./GameTable";
import { nameOf, positionOf, type Position } from "./util";

const SLOT: Record<Position, string> = {
  bottom: "left-1/2 bottom-0 -translate-x-1/2",
  top: "left-1/2 top-0 -translate-x-1/2",
  left: "left-0 top-1/2 -translate-y-1/2",
  right: "right-0 top-1/2 -translate-y-1/2",
};

const ENTER_FROM: Record<Position, { x: number; y: number }> = {
  bottom: { x: 0, y: 120 },
  top: { x: 0, y: -120 },
  left: { x: -120, y: 0 },
  right: { x: 120, y: 0 },
};

export function TrickArea({ state, players, mySeat }: { state: GameState; players: PlayerRow[]; mySeat: Seat }) {
  const trick = state.currentTrick;
  const trickKey = `${state.tricksPlayed - (trick?.winner !== null && trick ? 1 : 0)}`;

  if (!trick) {
    return (
      <Waiting>
        {state.turn === mySeat ? "You lead the first trick." : `${nameOf(players, state.turn)} leads the first trick.`}
      </Waiting>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-56 w-56 sm:h-64 sm:w-64">
        <AnimatePresence>
          {trick.cards.map(({ seat, card }) => {
            const pos = positionOf(seat, mySeat);
            return (
              <motion.div
                key={`${trickKey}-${card}`}
                className={`absolute ${SLOT[pos]}`}
                initial={{ opacity: 0, ...ENTER_FROM[pos], scale: 0.9 }}
                animate={{ opacity: 1, x: 0, y: 0, scale: trick.winner === seat ? 1.08 : 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: "spring", stiffness: 260, damping: 24 }}
              >
                <PlayingCard card={card} size="md" highlight={trick.winner === seat} />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <p className="h-5 text-sm text-card/80">
        {trick.winner !== null
          ? `${trick.winner === mySeat ? "You win" : `${nameOf(players, trick.winner)} wins`} the trick`
          : `Trick ${state.tricksPlayed + 1}`}
      </p>
    </div>
  );
}

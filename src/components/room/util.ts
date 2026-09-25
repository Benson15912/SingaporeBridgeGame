import type { GameState, Seat } from "@/lib/game";
import type { PlayerRow } from "@/lib/rows";

export const SEAT_WIND = ["N", "E", "S", "W"] as const;

/** Where a seat sits on screen relative to me: 0 bottom (me), 1 left, 2 top, 3 right (play goes clockwise). */
export type Position = "bottom" | "left" | "top" | "right";
const POSITIONS: Position[] = ["bottom", "left", "top", "right"];
export const positionOf = (seat: Seat, mySeat: Seat): Position => POSITIONS[(seat - mySeat + 4) % 4];

export const nameOf = (players: PlayerRow[], seat: Seat | null | undefined) =>
  seat == null ? "" : (players.find((p) => p.seat === seat)?.nickname ?? `Seat ${SEAT_WIND[seat]}`);

/** Cards still in a seat's hand, derived from public state. */
export function cardsLeft(state: GameState, seat: Seat): number {
  if (state.phase === "wash" || state.phase === "bidding" || state.phase === "partner") return 13;
  const t = state.currentTrick;
  const inOpenTrick = t && t.winner === null && t.cards.some((c) => c.seat === seat) ? 1 : 0;
  return 13 - state.tricksPlayed - inOpenTrick;
}

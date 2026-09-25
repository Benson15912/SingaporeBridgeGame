import { rankValue, suitOf } from "./cards";
import type { BidSuit, Card, Seat, Trick } from "./types";

/** Cards the player may legally play right now. */
export function legalPlays(hand: Card[], trick: Trick | null, trump: BidSuit, trumpBroken: boolean): Card[] {
  const leading = !trick || trick.cards.length === 0 || trick.winner !== null;
  if (leading) {
    if (trump === "NT" || trumpBroken) return hand;
    const nonTrump = hand.filter((c) => suitOf(c) !== trump);
    return nonTrump.length > 0 ? nonTrump : hand;
  }
  const led = suitOf(trick.cards[0].card);
  const following = hand.filter((c) => suitOf(c) === led);
  return following.length > 0 ? following : hand;
}

export function trickWinner(trick: Trick, trump: BidSuit): Seat {
  let best = trick.cards[0];
  for (const played of trick.cards.slice(1)) {
    const s = suitOf(played.card);
    const bestSuit = suitOf(best.card);
    const beats =
      s === bestSuit
        ? rankValue(played.card) > rankValue(best.card)
        : trump !== "NT" && s === trump && bestSuit !== trump;
    if (beats) best = played;
  }
  return best.seat;
}

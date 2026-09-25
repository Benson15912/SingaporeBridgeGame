import type { BidSuit, Card, Hands, Seat, Suit } from "./types";

export const SUITS: Suit[] = ["C", "D", "H", "S"];
export const BID_SUITS: BidSuit[] = ["C", "D", "H", "S", "NT"];
export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];

export const SUIT_SYMBOL: Record<BidSuit, string> = { C: "♣", D: "♦", H: "♥", S: "♠", NT: "NT" };
export const SUIT_NAME: Record<BidSuit, string> = {
  C: "Clubs",
  D: "Diamonds",
  H: "Hearts",
  S: "Spades",
  NT: "No Trump",
};

export const suitOf = (card: Card) => card[1] as Suit;
export const rankOf = (card: Card) => card[0];
/** 2 = 0 … A = 12 */
export const rankValue = (card: Card) => RANKS.indexOf(rankOf(card));
export const rankLabel = (card: Card) => (rankOf(card) === "T" ? "10" : rankOf(card));
export const isRed = (suit: BidSuit) => suit === "D" || suit === "H";

export const isCard = (value: unknown): value is Card =>
  typeof value === "string" &&
  value.length === 2 &&
  RANKS.includes(value[0]) &&
  (SUITS as string[]).includes(value[1]);

export function fullDeck(): Card[] {
  return SUITS.flatMap((s) => RANKS.map((r) => r + s));
}

function randomInt(max: number): number {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / max) * max;
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % max;
}

export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Sort for display: suits grouped (♠ ♥ ♣ ♦ alternates colours), high to low. */
const DISPLAY_SUIT_ORDER: Suit[] = ["S", "H", "C", "D"];
export function sortHand(cards: Card[]): Card[] {
  return [...cards].sort(
    (a, b) =>
      DISPLAY_SUIT_ORDER.indexOf(suitOf(a)) - DISPLAY_SUIT_ORDER.indexOf(suitOf(b)) ||
      rankValue(b) - rankValue(a),
  );
}

export function deal(): Hands {
  const deck = shuffle(fullDeck());
  return [0, 1, 2, 3].map((i) => sortHand(deck.slice(i * 13, i * 13 + 13))) as Hands;
}

const HCP: Record<string, number> = { A: 4, K: 3, Q: 2, J: 1 };
export function highCardPoints(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + (HCP[rankOf(c)] ?? 0), 0);
}

export const nextSeat = (seat: Seat, step = 1) => ((seat + step) % 4) as Seat;
export const SEATS: Seat[] = [0, 1, 2, 3];

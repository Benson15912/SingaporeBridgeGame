export type Suit = "C" | "D" | "H" | "S";
export type BidSuit = Suit | "NT";
/** Two-character card code: rank ("2"-"9", "T", "J", "Q", "K", "A") followed by suit, e.g. "AS", "TD". */
export type Card = string;
export type Seat = 0 | 1 | 2 | 3;

export interface Bid {
  level: number; // 1-7
  suit: BidSuit;
}

export interface BidEntry {
  seat: Seat;
  bid: Bid | null; // null = pass
}

export interface Contract extends Bid {
  declarer: Seat;
}

export interface PlayedCard {
  seat: Seat;
  card: Card;
}

export interface Trick {
  leader: Seat;
  cards: PlayedCard[];
  /** Set once all four cards are down. The trick stays visible until the next lead. */
  winner: Seat | null;
}

export type Phase = "wash" | "bidding" | "partner" | "playing" | "done";

export interface RoundResult {
  declarerWon: boolean;
  declarerSide: Seat[];
  defenders: Seat[];
  declarerTricks: number;
  defenderTricks: number;
}

/** Everything every player at the table may see. */
export interface GameState {
  phase: Phase;
  dealer: Seat;
  turn: Seat | null;
  /** Seats that still have to confirm the wash prompt (all four seats, so weak hands aren't revealed). */
  washPending: Seat[];
  bids: BidEntry[];
  contract: Contract | null;
  partnerCard: Card | null;
  /** Partner seat, public only once the called card has been played (or the round ends). */
  partnerRevealed: Seat | null;
  currentTrick: Trick | null;
  tricksPlayed: number;
  tricksWon: [number, number, number, number];
  trumpBroken: boolean;
  result: RoundResult | null;
  /** Human-readable note about the last redeal, if any. */
  notice: string | null;
}

/** Server-only knowledge. */
export interface Secrets {
  partnerSeat: Seat | null;
}

export type Hands = [Card[], Card[], Card[], Card[]];

export interface Round {
  state: GameState;
  secrets: Secrets;
  hands: Hands;
}

export type Action =
  | { type: "wash" }
  | { type: "no-wash" }
  | { type: "bid"; bid: Bid }
  | { type: "pass" }
  | { type: "call-partner"; card: Card }
  | { type: "play"; card: Card };

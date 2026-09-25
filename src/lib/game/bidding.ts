import { BID_SUITS } from "./cards";
import type { Bid, BidEntry, Contract } from "./types";

/** Total order over bids: 1♣ = 0 … 7NT = 34. */
export const bidRank = (bid: Bid) => (bid.level - 1) * BID_SUITS.length + BID_SUITS.indexOf(bid.suit);

export const isValidBid = (bid: unknown): bid is Bid =>
  typeof bid === "object" &&
  bid !== null &&
  Number.isInteger((bid as Bid).level) &&
  (bid as Bid).level >= 1 &&
  (bid as Bid).level <= 7 &&
  BID_SUITS.includes((bid as Bid).suit);

export function highestBid(bids: BidEntry[]): (BidEntry & { bid: Bid }) | null {
  for (let i = bids.length - 1; i >= 0; i--) {
    const entry = bids[i];
    if (entry.bid) return entry as BidEntry & { bid: Bid };
  }
  return null;
}

export function canBid(bids: BidEntry[], bid: Bid): boolean {
  const top = highestBid(bids);
  return isValidBid(bid) && (!top || bidRank(bid) > bidRank(top.bid));
}

export type BiddingOutcome = { kind: "continue" } | { kind: "contract"; contract: Contract } | { kind: "all-pass" };

/** Bidding ends after three passes in a row following a bid, or four passes with no bid. */
export function biddingOutcome(bids: BidEntry[]): BiddingOutcome {
  const top = highestBid(bids);
  if (!top) return bids.length >= 4 ? { kind: "all-pass" } : { kind: "continue" };
  const last3 = bids.slice(-3);
  if (last3.length === 3 && last3.every((b) => b.bid === null)) {
    return { kind: "contract", contract: { ...top.bid, declarer: top.seat } };
  }
  return { kind: "continue" };
}

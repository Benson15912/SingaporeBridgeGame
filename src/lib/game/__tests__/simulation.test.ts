import { describe, expect, it } from "vitest";
import {
  applyAction,
  BID_SUITS,
  canBid,
  canWash,
  fullDeck,
  legalPlays,
  newRound,
  SEATS,
  tricksNeeded,
  type Action,
  type Round,
} from "..";

const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

/** Chooses a random legal action for whoever needs to act. */
function randomStep(r: Round): Round {
  const { state } = r;
  if (state.phase === "wash") {
    const seat = state.washPending[0];
    const wash = canWash(r.hands[seat]) && Math.random() < 0.2;
    return applyAction(r, seat, { type: wash ? "wash" : "no-wash" });
  }
  const seat = state.turn!;
  const hand = r.hands[seat];
  let action: Action;
  switch (state.phase) {
    case "bidding": {
      const options = [1, 2, 3, 4].flatMap((level) => BID_SUITS.map((suit) => ({ level, suit })));
      const bid = options.find((b) => canBid(state.bids, b) && Math.random() < 0.3);
      action = bid && Math.random() < 0.5 ? { type: "bid", bid } : { type: "pass" };
      break;
    }
    case "partner":
      action = { type: "call-partner", card: pick(fullDeck().filter((c) => !hand.includes(c))) };
      break;
    case "playing":
      action = {
        type: "play",
        card: pick(legalPlays(hand, state.currentTrick, state.contract!.suit, state.trumpBroken)),
      };
      break;
    default:
      throw new Error(`unexpected phase ${state.phase}`);
  }
  return applyAction(r, seat, action);
}

describe("random full games", () => {
  it("always reaches a consistent result", () => {
    for (let game = 0; game < 300; game++) {
      let r = newRound(pick(SEATS));
      for (let steps = 0; r.state.phase !== "done"; steps++) {
        expect(steps).toBeLessThan(2000);
        r = randomStep(r);
        // Cards are never created or lost.
        const inTrick = r.state.currentTrick?.winner === null ? r.state.currentTrick.cards.length : 0;
        expect(r.hands.flat().length + inTrick + r.state.tricksPlayed * 4).toBe(52);
      }

      const { state, secrets } = r;
      const result = state.result!;
      const need = tricksNeeded(state.contract!.level);
      expect(state.partnerRevealed).toBe(secrets.partnerSeat);
      expect(secrets.partnerSeat).not.toBe(state.contract!.declarer);
      expect(result.declarerTricks + result.defenderTricks).toBe(state.tricksPlayed);
      if (result.declarerWon) expect(result.declarerTricks).toBe(need);
      else expect(result.defenderTricks).toBe(14 - need);
      expect(state.tricksWon.reduce((a, b) => a + b, 0)).toBe(state.tricksPlayed);
    }
  });
});

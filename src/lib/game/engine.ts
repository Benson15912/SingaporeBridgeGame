import { biddingOutcome, canBid } from "./bidding";
import { deal, highCardPoints, isCard, nextSeat, SEATS, sortHand } from "./cards";
import { legalPlays, trickWinner } from "./play";
import { roundResult } from "./scoring";
import type { Action, GameState, Hands, Round, Seat } from "./types";

export const WASH_MAX_HCP = 4;

export class GameError extends Error {}

/** Deal a fresh round. `dealt` lets tests supply fixed hands. */
export function newRound(dealer: Seat, dealt: Hands = deal(), notice: string | null = null): Round {
  const hands = dealt.map(sortHand) as Hands;
  const anyWashable = hands.some((h) => highCardPoints(h) <= WASH_MAX_HCP);
  const state: GameState = {
    phase: anyWashable ? "wash" : "bidding",
    dealer,
    turn: anyWashable ? null : nextSeat(dealer),
    washPending: anyWashable ? [...SEATS] : [],
    bids: [],
    contract: null,
    partnerCard: null,
    partnerRevealed: null,
    currentTrick: null,
    tricksPlayed: 0,
    tricksWon: [0, 0, 0, 0],
    trumpBroken: false,
    result: null,
    notice,
  };
  return { state, secrets: { partnerSeat: null }, hands };
}

export const canWash = (hand: string[]) => highCardPoints(hand) <= WASH_MAX_HCP;

/** Apply one player's action. Throws GameError on anything illegal; never mutates its input. */
export function applyAction(round: Round, seat: Seat, action: Action): Round {
  const state: GameState = structuredClone(round.state);
  const secrets = { ...round.secrets };
  const hands = round.hands.map((h) => [...h]) as Hands;
  const hand = hands[seat];
  state.notice = null;

  const requireTurn = () => {
    if (state.turn !== seat) throw new GameError("It's not your turn.");
  };

  switch (action.type) {
    case "wash":
    case "no-wash": {
      if (state.phase !== "wash") throw new GameError("Not in the wash phase.");
      if (!state.washPending.includes(seat)) throw new GameError("You've already answered.");
      if (action.type === "wash") {
        if (!canWash(hand)) throw new GameError(`Only hands with ${WASH_MAX_HCP} or fewer points can wash.`);
        return newRound(state.dealer, deal(), "A player called a wash. The cards have been redealt.");
      }
      state.washPending = state.washPending.filter((s) => s !== seat);
      if (state.washPending.length === 0) {
        state.phase = "bidding";
        state.turn = nextSeat(state.dealer);
      }
      break;
    }

    case "bid":
    case "pass": {
      if (state.phase !== "bidding") throw new GameError("Not in the bidding phase.");
      requireTurn();
      if (action.type === "bid" && !canBid(state.bids, action.bid)) {
        throw new GameError("That bid must be higher than the current bid.");
      }
      state.bids.push({ seat, bid: action.type === "bid" ? { level: action.bid.level, suit: action.bid.suit } : null });
      const outcome = biddingOutcome(state.bids);
      if (outcome.kind === "all-pass") {
        return newRound(state.dealer, deal(), "Everyone passed. The cards have been redealt.");
      }
      if (outcome.kind === "contract") {
        state.contract = outcome.contract;
        state.phase = "partner";
        state.turn = outcome.contract.declarer;
      } else {
        state.turn = nextSeat(seat);
      }
      break;
    }

    case "call-partner": {
      if (state.phase !== "partner") throw new GameError("Not choosing a partner now.");
      requireTurn();
      if (!isCard(action.card)) throw new GameError("Invalid card.");
      if (hand.includes(action.card)) throw new GameError("You can't call a card in your own hand.");
      const owner = SEATS.find((s) => hands[s].includes(action.card))!;
      const contract = state.contract!;
      state.partnerCard = action.card;
      secrets.partnerSeat = owner;
      state.phase = "playing";
      state.turn = contract.suit === "NT" ? contract.declarer : nextSeat(contract.declarer);
      break;
    }

    case "play": {
      if (state.phase !== "playing") throw new GameError("Not in the playing phase.");
      requireTurn();
      const contract = state.contract!;
      if (!hand.includes(action.card)) throw new GameError("You don't hold that card.");
      if (!legalPlays(hand, state.currentTrick, contract.suit, state.trumpBroken).includes(action.card)) {
        throw new GameError(
          state.currentTrick && state.currentTrick.winner === null && state.currentTrick.cards.length > 0
            ? "You must follow suit."
            : "Trump hasn't been broken yet.",
        );
      }

      if (!state.currentTrick || state.currentTrick.winner !== null) {
        state.currentTrick = { leader: seat, cards: [], winner: null };
      }
      const trick = state.currentTrick;
      trick.cards.push({ seat, card: action.card });
      hands[seat] = hand.filter((c) => c !== action.card);
      if (contract.suit !== "NT" && action.card[1] === contract.suit) state.trumpBroken = true;
      if (action.card === state.partnerCard) state.partnerRevealed = seat;

      if (trick.cards.length < 4) {
        state.turn = nextSeat(seat);
        break;
      }

      const winner = trickWinner(trick, contract.suit);
      trick.winner = winner;
      state.tricksWon[winner]++;
      state.tricksPlayed++;
      state.turn = winner;

      const result = roundResult(contract, secrets.partnerSeat!, state.tricksWon);
      if (result) {
        state.result = result;
        state.phase = "done";
        state.turn = null;
        state.partnerRevealed = secrets.partnerSeat;
      }
      break;
    }

    default:
      throw new GameError("Unknown action.");
  }

  return { state, secrets, hands };
}

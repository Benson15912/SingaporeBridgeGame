import { describe, expect, it } from "vitest";
import {
  applyAction,
  bidRank,
  canBid,
  deal,
  fullDeck,
  GameError,
  highCardPoints,
  legalPlays,
  newRound,
  SEATS,
  trickWinner,
  type Action,
  type Bid,
  type Hands,
  type Round,
  type Seat,
} from "..";

const b = (level: number, suit: Bid["suit"]): Action => ({ type: "bid", bid: { level, suit } });
const pass: Action = { type: "pass" };

/** Seat 0 all spades, 1 all hearts, 2 all diamonds, 3 all clubs. 10 HCP each, so no wash. */
const suitHands = (): Hands =>
  (["S", "H", "D", "C"] as const).map((s) => fullDeck().filter((c) => c[1] === s)) as Hands;

/** Every fourth card of the deck: each seat gets a mix of suits. */
const mixedHands = (): Hands => SEATS.map((s) => fullDeck().filter((_, i) => i % 4 === s)) as Hands;

function skipWash(round: Round): Round {
  let r = round;
  for (const s of [...r.state.washPending]) r = applyAction(r, s, { type: "no-wash" });
  return r;
}

function run(round: Round, steps: [Seat, Action][]): Round {
  return steps.reduce((r, [seat, action]) => applyAction(r, seat, action), round);
}

/** Seat 0 wins 1♠ (dealer 3, so seat 0 opens), then calls AH, owned by seat 1. */
function spadeContract(): Round {
  const r = run(newRound(3, suitHands()), [
    [0, b(1, "S")],
    [1, pass],
    [2, pass],
    [3, pass],
  ]);
  return applyAction(r, 0, { type: "call-partner", card: "AH" });
}

describe("cards", () => {
  it("deals 13 unique cards to each seat", () => {
    const hands = deal();
    expect(hands.every((h) => h.length === 13)).toBe(true);
    expect(new Set(hands.flat()).size).toBe(52);
  });

  it("counts high card points", () => {
    expect(highCardPoints(["AS", "KH", "QD", "JC", "TS"])).toBe(10);
  });
});

describe("bidding", () => {
  it("orders bids by level then suit", () => {
    expect(bidRank({ level: 1, suit: "NT" })).toBeLessThan(bidRank({ level: 2, suit: "C" }));
    expect(bidRank({ level: 1, suit: "S" })).toBeGreaterThan(bidRank({ level: 1, suit: "H" }));
    expect(canBid([{ seat: 0, bid: { level: 2, suit: "H" } }], { level: 2, suit: "D" })).toBe(false);
    expect(canBid([{ seat: 0, bid: { level: 2, suit: "H" } }], { level: 2, suit: "S" })).toBe(true);
  });

  it("starts left of the dealer and rejects out-of-turn bids", () => {
    const r = newRound(1, suitHands());
    expect(r.state.turn).toBe(2);
    expect(() => applyAction(r, 0, b(1, "C"))).toThrow(GameError);
  });

  it("rejects bids that are not higher", () => {
    const r = applyAction(newRound(3, suitHands()), 0, b(2, "H"));
    expect(() => applyAction(r, 1, b(2, "C"))).toThrow(GameError);
  });

  it("redeals when everyone passes", () => {
    const r = run(newRound(3, suitHands()), [
      [0, pass],
      [1, pass],
      [2, pass],
      [3, pass],
    ]);
    expect(r.state.bids).toEqual([]);
    expect(r.state.notice).toMatch(/passed/);
    expect(r.hands.flat().length).toBe(52);
  });

  it("lets a player who passed bid again, and ends after three passes", () => {
    const r = run(newRound(3, suitHands()), [
      [0, pass],
      [1, b(1, "H")],
      [2, pass],
      [3, pass],
      [0, b(2, "S")],
      [1, pass],
      [2, pass],
    ]);
    expect(r.state.phase).toBe("bidding");
    const done = applyAction(r, 3, pass);
    expect(done.state.phase).toBe("partner");
    expect(done.state.contract).toEqual({ level: 2, suit: "S", declarer: 0 });
    expect(done.state.turn).toBe(0);
  });
});

describe("partner", () => {
  it("can't call a card in your own hand", () => {
    const r = run(newRound(3, suitHands()), [
      [0, b(1, "S")],
      [1, pass],
      [2, pass],
      [3, pass],
    ]);
    expect(() => applyAction(r, 0, { type: "call-partner", card: "AS" })).toThrow(/own hand/);
  });

  it("keeps the partner secret, and the player left of declarer leads in a suit contract", () => {
    const r = spadeContract();
    expect(r.secrets.partnerSeat).toBe(1);
    expect(r.state.partnerRevealed).toBeNull();
    expect(r.state.turn).toBe(1);
  });

  it("the declarer leads in no trump", () => {
    const r = run(newRound(3, suitHands()), [
      [0, b(1, "NT")],
      [1, pass],
      [2, pass],
      [3, pass],
      [0, { type: "call-partner", card: "AH" }],
    ]);
    expect(r.state.turn).toBe(0);
  });

  it("reveals the partner when the called card is played", () => {
    const r = applyAction(spadeContract(), 1, { type: "play", card: "AH" });
    expect(r.state.partnerRevealed).toBe(1);
  });
});

describe("play", () => {
  it("enforces following suit", () => {
    const trick = { leader: 0 as Seat, cards: [{ seat: 0 as Seat, card: "2H" }], winner: null };
    expect(legalPlays(["3H", "AS", "KD"], trick, "S", false)).toEqual(["3H"]);
    expect(legalPlays(["AS", "KD"], trick, "S", false)).toEqual(["AS", "KD"]);
  });

  it("doesn't allow leading trump before it is broken, unless only trump is held", () => {
    expect(legalPlays(["AS", "2H"], null, "S", false)).toEqual(["2H"]);
    expect(legalPlays(["AS", "KS"], null, "S", false)).toEqual(["AS", "KS"]);
    expect(legalPlays(["AS", "2H"], null, "S", true)).toEqual(["AS", "2H"]);
    expect(legalPlays(["AS", "2H"], null, "NT", false)).toEqual(["AS", "2H"]);
  });

  it("picks the trick winner, with trump beating the led suit", () => {
    const cards = [
      { seat: 0 as Seat, card: "KH" },
      { seat: 1 as Seat, card: "AH" },
      { seat: 2 as Seat, card: "2S" },
      { seat: 3 as Seat, card: "AD" },
    ];
    expect(trickWinner({ leader: 0, cards, winner: null }, "S")).toBe(2);
    expect(trickWinner({ leader: 0, cards, winner: null }, "NT")).toBe(1);
  });

  it("rejects illegal plays through applyAction", () => {
    let r = newRound(3, mixedHands());
    r = skipWash(r);
    r = run(r, [
      [0, b(1, "NT")],
      [1, pass],
      [2, pass],
      [3, pass],
    ]);
    const callable = r.hands[1][0];
    r = applyAction(r, 0, { type: "call-partner", card: callable });
    const lead = r.hands[0][0];
    r = applyAction(r, 0, { type: "play", card: lead });
    const offSuit = r.hands[1].find((c) => c[1] !== lead[1]);
    const onSuit = r.hands[1].find((c) => c[1] === lead[1]);
    expect(onSuit).toBeDefined();
    expect(() => applyAction(r, 1, { type: "play", card: offSuit! })).toThrow(/follow suit/);
    expect(() => applyAction(r, 2, { type: "play", card: r.hands[2][0] })).toThrow(/turn/);
    expect(() => applyAction(r, 1, { type: "play", card: r.hands[0][1] })).toThrow(/hold/);
  });

  it("ruffing breaks trump, the winner leads next, and the round ends once decided", () => {
    // 1♠ by seat 0 needs 7 tricks. Seat 1 (partner) leads hearts; seat 0 ruffs every time.
    let r = spadeContract();
    for (let i = 0; i < 7; i++) {
      const leader = r.state.turn!;
      expect(leader).toBe(i === 0 ? 1 : 0);
      if (i === 0) {
        r = run(r, [
          [1, { type: "play", card: r.hands[1][0] }],
          [2, { type: "play", card: r.hands[2][0] }],
          [3, { type: "play", card: r.hands[3][0] }],
          [0, { type: "play", card: r.hands[0][r.hands[0].length - 1] }],
        ]);
        expect(r.state.trumpBroken).toBe(true);
        expect(r.state.currentTrick!.winner).toBe(0);
      } else {
        r = run(r, [
          [0, { type: "play", card: r.hands[0][0] }],
          [1, { type: "play", card: r.hands[1][0] }],
          [2, { type: "play", card: r.hands[2][0] }],
          [3, { type: "play", card: r.hands[3][0] }],
        ]);
      }
    }
    expect(r.state.phase).toBe("done");
    expect(r.state.tricksPlayed).toBe(7);
    expect(r.state.result).toMatchObject({ declarerWon: true, declarerSide: [0, 1], declarerTricks: 7 });
  });
});

describe("wash", () => {
  const weak = (): Hands => {
    // Seat 0: 2-9 of every suit plus one ten: zero points.
    const low = fullDeck().filter((c) => "23456789".includes(c[0])).slice(0, 13);
    const rest = fullDeck().filter((c) => !low.includes(c));
    return [low, rest.slice(0, 13), rest.slice(13, 26), rest.slice(26, 39)];
  };

  it("asks all four seats so a weak hand isn't revealed", () => {
    const r = newRound(0, weak());
    expect(r.state.phase).toBe("wash");
    expect(r.state.washPending).toEqual([0, 1, 2, 3]);
  });

  it("only a weak hand may wash, and a wash redeals", () => {
    const r = newRound(0, weak());
    expect(() => applyAction(r, 1, { type: "wash" })).toThrow(GameError);
    const redealt = applyAction(r, 0, { type: "wash" });
    expect(redealt.state.notice).toMatch(/wash/);
    expect(redealt.hands[0]).not.toEqual(r.hands[0]);
  });

  it("moves to bidding when everyone declines", () => {
    const r = skipWash(newRound(0, weak()));
    expect(r.state.phase).toBe("bidding");
    expect(r.state.turn).toBe(1);
  });

  it("skips the wash phase when nobody can wash", () => {
    expect(newRound(0, suitHands()).state.phase).toBe("bidding");
  });
});

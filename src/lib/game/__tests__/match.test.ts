import { describe, expect, it } from "vitest";
import { matchWinnerSeat } from "..";
import { computeInsights } from "../../insights";

describe("matchWinnerSeat", () => {
  it("needs someone at the target", () => {
    expect(matchWinnerSeat({ 0: 29, 1: 10, 2: 0, 3: 4 }, 30)).toBeNull();
    expect(matchWinnerSeat({ 0: 31, 1: 10, 2: 0, 3: 4 }, 30)).toBe(0);
  });
  it("highest score wins when several cross the line, and a dead heat plays on", () => {
    expect(matchWinnerSeat({ 0: 31, 1: 33, 2: 0, 3: 4 }, 30)).toBe(1);
    expect(matchWinnerSeat({ 0: 32, 1: 32, 2: 0, 3: 4 }, 30)).toBeNull();
  });
});

describe("computeInsights", () => {
  const row = (declarer: string, partner: string, won: boolean, round_no: number) => ({
    room_id: "r",
    round_no,
    declarer_id: declarer,
    partner_id: partner,
    level: 3,
    suit: "H",
    declarer_won: won,
    declarer_tricks: 9,
  });
  it("tallies roles and pairings", () => {
    const i = computeInsights([row("a", "b", true, 1), row("c", "b", true, 2), row("a", "b", false, 3)], ["a", "b", "c", "d"]);
    const b = i.players.find((p) => p.userId === "b")!;
    expect(b.partner).toEqual({ played: 3, won: 2 });
    expect(i.players.find((p) => p.userId === "d")!.defender).toEqual({ played: 3, won: 1 });
    expect(i.bestPartners[0].userId).toBe("b");
    expect(i.duos[0]).toEqual({ a: "b", b: "c", tally: { played: 1, won: 1 } });
  });
});

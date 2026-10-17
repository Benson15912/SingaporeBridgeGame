import { SEATS } from "./cards";
import type { Contract, RoundResult, Seat } from "./types";

export const tricksNeeded = (level: number) => 6 + level;
export const defenderTricksNeeded = (level: number) => 13 - tricksNeeded(level) + 1;

/** Returns the result as soon as either side has reached its target, otherwise null. */
export function roundResult(
  contract: Contract,
  partnerSeat: Seat,
  tricksWon: readonly number[],
): RoundResult | null {
  const declarerSide = [...new Set([contract.declarer, partnerSeat])] as Seat[];
  const defenders = SEATS.filter((s) => !declarerSide.includes(s));
  const declarerTricks = declarerSide.reduce<number>((n, s) => n + tricksWon[s], 0);
  const defenderTricks = defenders.reduce<number>((n, s) => n + tricksWon[s], 0);
  const base = { declarerSide, defenders, declarerTricks, defenderTricks };
  if (declarerTricks >= tricksNeeded(contract.level)) return { ...base, declarerWon: true };
  if (defenderTricks >= defenderTricksNeeded(contract.level)) return { ...base, declarerWon: false };
  return null;
}

/** Points each player on the winning side earns for a round. */
export const pointsForWin = (contract: Contract) => contract.level;

/** The seat that has reached the target with a strictly highest score, or null if the match goes on. */
export function matchWinnerSeat(points: Record<number, number>, target: number): Seat | null {
  const ranked = Object.entries(points)
    .map(([seat, p]) => ({ seat: Number(seat) as Seat, p }))
    .sort((a, b) => b.p - a.p);
  if (!ranked.length || ranked[0].p < target) return null;
  if (ranked[1] && ranked[1].p === ranked[0].p) return null; // dead heat: play on
  return ranked[0].seat;
}

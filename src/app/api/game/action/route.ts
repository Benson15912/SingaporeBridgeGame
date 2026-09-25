import { applyAction, isCard, isValidBid, pointsForWin, type Action } from "@/lib/game";
import { commitRound, getMembership, HttpError, loadRound, route, VersionConflict } from "@/lib/server/rooms";

function parseAction(raw: unknown): Action {
  const a = (raw ?? {}) as Record<string, unknown>;
  switch (a.type) {
    case "wash":
    case "no-wash":
    case "pass":
      return { type: a.type };
    case "bid":
      if (!isValidBid(a.bid)) throw new HttpError(400, "Invalid bid.");
      return { type: "bid", bid: { level: a.bid.level, suit: a.bid.suit } };
    case "call-partner":
    case "play":
      if (!isCard(a.card)) throw new HttpError(400, "Invalid card.");
      return { type: a.type, card: a.card };
    default:
      throw new HttpError(400, "Unknown action.");
  }
}

export const POST = route(async (body, userId) => {
  const action = parseAction(body.action);
  const { room, players, me } = await getMembership(body.code, userId);
  if (room.status !== "playing") throw new HttpError(409, "No game in progress.");

  for (let attempt = 0; attempt < 3; attempt++) {
    const { round, version, roundNo } = await loadRound(room.id);
    const next = applyAction(round, me.seat, action);

    let scores;
    if (next.state.result && !round.state.result) {
      const { declarerWon, declarerSide, defenders } = next.state.result;
      const winners = declarerWon ? declarerSide : defenders;
      const points = pointsForWin(next.state.contract!);
      scores = players.map((p) => {
        const won = winners.includes(p.seat);
        return { user_id: p.user_id, points: won ? points : 0, won: won ? 1 : 0 };
      });
    }

    try {
      await commitRound({ roomId: room.id, expectedVersion: version, roundNo, round: next, players, scores });
      return;
    } catch (err) {
      if (!(err instanceof VersionConflict)) throw err;
    }
  }
  throw new HttpError(409, "The table changed. Try again.");
});

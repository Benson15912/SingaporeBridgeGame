import { applyAction, isCard, isValidBid, matchWinnerSeat, pointsForWin, type Action } from "@/lib/game";
import { DEFAULT_TARGET } from "@/lib/rows";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PlayerRow } from "@/lib/rows";
import type { Round } from "@/lib/game";
import { commitRound, getTable, HttpError, loadRound, route, toRound, VersionConflict } from "@/lib/server/rooms";

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
  const { room, players, me, rows } = await getTable(body.code, userId);
  if (room.status !== "playing") throw new HttpError(409, "No game in progress.");

  for (let attempt = 0; attempt < 3; attempt++) {
    // First attempt reuses the rows we already fetched; only a version conflict needs a reload.
    const { round, version, roundNo } = attempt === 0 ? toRound(rows) : await loadRound(room.id);
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

      // Did this round take someone to the target?
      const { data: current } = await supabaseAdmin().from("scores").select("user_id, points").eq("room_id", room.id);
      const total: Record<number, number> = {};
      for (const p of players) {
        const before = current?.find((s) => s.user_id === p.user_id)?.points ?? 0;
        total[p.seat] = before + (scores.find((s) => s.user_id === p.user_id)?.points ?? 0);
      }
      next.state.result.matchWinner = matchWinnerSeat(total, room.target_score ?? DEFAULT_TARGET);
    }

    try {
      await commitRound({ roomId: room.id, expectedVersion: version, roundNo, round: next, players, scores });
      if (scores) await recordRound(room.id, roundNo, next, players);
      return;
    } catch (err) {
      if (!(err instanceof VersionConflict)) throw err;
    }
  }
  throw new HttpError(409, "The table changed. Try again.");
});

/** Stores the finished round for the partner insights and credits a match win. Never blocks the game. */
async function recordRound(roomId: string, roundNo: number, round: Round, players: PlayerRow[]) {
  try {
    const db = supabaseAdmin();
    const { state, secrets } = round;
    const c = state.contract!;
    const result = state.result!;
    const userAt = (seat: number | null) => players.find((p) => p.seat === seat)?.user_id;
    const declarer = userAt(c.declarer);
    const partner = userAt(secrets.partnerSeat);
    if (declarer && partner) {
      await db.from("round_history").upsert(
        {
          room_id: roomId,
          round_no: roundNo,
          declarer_id: declarer,
          partner_id: partner,
          level: c.level,
          suit: c.suit,
          declarer_won: result.declarerWon,
          declarer_tricks: result.declarerTricks,
        },
        { onConflict: "room_id,round_no", ignoreDuplicates: true },
      );
    }
    const winner = userAt(result.matchWinner ?? null);
    if (winner) {
      const { data } = await db.from("scores").select("matches_won").eq("room_id", roomId).eq("user_id", winner).maybeSingle();
      await db
        .from("scores")
        .update({ matches_won: (data?.matches_won ?? 0) + 1 })
        .eq("room_id", roomId)
        .eq("user_id", winner);
    }
  } catch (err) {
    console.error("recordRound failed", err);
  }
}

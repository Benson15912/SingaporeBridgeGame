import { newRound, nextSeat } from "@/lib/game";
import {
  commitRound,
  getMembership,
  HttpError,
  loadRound,
  requireFullTable,
  route,
  VersionConflict,
} from "@/lib/server/rooms";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Host starts a fresh match after someone reached the target: scores go back to zero. */
export const POST = route(async (body, userId) => {
  const { room, players } = await getMembership(body.code, userId);
  if (room.host_id !== userId) throw new HttpError(403, "Only the host can start a new match.");
  if (room.status !== "playing") throw new HttpError(409, "No game in progress.");
  requireFullTable(players);
  const { round, version, roundNo } = await loadRound(room.id);
  if (round.state.result?.matchWinner == null) throw new HttpError(409, "The match isn't over yet.");

  const dealer = nextSeat(round.state.dealer);
  try {
    await commitRound({ roomId: room.id, expectedVersion: version, roundNo: roundNo + 1, round: newRound(dealer), players });
  } catch (err) {
    if (err instanceof VersionConflict) return;
    throw err;
  }
  const db = supabaseAdmin();
  await db.from("scores").update({ points: 0 }).eq("room_id", room.id);
  await db.from("rooms").update({ dealer_seat: dealer, round_no: roundNo + 1 }).eq("id", room.id);
});

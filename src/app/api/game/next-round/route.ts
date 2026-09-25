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

export const POST = route(async (body, userId) => {
  const { room, players } = await getMembership(body.code, userId);
  if (room.status !== "playing") throw new HttpError(409, "No game in progress.");
  requireFullTable(players);
  const { round, version, roundNo } = await loadRound(room.id);
  if (round.state.phase !== "done") throw new HttpError(409, "This round isn't finished yet.");

  const dealer = nextSeat(round.state.dealer);
  try {
    // expectedVersion stops two players clicking at once from dealing twice.
    await commitRound({ roomId: room.id, expectedVersion: version, roundNo: roundNo + 1, round: newRound(dealer), players });
  } catch (err) {
    if (err instanceof VersionConflict) return;
    throw err;
  }
  await supabaseAdmin().from("rooms").update({ dealer_seat: dealer, round_no: roundNo + 1 }).eq("id", room.id);
});

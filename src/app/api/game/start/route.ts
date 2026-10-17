import { newRound } from "@/lib/game";
import { DEFAULT_TARGET } from "@/lib/rows";
import { commitRound, getMembership, HttpError, requireFullTable, route } from "@/lib/server/rooms";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const POST = route(async (body, userId) => {
  const { room, players } = await getMembership(body.code, userId);
  if (room.host_id !== userId) throw new HttpError(403, "Only the host can start the game.");
  if (room.status !== "lobby") throw new HttpError(409, "The game has already started.");
  requireFullTable(players);

  // A finished match (someone at the target) starts the next one from zero.
  const db = supabaseAdmin();
  const { data: scores } = await db.from("scores").select("points").eq("room_id", room.id);
  if ((scores ?? []).some((s) => s.points >= (room.target_score ?? DEFAULT_TARGET))) {
    await db.from("scores").update({ points: 0 }).eq("room_id", room.id);
  }

  const roundNo = room.round_no + 1;
  await commitRound({ roomId: room.id, expectedVersion: null, roundNo, round: newRound(room.dealer_seat), players });
  const { error } = await supabaseAdmin().from("rooms").update({ status: "playing", round_no: roundNo }).eq("id", room.id);
  if (error) throw new Error(error.message);
});

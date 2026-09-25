import { newRound } from "@/lib/game";
import { commitRound, getMembership, HttpError, requireFullTable, route } from "@/lib/server/rooms";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const POST = route(async (body, userId) => {
  const { room, players } = await getMembership(body.code, userId);
  if (room.host_id !== userId) throw new HttpError(403, "Only the host can start the game.");
  if (room.status !== "lobby") throw new HttpError(409, "The game has already started.");
  requireFullTable(players);

  const roundNo = room.round_no + 1;
  await commitRound({ roomId: room.id, expectedVersion: null, roundNo, round: newRound(room.dealer_seat), players });
  const { error } = await supabaseAdmin().from("rooms").update({ status: "playing", round_no: roundNo }).eq("id", room.id);
  if (error) throw new Error(error.message);
});

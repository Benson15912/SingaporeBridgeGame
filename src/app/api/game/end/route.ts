import { getMembership, HttpError, route } from "@/lib/server/rooms";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Host sends everyone back to the lobby (e.g. to swap seats or players). Scores are kept. */
export const POST = route(async (body, userId) => {
  const { room } = await getMembership(body.code, userId);
  if (room.host_id !== userId) throw new HttpError(403, "Only the host can end the game.");
  await supabaseAdmin().from("rooms").update({ status: "lobby" }).eq("id", room.id);
});

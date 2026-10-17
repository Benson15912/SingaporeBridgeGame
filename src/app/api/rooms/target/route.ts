import { TARGET_MAX, TARGET_MIN } from "@/lib/rows";
import { getMembership, HttpError, route } from "@/lib/server/rooms";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Host picks the score a player must reach to win the match. */
export const POST = route(async (body, userId) => {
  const { room } = await getMembership(body.code, userId);
  if (room.host_id !== userId) throw new HttpError(403, "Only the host can set the target.");
  if (room.status !== "lobby") throw new HttpError(409, "The target can only change in the lobby.");
  const target = Math.round(Number(body.target));
  if (!Number.isFinite(target) || target < TARGET_MIN || target > TARGET_MAX) {
    throw new HttpError(400, `Target must be between ${TARGET_MIN} and ${TARGET_MAX}.`);
  }
  const { error } = await supabaseAdmin().from("rooms").update({ target_score: target }).eq("id", room.id);
  if (error) throw new Error(error.message);
});

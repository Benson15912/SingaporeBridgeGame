import { getMembership, HttpError, route } from "@/lib/server/rooms";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const POST = route(async (body, userId) => {
  const { room, players } = await getMembership(body.code, userId);
  const seat = Number(body.seat);
  if (![0, 1, 2, 3].includes(seat)) throw new HttpError(400, "Invalid seat.");
  if (room.status !== "lobby") throw new HttpError(409, "You can only change seats in the lobby.");
  if (players.some((p) => p.seat === seat)) throw new HttpError(409, "That seat is taken.");
  const { error } = await supabaseAdmin()
    .from("room_players")
    .update({ seat })
    .eq("room_id", room.id)
    .eq("user_id", userId);
  if (error?.code === "23505") throw new HttpError(409, "That seat is taken.");
  if (error) throw new Error(error.message);
});

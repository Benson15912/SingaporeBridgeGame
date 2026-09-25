import { parseNickname, randomCode, route } from "@/lib/server/rooms";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const POST = route(async (body, userId) => {
  const nickname = parseNickname(body.nickname);
  const db = supabaseAdmin();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const { data: room, error } = await db.from("rooms").insert({ code, host_id: userId }).select("id").single();
    if (error?.code === "23505") continue; // code already taken
    if (error) throw new Error(error.message);
    const { error: seatError } = await db
      .from("room_players")
      .insert({ room_id: room.id, user_id: userId, nickname, seat: 0 });
    if (seatError) throw new Error(seatError.message);
    return { code };
  }
  throw new Error("Couldn't generate a room code.");
});

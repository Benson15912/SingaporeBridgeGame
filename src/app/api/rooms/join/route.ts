import type { Seat } from "@/lib/game";
import { getPlayers, getRoom, HttpError, parseNickname, route } from "@/lib/server/rooms";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const POST = route(async (body, userId) => {
  const nickname = parseNickname(body.nickname);
  const room = await getRoom(body.code);
  const db = supabaseAdmin();

  for (let attempt = 0; attempt < 3; attempt++) {
    const players = await getPlayers(room.id);
    if (players.some((p) => p.user_id === userId)) {
      await db.from("room_players").update({ nickname }).eq("room_id", room.id).eq("user_id", userId);
      return { code: room.code };
    }
    const taken = new Set(players.map((p) => p.seat));
    const seat = ([0, 1, 2, 3] as Seat[]).find((s) => !taken.has(s));
    if (seat === undefined) throw new HttpError(409, "This room is full.");
    const { error } = await db.from("room_players").insert({ room_id: room.id, user_id: userId, nickname, seat });
    if (error?.code === "23505") continue; // someone grabbed the seat first
    if (error) throw new Error(error.message);
    return { code: room.code };
  }
  throw new HttpError(409, "Couldn't find a free seat. Try again.");
});

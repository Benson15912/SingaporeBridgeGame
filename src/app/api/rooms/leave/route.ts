import { getMembership, route } from "@/lib/server/rooms";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Leaving mid-game sends the others back to the lobby to wait for a replacement. */
export const POST = route(async (body, userId) => {
  const { room, players } = await getMembership(body.code, userId);
  const db = supabaseAdmin();
  const remaining = players.filter((p) => p.user_id !== userId);

  if (remaining.length === 0) {
    await db.from("rooms").delete().eq("id", room.id);
    return;
  }
  await db.from("room_players").delete().eq("room_id", room.id).eq("user_id", userId);
  // Always touch the room row: Realtime doesn't deliver filtered DELETE events, so this is how
  // the others find out someone left.
  await db
    .from("rooms")
    .update({
      host_id: room.host_id === userId ? remaining[0].user_id : room.host_id,
      status: "lobby",
    })
    .eq("id", room.id);
});

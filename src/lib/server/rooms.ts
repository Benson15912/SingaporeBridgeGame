import "server-only";
import { NextResponse } from "next/server";
import { GameError, type Hands, type Round, type Seat } from "@/lib/game";
import { CODE_ALPHABET, CODE_LENGTH, NICKNAME_MAX, normaliseCode, type GameRow, type PlayerRow, type RoomRow } from "@/lib/rows";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Wraps a POST handler: parses JSON, resolves the signed-in user, maps errors to JSON responses. */
export function route<T>(fn: (body: Record<string, unknown>, userId: string) => Promise<T>) {
  return async (req: Request) => {
    try {
      const supabase = await supabaseServer();
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new HttpError(401, "Not signed in. Refresh the page and try again.");
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      return NextResponse.json((await fn(body, data.user.id)) ?? { ok: true });
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
      if (err instanceof GameError) return NextResponse.json({ error: err.message }, { status: 400 });
      console.error(err);
      return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
    }
  };
}

export function parseNickname(value: unknown): string {
  const nickname = typeof value === "string" ? value.trim().slice(0, NICKNAME_MAX) : "";
  if (!nickname) throw new HttpError(400, "Enter a nickname.");
  return nickname;
}

export function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

function must<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

export async function getRoom(code: unknown): Promise<RoomRow> {
  const normalised = typeof code === "string" ? normaliseCode(code) : "";
  const room = must(await supabaseAdmin().from("rooms").select("*").eq("code", normalised).maybeSingle<RoomRow>());
  if (!room) throw new HttpError(404, "Room not found. Check the code.");
  return room;
}

export async function getPlayers(roomId: string): Promise<PlayerRow[]> {
  return must(
    await supabaseAdmin().from("room_players").select("*").eq("room_id", roomId).order("joined_at").returns<PlayerRow[]>(),
  );
}

/** Loads the room and confirms the caller has a seat in it. */
export async function getMembership(code: unknown, userId: string) {
  const room = await getRoom(code);
  const players = await getPlayers(room.id);
  const me = players.find((p) => p.user_id === userId);
  if (!me) throw new HttpError(403, "You're not in this room.");
  return { room, players, me };
}

export async function loadRound(roomId: string): Promise<{ round: Round; version: number; roundNo: number }> {
  const db = supabaseAdmin();
  const [game, secrets, hands] = await Promise.all([
    db.from("games").select("*").eq("room_id", roomId).maybeSingle<GameRow>(),
    db.from("game_secrets").select("secrets").eq("room_id", roomId).maybeSingle(),
    db.from("hands").select("seat, cards").eq("room_id", roomId),
  ]);
  const g = must(game);
  if (!g) throw new HttpError(409, "No game in progress.");
  const handRows = must(hands) as { seat: Seat; cards: string[] }[];
  const handArr: Hands = [[], [], [], []];
  for (const h of handRows) handArr[h.seat] = h.cards;
  return {
    round: { state: g.state, secrets: must(secrets)?.secrets ?? { partnerSeat: null }, hands: handArr },
    version: g.version,
    roundNo: g.round_no,
  };
}

export class VersionConflict extends Error {}

export async function commitRound(opts: {
  roomId: string;
  expectedVersion: number | null;
  roundNo: number;
  round: Round;
  players: PlayerRow[];
  scores?: { user_id: string; points: number; won: number }[];
}) {
  const bySeat = new Map(opts.players.map((p) => [p.seat, p.user_id]));
  const { error } = await supabaseAdmin().rpc("commit_round", {
    p_room: opts.roomId,
    p_expected_version: opts.expectedVersion,
    p_round_no: opts.roundNo,
    p_state: opts.round.state,
    p_secrets: opts.round.secrets,
    p_hands: opts.round.hands.map((cards, seat) => ({ seat, user_id: bySeat.get(seat as Seat), cards })),
    p_scores: opts.scores ?? null,
  });
  if (error) {
    if (error.message.includes("version_conflict")) throw new VersionConflict();
    throw new Error(error.message);
  }
}

export function requireFullTable(players: PlayerRow[]) {
  if (players.length !== 4) throw new HttpError(409, "Waiting for 4 players.");
}

"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Card } from "@/lib/game";
import type { ChatRow, GameRow, PlayerRow, RoomRow, ScoreRow } from "@/lib/rows";
import { normaliseCode } from "@/lib/rows";
import { ensureSession, supabaseBrowser } from "@/lib/supabase/client";

export interface RoomData {
  room: RoomRow;
  players: PlayerRow[];
  game: GameRow | null;
  hand: Card[];
  scores: ScoreRow[];
  chat: ChatRow[];
}

export type RoomStatus =
  | { kind: "loading" }
  | { kind: "not-member" }
  | { kind: "error"; message: string }
  | { kind: "ready"; userId: string; data: RoomData; online: Set<string> };

/** Loads everything the caller may see in a room and keeps it live via Supabase Realtime. */
export function useRoom(rawCode: string) {
  const code = normaliseCode(rawCode);
  const [userId, setUserId] = useState<string | null>(null);
  const [data, setData] = useState<RoomData | null>(null);
  const [status, setStatus] = useState<"loading" | "not-member" | "error" | "ready">("loading");
  const [error, setError] = useState("");
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [reloadKey, setReloadKey] = useState(0);
  const roomIdRef = useRef<string | null>(null);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // Fetchers for each slice of room data.
  const fetchers = useCallback((roomId: string, uid: string) => {
    const db = supabaseBrowser();
    return {
      room: async () =>
        (await db.from("rooms").select("*").eq("id", roomId).maybeSingle<RoomRow>()).data ?? null,
      players: async () =>
        (await db.from("room_players").select("*").eq("room_id", roomId).order("seat").returns<PlayerRow[]>()).data ??
        [],
      game: async () =>
        (await db.from("games").select("*").eq("room_id", roomId).maybeSingle<GameRow>()).data ?? null,
      hand: async () =>
        ((await db.from("hands").select("cards").eq("room_id", roomId).eq("user_id", uid).maybeSingle()).data
          ?.cards as Card[]) ?? [],
      scores: async () =>
        (await db.from("scores").select("*").eq("room_id", roomId).returns<ScoreRow[]>()).data ?? [],
      chat: async () =>
        (
          (
            await db
              .from("chat_messages")
              .select("*")
              .eq("room_id", roomId)
              .order("created_at", { ascending: false })
              .limit(100)
              .returns<ChatRow[]>()
          ).data ?? []
        ).reverse(),
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    const db = supabaseBrowser();

    (async () => {
      try {
        const uid = await ensureSession();
        if (cancelled) return;
        setUserId(uid);

        // RLS only returns the room if we have a seat in it.
        const { data: room } = await db.from("rooms").select("*").eq("code", code).maybeSingle<RoomRow>();
        if (cancelled) return;
        if (!room) {
          setStatus("not-member");
          return;
        }
        roomIdRef.current = room.id;
        const f = fetchers(room.id, uid);
        const [players, game, hand, scores, chat] = await Promise.all([
          f.players(),
          f.game(),
          f.hand(),
          f.scores(),
          f.chat(),
        ]);
        if (cancelled) return;
        setData({ room, players, game, hand, scores, chat });
        setStatus("ready");

        const refresh = async <K extends keyof RoomData>(key: K) => {
          const value = (await f[key]()) as RoomData[K];
          if (cancelled) return;
          if (key === "room" && !value) {
            setStatus("not-member");
            return;
          }
          setData((d) => (d ? { ...d, [key]: value } : d));
        };

        const filter = `room_id=eq.${room.id}`;
        channel = db
          .channel(`room:${room.id}`, { config: { presence: { key: uid } } })
          .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${room.id}` }, () => {
            refresh("room");
            refresh("players"); // someone leaving shows up as a room update
          })
          .on("postgres_changes", { event: "*", schema: "public", table: "room_players", filter }, () => {
            refresh("players");
            refresh("room"); // being removed means we lose access
          })
          .on("postgres_changes", { event: "*", schema: "public", table: "games", filter }, (payload) => {
            const row = payload.new as GameRow | undefined;
            if (row?.state) setData((d) => (d ? { ...d, game: row } : d));
            else refresh("game");
          })
          .on("postgres_changes", { event: "*", schema: "public", table: "hands", filter }, () => refresh("hand"))
          .on("postgres_changes", { event: "*", schema: "public", table: "scores", filter }, () => refresh("scores"))
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "chat_messages", filter },
            (payload) => {
              const msg = payload.new as ChatRow;
              setData((d) =>
                d && !d.chat.some((m) => m.id === msg.id) ? { ...d, chat: [...d.chat, msg].slice(-100) } : d,
              );
            },
          )
          .on("presence", { event: "sync" }, () => {
            setOnline(new Set(Object.keys(channel!.presenceState())));
          })
          .subscribe((state) => {
            if (state === "SUBSCRIBED") {
              channel!.track({ at: Date.now() });
              // Catch anything that changed between the first load and subscribing.
              (["room", "players", "game", "hand", "scores"] as const).forEach(refresh);
            }
          });
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (channel) db.removeChannel(channel);
    };
  }, [code, fetchers, reloadKey]);

  // Resync after the tab has been in the background (mobile browsers drop sockets).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && roomIdRef.current) reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reload]);

  const result: RoomStatus =
    status === "ready" && data && userId
      ? { kind: "ready", userId, data, online }
      : status === "error"
        ? { kind: "error", message: error }
        : status === "not-member"
          ? { kind: "not-member" }
          : { kind: "loading" };

  return { status: result, reload, code };
}

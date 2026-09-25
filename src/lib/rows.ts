import type { Card, GameState, Seat } from "./game";

/** Shapes of the Supabase rows, shared by client and server. */
export interface RoomRow {
  id: string;
  code: string;
  host_id: string;
  status: "lobby" | "playing";
  dealer_seat: Seat;
  round_no: number;
}

export interface PlayerRow {
  room_id: string;
  user_id: string;
  nickname: string;
  seat: Seat;
  joined_at: string;
}

export interface GameRow {
  room_id: string;
  round_no: number;
  state: GameState;
  version: number;
}

export interface HandRow {
  room_id: string;
  seat: Seat;
  user_id: string;
  cards: Card[];
}

export interface ScoreRow {
  room_id: string;
  user_id: string;
  points: number;
  games_won: number;
}

export interface ChatRow {
  id: number;
  room_id: string;
  user_id: string;
  nickname: string;
  body: string;
  created_at: string;
}

export const NICKNAME_MAX = 20;
export const CODE_LENGTH = 6;
/** No 0/O, 1/I/L, so codes are easy to read aloud. */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const normaliseCode = (code: string) => code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

import type { Card, GameState, Seat } from "./game";

/** Shapes of the Supabase rows, shared by client and server. */
export interface RoomRow {
  id: string;
  code: string;
  host_id: string;
  status: "lobby" | "playing";
  dealer_seat: Seat;
  round_no: number;
  /** First player to reach this many points wins the match. */
  target_score?: number;
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
  matches_won?: number;
}

export interface HistoryRow {
  room_id: string;
  round_no: number;
  declarer_id: string;
  partner_id: string;
  level: number;
  suit: string;
  declarer_won: boolean;
  declarer_tricks: number;
}

export const DEFAULT_TARGET = 30;
export const TARGET_MIN = 5;
export const TARGET_MAX = 200;

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

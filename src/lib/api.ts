"use client";

import { ensureSession } from "./supabase/client";

/** POST to one of our API routes. Throws an Error with the server's message on failure. */
export async function api<T = { ok: true }>(path: string, body: unknown): Promise<T> {
  await ensureSession();
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed.");
  return data as T;
}

const NICK_KEY = "fb.nickname";
export const loadNickname = () => {
  try {
    return localStorage.getItem(NICK_KEY) ?? "";
  } catch {
    return "";
  }
};
export const saveNickname = (name: string) => {
  try {
    localStorage.setItem(NICK_KEY, name);
  } catch {}
};

"use client";

import { ensureSession, supabaseBrowser } from "./supabase/client";

/** POST to one of our API routes. Throws an Error with the server's message on failure. */
export async function api<T = { ok: true }>(path: string, body: unknown): Promise<T> {
  const send = async () => {
    await ensureSession();
    return fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  };
  let res = await send();
  if (res.status === 401) {
    // The guest account was removed by the idle cleanup: start a fresh one and retry once.
    await supabaseBrowser().auth.signOut({ scope: "local" });
    res = await send();
  }
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

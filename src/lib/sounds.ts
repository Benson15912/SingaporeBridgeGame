"use client";

/**
 * Sound effects. To replace one, drop a file into public/sounds/ and point its entry here
 * (any format browsers play: .mp3, .wav, .ogg, .m4a). Set `src: null` to silence an event.
 * `volume` is 0–1.
 */
export const SOUNDS = {
  cardPlay: { src: "/sounds/card-play.wav", volume: 0.7 }, // any card hits the table
  select: { src: "/sounds/select.wav", volume: 0.5 }, // picking a partner card
  bid: { src: "/sounds/bid.wav", volume: 0.5 }, // someone bids or passes
  deal: { src: "/sounds/deal.wav", volume: 0.6 }, // new hand dealt (incl. redeals)
  trickWon: { src: "/sounds/trick-won.wav", volume: 0.5 }, // a trick is completed
  yourTurn: { src: "/sounds/your-turn.wav", volume: 0.6 }, // it becomes your turn
  partnerReveal: { src: "/sounds/partner-reveal.wav", volume: 0.6 }, // the called card is played
  win: { src: "/sounds/win.wav", volume: 0.7 }, // your side won the round
  lose: { src: "/sounds/lose.wav", volume: 0.7 }, // your side lost the round
  chat: { src: "/sounds/chat.wav", volume: 0.4 }, // chat message from someone else
} satisfies Record<string, { src: string | null; volume: number }>;

export type SoundName = keyof typeof SOUNDS;

const MUTE_KEY = "fb.muted";
const cache = new Map<SoundName, HTMLAudioElement>();
let muted: boolean | null = null;
const listeners = new Set<(muted: boolean) => void>();

export function isMuted(): boolean {
  if (muted === null) {
    try {
      muted = localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      muted = false;
    }
  }
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {}
  listeners.forEach((fn) => fn(value));
}

export function onMuteChange(fn: (muted: boolean) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function playSound(name: SoundName) {
  const { src, volume } = SOUNDS[name] as { src: string | null; volume: number };
  if (!src || isMuted() || typeof Audio === "undefined") return;
  let base = cache.get(name);
  if (!base) {
    base = new Audio(src);
    base.preload = "auto";
    cache.set(name, base);
  }
  // Clone so the same sound can overlap (e.g. cards played in quick succession).
  const audio = base.cloneNode() as HTMLAudioElement;
  audio.volume = volume;
  // Browsers block audio until the user has interacted with the page; that's fine to ignore.
  audio.play().catch(() => {});
}

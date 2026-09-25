// Generates the default sound effects in public/sounds/ as small WAV files.
// Run: node scripts/generate-sounds.mjs
// These are just placeholders: drop your own files into public/sounds/ (same names),
// or point src/lib/sounds.ts at different files.

import { mkdirSync, writeFileSync } from "node:fs";

const RATE = 22050;
const OUT = new URL("../public/sounds/", import.meta.url);

/** Renders `seconds` of audio from a per-sample function f(t) in [-1, 1]. */
function render(seconds, f) {
  const n = Math.floor(seconds * RATE);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = f(i / RATE);
  return out;
}

function mix(...tracks) {
  const n = Math.max(...tracks.map(([, s]) => Math.floor(s * RATE) + 1), ...tracks.map(([t, s]) => t.length + Math.floor(s * RATE)));
  const out = new Float32Array(n);
  for (const [track, start] of tracks) {
    const offset = Math.floor(start * RATE);
    for (let i = 0; i < track.length; i++) out[offset + i] += track[i];
  }
  return out;
}

// Deterministic noise so regenerating gives identical files.
let seed = 1;
const noise = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return (seed / 0x7fffffff) * 2 - 1;
};

/** Low-passed noise burst: a card snapping onto felt. */
function snap(len = 0.07, cutoff = 0.35, gain = 0.9) {
  let y = 0;
  return render(len, (t) => {
    y += cutoff * (noise() - y);
    const env = Math.exp(-t * 70);
    const thump = Math.sin(2 * Math.PI * 140 * t) * Math.exp(-t * 60) * 0.5;
    return (y * 1.6 + thump) * env * gain;
  });
}

/** Bell-ish tone with a few harmonics and exponential decay. */
function bell(freq, len = 0.6, gain = 0.35, decay = 5) {
  return render(len, (t) => {
    const attack = Math.min(1, t / 0.005);
    const env = attack * Math.exp(-t * decay);
    const tone =
      Math.sin(2 * Math.PI * freq * t) +
      0.35 * Math.sin(2 * Math.PI * freq * 2 * t) +
      0.12 * Math.sin(2 * Math.PI * freq * 3.01 * t);
    return tone * env * gain;
  });
}

const note = (semitonesFromA4) => 440 * 2 ** (semitonesFromA4 / 12);
const [C5, E5, G5, A5, C6, E6] = [3, 7, 10, 12, 15, 19].map(note);
const [C4, Eb4, G4] = [-9, -6, -2].map(note);

const sounds = {
  "card-play": snap(),
  select: snap(0.04, 0.6, 0.5),
  bid: mix([bell(note(5), 0.18, 0.25, 22), 0], [snap(0.03, 0.5, 0.4), 0]),
  deal: mix(...Array.from({ length: 7 }, (_, i) => [snap(0.06, 0.3 + (i % 3) * 0.1, 0.6), i * 0.075])),
  "trick-won": (() => {
    // A soft swoosh as the cards are swept away.
    let y = 0;
    return render(0.35, (t) => {
      y += (0.05 + 0.25 * (t / 0.35)) * (noise() - y);
      return y * Math.sin(Math.PI * (t / 0.35)) * 1.4;
    });
  })(),
  "your-turn": mix([bell(E5, 0.5, 0.3, 7), 0], [bell(A5, 0.7, 0.3, 6), 0.12]),
  "partner-reveal": mix([bell(C5, 0.6, 0.25), 0], [bell(E5, 0.6, 0.25), 0.09], [bell(G5, 0.9, 0.3), 0.18]),
  win: mix(
    [bell(C5, 0.8, 0.28), 0],
    [bell(E5, 0.8, 0.28), 0.12],
    [bell(G5, 0.8, 0.28), 0.24],
    [bell(C6, 1.6, 0.32, 2.5), 0.36],
    [bell(E6, 1.4, 0.15, 2.5), 0.36],
  ),
  lose: mix([bell(G4, 0.7, 0.3, 4), 0], [bell(Eb4, 0.7, 0.3, 4), 0.22], [bell(C4, 1.4, 0.34, 2.5), 0.44]),
  chat: bell(note(14), 0.25, 0.2, 14),
};

function toWav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  const peak = Math.max(0.001, ...samples.map(Math.abs));
  const scale = Math.min(1, 0.9 / peak);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(s * scale * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

mkdirSync(OUT, { recursive: true });
for (const [name, samples] of Object.entries(sounds)) {
  writeFileSync(new URL(`${name}.wav`, OUT), toWav(samples));
  console.log(`public/sounds/${name}.wav`);
}

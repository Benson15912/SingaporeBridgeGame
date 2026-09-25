# Floating Bridge

Play Floating Bridge (Singapore Bridge) online with 3 friends. One player creates a room, shares the 6-character code or invite link, and everyone plays in real time.

**Stack:**
- **Framework:** Next.js 15 (App Router) on Vercel.
- **Backend:** Supabase for anonymous auth, Postgres, and Realtime.
- **UI:** Tailwind CSS 4, Framer Motion, lucide icons.

## How it works

- **Server-authoritative.** Every game move is `POST`ed to a Next.js route (`src/app/api/game/action`). The route loads the round, validates the move with the pure rules engine in `src/lib/game/`, and writes the result. It does this through one transactional Postgres function (`commit_round`) using the service-role key. Browsers only ever *read* data.
- **Hidden information stays hidden.**
  - **Hands:** RLS lets each player read only their own row in `hands`.
  - **Partner:** the secret partner's seat lives in `game_secrets`, which no client can read. It's only copied into the public state when the called card is played.
  - **Wash:** the wash prompt asks all four players, so it never reveals who has a weak hand.
- **Live updates.** Clients subscribe to Postgres changes for their room. They also use Realtime Presence to show online/away status. Refreshing the page reconnects you to your seat, because the anonymous session is kept in a cookie.

## Rules implemented

- **Deal:** 13 cards each.
- **Wash:** a hand with 4 or fewer high-card points (A=4, K=3, Q=2, J=1) may call a wash, and the cards are redealt.
- **Bidding:** starts left of the dealer, from 1♣ to 7NT (♣ < ♦ < ♥ < ♠ < NT). A player who passed may bid again later.
  - Bidding ends after 3 passes in a row following a bid.
  - If all 4 players pass, the cards are redealt.
- **Partner:** the declarer calls a card they don't hold. Whoever holds it is their secret partner, revealed when that card is played.
- **Opening lead:** in a suit contract, the player left of the declarer leads. In NT, the declarer leads.
- **Play:** you must follow suit if you can. Trump can't be led until it has been played, unless you hold only trump.
- **Winning:** the declarer's side needs 6 + level tricks, and the defenders need 8 − level. The round ends as soon as either side gets there.
- **Scoring:** each player on the winning side scores the bid level, and the scoreboard keeps a running total across rounds. To change this, edit `pointsForWin` in `src/lib/game/scoring.ts`.
- **Dealer:** rotates each round.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com). The free tier is fine.
2. Go to **Authentication → Sign In / Providers** and turn on **Allow anonymous sign-ins**.
3. Open the **SQL Editor** and run `supabase/migrations/0001_init.sql`, then `supabase/migrations/0002_cleanup.sql`. Alternatively, run `supabase db push` with the Supabase CLI. If the second file fails on `create extension`, enable **pg_cron** under **Database → Extensions** and run it again.
4. Go to **Project Settings → API** and copy the project URL, the `anon` key and the `service_role` key.

### 2. Run locally

```bash
cp .env.example .env.local   # then fill in the three values
npm install
npm run dev
```

Open http://localhost:3000.

To play all four seats yourself, use 4 separate browser profiles or incognito windows. Each one gets its own anonymous user.

### 3. Deploy to Vercel

1. Push this repository to GitHub, then **Import** it in Vercel. The framework is detected automatically.
2. Add the same three environment variables in **Project → Settings → Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Deploy.

Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser. It's only used in `src/lib/supabase/admin.ts`, which is marked `server-only`.

## Cleanup

Once an hour, a `pg_cron` job in Supabase runs `cleanup_stale_rooms()`, defined in `0002_cleanup.sql`.

- **Rooms:** it deletes any room with no activity for 12 hours, together with its players, hands, game state, scores and chat. A room's last activity is its creation, the last join, the last move, or the last chat message, whichever is latest.
- **Guest accounts:** it deletes anonymous accounts that aren't seated in any room and haven't signed in for 12 hours. Real (email/OAuth) accounts are never touched.
- **Returning players:** if a player whose guest account was deleted comes back, the site signs them in with a fresh guest account.

**Changing it:**
- To use a different idle time, change the default argument in `0002_cleanup.sql`.
- To see what the job has done, run `select * from cron.job_run_details order by start_time desc limit 10;`.

## Sound effects

The sounds live in `public/sounds/`, and `src/lib/sounds.ts` maps each game event to a file and a volume:

| Event | File | Plays when |
|---|---|---|
| `cardPlay` | `card-play.wav` | Any card is played |
| `select` | `select.wav` | You pick a suit or card while calling your partner |
| `bid` | `bid.wav` | Someone bids or passes |
| `deal` | `deal.wav` | A new hand is dealt, including redeals |
| `trickWon` | `trick-won.wav` | A trick is completed |
| `yourTurn` | `your-turn.wav` | It becomes your turn |
| `partnerReveal` | `partner-reveal.wav` | The called partner card is played |
| `win` / `lose` | `win.wav` / `lose.wav` | Your side wins or loses the round |
| `chat` | `chat.wav` | Someone else sends a chat message |

**To replace a sound**, do one of these:
- Overwrite the file in `public/sounds/` with a new file of the same name.
- Add your own file (for example `.mp3` or `.ogg`) and change its `src` in `src/lib/sounds.ts`.

To silence one event, set its `src` to `null`. Players can mute all sounds with the speaker button in the room header, and that choice is remembered in their browser.

The default sounds are generated by `npm run sounds` (`scripts/generate-sounds.mjs`). Running it again overwrites the files in `public/sounds/`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm test` | Rules-engine tests, including 300 simulated random games |
| `npm run lint` | TypeScript check |
| `npm run build` | Production build |
| `npm run sounds` | Regenerate the default sound effects |

## Project layout

```
src/lib/game/        Pure rules engine (cards, bidding, play, scoring, applyAction) + tests
src/lib/server/      Server helpers: auth wrapper, room lookup, load/commit a round
src/app/api/         Route handlers: rooms/{create,join,seat,leave}, game/{start,action,next-round,end}
src/hooks/useRoom.ts Loads room data and keeps it live via Supabase Realtime + Presence
src/components/room/ Lobby, table, hand, trick area, bidding/partner/wash/result panels, chat & scores
supabase/migrations/ Schema, RLS policies, commit_round() and Realtime publication
```

-- Match target score, match wins, and per-round history for partner insights.

alter table public.rooms
  add column if not exists target_score int not null default 30 check (target_score between 5 and 200);

alter table public.scores
  add column if not exists matches_won int not null default 0;

-- One row per finished round. Written by the API (service role); members can read.
create table if not exists public.round_history (
  room_id uuid not null references public.rooms (id) on delete cascade,
  round_no int not null,
  declarer_id uuid not null,
  partner_id uuid not null,
  level smallint not null,
  suit text not null,
  declarer_won boolean not null,
  declarer_tricks smallint not null,
  created_at timestamptz not null default now(),
  primary key (room_id, round_no)
);

alter table public.round_history enable row level security;
create policy "members read history" on public.round_history for select using (public.is_room_member(room_id));

alter publication supabase_realtime add table public.round_history;

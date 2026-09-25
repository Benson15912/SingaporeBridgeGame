-- Floating Bridge schema.
-- Clients only READ (limited by RLS); all game writes go through Next.js API routes using the service-role key.
-- The one exception is chat, which clients insert directly.

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null,
  status text not null default 'lobby' check (status in ('lobby', 'playing')),
  dealer_seat smallint not null default 0 check (dealer_seat between 0 and 3),
  round_no int not null default 0,
  created_at timestamptz not null default now()
);

create table public.room_players (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null,
  nickname text not null check (char_length(nickname) between 1 and 20),
  seat smallint not null check (seat between 0 and 3),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, seat)
);

-- Public state of the current round (the engine's GameState as JSON).
create table public.games (
  room_id uuid primary key references public.rooms (id) on delete cascade,
  round_no int not null,
  state jsonb not null,
  version int not null default 1,
  updated_at timestamptz not null default now()
);

-- Server-only knowledge, such as who the secret partner is. RLS on, no policies: clients can never read it.
create table public.game_secrets (
  room_id uuid primary key references public.rooms (id) on delete cascade,
  secrets jsonb not null
);

create table public.hands (
  room_id uuid not null references public.rooms (id) on delete cascade,
  seat smallint not null check (seat between 0 and 3),
  user_id uuid not null,
  cards jsonb not null,
  primary key (room_id, seat)
);

create table public.scores (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null,
  points int not null default 0,
  games_won int not null default 0,
  primary key (room_id, user_id)
);

create table public.chat_messages (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null default auth.uid(),
  nickname text not null default '',
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index chat_messages_room_idx on public.chat_messages (room_id, created_at);

-- ---------------------------------------------------------------- RLS

create or replace function public.is_room_member(p_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from room_players where room_id = p_room and user_id = auth.uid());
$$;

alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.games enable row level security;
alter table public.game_secrets enable row level security;
alter table public.hands enable row level security;
alter table public.scores enable row level security;
alter table public.chat_messages enable row level security;

create policy "members read room" on public.rooms for select using (public.is_room_member(id));
create policy "members read players" on public.room_players for select using (public.is_room_member(room_id));
create policy "members read game" on public.games for select using (public.is_room_member(room_id));
create policy "own hand only" on public.hands for select using (user_id = auth.uid());
create policy "members read scores" on public.scores for select using (public.is_room_member(room_id));
create policy "members read chat" on public.chat_messages for select using (public.is_room_member(room_id));
create policy "members send chat" on public.chat_messages for insert
  with check (user_id = auth.uid() and public.is_room_member(room_id));

-- Chat nickname comes from the seat list, so it can't be spoofed.
create or replace function public.chat_set_nickname()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select nickname into new.nickname from room_players where room_id = new.room_id and user_id = new.user_id;
  return new;
end $$;

create trigger chat_set_nickname before insert on public.chat_messages
  for each row execute function public.chat_set_nickname();

-- ---------------------------------------------------------------- Atomic game write

-- Writes the game state, secrets, hands and optional score changes in one transaction.
-- p_expected_version null = start a new round (overwrites whatever was there).
-- Raises 'version_conflict' if someone else wrote first.
create or replace function public.commit_round(
  p_room uuid,
  p_expected_version int,
  p_round_no int,
  p_state jsonb,
  p_secrets jsonb,
  p_hands jsonb,            -- [{seat, user_id, cards}]
  p_scores jsonb default null -- [{user_id, points, won}]
) returns int language plpgsql security definer set search_path = public as $$
declare
  v int;
begin
  if p_expected_version is null then
    insert into games (room_id, round_no, state, version)
    values (p_room, p_round_no, p_state, 1)
    on conflict (room_id) do update
      set round_no = excluded.round_no, state = excluded.state, version = games.version + 1, updated_at = now()
    returning version into v;
  else
    update games
      set state = p_state, round_no = p_round_no, version = version + 1, updated_at = now()
      where room_id = p_room and version = p_expected_version
      returning version into v;
    if v is null then
      raise exception 'version_conflict';
    end if;
  end if;

  insert into game_secrets (room_id, secrets) values (p_room, p_secrets)
  on conflict (room_id) do update set secrets = excluded.secrets;

  insert into hands (room_id, seat, user_id, cards)
  select p_room, (h ->> 'seat')::smallint, (h ->> 'user_id')::uuid, h -> 'cards'
  from jsonb_array_elements(p_hands) h
  on conflict (room_id, seat) do update
    set user_id = excluded.user_id, cards = excluded.cards
    where hands.cards is distinct from excluded.cards or hands.user_id is distinct from excluded.user_id;

  if p_scores is not null then
    insert into scores (room_id, user_id, points, games_won)
    select p_room, (s ->> 'user_id')::uuid, (s ->> 'points')::int, (s ->> 'won')::int
    from jsonb_array_elements(p_scores) s
    on conflict (room_id, user_id) do update
      set points = scores.points + excluded.points, games_won = scores.games_won + excluded.games_won;
  end if;

  return v;
end $$;

revoke execute on function public.commit_round from public, anon, authenticated;

-- ---------------------------------------------------------------- Realtime

alter publication supabase_realtime add table
  public.rooms, public.room_players, public.games, public.hands, public.scores, public.chat_messages;

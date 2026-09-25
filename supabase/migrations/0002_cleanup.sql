-- Hourly cleanup of abandoned rooms and leftover guest accounts.
-- Requires the pg_cron extension (Dashboard → Database → Extensions → pg_cron), or the line below.

create extension if not exists pg_cron;

create index if not exists room_players_user_idx on public.room_players (user_id);

-- Deletes rooms with no activity for p_max_idle, then anonymous users who aren't seated anywhere
-- and haven't signed in for p_max_idle. Deleting a room cascades to room_players, games,
-- game_secrets, hands, scores and chat_messages.
-- Returns what was deleted, e.g. {"rooms": 3, "users": 7}.
create or replace function public.cleanup_stale_rooms(p_max_idle interval default interval '12 hours')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  rooms_deleted int;
  users_deleted int;
begin
  with activity as (
    select r.id,
      greatest(
        r.created_at,
        (select max(p.joined_at) from room_players p where p.room_id = r.id),
        (select g.updated_at from games g where g.room_id = r.id),
        (select max(c.created_at) from chat_messages c where c.room_id = r.id)
      ) as last_at
    from rooms r
  ),
  deleted as (
    delete from rooms
    using activity
    where rooms.id = activity.id and activity.last_at < now() - p_max_idle
    returning rooms.id
  )
  select count(*) into rooms_deleted from deleted;

  -- Guest accounts only; never touches real (email/OAuth) users.
  with deleted as (
    delete from auth.users u
    where u.is_anonymous
      and coalesce(u.last_sign_in_at, u.created_at) < now() - p_max_idle
      and not exists (select 1 from room_players p where p.user_id = u.id)
    returning u.id
  )
  select count(*) into users_deleted from deleted;

  return jsonb_build_object('rooms', rooms_deleted, 'users', users_deleted);
end $$;

revoke execute on function public.cleanup_stale_rooms from public, anon, authenticated;

-- Run at the top of every hour. Scheduling again with the same name updates the job.
select cron.schedule('cleanup-stale-rooms', '0 * * * *', $$select public.cleanup_stale_rooms()$$);

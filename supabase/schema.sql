-- Versus app - Supabase/Postgres schema
-- You can run this in the Supabase SQL editor.
-- It assumes the built-in `auth.users` table is already present.
-- Safe to re-run: uses IF NOT EXISTS for tables/indexes and
-- DROP ... IF EXISTS before each CREATE POLICY.

-- Extensions -----------------------------------------------------------------

create extension if not exists "pgcrypto";

-- Enum-like domains / types --------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'match_type') then
    create type match_type as enum ('ranked', 'casual', 'local');
  end if;

  if not exists (select 1 from pg_type where typname = 'match_status') then
    create type match_status as enum ('planned', 'pending', 'confirmed', 'in_progress', 'completed', 'canceled');
  end if;

  if not exists (select 1 from pg_type where typname = 'participant_role') then
    create type participant_role as enum ('challenger', 'opponent');
  end if;

  if not exists (select 1 from pg_type where typname = 'participant_result') then
    create type participant_result as enum ('pending', 'win', 'loss', 'draw');
  end if;

  if not exists (select 1 from pg_type where typname = 'theme_preference') then
    create type theme_preference as enum ('system', 'light', 'dark');
  end if;
end
$$;

-- Core user profile data -----------------------------------------------------

create table if not exists public.profiles (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  username       text unique,
  full_name      text,
  avatar_url     text,
  bio            text,

  preferred_sports text[] not null default '{}',

  vp_total       integer not null default 0,

  last_lat       numeric(9, 6),
  last_lng       numeric(9, 6),

  theme          theme_preference not null default 'system',

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists profiles_username_idx on public.profiles (username);

-- RLS for profiles -----------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "Users can read any profile" on public.profiles;
create policy "Users can read any profile"
  on public.profiles for select
  using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- RPC: let the client check if an email is already registered ----------------

create or replace function public.check_email_exists(email_input text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists(
    select 1 from auth.users where email = lower(trim(email_input))
  );
$$;

-- RPC: check if a username is already taken ----------------------------------

create or replace function public.check_username_taken(username_input text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists(
    select 1 from public.profiles where lower(username) = lower(trim(username_input))
  );
$$;

-- Sports lookup --------------------------------------------------------------

create table if not exists public.sports (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

insert into public.sports (name, slug)
values
  ('Tennis', 'tennis'),
  ('Pickleball', 'pickleball'),
  ('Badminton', 'badminton'),
  ('Ping Pong', 'ping-pong'),
  ('Racquetball', 'racquetball'),
  ('Squash', 'squash'),
  ('Basketball', 'basketball'),
  ('Bowling', 'bowling'),
  ('Golf', 'golf'),
  ('Boxing', 'boxing'),
  ('Wrestling', 'wrestling'),
  ('Pool', 'pool'),
  ('Spikeball', 'spikeball'),
  ('Track', 'track')
on conflict (slug) do update
set name = excluded.name,
    is_active = true;

update public.sports set is_active = false
where slug in ('mma', 'fencing', 'darts', 'cornhole', 'arm-wrestling', 'chess', 'running');

-- RLS for sports -------------------------------------------------------------
alter table public.sports enable row level security;

drop policy if exists "Anyone can read sports" on public.sports;
create policy "Anyone can read sports"
  on public.sports for select
  using (true);

-- Per-sport rating / VP ------------------------------------------------------

create table if not exists public.user_sport_ratings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  sport_id    uuid not null references public.sports (id) on delete cascade,

  rank_tier   text,
  rank_div    text,

  vp          integer not null default 0,
  wins        integer not null default 0,
  losses      integer not null default 0,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (user_id, sport_id)
);

create index if not exists user_sport_ratings_user_id_idx on public.user_sport_ratings (user_id);
create index if not exists user_sport_ratings_sport_id_idx on public.user_sport_ratings (sport_id);

-- RLS for user_sport_ratings -------------------------------------------------
alter table public.user_sport_ratings enable row level security;

drop policy if exists "Users can read any ratings" on public.user_sport_ratings;
create policy "Users can read any ratings"
  on public.user_sport_ratings for select
  using (true);

drop policy if exists "Users can insert their own ratings" on public.user_sport_ratings;
create policy "Users can insert their own ratings"
  on public.user_sport_ratings for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own ratings" on public.user_sport_ratings;
create policy "Users can update their own ratings"
  on public.user_sport_ratings for update
  using (auth.uid() = user_id);

-- Social graph (following / followers) --------------------------------------

create table if not exists public.follows (
  follower_id  uuid not null references auth.users (id) on delete cascade,
  followed_id  uuid not null references auth.users (id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),

  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

create index if not exists follows_follower_id_idx on public.follows (follower_id);
create index if not exists follows_followed_id_idx on public.follows (followed_id);

-- RLS for follows ------------------------------------------------------------
alter table public.follows enable row level security;

drop policy if exists "Anyone can read follows" on public.follows;
create policy "Anyone can read follows"
  on public.follows for select
  using (true);

drop policy if exists "Users can follow others" on public.follows;
create policy "Users can follow others"
  on public.follows for insert
  with check (auth.uid() = follower_id);

drop policy if exists "Users can unfollow" on public.follows;
create policy "Users can unfollow"
  on public.follows for delete
  using (auth.uid() = follower_id or auth.uid() = followed_id);

drop policy if exists "Users can accept follow requests" on public.follows;
create policy "Users can accept follow requests"
  on public.follows for update
  using (auth.uid() = followed_id);

-- Matches --------------------------------------------------------------------

create table if not exists public.matches (
  id              uuid primary key default gen_random_uuid(),

  sport_id        uuid not null references public.sports (id),
  created_by      uuid not null references auth.users (id),

  match_type      match_type not null,
  status          match_status not null default 'planned',

  scheduled_at    timestamptz,

  location_name   text,
  location_lat    numeric(9, 6),
  location_lng    numeric(9, 6),

  notes           text,

  is_public       boolean not null default true,

  started_at      timestamptz,
  ended_at        timestamptz,
  games_played    integer,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists matches_sport_id_idx on public.matches (sport_id);
create index if not exists matches_created_by_idx on public.matches (created_by);
create index if not exists matches_scheduled_at_idx on public.matches (scheduled_at);
create index if not exists matches_status_idx on public.matches (status);

-- Match participants ---------------------------------------------------------

create table if not exists public.match_participants (
  id            uuid primary key default gen_random_uuid(),
  match_id      uuid not null references public.matches (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,

  role          participant_role not null,
  result        participant_result not null default 'pending',

  score         text,
  vp_delta      integer not null default 0,

  created_at    timestamptz not null default now(),

  unique (match_id, user_id)
);

create index if not exists match_participants_match_id_idx on public.match_participants (match_id);
create index if not exists match_participants_user_id_idx on public.match_participants (user_id);

-- RLS for matches ------------------------------------------------------------
alter table public.matches enable row level security;

drop policy if exists "Anyone can read public matches" on public.matches;
create policy "Anyone can read public matches"
  on public.matches for select
  using (true);

drop policy if exists "Auth users can create matches" on public.matches;
create policy "Auth users can create matches"
  on public.matches for insert
  with check (auth.uid() = created_by);

drop policy if exists "Creators can update their matches" on public.matches;
drop policy if exists "Creators and participants can update matches" on public.matches;
create policy "Creators and participants can update matches"
  on public.matches for update
  using (
    auth.uid() = created_by
    or exists (select 1 from public.match_participants where match_id = id and user_id = auth.uid())
  );

drop policy if exists "Creators and participants can delete matches" on public.matches;
create policy "Creators and participants can delete matches"
  on public.matches for delete
  using (
    auth.uid() = created_by
    or exists (select 1 from public.match_participants where match_id = id and user_id = auth.uid())
  );

-- RLS for match_participants -------------------------------------------------
alter table public.match_participants enable row level security;

drop policy if exists "Anyone can read participants" on public.match_participants;
create policy "Anyone can read participants"
  on public.match_participants for select
  using (true);

drop policy if exists "Auth users can add themselves as participant" on public.match_participants;
drop policy if exists "Auth users can add participants" on public.match_participants;
create policy "Auth users can add participants"
  on public.match_participants for insert
  with check (
    auth.uid() = user_id
    or exists (select 1 from public.matches where id = match_id and created_by = auth.uid())
  );

drop policy if exists "Users can update their own participation" on public.match_participants;
create policy "Users can update their own participation"
  on public.match_participants for update
  using (auth.uid() = user_id);

drop policy if exists "Creators can update participants of their matches" on public.match_participants;
create policy "Creators can update participants of their matches"
  on public.match_participants for update
  using (exists (select 1 from public.matches where id = match_id and created_by = auth.uid()));

-- Likes & comments for the feed ---------------------------------------------

create table if not exists public.match_likes (
  user_id     uuid not null references auth.users (id) on delete cascade,
  match_id    uuid not null references public.matches (id) on delete cascade,
  created_at  timestamptz not null default now(),

  primary key (user_id, match_id)
);

create index if not exists match_likes_match_id_idx on public.match_likes (match_id);

create table if not exists public.match_comments (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists match_comments_match_id_idx on public.match_comments (match_id);
create index if not exists match_comments_user_id_idx on public.match_comments (user_id);

-- Match games (per-game scores) -----------------------------------------------
create table if not exists public.match_games (
  id              uuid primary key default gen_random_uuid(),
  match_id        uuid not null references public.matches (id) on delete cascade,
  game_number     integer not null,
  score_challenger integer not null default 0,
  score_opponent  integer not null default 0,
  created_at      timestamptz not null default now(),
  unique (match_id, game_number)
);
create index if not exists match_games_match_id_idx on public.match_games (match_id);
alter table public.match_games enable row level security;
drop policy if exists "Anyone can read match games" on public.match_games;
create policy "Anyone can read match games" on public.match_games for select using (true);
drop policy if exists "Participants can manage match games" on public.match_games;
create policy "Participants can manage match games" on public.match_games for all
  using (
    exists (select 1 from public.match_participants where match_id = match_games.match_id and user_id = auth.uid())
    or exists (select 1 from public.matches where id = match_games.match_id and created_by = auth.uid())
  )
  with check (
    exists (select 1 from public.match_participants where match_id = match_games.match_id and user_id = auth.uid())
    or exists (select 1 from public.matches where id = match_games.match_id and created_by = auth.uid())
  );

-- Match images (photos on posts) -----------------------------------------------
create table if not exists public.match_images (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  file_path   text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists match_images_match_id_idx on public.match_images (match_id);
alter table public.match_images enable row level security;
drop policy if exists "Anyone can read match images" on public.match_images;
create policy "Anyone can read match images" on public.match_images for select using (true);
drop policy if exists "Participants can add match images" on public.match_images;
create policy "Participants can add match images" on public.match_images for insert
  with check (
    auth.uid() = user_id
    and (exists (select 1 from public.match_participants where match_id = match_images.match_id and user_id = auth.uid())
         or exists (select 1 from public.matches where id = match_images.match_id and created_by = auth.uid()))
  );
drop policy if exists "Users can delete own match images" on public.match_images;
create policy "Users can delete own match images" on public.match_images for delete
  using (auth.uid() = user_id);

-- RLS for match_likes --------------------------------------------------------
alter table public.match_likes enable row level security;

drop policy if exists "Anyone can read likes" on public.match_likes;
create policy "Anyone can read likes"
  on public.match_likes for select
  using (true);

drop policy if exists "Users can like" on public.match_likes;
create policy "Users can like"
  on public.match_likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can unlike" on public.match_likes;
create policy "Users can unlike"
  on public.match_likes for delete
  using (auth.uid() = user_id);

-- RLS for match_comments -----------------------------------------------------
alter table public.match_comments enable row level security;

drop policy if exists "Anyone can read comments" on public.match_comments;
create policy "Anyone can read comments"
  on public.match_comments for select
  using (true);

drop policy if exists "Users can post comments" on public.match_comments;
create policy "Users can post comments"
  on public.match_comments for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own comments" on public.match_comments;
create policy "Users can delete their own comments"
  on public.match_comments for delete
  using (auth.uid() = user_id);

-- Notifications -------------------------------------------------------------

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  data        jsonb not null default '{}',
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists idx_notifications_user
  on public.notifications (user_id, read, created_at desc);

-- RLS for notifications -----------------------------------------------------
alter table public.notifications enable row level security;

drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "Auth users can create notifications" on public.notifications;
create policy "Auth users can create notifications"
  on public.notifications for insert
  with check (true);

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own notifications" on public.notifications;
create policy "Users can delete own notifications"
  on public.notifications for delete
  using (auth.uid() = user_id);

-- Migration: add in_progress to match_status, add started_at/ended_at/games_played to matches
-- Must run before match_feed view which references these columns
do $$
begin
  begin
    alter type match_status add value 'in_progress';
  exception when others then null;
  end;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'matches' and column_name = 'started_at') then
    alter table public.matches add column started_at timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'matches' and column_name = 'ended_at') then
    alter table public.matches add column ended_at timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'matches' and column_name = 'games_played') then
    alter table public.matches add column games_played integer;
  end if;
end $$;

-- Simple helper view for feed items -----------------------------------------
-- Drop first to avoid "cannot change name of view column" when adding columns
drop view if exists public.match_feed cascade;

create view public.match_feed as
select
  m.id,
  m.created_at,
  m.scheduled_at,
  m.started_at,
  m.ended_at,
  m.match_type,
  m.status,
  m.location_name,
  m.notes,
  m.created_by,
  s.name as sport_name,
  s.slug as sport_slug,
  array_agg(jsonb_build_object(
    'user_id', mp.user_id,
    'role', mp.role,
    'result', mp.result,
    'score', mp.score,
    'vp_delta', mp.vp_delta,
    'username', p.username,
    'full_name', p.full_name,
    'avatar_url', p.avatar_url
  ) order by mp.role) as participants,
  (select coalesce(jsonb_agg(jsonb_build_object('game_number', game_number, 'score_challenger', score_challenger, 'score_opponent', score_opponent) order by game_number), '[]'::jsonb) from public.match_games mg where mg.match_id = m.id) as games,
  (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'file_path', file_path, 'sort_order', sort_order) order by sort_order, created_at), '[]'::jsonb) from public.match_images mi where mi.match_id = m.id) as images,
  (select coalesce(count(*), 0) from public.match_likes ml where ml.match_id = m.id) as likes_count,
  (select coalesce(count(*), 0) from public.match_comments mc where mc.match_id = m.id) as comments_count
from public.matches m
join public.sports s on s.id = m.sport_id
left join public.match_participants mp on mp.match_id = m.id
left join public.profiles p on p.user_id = mp.user_id
where m.is_public = true
group by m.id, s.name, s.slug;

-- Storage bucket for avatars --------------------------------------------------
-- Run this in the Supabase SQL editor or create the bucket via the dashboard.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false), ('match-images', 'match-images', false)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can upload avatars" on storage.objects;
create policy "Authenticated users can upload avatars"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update their own avatars" on storage.objects;
create policy "Users can update their own avatars"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Authenticated users can read avatars" on storage.objects;
create policy "Authenticated users can read avatars"
  on storage.objects for select
  using (bucket_id = 'avatars' and auth.role() = 'authenticated');

-- Storage for match images (path: match_id/user_id/filename)
drop policy if exists "Authenticated users can upload match images" on storage.objects;
create policy "Authenticated users can upload match images"
  on storage.objects for insert
  with check (
    bucket_id = 'match-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "Authenticated users can read match images" on storage.objects;
create policy "Authenticated users can read match images"
  on storage.objects for select
  using (bucket_id = 'match-images' and auth.role() = 'authenticated');

-- Migration: add status column to follows if it doesn't exist -----------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'follows' and column_name = 'status'
  ) then
    alter table public.follows add column status text not null default 'pending'
      check (status in ('pending', 'accepted'));
    update public.follows set status = 'accepted';
  end if;
end $$;

-- Grant table access to Supabase auth roles (required for RLS to work)
-- Run this if you get "permission denied for table profiles" or similar
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;

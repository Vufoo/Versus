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
    create type match_type as enum ('ranked', 'casual', 'local', 'practice');
  end if;

  if not exists (select 1 from pg_type where typname = 'match_status') then
    create type match_status as enum ('planned', 'pending', 'confirmed', 'in_progress', 'paused', 'completed', 'canceled');
  end if;

  -- Ensure in_progress and paused exist even if the type was created by an older schema
  begin
    alter type match_status add value 'in_progress';
  exception when duplicate_object then null;
  end;
  begin
    alter type match_status add value 'paused';
  exception when duplicate_object then null;
  end;

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
  date_of_birth  date,
  gender         text,

  preferred_sports text[] not null default '{}',

  vp_total       integer not null default 0,

  location       text,

  last_lat       numeric(9, 6),
  last_lng       numeric(9, 6),

  theme          theme_preference not null default 'system',

  is_admin       boolean not null default false,
  membership_status text not null default 'free',
  location_visibility text not null default 'private',
  profile_visibility text not null default 'public',

  push_token     text,
  push_notifications_enabled boolean not null default true,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists profiles_username_idx on public.profiles (username);

-- Add membership/admin columns if table already existed (safe to re-run)
alter table public.profiles
  add column if not exists is_admin boolean not null default false,
  add column if not exists membership_status text not null default 'free',
  add column if not exists location_visibility text not null default 'private',
  add column if not exists profile_visibility text not null default 'public',
  add column if not exists date_of_birth date,
  add column if not exists gender text,
  add column if not exists location text,
  add column if not exists push_token text,
  add column if not exists push_notifications_enabled boolean not null default true,
  -- Whether the user has granted the app foreground location permission.
  -- Required for both participants before a ranked match can start.
  add column if not exists location_enabled boolean not null default false;

-- Migration: drop rank_div column (replaced by tier-only ELO system) ----------
alter table public.user_sport_ratings
  drop column if exists rank_div;

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

-- Prevent users from setting is_admin on themselves (only service role / dashboard can)
create or replace function public.prevent_self_admin()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.is_admin = true and (old.is_admin is null or old.is_admin = false) then
    if auth.uid() = new.user_id then
      raise exception 'Cannot set yourself as admin';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_self_admin_trigger on public.profiles;
create trigger prevent_self_admin_trigger
  before update on public.profiles
  for each row execute function public.prevent_self_admin();

-- RPC: fetch push token for a user the caller shares a match with.
-- Prevents arbitrary push token enumeration — only returns the token when
-- the calling user is a confirmed participant in a shared match with the target.
create or replace function public.get_push_token_for_notification(target_user_id uuid)
returns table(push_token text, push_notifications_enabled boolean)
language sql
security definer
set search_path = ''
as $$
  select p.push_token, p.push_notifications_enabled
  from public.profiles p
  where p.user_id = target_user_id
    and (
      -- Caller is in a shared match (any status) with the target
      exists (
        select 1
        from public.match_participants mp1
        join public.match_participants mp2
          on mp1.match_id = mp2.match_id and mp2.user_id = target_user_id
        where mp1.user_id = auth.uid()
      )
      -- OR the target follows or is followed by the caller
      or exists (
        select 1 from public.follows f
        where (f.follower_id = auth.uid() and f.followed_id = target_user_id)
           or (f.follower_id = target_user_id and f.followed_id = auth.uid())
      )
    );
$$;

grant execute on function public.get_push_token_for_notification(uuid) to authenticated;

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

  -- Invited players (added via migrations — safe if columns already exist)
  invited_opponent_id   uuid references auth.users (id) on delete set null,
  invited_teammate_id   uuid references auth.users (id) on delete set null,
  invited_opponent_2_id uuid references auth.users (id) on delete set null,
  invited_teammate_2_id uuid references auth.users (id) on delete set null,
  invited_opponent_3_id uuid references auth.users (id) on delete set null,

  match_format    text not null default '1v1' constraint matches_match_format_check check (match_format in ('1v1', '2v2', '3v3')),

  started_at      timestamptz,
  ended_at        timestamptz,
  paused_at       timestamptz,
  games_played    integer,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists matches_sport_id_idx on public.matches (sport_id);
create index if not exists matches_created_by_idx on public.matches (created_by);
create index if not exists matches_created_at_desc_idx on public.matches (created_at desc);
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

  -- Ready-up / mutual-action flags (added via migrations — safe if columns already exist)
  ready             boolean not null default false,
  ready_at          timestamptz,
  delete_requested  boolean not null default false,
  finish_requested  boolean not null default false,

  created_at    timestamptz not null default now(),

  unique (match_id, user_id)
);

create index if not exists match_participants_match_id_idx on public.match_participants (match_id);
create index if not exists match_participants_user_id_idx on public.match_participants (user_id);
create index if not exists match_participants_match_user_idx on public.match_participants (match_id, user_id);

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

drop policy if exists "Users can leave matches" on public.match_participants;
create policy "Users can leave matches"
  on public.match_participants for delete
  using (auth.uid() = user_id);

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

-- Comment likes ---------------------------------------------------------------
create table if not exists public.comment_likes (
  comment_id  uuid not null references public.match_comments (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists comment_likes_comment_id_idx on public.comment_likes (comment_id);
create index if not exists comment_likes_user_id_idx on public.comment_likes (user_id);

alter table public.comment_likes enable row level security;

drop policy if exists "Anyone can read comment likes" on public.comment_likes;
create policy "Anyone can read comment likes"
  on public.comment_likes for select using (true);

drop policy if exists "Users can like comments" on public.comment_likes;
create policy "Users can like comments"
  on public.comment_likes for insert with check (auth.uid() = user_id);

drop policy if exists "Users can unlike comments" on public.comment_likes;
create policy "Users can unlike comments"
  on public.comment_likes for delete using (auth.uid() = user_id);

-- Match games: per-game/set scores (e.g. tennis 6-4, 4-6, 6-4) -----------------
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
-- Require from_user_id in data to match the authenticated caller.
-- Prevents any user from sending notifications impersonating someone else.
-- from_user_id may be omitted for system-generated notifications (null check allows that).
create policy "Auth users can create notifications"
  on public.notifications for insert
  with check (
    auth.uid() is not null
    and (
      data->>'from_user_id' is null
      or data->>'from_user_id' = auth.uid()::text
    )
  );

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own notifications" on public.notifications;
create policy "Users can delete own notifications"
  on public.notifications for delete
  using (auth.uid() = user_id);

-- Direct messages (1:1 conversations) -----------------------------------------
-- Conversation between two users: user1_id < user2_id for uniqueness
create table if not exists public.dm_conversations (
  id         uuid primary key default gen_random_uuid(),
  user1_id   uuid not null references auth.users (id) on delete cascade,
  user2_id   uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user1_id, user2_id),
  check (user1_id < user2_id)
);
create index if not exists dm_conversations_user1_idx on public.dm_conversations (user1_id);
create index if not exists dm_conversations_user2_idx on public.dm_conversations (user2_id);

create table if not exists public.dm_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.dm_conversations (id) on delete cascade,
  sender_id       uuid not null references auth.users (id) on delete cascade,
  body            text not null,
  created_at      timestamptz not null default now()
);
create index if not exists dm_messages_conversation_idx on public.dm_messages (conversation_id);
create index if not exists dm_messages_conv_created_idx on public.dm_messages (conversation_id, created_at desc);

alter table public.dm_conversations enable row level security;
alter table public.dm_messages enable row level security;

drop policy if exists "Users can read own conversations" on public.dm_conversations;
create policy "Users can read own conversations" on public.dm_conversations for select
  using (auth.uid() = user1_id or auth.uid() = user2_id);

drop policy if exists "Users can create conversations" on public.dm_conversations;
create policy "Users can create conversations" on public.dm_conversations for insert
  with check (auth.uid() = user1_id or auth.uid() = user2_id);

drop policy if exists "Users can read messages in own conversations" on public.dm_messages;
create policy "Users can read messages in own conversations" on public.dm_messages for select
  using (
    exists (
      select 1 from public.dm_conversations c
      where c.id = conversation_id and (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    )
  );

drop policy if exists "Users can send messages in own conversations" on public.dm_messages;
create policy "Users can send messages in own conversations" on public.dm_messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.dm_conversations c
      where c.id = conversation_id and (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    )
  );

drop policy if exists "Users can delete own messages" on public.dm_messages;
create policy "Users can delete own messages" on public.dm_messages for delete
  using (auth.uid() = sender_id);

-- Track when user last read each conversation (for unread badge)
create table if not exists public.dm_conversation_read (
  user_id         uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid not null references public.dm_conversations (id) on delete cascade,
  last_read_at    timestamptz not null default now(),
  primary key (user_id, conversation_id)
);
create index if not exists dm_conversation_read_user_idx on public.dm_conversation_read (user_id);
alter table public.dm_conversation_read enable row level security;
drop policy if exists "Users can manage own read state" on public.dm_conversation_read;
create policy "Users can manage own read state" on public.dm_conversation_read for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Migration: add invited_opponent_id, invited_teammate_id, invited_opponent_2_id, match_format
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'matches' and column_name = 'invited_opponent_id') then
    alter table public.matches add column invited_opponent_id uuid references auth.users (id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'matches' and column_name = 'invited_teammate_id') then
    alter table public.matches add column invited_teammate_id uuid references auth.users (id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'matches' and column_name = 'invited_opponent_2_id') then
    alter table public.matches add column invited_opponent_2_id uuid references auth.users (id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'matches' and column_name = 'match_format') then
    alter table public.matches add column match_format text not null default '1v1' check (match_format in ('1v1', '2v2'));
  end if;
end $$;

-- Migration: add invited_teammate_2_id, invited_opponent_3_id for 3v3 support
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'matches' and column_name = 'invited_teammate_2_id') then
    alter table public.matches add column invited_teammate_2_id uuid references auth.users (id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'matches' and column_name = 'invited_opponent_3_id') then
    alter table public.matches add column invited_opponent_3_id uuid references auth.users (id) on delete set null;
  end if;
end $$;
-- Update match_format check constraint to allow '3v3'
alter table public.matches drop constraint if exists matches_match_format_check;
alter table public.matches add constraint matches_match_format_check check (match_format in ('1v1', '2v2', '3v3'));

-- Migration: add ready to match_participants for ranked ready-up
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'match_participants' and column_name = 'ready') then
    alter table public.match_participants add column ready boolean not null default false;
  end if;
end $$;

-- Migration: add delete_requested to match_participants for mutual delete confirmation
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'match_participants' and column_name = 'delete_requested') then
    alter table public.match_participants add column delete_requested boolean not null default false;
  end if;
end $$;

-- Migration: add finish_requested to match_participants for ranked mutual finish confirmation
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'match_participants' and column_name = 'finish_requested') then
    alter table public.match_participants add column finish_requested boolean not null default false;
  end if;
end $$;

-- Migration: add ready_at to match_participants for 2-minute ready expiry (must be before match_feed view)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'match_participants' and column_name = 'ready_at') then
    alter table public.match_participants add column ready_at timestamptz;
  end if;
end $$;

-- RLS: allow invited opponent to update match (for accept flow)
-- WITH CHECK mirrors USING so participants cannot change created_by or escalate privileges.
drop policy if exists "Creators and participants can update matches" on public.matches;
create policy "Creators and participants can update matches"
  on public.matches for update
  using (
    auth.uid() = created_by
    or auth.uid() = invited_opponent_id
    or auth.uid() = invited_teammate_id
    or auth.uid() = invited_opponent_2_id
    or auth.uid() = invited_teammate_2_id
    or auth.uid() = invited_opponent_3_id
    or exists (select 1 from public.match_participants where match_id = id and user_id = auth.uid())
  )
  with check (
    -- created_by must not be changed — the creator row must still match
    created_by = (select created_by from public.matches where id = matches.id)
    and (
      auth.uid() = created_by
      or auth.uid() = invited_opponent_id
      or auth.uid() = invited_teammate_id
      or auth.uid() = invited_opponent_2_id
      or auth.uid() = invited_teammate_2_id
      or auth.uid() = invited_opponent_3_id
      or exists (select 1 from public.match_participants where match_id = id and user_id = auth.uid())
    )
  );


-- Migration: add in_progress to match_status, add started_at/ended_at/games_played to matches
-- Must run before match_feed view which references these columns
do $$
begin
  begin
    alter type match_status add value 'in_progress';
  exception when others then null;
  end;
  begin
    alter type match_status add value 'paused';
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

-- Migration: add paused_at to matches for stable paused-timer display
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'matches' and column_name = 'paused_at') then
    alter table public.matches add column paused_at timestamptz;
  end if;
end $$;

-- Index on match location coordinates for spatial queries on the map
create index if not exists matches_location_idx
  on public.matches (location_lat, location_lng)
  where location_lat is not null and location_lng is not null;

-- match_feed: denormalized view for the home/plan feed. Joins matches + participants
-- + games + images + likes + comments so the app can load feed data in one query.
drop view if exists public.match_feed cascade;

create view public.match_feed as
select
  m.id,
  m.created_at,
  m.scheduled_at,
  m.started_at,
  m.ended_at,
  m.paused_at,
  m.match_type,
  m.status,
  m.is_public,
  m.match_format,
  m.location_name,
  m.location_lat,
  m.location_lng,
  m.notes,
  m.created_by,
  m.invited_opponent_id,
  m.invited_teammate_id,
  m.invited_opponent_2_id,
  m.invited_teammate_2_id,
  m.invited_opponent_3_id,
  s.name as sport_name,
  s.slug as sport_slug,
  array_agg(jsonb_build_object(
    'user_id', mp.user_id,
    'role', mp.role,
    'result', mp.result,
    'score', mp.score,
    'vp_delta', mp.vp_delta,
    'ready', coalesce(mp.ready, false),
    'ready_at', mp.ready_at,
    'delete_requested', coalesce(mp.delete_requested, false),
    'finish_requested', coalesce(mp.finish_requested, false),
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
    and (storage.foldername(name))[2] = auth.uid()::text
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

-- Drop old trigger/function if they exist from earlier schema versions ---------
drop trigger if exists trg_update_sport_ratings on public.match_participants;
drop function if exists public.update_user_sport_ratings();

-- RPC: delete the calling user's own account (requires security definer to touch auth.users) --
create or replace function public.delete_own_account()
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from anon, authenticated;
grant execute on function public.delete_own_account() to authenticated;

-- RLS: allow creator, confirmed participants, or invited users to delete a match
drop policy if exists "Creators and participants can delete matches" on public.matches;
drop policy if exists "Only creators can delete matches" on public.matches;
create policy "Creators and participants can delete matches"
  on public.matches for delete
  using (
    auth.uid() = created_by
    or exists (
      select 1 from public.match_participants
      where match_id = id and user_id = auth.uid()
    )
    or invited_opponent_id = auth.uid()
    or invited_teammate_id = auth.uid()
    or invited_opponent_2_id = auth.uid()
    or invited_teammate_2_id = auth.uid()
    or invited_opponent_3_id = auth.uid()
  );

-- RPC: delete a match — security definer bypasses RLS, auth check is enforced inside
create or replace function public.delete_match_as_participant(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  -- If match no longer exists it was already deleted (race condition) — treat as success
  if not exists (select 1 from public.matches where id = p_match_id) then
    return jsonb_build_object('ok', true);
  end if;

  -- Authorization: must be creator, confirmed participant, or invited user
  if not exists (
    select 1 from public.matches
    where id = p_match_id
      and (
        created_by = auth.uid()
        or exists (
          select 1 from public.match_participants
          where match_id = p_match_id and user_id = auth.uid()
        )
        or invited_opponent_id = auth.uid()
        or invited_teammate_id = auth.uid()
        or invited_opponent_2_id = auth.uid()
        or invited_teammate_2_id = auth.uid()
        or invited_opponent_3_id = auth.uid()
      )
  ) then
    return jsonb_build_object('ok', false, 'error', 'Not authorized to delete this match');
  end if;

  delete from public.matches where id = p_match_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- Grant access to Supabase auth roles (required for RLS to work)
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
grant select on public.match_feed to anon, authenticated;

-- Contacts integration: store hashed phone numbers for friend discovery
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_hash TEXT UNIQUE;

-- Prevent duplicate participant rows (one user per match)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'match_participants_match_user_unique'
    and conrelid = 'public.match_participants'::regclass
  ) then
    -- Remove any duplicates first (keep one row per match+user pair)
    delete from public.match_participants
    where id in (
      select id from (
        select id, row_number() over (partition by match_id, user_id order by id) as rn
        from public.match_participants
      ) sub
      where rn > 1
    );
    alter table public.match_participants
      add constraint match_participants_match_user_unique unique (match_id, user_id);
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Tier-based VP ranking system
--
-- Tiers (in order): Beginner → Bronze → Silver → Gold → Platinum → Diamond → Pro
--
-- Rules:
--   • Beginner promotes to Bronze at 1 VP (easy onramp)
--   • All other tiers promote at 10 VP; VP resets to 0 (excess carries over)
--   • On a loss VP drops but never below 0, and tier never decreases
--   • VP delta per match:
--       - Same tier:           ±1
--       - Winner is underdog (lower tier) by N tiers: ±(1 + N)
--       - Winner is favorite  (higher tier):          ±1
--   • Winner gains exactly what loser loses (symmetric)
-- ═══════════════════════════════════════════════════════════════════════════

-- Helper: numeric rank of a tier (used for diff calculation)
create or replace function public.tier_rank(p_tier text)
returns integer language plpgsql immutable as $$
begin
  return case p_tier
    when 'Beginner' then 0
    when 'Bronze'   then 1
    when 'Silver'   then 2
    when 'Gold'     then 3
    when 'Platinum' then 4
    when 'Diamond'  then 5
    when 'Pro'      then 6
    else 0
  end;
end; $$;

-- Helper: the tier one step above the given tier
create or replace function public.next_tier(p_tier text)
returns text language plpgsql immutable as $$
begin
  return case p_tier
    when 'Beginner' then 'Bronze'
    when 'Bronze'   then 'Silver'
    when 'Silver'   then 'Gold'
    when 'Gold'     then 'Platinum'
    when 'Platinum' then 'Diamond'
    when 'Diamond'  then 'Pro'
    else 'Pro'
  end;
end; $$;

-- Helper: VP threshold to leave a tier (Beginner is 1; everything else is 10)
create or replace function public.tier_threshold(p_tier text)
returns integer language plpgsql immutable as $$
begin
  return case p_tier when 'Beginner' then 1 else 10 end;
end; $$;

-- Core: apply a VP change for one player after a ranked match
-- p_vp_delta: positive = win, negative = loss, 0 = draw
-- Drop old signature (p_vp_gain) so CREATE OR REPLACE can rename the parameter
drop function if exists public.upsert_sport_rating(uuid, uuid, integer, boolean, boolean);
create or replace function public.upsert_sport_rating(
  p_user_id  uuid,
  p_sport_id uuid,
  p_vp_delta integer,
  p_is_win   boolean,
  p_is_loss  boolean
) returns void language plpgsql security definer as $$
declare
  v_vp       integer;
  v_tier     text;
  v_new_vp   integer;
  v_new_tier text;
begin
  -- Ensure row exists
  insert into public.user_sport_ratings (user_id, sport_id, vp, rank_tier, wins, losses)
  values (p_user_id, p_sport_id, 0, 'Beginner', 0, 0)
  on conflict (user_id, sport_id) do nothing;

  select coalesce(vp, 0), coalesce(rank_tier, 'Beginner')
  into v_vp, v_tier
  from public.user_sport_ratings
  where user_id = p_user_id and sport_id = p_sport_id;

  if p_vp_delta > 0 then
    -- ── Win: add VP, promote while above threshold ──────────────────────
    v_new_vp   := v_vp + p_vp_delta;
    v_new_tier := v_tier;

    while v_new_vp >= public.tier_threshold(v_new_tier) and v_new_tier <> 'Pro' loop
      v_new_vp   := v_new_vp - public.tier_threshold(v_new_tier);
      v_new_tier := public.next_tier(v_new_tier);
    end loop;

    update public.user_sport_ratings
    set vp        = v_new_vp,
        rank_tier  = v_new_tier,

        wins       = wins + (case when p_is_win then 1 else 0 end),
        updated_at = now()
    where user_id = p_user_id and sport_id = p_sport_id;

    -- Increment cumulative vp_total on the profile (never decreases)
    update public.profiles
    set vp_total = vp_total + p_vp_delta
    where user_id = p_user_id;

  elsif p_vp_delta < 0 then
    -- ── Loss: subtract VP, floor at 0, tier never changes ───────────────
    update public.user_sport_ratings
    set vp        = greatest(0, v_vp + p_vp_delta),
        rank_tier  = v_tier,

        losses     = losses + (case when p_is_loss then 1 else 0 end),
        updated_at = now()
    where user_id = p_user_id and sport_id = p_sport_id;

  else
    -- ── Draw: no VP change, update counts only ───────────────────────────
    update public.user_sport_ratings
    set wins       = wins  + (case when p_is_win  then 1 else 0 end),
        losses     = losses + (case when p_is_loss then 1 else 0 end),

        updated_at = now()
    where user_id = p_user_id and sport_id = p_sport_id;
  end if;
end; $$;

-- Reverse: undo a ranked match result when the match is deleted
-- p_vp_magnitude: absolute value of the original VP change (always positive)
-- Drop old signatures (p_vp_loss / p_vp_gain) so CREATE OR REPLACE can rename the parameter
drop function if exists public.reverse_sport_rating(uuid, uuid, integer, boolean, boolean);
create or replace function public.reverse_sport_rating(
  p_user_id       uuid,
  p_sport_id      uuid,
  p_vp_magnitude  integer,   -- renamed from p_vp_loss; always a positive number
  p_was_win       boolean,
  p_was_loss      boolean
) returns void language plpgsql security definer as $$
declare
  v_vp       integer;
  v_tier     text;
  v_new_vp   integer;
  v_new_tier text;
  v_prev_tier text;
begin
  select coalesce(vp, 0), coalesce(rank_tier, 'Beginner')
  into v_vp, v_tier
  from public.user_sport_ratings
  where user_id = p_user_id and sport_id = p_sport_id;

  if v_tier is null then return; end if;

  if p_was_win then
    -- Undo a win: subtract the gained VP, allow tier rollback on reversal
    v_new_vp   := v_vp - p_vp_magnitude;
    v_new_tier := v_tier;

    while v_new_vp < 0 and v_new_tier <> 'Beginner' loop
      v_new_tier := case v_new_tier
        when 'Bronze'   then 'Beginner'
        when 'Silver'   then 'Bronze'
        when 'Gold'     then 'Silver'
        when 'Platinum' then 'Gold'
        when 'Diamond'  then 'Platinum'
        when 'Pro'      then 'Diamond'
        else 'Beginner'
      end;
      -- Restore into previous tier: add that tier's threshold to what remains
      v_new_vp := public.tier_threshold(v_new_tier) + v_new_vp;
    end loop;

    v_new_vp := greatest(0, v_new_vp);

    update public.user_sport_ratings
    set vp        = v_new_vp,
        rank_tier  = v_new_tier,

        wins       = greatest(0, wins - 1),
        updated_at = now()
    where user_id = p_user_id and sport_id = p_sport_id;

    -- Reverse the vp_total increment
    update public.profiles
    set vp_total = greatest(0, vp_total - p_vp_magnitude)
    where user_id = p_user_id;

  elsif p_was_loss then
    -- Undo a loss: restore the VP that was subtracted (cap at threshold - 1 to avoid accidental promotion)
    v_new_vp := least(v_vp + p_vp_magnitude, public.tier_threshold(v_tier) - 1);

    update public.user_sport_ratings
    set vp        = greatest(0, v_new_vp),
        rank_tier  = v_tier,

        losses     = greatest(0, losses - 1),
        updated_at = now()
    where user_id = p_user_id and sport_id = p_sport_id;
  end if;
end; $$;

-- finish_match: calculate tier-adjusted VP delta, then apply to all participants
create or replace function public.finish_match(
  p_match_id       uuid,
  p_winner_user_id uuid,   -- NULL for draw
  p_finished_by    uuid
) returns jsonb language plpgsql security definer as $$
declare
  v_match        record;
  v_match_format text;
  v_winning_role participant_role;
  v_sport_id     uuid;
  v_winner_tier  text;
  v_loser_tier   text;
  v_tier_diff    integer;
  v_vp_delta     integer;
  v_participant  record;
  v_result       participant_result;
  v_is_winner    boolean;
begin
  -- Verify caller identity matches the passed-in user_id
  if p_finished_by <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'Not authorized');
  end if;

  -- Verify caller is a participant in this match
  if not exists (
    select 1 from match_participants
    where match_id = p_match_id and user_id = auth.uid()
  ) then
    return jsonb_build_object('ok', false, 'error', 'Not a participant in this match');
  end if;

  select * into v_match from matches where id = p_match_id for update;

  if v_match is null then
    return jsonb_build_object('ok', false, 'error', 'Match not found');
  end if;
  if v_match.status in ('completed', 'canceled') then
    return jsonb_build_object('ok', false, 'error', 'Match already ' || v_match.status);
  end if;

  v_sport_id     := v_match.sport_id;
  v_match_format := coalesce(v_match.match_format, '1v1');

  -- Determine winning role for 2v2
  if p_winner_user_id is not null and v_match_format = '2v2' then
    select role into v_winning_role
    from match_participants
    where match_id = p_match_id and user_id = p_winner_user_id;
  end if;

  -- ── VP delta calculation (ranked + winner declared) ──────────────────────
  v_vp_delta := 0;
  if v_match.match_type = 'ranked' and p_winner_user_id is not null then
    -- Winner's current tier
    select coalesce(rank_tier, 'Beginner') into v_winner_tier
    from public.user_sport_ratings
    where user_id = p_winner_user_id and sport_id = v_sport_id;
    v_winner_tier := coalesce(v_winner_tier, 'Beginner');

    -- Loser's current tier (first participant on the losing side)
    if v_match_format = '2v2' and v_winning_role is not null then
      select coalesce(usr.rank_tier, 'Beginner') into v_loser_tier
      from match_participants mp
      left join public.user_sport_ratings usr
        on usr.user_id = mp.user_id and usr.sport_id = v_sport_id
      where mp.match_id = p_match_id and mp.role <> v_winning_role
      limit 1;
    else
      select coalesce(usr.rank_tier, 'Beginner') into v_loser_tier
      from match_participants mp
      left join public.user_sport_ratings usr
        on usr.user_id = mp.user_id and usr.sport_id = v_sport_id
      where mp.match_id = p_match_id and mp.user_id <> p_winner_user_id
      limit 1;
    end if;
    v_loser_tier := coalesce(v_loser_tier, 'Beginner');

    -- Negative diff = winner is the underdog → upset bonus
    v_tier_diff := public.tier_rank(v_winner_tier) - public.tier_rank(v_loser_tier);
    v_vp_delta  := case when v_tier_diff < 0 then 1 + abs(v_tier_diff) else 1 end;
  end if;

  -- ── Update participants ───────────────────────────────────────────────────
  for v_participant in
    select * from match_participants where match_id = p_match_id
  loop
    if p_winner_user_id is null then
      v_result    := 'draw';
      v_is_winner := false;
    elsif v_match_format = '2v2' and v_winning_role is not null then
      v_is_winner := v_participant.role = v_winning_role;
      v_result    := case when v_is_winner then 'win'::participant_result else 'loss'::participant_result end;
    else
      v_is_winner := v_participant.user_id = p_winner_user_id;
      v_result    := case when v_is_winner then 'win'::participant_result else 'loss'::participant_result end;
    end if;

    update match_participants
    set result   = v_result,
        vp_delta = case
          when v_result = 'win'  then  v_vp_delta
          when v_result = 'loss' then -v_vp_delta
          else 0
        end
    where match_id = p_match_id and user_id = v_participant.user_id;

    if v_match.match_type = 'ranked' and v_sport_id is not null then
      perform public.upsert_sport_rating(
        v_participant.user_id,
        v_sport_id,
        case
          when v_result = 'win'  then  v_vp_delta
          when v_result = 'loss' then -v_vp_delta
          else 0
        end,
        v_result = 'win',
        v_result = 'loss'
      );
    end if;
  end loop;

  update matches set status = 'completed', ended_at = now() where id = p_match_id;
  return jsonb_build_object('ok', true, 'vp_delta', v_vp_delta);
end; $$;

-- RPC: allow match creator to remove another participant from a casual/practice match
create or replace function public.kick_match_participant(p_match_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator uuid;
  v_match_type text;
  v_status text;
begin
  select created_by, match_type, status into v_creator, v_match_type, v_status
  from public.matches where id = p_match_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Match not found.');
  end if;

  if auth.uid() != v_creator then
    return jsonb_build_object('ok', false, 'error', 'Only the match creator can remove players.');
  end if;

  if lower(v_match_type) = 'ranked' then
    return jsonb_build_object('ok', false, 'error', 'Cannot remove players from a ranked match.');
  end if;

  if p_user_id = auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'Use Leave match to remove yourself.');
  end if;

  delete from public.match_participants
  where match_id = p_match_id and user_id = p_user_id;

  -- Reset to pending if confirmed, since lineup changed
  if v_status = 'confirmed' then
    update public.matches set status = 'pending' where id = p_match_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;


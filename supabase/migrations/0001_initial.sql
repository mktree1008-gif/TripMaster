create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null,
  nickname text unique not null,
  display_name text,
  phone text,
  profile_image_url text,
  locale text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.trip_role as enum ('viewer', 'editor');
create type public.invite_status as enum ('pending', 'accepted', 'expired');
create type public.music_job_status as enum ('queued', 'running', 'succeeded', 'failed');

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  destination_country text,
  owner_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role public.trip_role not null default 'viewer',
  created_at timestamptz not null default now(),
  unique (trip_id, user_id)
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  role public.trip_role not null,
  code text unique not null,
  status public.invite_status not null default 'pending',
  invited_by uuid not null references public.users(id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.flights (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  payload jsonb not null,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.hotels (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  payload jsonb not null,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  place_ref_id text,
  country_code text,
  city text,
  name text,
  theme text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  restaurant_ref_id text,
  country_code text,
  city text,
  name text,
  cuisine text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.records (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null,
  note text,
  media_urls text[] not null default '{}',
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.record_media (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.records(id) on delete cascade,
  media_url text not null,
  media_type text,
  created_at timestamptz not null default now()
);

create table if not exists public.diaries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null,
  content text not null,
  date date not null,
  place text not null,
  weather_emoji text,
  weather_label text,
  media_urls text[] not null default '{}',
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.diary_media (
  id uuid primary key default gen_random_uuid(),
  diary_id uuid not null references public.diaries(id) on delete cascade,
  media_url text not null,
  media_type text,
  created_at timestamptz not null default now()
);

create table if not exists public.music_jobs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  diary_id uuid not null references public.diaries(id) on delete cascade,
  created_by uuid references public.users(id),
  style text not null,
  include_lyrics boolean not null default true,
  prompt text not null,
  status public.music_job_status not null default 'queued',
  result_url text,
  title text,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.music_tracks (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  diary_id uuid not null references public.diaries(id) on delete cascade,
  music_job_id uuid not null references public.music_jobs(id) on delete cascade,
  provider_name text,
  provider_track_id text,
  title text,
  track_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  content text not null,
  emoji text,
  author_id uuid references public.users(id),
  author_nickname text,
  created_at timestamptz not null default now()
);

create table if not exists public.city_images (
  id uuid primary key default gen_random_uuid(),
  country_code text not null,
  city text not null,
  image_url text not null,
  caption text,
  created_at timestamptz not null default now()
);

create table if not exists public.i18n_labels (
  id uuid primary key default gen_random_uuid(),
  language_code text not null,
  label_key text not null,
  label_value text not null,
  unique (language_code, label_key)
);

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  category text not null,
  title text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips(id) on delete set null,
  user_id uuid not null references public.users(id) on delete cascade,
  nickname text not null,
  country_code text not null,
  city text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create or replace function public.current_profile_id()
returns uuid
language sql
stable
as $$
  select id from public.users where auth_user_id = auth.uid() limit 1;
$$;

alter table public.users enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.invites enable row level security;
alter table public.flights enable row level security;
alter table public.hotels enable row level security;
alter table public.places enable row level security;
alter table public.restaurants enable row level security;
alter table public.records enable row level security;
alter table public.record_media enable row level security;
alter table public.diaries enable row level security;
alter table public.diary_media enable row level security;
alter table public.music_jobs enable row level security;
alter table public.music_tracks enable row level security;
alter table public.comments enable row level security;
alter table public.city_images enable row level security;
alter table public.i18n_labels enable row level security;
alter table public.support_requests enable row level security;
alter table public.tips enable row level security;

create policy "users can view own profile" on public.users
for select using (auth_user_id = auth.uid());

create policy "users can update own profile" on public.users
for update using (auth_user_id = auth.uid());

create policy "users can insert own profile" on public.users
for insert with check (auth_user_id = auth.uid());

create policy "members can read trips" on public.trips
for select using (
  exists (
    select 1 from public.trip_members tm
    where tm.trip_id = id and tm.user_id = public.current_profile_id()
  )
);

create policy "owners can modify trips" on public.trips
for all using (owner_id = public.current_profile_id())
with check (owner_id = public.current_profile_id());

create policy "members can read trip members" on public.trip_members
for select using (
  exists (
    select 1 from public.trip_members tm
    where tm.trip_id = trip_id and tm.user_id = public.current_profile_id()
  )
);

create policy "editors can manage trip members" on public.trip_members
for all using (
  exists (
    select 1 from public.trip_members tm
    where tm.trip_id = trip_id and tm.user_id = public.current_profile_id() and tm.role = 'editor'
  )
)
with check (
  exists (
    select 1 from public.trip_members tm
    where tm.trip_id = trip_id and tm.user_id = public.current_profile_id() and tm.role = 'editor'
  )
);

create policy "members can read invites" on public.invites
for select using (
  exists (
    select 1 from public.trip_members tm
    where tm.trip_id = trip_id and tm.user_id = public.current_profile_id()
  )
);

create policy "editors can manage invites" on public.invites
for all using (
  exists (
    select 1 from public.trip_members tm
    where tm.trip_id = trip_id and tm.user_id = public.current_profile_id() and tm.role = 'editor'
  )
)
with check (
  exists (
    select 1 from public.trip_members tm
    where tm.trip_id = trip_id and tm.user_id = public.current_profile_id() and tm.role = 'editor'
  )
);

create policy "members can read trip data" on public.flights
for select using (exists (select 1 from public.trip_members tm where tm.trip_id = trip_id and tm.user_id = public.current_profile_id()));
create policy "members can read trip data 2" on public.hotels
for select using (exists (select 1 from public.trip_members tm where tm.trip_id = trip_id and tm.user_id = public.current_profile_id()));
create policy "members can read trip data 3" on public.places
for select using (exists (select 1 from public.trip_members tm where tm.trip_id = trip_id and tm.user_id = public.current_profile_id()));
create policy "members can read trip data 4" on public.restaurants
for select using (exists (select 1 from public.trip_members tm where tm.trip_id = trip_id and tm.user_id = public.current_profile_id()));
create policy "members can read trip data 5" on public.records
for select using (exists (select 1 from public.trip_members tm where tm.trip_id = trip_id and tm.user_id = public.current_profile_id()));
create policy "members can read trip data 6" on public.diaries
for select using (exists (select 1 from public.trip_members tm where tm.trip_id = trip_id and tm.user_id = public.current_profile_id()));
create policy "members can read trip data 7" on public.music_jobs
for select using (exists (select 1 from public.trip_members tm where tm.trip_id = trip_id and tm.user_id = public.current_profile_id()));
create policy "members can read trip data 8" on public.music_tracks
for select using (exists (select 1 from public.trip_members tm where tm.trip_id = trip_id and tm.user_id = public.current_profile_id()));
create policy "members can read trip data 9" on public.comments
for select using (exists (select 1 from public.trip_members tm where tm.trip_id = trip_id and tm.user_id = public.current_profile_id()));

create policy "editors can write places" on public.places
for insert with check (exists (select 1 from public.trip_members tm where tm.trip_id = trip_id and tm.user_id = public.current_profile_id() and tm.role = 'editor'));

create policy "editors can write restaurants" on public.restaurants
for insert with check (exists (select 1 from public.trip_members tm where tm.trip_id = trip_id and tm.user_id = public.current_profile_id() and tm.role = 'editor'));

create policy "editors can write records" on public.records
for insert with check (exists (select 1 from public.trip_members tm where tm.trip_id = trip_id and tm.user_id = public.current_profile_id() and tm.role = 'editor'));

create policy "editors can write diaries" on public.diaries
for all using (exists (select 1 from public.trip_members tm where tm.trip_id = trip_id and tm.user_id = public.current_profile_id() and tm.role = 'editor'))
with check (exists (select 1 from public.trip_members tm where tm.trip_id = trip_id and tm.user_id = public.current_profile_id() and tm.role = 'editor'));

create policy "members can write comments" on public.comments
for insert with check (exists (select 1 from public.trip_members tm where tm.trip_id = trip_id and tm.user_id = public.current_profile_id()));

create policy "users can read own support" on public.support_requests
for select using (user_id = public.current_profile_id());

create policy "users can create own support" on public.support_requests
for insert with check (user_id = public.current_profile_id());

create policy "public read city images" on public.city_images for select using (true);
create policy "public read i18n labels" on public.i18n_labels for select using (true);
create policy "public read tips" on public.tips for select using (true);
create policy "users write tips" on public.tips for insert with check (user_id = public.current_profile_id());

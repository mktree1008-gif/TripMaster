create table if not exists public.tripstargram_posts (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  diary_id uuid references public.diaries(id) on delete set null,
  image_url text,
  media_url text,
  caption text not null,
  hashtags text[] not null default '{}',
  author_id uuid not null references public.users(id) on delete cascade,
  author_nickname text not null,
  created_at timestamptz not null default now()
);

create index if not exists tripstargram_posts_trip_id_idx on public.tripstargram_posts(trip_id);
create index if not exists tripstargram_posts_created_at_idx on public.tripstargram_posts(created_at desc);

alter table public.tripstargram_posts enable row level security;

create policy "members can read tripstargram posts" on public.tripstargram_posts
for select using (
  exists (
    select 1
    from public.trip_members tm
    where tm.trip_id = trip_id and tm.user_id = public.current_profile_id()
  )
);

create policy "editors can write tripstargram posts" on public.tripstargram_posts
for insert with check (
  exists (
    select 1
    from public.trip_members tm
    where tm.trip_id = trip_id and tm.user_id = public.current_profile_id() and tm.role = 'editor'
  )
);

alter table public.trips
add column if not exists allow_member_packing_edit boolean not null default false;

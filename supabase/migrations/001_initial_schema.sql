create extension if not exists pgcrypto;

create type public.booking_status as enum ('pending', 'confirmed', 'cancelled');

create table public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  event_date date not null,
  time_slot time not null,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  unique (event_date, time_slot)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  child_name text not null check (char_length(child_name) between 1 and 80),
  child_age smallint not null check (child_age between 1 and 14),
  parent_name text not null check (char_length(parent_name) between 1 and 120),
  phone text not null check (char_length(phone) between 7 and 24),
  event_date date not null check (event_date > current_date),
  time_slot time not null,
  package_name text not null check (package_name in ('Mini', 'Nube', 'Fiestón')),
  kids_count smallint not null check (kids_count between 5 and 40),
  extras text[] not null default '{}',
  estimated_total integer not null check (estimated_total > 0),
  status public.booking_status not null default 'pending',
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index one_active_booking_per_slot
on public.bookings (event_date, time_slot)
where status in ('pending', 'confirmed');

alter table public.availability_slots enable row level security;
alter table public.bookings enable row level security;
revoke all on public.bookings from anon, authenticated;
revoke all on public.availability_slots from anon, authenticated;
grant select on public.availability_slots to anon;
grant insert on public.bookings to anon;

create policy "Public can view available slots"
on public.availability_slots for select to anon
using (is_available = true and event_date > current_date);

create policy "Public can request a booking"
on public.bookings for insert to anon
with check (status = 'pending' and event_date > current_date);

insert into public.availability_slots (event_date, time_slot)
select d::date, t::time
from generate_series(current_date + 1, current_date + 90, interval '1 day') d
cross join (values ('14:00'), ('18:00')) as slots(t)
where extract(isodow from d) in (6, 7)
on conflict do nothing;

create type public.gardening_import_status as enum ('processing', 'completed', 'failed');

create table public.gardening_imports (
  id uuid primary key default gen_random_uuid(),
  filename text not null check (char_length(filename) between 1 and 255),
  status public.gardening_import_status not null default 'processing',
  parser_version text not null,
  total_rows integer not null default 0 check (total_rows >= 0),
  valid_rows integer not null default 0 check (valid_rows >= 0),
  invalid_rows integer not null default 0 check (invalid_rows >= 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.gardening_measurements (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.gardening_imports(id) on delete cascade,
  plant_id text not null check (char_length(plant_id) between 1 and 100),
  measured_at date not null,
  total_height double precision not null,
  source_row integer not null check (source_row > 0),
  created_at timestamptz not null default now(),
  unique (plant_id, measured_at)
);

create table public.gardening_water_events (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.gardening_imports(id) on delete cascade,
  plant_id text not null check (char_length(plant_id) between 1 and 100),
  measured_at date not null,
  amount double precision not null,
  source_row integer not null check (source_row > 0),
  created_at timestamptz not null default now()
);

create table public.gardening_nutrient_events (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.gardening_imports(id) on delete cascade,
  plant_id text not null check (char_length(plant_id) between 1 and 100),
  sampled_at date not null,
  dose double precision not null,
  source_row integer not null check (source_row > 0),
  created_at timestamptz not null default now()
);

create table public.gardening_import_errors (
  id bigint generated always as identity primary key,
  import_id uuid not null references public.gardening_imports(id) on delete cascade,
  row_number integer not null check (row_number > 0),
  raw_value text not null,
  error_message text not null,
  created_at timestamptz not null default now()
);

create index gardening_measurements_plant_date_idx on public.gardening_measurements (plant_id, measured_at);

alter table public.gardening_imports enable row level security;
alter table public.gardening_measurements enable row level security;
alter table public.gardening_water_events enable row level security;
alter table public.gardening_nutrient_events enable row level security;
alter table public.gardening_import_errors enable row level security;

revoke all on public.gardening_imports from anon, authenticated;
revoke all on public.gardening_measurements from anon, authenticated;
revoke all on public.gardening_water_events from anon, authenticated;
revoke all on public.gardening_nutrient_events from anon, authenticated;
revoke all on public.gardening_import_errors from anon, authenticated;

create or replace function public.persist_gardening_import(
  p_filename text,
  p_plant_id text,
  p_parser_version text,
  p_total_rows integer,
  p_measurements jsonb,
  p_water_events jsonb,
  p_nutrient_events jsonb,
  p_issues jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_import_id uuid;
begin
  insert into public.gardening_imports (
    filename, status, parser_version, total_rows, valid_rows, invalid_rows, completed_at
  ) values (
    p_filename,
    'completed',
    p_parser_version,
    p_total_rows,
    jsonb_array_length(p_measurements) + jsonb_array_length(p_water_events) + jsonb_array_length(p_nutrient_events),
    jsonb_array_length(p_issues),
    now()
  ) returning id into v_import_id;

  insert into public.gardening_measurements (
    import_id, plant_id, measured_at, total_height, source_row
  )
  select v_import_id, p_plant_id, x.measured_at, x.total_height, x.source_row
  from jsonb_to_recordset(p_measurements) as x(
    measured_at date, total_height double precision, source_row integer
  )
  on conflict (plant_id, measured_at) do update set
    import_id = excluded.import_id,
    total_height = excluded.total_height,
    source_row = excluded.source_row;

  insert into public.gardening_water_events (import_id, plant_id, measured_at, amount, source_row)
  select v_import_id, p_plant_id, x.measured_at, x.amount, x.source_row
  from jsonb_to_recordset(p_water_events) as x(measured_at date, amount double precision, source_row integer);

  insert into public.gardening_nutrient_events (import_id, plant_id, sampled_at, dose, source_row)
  select v_import_id, p_plant_id, x.sampled_at, x.dose, x.source_row
  from jsonb_to_recordset(p_nutrient_events) as x(sampled_at date, dose double precision, source_row integer);

  insert into public.gardening_import_errors (import_id, row_number, raw_value, error_message)
  select v_import_id, x.row_number, x.raw_value, x.error_message
  from jsonb_to_recordset(p_issues) as x(row_number integer, raw_value text, error_message text);

  return v_import_id;
end;
$$;

revoke all on function public.persist_gardening_import(text, text, text, integer, jsonb, jsonb, jsonb, jsonb)
from public, anon, authenticated;
grant execute on function public.persist_gardening_import(text, text, text, integer, jsonb, jsonb, jsonb, jsonb)
to service_role;

notify pgrst, 'reload schema';

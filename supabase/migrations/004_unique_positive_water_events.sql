-- Values less than or equal to zero do not represent a real watering deposit.
delete from public.gardening_water_events
where amount <= 0;

-- Keep the most recently imported deposit when a plant and date
-- already appear multiple times because of previous reimports.
with duplicates as (
  select id,
    row_number() over (
      partition by plant_id, measured_at
      order by created_at desc, id desc
    ) as position
  from public.gardening_water_events
)
delete from public.gardening_water_events as event
using duplicates
where event.id = duplicates.id
  and duplicates.position > 1;

alter table public.gardening_water_events
  add constraint gardening_water_events_positive_amount check (amount > 0),
  add constraint gardening_water_events_plant_date_key unique (plant_id, measured_at);

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
    measured_at date,
    total_height double precision,
    source_row integer
  )
  on conflict (plant_id, measured_at) do update set
    import_id = excluded.import_id,
    total_height = excluded.total_height,
    source_row = excluded.source_row;

  insert into public.gardening_water_events (
    import_id, plant_id, measured_at, amount, source_row
  )
  select v_import_id, p_plant_id, x.measured_at, x.amount, x.source_row
  from jsonb_to_recordset(p_water_events) as x(
    measured_at date,
    amount double precision,
    source_row integer
  )
  where x.amount > 0
  on conflict (plant_id, measured_at) do update set
    import_id = excluded.import_id,
    amount = excluded.amount,
    source_row = excluded.source_row;

  insert into public.gardening_nutrient_events (import_id, plant_id, sampled_at, dose, source_row)
  select v_import_id, p_plant_id, x.sampled_at, x.dose, x.source_row
  from jsonb_to_recordset(p_nutrient_events) as x(
    sampled_at date,
    dose double precision,
    source_row integer
  );

  insert into public.gardening_import_errors (import_id, row_number, raw_value, error_message)
  select v_import_id, x.row_number, x.raw_value, x.error_message
  from jsonb_to_recordset(p_issues) as x(
    row_number integer,
    raw_value text,
    error_message text
  );

  return v_import_id;
end;
$$;

revoke all on function public.persist_gardening_import(text, text, text, integer, jsonb, jsonb, jsonb, jsonb)
from public, anon, authenticated;

grant execute on function public.persist_gardening_import(text, text, text, integer, jsonb, jsonb, jsonb, jsonb)
to service_role;

notify pgrst, 'reload schema';

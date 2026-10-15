-- M8. Forecast: atomic import. Replaces every arrival row of each source in the
-- payload and records the metrics in one transaction, so a re-import never
-- leaves stale rows or a half-written forecast.

create function public.import_forecast(p_arrivals jsonb, p_metrics jsonb, p_trained_on timestamptz)
returns void
language plpgsql
set search_path = ''
as $$
declare
  unknown text;
begin
  select string_agg(distinct a.psgc_code, ', ')
  into unknown
  from jsonb_to_recordset(p_arrivals) as a (psgc_code text)
  left join public.municipalities m on m.psgc_code = a.psgc_code
  where m.id is null;
  if unknown is not null then
    raise exception 'Unknown municipalities: %', unknown;
  end if;

  delete from public.forecast_arrivals f
  where f.source in (
    select distinct a.source
    from jsonb_to_recordset(p_arrivals) as a (source public.forecast_source)
  );

  insert into public.forecast_arrivals (municipality_id, date, kg_low, kg_mid, kg_high, source)
  select m.id, a.date, a.kg_low, a.kg_mid, a.kg_high, a.source
  from jsonb_to_recordset(p_arrivals) as a (
    psgc_code text, date date, kg_low integer, kg_mid integer, kg_high integer,
    source public.forecast_source
  )
  join public.municipalities m on m.psgc_code = a.psgc_code;

  insert into public.forecast_metrics (trained_on, metrics)
  values (p_trained_on, p_metrics);
end;
$$;

-- Server-side only (service role), like every other table.
revoke execute on function public.import_forecast (jsonb, jsonb, timestamptz) from public, anon, authenticated;

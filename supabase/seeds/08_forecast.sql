-- M8. Forecast: a few demo-synthetic arrival rows so capacity shows a forecast
-- after `pnpm db:reset`. `pnpm import:forecast` replaces every demo-synthetic
-- row with the trained export, so the two never add up.
--
-- Three municipalities over the next 8 weeks, peaking around day 28.

insert into public.forecast_arrivals (municipality_id, date, kg_low, kg_mid, kg_high, source)
select m.id, current_date + d,
  round(v.mid * 0.6)::integer, v.mid, round(v.mid * 1.5)::integer,
  'demo-synthetic'
from (
  values ('0603001000', 1.0), ('0603002000', 0.7), ('0603003000', 0.5)
) as p (psgc_code, scale)
join public.municipalities m on m.psgc_code = p.psgc_code
cross join generate_series(0, 55) as d
cross join lateral (
  select round(p.scale * (1500 + 6000 * exp(-power((d - 28) / 9.0, 2))))::integer as mid
) as v;

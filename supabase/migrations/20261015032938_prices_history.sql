-- M7. Pricing and Cost: keep every price save as its own row.
--
-- The manager wants History to show each change, not one row per date. Drop the
-- (facility_id, effective_date) uniqueness so saving the same date appends a row;
-- priceOn then picks the newest save (effective_date, then created_at).

alter table public.prices
  drop constraint prices_facility_id_effective_date_key;

-- Dropping the constraint also drops its index. priceOn/listPrices filter on
-- facility_id and sort by (effective_date, created_at), so keep an index for them.
create index prices_facility_effective_created_idx
  on public.prices (facility_id, effective_date, created_at);

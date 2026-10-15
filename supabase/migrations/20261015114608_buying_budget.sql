-- M5. Buying: the manager's buying budget (working capital) for the current period.

alter table public.facilities
  add column buy_budget_minor bigint not null default 0 check (buy_budget_minor >= 0),
  -- Purchases priced on or after this date count as used; null counts all.
  add column buy_budget_start date;

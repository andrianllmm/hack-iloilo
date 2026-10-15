-- M6. Gate: what the encoder records at check-in.
-- Ownership chosen for phone and walk-in check-ins (bookings and offers derive it),
-- and the client's estimated kg shown in the live queue.

alter table public.queue_entries
  add column ownership public.batch_ownership,
  add column est_kg integer check (est_kg > 0);

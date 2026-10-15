-- M4/M10: the new date M10 proposes while a booking is `reschedule_proposed`.
-- The booking keeps `scheduled_date` until the client answers YES.

alter table public.bookings add column proposed_date date;

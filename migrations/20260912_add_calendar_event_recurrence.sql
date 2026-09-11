-- Additive only: existing ordinary calendar events remain unchanged and are
-- interpreted by the application as recurrence { type: "none" }.
alter table public.calendar_events
  add column if not exists recurrence jsonb not null default '{"type":"none"}'::jsonb,
  add column if not exists recurrence_end_date date null;

create index if not exists calendar_events_recurrence_end_date_idx
  on public.calendar_events (recurrence_end_date);

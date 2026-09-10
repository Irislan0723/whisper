-- Extends the existing independent calendar_courses table.  This is additive
-- only: legacy course rows remain valid and are treated as weekly courses.
alter table public.calendar_courses
  add column if not exists term text not null default '',
  add column if not exists week_type text not null default 'all',
  add column if not exists weeks jsonb not null default '[]'::jsonb,
  add column if not exists note text not null default '',
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'calendar_courses_week_type_check'
      and conrelid = 'public.calendar_courses'::regclass
  ) then
    alter table public.calendar_courses
      add constraint calendar_courses_week_type_check
      check (week_type in ('all', 'odd', 'even', 'list'));
  end if;
end $$;

create index if not exists calendar_courses_term_idx
  on public.calendar_courses (term);

-- Some letters only carry a month ("January 2026"); the app then shows the
-- month and year instead of an invented day.
alter table letters add column if not exists published_precision text not null default 'day'
  check (published_precision in ('day','month'));

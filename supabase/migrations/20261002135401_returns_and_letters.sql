-- Investor returns (from 13F filings) and investor letters. Adds tables only;
-- no existing rows change.
--
-- investor_returns: one row per investor and calendar month. The return is
-- that of the investor's latest 13F long stock positions, held from the
-- report date with their reported weights (see
-- ingestion/outsider_ingest/pipelines/compute_returns.py). coverage is the
-- share of the 13F's stock value that could be priced.
-- benchmark_returns: the same months for an index fund (SPY).
-- return_symbols: CUSIP -> ticker for old 13F positions. Kept apart from
-- securities on purpose: the daily price job refreshes every security, and
-- ten years of former positions would flood it.
-- letters: investor letters, memos and public letters to companies, with a
-- structured summary (headline, takeaways, risks, quotes, stocks discussed).
begin;

create table if not exists investor_returns (
  entity_id      bigint not null references entities(id) on delete cascade,
  month          date not null check (extract(day from month) = 1),
  ret            double precision not null,
  coverage       real,
  positions      integer,
  holdings_as_of date,
  partial        boolean not null default false,
  computed_at    timestamptz not null default now(),
  primary key (entity_id, month)
);

create table if not exists benchmark_returns (
  symbol      text not null,
  month       date not null check (extract(day from month) = 1),
  ret         double precision not null,
  partial     boolean not null default false,
  computed_at timestamptz not null default now(),
  primary key (symbol, month)
);

create table if not exists return_symbols (
  cusip      text primary key,
  ticker     text,
  name       text,
  checked_at timestamptz not null default now()
);

create table if not exists letters (
  id           bigint generated always as identity primary key,
  slug         text not null unique,
  entity_id    bigint references entities(id) on delete set null,
  author       text not null,
  org          text,
  kind         text not null check (kind in ('annual_letter','quarterly_letter','memo','activist_letter','commentary')),
  title        text not null,
  published_on date not null,
  source_url   text not null,
  source_name  text,
  stance       text not null check (stance in ('bullish','neutral','bearish')),
  headline     text not null,
  summary      text not null,
  takeaways    jsonb not null default '[]'::jsonb,
  views        jsonb not null default '[]'::jsonb,
  risks        jsonb not null default '[]'::jsonb,
  quotes       jsonb not null default '[]'::jsonb,
  stocks       jsonb not null default '[]'::jsonb,
  summarized_by text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists letters_published_idx on letters (published_on desc);
create index if not exists letters_entity_idx on letters (entity_id, published_on desc);
create index if not exists letters_stocks_idx on letters using gin (stocks jsonb_path_ops);

-- Same access model as every other table: row level security on, read-only
-- for the server's reader role, nothing for the Data API roles.
do $$ declare table_name text;
begin
  foreach table_name in array array['investor_returns','benchmark_returns','return_symbols','letters'] loop
    execute format('alter table public.%I enable row level security', table_name);
    if exists (select 1 from pg_roles where rolname = 'outsider_reader') then
      execute format('grant select on public.%I to outsider_reader', table_name);
      execute format('drop policy if exists outsider_server_read on public.%I', table_name);
      execute format('create policy outsider_server_read on public.%I for select to outsider_reader using (true)', table_name);
    end if;
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on public.%I from anon', table_name);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on public.%I from authenticated', table_name);
    end if;
  end loop;
end $$;

commit;

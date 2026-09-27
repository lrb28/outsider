-- Generated with Supabase CLI. Apply after db/migrations/0001_init.sql.
-- No rows are deleted. Ingestion activates corrected rows per filing atomically.
begin;
alter table public.transactions add column if not exists transaction_code text;
alter table public.transactions add column if not exists is_derivative boolean not null default false;
alter table public.transactions add column if not exists acquired_disposed text;
alter table public.transactions add column if not exists source_line text;
alter table public.transactions add column if not exists superseded boolean not null default false;

-- Preserve the legacy constraint only for records without source-row identity.
drop index if exists public.transactions_dedupe_idx;
create unique index transactions_dedupe_idx
  on public.transactions (filing_id, security_id, txn_type, put_call, coalesce(txn_date,'1900-01-01'))
  where source_line is null;
create unique index if not exists transactions_source_line_idx
  on public.transactions (filing_id, entity_id, source_line) where source_line is not null;
create index if not exists transactions_active_disclosed_idx
  on public.transactions (disclosed_at desc nulls last, id desc) where not superseded;

create table if not exists public.ingestion_price_attempts (
  security_id bigint primary key references public.securities(id),
  last_attempt timestamptz not null,
  outcome text not null check (outcome in ('updated','stale','empty','failed'))
);

-- The application uses a server-side SQL connection. Browser API roles receive
-- no direct privileges. An explicit reader role can be granted to a dedicated
-- login after the deployment's connection and ingestion roles are verified.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'outsider_reader') then
    create role outsider_reader nologin;
  end if;
end $$;
grant usage on schema public to outsider_reader;
do $$ declare table_name text; role_name text;
begin
  foreach table_name in array array['entities','securities','filings','transactions','holdings','prices','short_interest','symbols_cache','ingestion_price_attempts'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from public', table_name);
    foreach role_name in array array['anon','authenticated'] loop
      if exists (select 1 from pg_roles where rolname = role_name) then
        execute format('revoke all on public.%I from %I', table_name, role_name);
      end if;
    end loop;
    execute format('grant select on public.%I to outsider_reader', table_name);
    execute format('drop policy if exists outsider_server_read on public.%I', table_name);
    execute format('create policy outsider_server_read on public.%I for select to outsider_reader using (true)', table_name);
  end loop;
end $$;
commit;

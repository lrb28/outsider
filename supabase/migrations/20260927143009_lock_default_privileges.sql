-- Apply after 20260914185135_audit_disclosure_integrity.sql. No rows are changed.
--
-- Outsider reads the database only through server-side SQL. The Supabase Data
-- API (anon/authenticated keys) is never used. This migration makes sure a
-- table added later — by hand, by a tool or by an AI assistant — cannot become
-- readable or writable through that API by accident.
begin;

-- 1. Supabase grants anon/authenticated full rights on every new table,
--    sequence and function in public by default. Remove those defaults for
--    objects created by the role running this migration (postgres in the SQL
--    editor / CLI), and remove any such rights that already exist on objects
--    no earlier migration knows about.
do $$ declare role_name text;
begin
  foreach role_name in array array['anon','authenticated'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('alter default privileges in schema public revoke all on tables from %I', role_name);
      execute format('alter default privileges in schema public revoke all on sequences from %I', role_name);
      execute format('alter default privileges in schema public revoke all on functions from %I', role_name);
      execute format('revoke all on all tables in schema public from %I', role_name);
      execute format('revoke all on all sequences in schema public from %I', role_name);
      execute format('revoke all on all functions in schema public from %I', role_name);
    end if;
  end loop;
end $$;

-- 2. PostgreSQL itself lets PUBLIC (and so anon/authenticated) execute every
--    new function, which the Data API would expose as RPC. A per-schema revoke
--    cannot remove that built-in default, so revoke it for the running role.
alter default privileges revoke execute on functions from public;
revoke execute on all functions in schema public from public;

-- 3. Safety net: every existing table in public gets row level security, even
--    tables that no earlier migration knows about. Table owners (the ingestion
--    and current server connection) are not affected; outsider_reader keeps
--    its explicit policies from the audit migration.
do $$ declare t record;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity
  loop
    execute format('alter table public.%I enable row level security', t.relname);
  end loop;
end $$;
commit;

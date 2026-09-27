-- Dedicated read-only login for the Vercel deployment. No rows are changed.
--
-- The web app only runs SELECTs. It should not connect as postgres, which owns
-- every table and could change or delete data. outsider_web inherits the read
-- grants and RLS policies of outsider_reader and nothing else.
--
-- The role is created WITHOUT a password, so it cannot log in yet. Set one in
-- the Supabase SQL editor (never commit it):
--   alter role outsider_web password '<long random password>';
-- Pooler user name: outsider_web.<project-ref>
begin;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'outsider_web') then
    create role outsider_web login inherit connection limit 20 in role outsider_reader;
  end if;
end $$;

-- Backstops in case the app's own limits are bypassed.
alter role outsider_web set default_transaction_read_only = on;
alter role outsider_web set statement_timeout = '8s';
alter role outsider_web set idle_in_transaction_session_timeout = '15s';

commit;

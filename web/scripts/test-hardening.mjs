import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const RL = (await import('./rateLimit.cjs')).default;
const route = async name => (await import(`./route-${name}.cjs`)).default.GET;
const request = (path, ip) => ({nextUrl:new URL(path,'http://localhost'), headers:new Headers(ip ? {'x-real-ip':ip} : {})});

test('database TLS trusts the Supabase root CA only for Supabase hosts', async () => {
  const DB = (await import('./db.cjs')).default;
  for (const host of ['aws-0-eu-west-1.pooler.supabase.com','db.jlyjosdtljwiqmefogje.supabase.co']) {
    assert.match(DB.trustedCa(host,''),/BEGIN CERTIFICATE/,host);
  }
  assert.equal(DB.trustedCa('db.example.com',''),undefined,'other hosts keep the default trust store');
  assert.equal(DB.trustedCa('evilsupabase.com',''),undefined);
  assert.equal(DB.trustedCa('aws-0-eu-west-1.pooler.supabase.com','A\\nB'),'A\nB','configured CA wins');
});

test('rate limiter: bounded window, separate clients, reset after window', () => {
  const check = RL.createRateLimiter();
  const rule = {limit:3, windowMs:1_000};
  for (let i=0;i<3;i++) assert.equal(check('a',rule,0).allowed,true);
  const blocked = check('a',rule,500);
  assert.equal(blocked.allowed,false); assert.equal(blocked.retryAfterSec,1);
  assert.equal(check('b',rule,500).allowed,true,'other client has its own budget');
  assert.equal(check('a',rule,1_000).allowed,true,'new window');
});

test('rate limiter: memory stays bounded under many client keys', () => {
  const check = RL.createRateLimiter(10);
  for (let i=0;i<1_000;i++) check(`ip-${i}`,{limit:1,windowMs:60_000},0);
  assert.equal(check('ip-999',{limit:1,windowMs:60_000},1).allowed,false,'recent key is still tracked');
});

test('client key uses platform headers and never throws without headers', () => {
  assert.equal(RL.clientKey(new Headers({'x-forwarded-for':'198.51.100.7, 10.0.0.1'})),'198.51.100.7');
  assert.equal(RL.clientKey(new Headers({'x-real-ip':'203.0.113.1','x-forwarded-for':'1.1.1.1'})),'203.0.113.1');
  assert.equal(RL.clientKey(undefined),'unknown');
});

test('upstream proxy routes answer 429 after the per-client budget', async () => {
  for (const [name, path] of [['quotes','/api/quotes?tickers='],['history','/api/history?tickers='],['resolve','/api/resolve?ids=']]) {
    const GET = await route(name);
    for (let i=0;i<RL.UPSTREAM_RULE.limit;i++) assert.notEqual((await GET(request(path,'203.0.113.50'))).status,429);
    const limited = await GET(request(path,'203.0.113.50'));
    assert.equal(limited.status,429,name); assert.ok(Number(limited.headers.get('retry-after'))>=1);
    assert.notEqual((await GET(request(path,'203.0.113.51'))).status,429,'another client is unaffected');
  }
});

const db = new PGlite();
after(async () => { await db.close(); });

test('PostgreSQL: new tables are never exposed to the Supabase Data API roles', async () => {
  // Reproduce Supabase defaults: anon/authenticated receive rights on new objects.
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated;`);
  await db.exec(await readFile(join(process.env.OUTSIDER_REPO,'db/migrations/0001_init.sql'),'utf8'));
  await db.exec('CREATE TABLE public.unlisted_manual_table (id int)');
  await db.exec(`CREATE FUNCTION public.unlisted_manual_rpc() RETURNS int LANGUAGE sql AS 'select 1'`);
  const folder = join(process.env.OUTSIDER_REPO,'supabase/migrations');
  for (const file of (await readdir(folder)).filter(f=>f.endsWith('.sql')).sort()) {
    const sql = await readFile(join(folder,file),'utf8'); await db.exec(sql); await db.exec(sql);
  }
  const noRls = await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity`);
  assert.deepEqual(noRls.rows,[],'every public table has row level security');
  const web = await db.query(`select has_table_privilege('outsider_web','public.transactions','SELECT') as can_read,
    has_table_privilege('outsider_web','public.transactions','INSERT,UPDATE,DELETE') as can_write,
    (select rolconfig from pg_roles where rolname='outsider_web') as config`);
  assert.equal(web.rows[0].can_read,true,'web login reads through outsider_reader');
  assert.equal(web.rows[0].can_write,false,'web login cannot change data');
  assert.ok(web.rows[0].config.includes('default_transaction_read_only=on'));
  await db.exec('CREATE TABLE public.future_feature (id serial primary key, email text)');
  await db.exec(`CREATE FUNCTION public.future_rpc() RETURNS int LANGUAGE sql AS 'select 1'`);
  for (const role of ['anon','authenticated']) {
    for (const fn of ['public.future_rpc()','public.unlisted_manual_rpc()']) {
      const {rows} = await db.query(`select has_function_privilege($1,$2,'EXECUTE') as ok`,[role,fn]);
      assert.equal(rows[0].ok,false,`${role} EXECUTE ${fn}`);
    }
    for (const table of ['public.future_feature','public.unlisted_manual_table']) {
      for (const privilege of ['SELECT','INSERT','UPDATE','DELETE']) {
        const {rows} = await db.query('select has_table_privilege($1,$2,$3) as ok',[role,table,privilege]);
        assert.equal(rows[0].ok,false,`${role} ${privilege} ${table}`);
      }
    }
    await db.exec(`SET ROLE ${role}`);
    await assert.rejects(db.query('select * from future_feature'),e=>e.code==='42501');
    await db.exec('RESET ROLE');
  }
});

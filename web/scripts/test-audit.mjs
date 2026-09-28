import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import * as V from './valuation.mjs';
import * as F from './format.mjs';
import * as A from './apiValidation.mjs';
import * as Q from './queries.mjs';
import * as S from './stats.mjs';
import * as HTTP from './fetchJson.mjs';
import * as P from './portfolio.mjs';
import * as W from './watchlist.mjs';
const b = (date, close) => ({date,close});
const db = new PGlite();
after(async () => {delete globalThis.__testPool; await db.close();});
const route = async name => (await import(`./route-${name}.cjs`)).default.GET;
const request = path => ({nextUrl:new URL(path,'http://localhost')});

test('FX: same currency, USD/EUR, Pence, absent and stale rates', () => {
  assert.equal(V.conversionFactor('EUR','EUR',null,'2026-09-11'),1);
  assert.equal(V.conversionFactor('USD','EUR',[b('2026-09-11',1.25)],'2026-09-11'),0.8);
  assert.equal(V.conversionFactor('GBp','GBP',null,'2026-09-11'),0.01);
  assert.equal(V.fxSymbol('GBp','EUR'),'EURGBP=X');
  assert.equal(V.conversionFactor('JPY','EUR',null,'2026-09-11'),null);
  assert.equal(V.conversionFactor(null,'EUR',null,'2026-09-11'),null);
  assert.equal(V.conversionFactor('USD','EUR',[b('2026-08-11',1.2)],'2026-09-11'),null);
});
test('FX histories never look ahead or fill a missing conversion with 1', () => {
  assert.deepEqual(V.convertHistory([b('2026-09-09',100),b('2026-09-11',120)],'USD','EUR',[b('2026-09-10',1.2)]),[b('2026-09-11',100)]);
  assert.deepEqual(V.convertHistory([b('2026-09-11',100)],'JPY','EUR',null),[]);
});
test('daily absolute change uses shares × price delta, handles missing data', () => {
  assert.equal(V.dailyChange(10,110,100,0.8),80);
  assert.equal(V.dailyChange(10,110,null,0.8),null);
  assert.equal(V.dailyChange(10,110,100,null),null);
});
test('disclosure language distinguishes 13F, grants, tax withholding and P/S', () => {
  const row = {entityType:'corporate_insider',txnType:'buy',putCall:null};
  assert.equal(F.tradeSignal(row).tone,'neutral');
  assert.equal(F.tradeSignal({...row,transactionCode:'P'}).tone,'bull');
  assert.equal(F.tradeSignal({...row,transactionCode:'A'}).tone,'neutral');
  assert.equal(F.tradeSignal({...row,transactionCode:'F',txnType:'sell'}).tone,'neutral');
  assert.equal(F.tradeSignal({...row,entityType:'institution'}).tone,'neutral');
  assert.equal(F.tradeSignal({...row,transactionCode:'P',isDerivative:true}).tone,'neutral');
  assert.equal(F.sizeDisplay({shares:0.125,amount_min:null,amount_max:null}),'0,125 St.');
  assert.equal(F.sourceLink('javascript:alert(1)'),null);
});
test('strict API parameters reject overflow, dates and symbols', () => {
  for (const value of ['-1','1.5','Infinity','1e2','9007199254740999']) assert.throws(() => A.integerParam(new URLSearchParams({limit:value}),'limit',24,1,200));
  assert.throws(() => A.dateParam(new URLSearchParams({from:'2026-02-30'}),'from'));
  assert.throws(() => A.symbolList('AAPL,<script>',30));
  assert.deepEqual(A.symbolList('aapl,AAPL,^GDAXI',30),['AAPL','^GDAXI']);
});
test('HTTP errors are distinct from empty data and 4xx are not retried', async () => {
  const original = globalThis.fetch; let calls=0;
  globalThis.fetch = async () => {calls++;return new Response('{}',{status:400});};
  try { await assert.rejects(HTTP.fetchJson('/x'),HTTP.HttpError);assert.equal(calls,1); }
  finally {globalThis.fetch = original;}
});
test('API failure mode never silently substitutes sample data', async () => {
  delete process.env.DATABASE_URL; delete process.env.OUTSIDER_DEMO_MODE;delete globalThis.__testPool;
  for(const name of ['trades','prices','stats','discover']) {const GET=await route(name);const response=await GET(request(name==='prices'?'/api/prices?ticker=MSFT':`/api/${name}`));assert.equal(response.status,503,name);assert.equal((await response.json()).source,'unavailable');}
});
test('explicit demo mode is labelled and pagination has no overlap', async () => {
  process.env.OUTSIDER_DEMO_MODE='true';const GET=await route('trades');
  const first=await(await GET(request('/api/trades?limit=3'))).json();
  const second=await(await GET(request(`/api/trades?limit=3&offset=${first.nextOffset}`))).json();
  assert.equal(first.source,'sample');assert.equal(first.rows.length,3);assert.ok(second.rows.every(r=>!first.rows.some(a=>a.id===r.id)));
  const prices=await(await(await route('prices'))(request('/api/prices?ticker=MSFT'))).json();assert.deepEqual(prices.bars,[]);
  delete process.env.OUTSIDER_DEMO_MODE;
});
test('API boundaries reject oversize batches instead of truncating', async () => {
  for (const [name,path] of [['quotes',`/api/quotes?tickers=${Array.from({length:31},(_,i)=>`X${i}`).join(',')}`],['history','/api/history?tickers=MSFT&range=6y'],['resolve','/api/resolve?ids=invalid'],['trades','/api/trades?limit=201'],['trades','/api/trades?from=2026-09-12&to=2026-09-01']]) assert.equal((await(await route(name))(request(path))).status,400,name);
});
test('quotes without source timestamps are omitted, never dated now', async () => {
  const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({chart:{result:[{meta:{regularMarketPrice:100,currency:'USD'}}]}});
  try {const result=await(await(await route('quotes'))(request('/api/quotes?tickers=TEST'))).json();assert.deepEqual(result.quotes,{});assert.deepEqual(result.missing,['TEST']);}finally{globalThis.fetch=original;}
});
test('local storage failures preserve data and report a useful event', () => {
  const originalWindow=globalThis.window;const events=[];
  const stored=JSON.stringify([P.makeTxn({kind:'interest',amount:3})]);
  globalThis.window={localStorage:{getItem:key=>key.includes('txns') ? stored : JSON.stringify('invalid-array'),setItem:()=>{throw new Error('QuotaExceededError');}},dispatchEvent:event=>{events.push(event.type);}};
  try {assert.equal(P.getTxns().length,1);assert.deepEqual(W.getFollowed('stock'),[]);assert.throws(()=>P.setTxns([]));assert.throws(()=>W.toggleFollow('stock','MSFT'));assert.equal(events.filter(e=>e==='storage-error').length,2);assert.equal(P.getTxns().length,1);}
  finally {globalThis.window=originalWindow;}
});
test('PostgreSQL: additive migration preserves old rows and supports multiple source lines', async () => {
  await db.exec(await readFile(join(process.env.OUTSIDER_REPO,'db/migrations/0001_init.sql'),'utf8'));
  await db.exec("CREATE ROLE anon; CREATE ROLE authenticated;");
  await db.exec(`INSERT INTO entities(type,full_name,slug) VALUES ('corporate_insider','TEST OWNER','test-owner'),('institution','Test Fund','test-fund'),('politician','Test Person','test-person');
    INSERT INTO securities(ticker,name) VALUES ('TEST','Test Company'),('OLD','Old Price Company');
    INSERT INTO filings(source,form_type,entity_id,filed_at,period_of_report,source_url) VALUES ('sec_edgar','4',1,current_date,current_date,'https://www.sec.gov/test'),('sec_edgar','13F-HR',2,current_date,'2026-06-30','https://www.sec.gov/fund'),('sec_edgar','13F-HR',2,current_date-90,'2026-03-31','https://www.sec.gov/fund-old');
    INSERT INTO transactions(filing_id,entity_id,security_id,txn_type,disclosed_at,shares) VALUES(1,1,1,'buy',current_date,5);`);
  const folder=join(process.env.OUTSIDER_REPO,'supabase/migrations');const file=(await readdir(folder)).find(f=>f.endsWith('audit_disclosure_integrity.sql'));const sql=await readFile(join(folder,file),'utf8');await db.exec(sql);await db.exec(sql);
  assert.equal((await db.query('select count(*)::int as n from transactions')).rows[0].n,1);
  await db.exec(`UPDATE transactions SET superseded=true WHERE source_line IS NULL;
    INSERT INTO transactions(filing_id,entity_id,security_id,txn_type,disclosed_at,txn_date,shares,transaction_code,source_line) VALUES
      (1,1,1,'buy',current_date,current_date,0.125,'P','nonDerivativeTable:0'),
      (1,1,1,'buy',current_date,current_date,2,'P','nonDerivativeTable:1'),
      (1,1,1,'exchange',current_date,current_date,30,'A','nonDerivativeTable:2'),
      (1,1,2,'buy',current_date-1,current_date-1,10,'P','nonDerivativeTable:3'),
      (2,2,1,'buy',current_date,null,10,null,'13f:TEST:stock'),
      (3,2,2,'buy',current_date-90,'2026-03-31',99,null,'13f:OLD:stock');
    INSERT INTO holdings(filing_id,entity_id,security_id,as_of_date,shares,market_value) VALUES(2,2,1,'2026-06-30',10,1000),(3,2,2,'2026-03-31',99,9900);
    INSERT INTO prices(security_id,date,close) VALUES(1,current_date,110),(1,current_date-1,100),(2,current_date-30,55);`);
  globalThis.__testPool={query:(sql,params)=>db.query(sql,params)};
  const rows=await Q.getTrades({limit:200});assert.equal(rows.length,6);assert.ok(!rows.some(r=>r.id==='1'));assert.equal(rows.find(r=>r.transactionCode==='A').txnType,'exchange');
  const fractional=rows.find(r=>r.sizeDisplay==='0,125 St.');assert.ok(fractional);assert.equal(fractional.transactionCode,'P');
  assert.equal(rows.find(r=>r.ticker==='OLD').pctSinceDisclosure,null);
  assert.equal(rows.find(r=>r.entityType==='institution').txnDate,null);
  assert.equal((await Q.getDiscover()).mostBoughtQ[0].ticker,'TEST');
  const discover=await Q.getDiscover();assert.ok(!discover.mostBoughtQ.some(r=>r.ticker==='OLD'));assert.equal(discover.insiderBuys.find(r=>r.ticker==='TEST').metric,'1 Insider','two purchases by one insider count once');
  assert.equal((await Q.getTrades({q:'%'})).length,0,'search percent is literal');
  const stats=await S.getStats();assert.equal(stats.trades,6);assert.equal(stats.freshPriceSymbols,1);assert.equal(stats.groups.find(g=>g.type==='politician').missingDates,0);
});
test('PostgreSQL RLS: anonymous and authenticated roles denied, reader cannot write', async () => {
  for (const roleName of ['anon','authenticated']) {await db.exec(`SET ROLE ${roleName}`);await assert.rejects(db.query('select * from transactions'),e=>e.code==='42501');await db.exec('RESET ROLE');}
  await db.exec('SET ROLE outsider_reader');assert.ok((await db.query('select * from transactions')).rows.length>0);await assert.rejects(db.query('delete from transactions'),e=>e.code==='42501');await db.exec('RESET ROLE');
});

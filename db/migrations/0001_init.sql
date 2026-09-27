-- Outsider — canonical schema (Postgres / Supabase)
-- One unified trade model for three worlds: politicians, corporate insiders,
-- institutions. Actor kind is distinguished only by entities.type, so the feed,
-- filters, ticker pages and performance math work identically for all three.
--
-- Apply:  psql "$DATABASE_URL" -f db/migrations/0001_init.sql
--   (or paste into the Supabase SQL editor)

begin;

-- ── entities ────────────────────────────────────────────────────────────────
create table if not exists entities (
    id           bigint generated always as identity primary key,
    type         text not null check (type in ('politician','corporate_insider','institution')),
    full_name    text not null,
    slug         text not null unique,
    org_name     text,
    role         text,                 -- CEO/Director (insiders); PM (institutions)
    party        text,                 -- politicians
    chamber      text,                 -- 'House' | 'Senate'
    highlight    boolean not null default false,
    external_ids jsonb not null default '{}'::jsonb,   -- {cik, bioguide_id, ...}
    created_at   timestamptz not null default now()
);
create index if not exists entities_type_idx on entities (type);

-- ── securities ──────────────────────────────────────────────────────────────
create table if not exists securities (
    id         bigint generated always as identity primary key,
    ticker     text,
    figi       text unique,            -- FIGI is the stable identity (nullable)
    cusip      text unique,            -- from 13F; unique so we can upsert by it
    name       text,
    exchange   text,
    asset_type text,
    created_at timestamptz not null default now()
);
create index if not exists securities_ticker_idx on securities (ticker);

-- ── filings ─────────────────────────────────────────────────────────────────
create table if not exists filings (
    id               bigint generated always as identity primary key,
    source           text not null,    -- 'sec_edgar' | 'house_fd' | 'senate_efd'
    form_type        text not null,    -- '13F-HR' | '4' | 'SC 13D' | 'P' ...
    entity_id        bigint not null references entities(id) on delete cascade,
    filed_at         date,
    period_of_report date,
    source_url       text not null unique,   -- audit: every number traces here
    raw_ref          text,             -- storage path of the raw filing we kept
    created_at       timestamptz not null default now()
);
create index if not exists filings_entity_idx on filings (entity_id);

-- ── transactions (individual buys/sells; unified across actor types) ─────────
create table if not exists transactions (
    id           bigint generated always as identity primary key,
    filing_id    bigint not null references filings(id) on delete cascade,
    entity_id    bigint not null references entities(id) on delete cascade,
    security_id  bigint not null references securities(id) on delete cascade,
    txn_type     text not null check (txn_type in ('buy','sell','exchange','option')),
    txn_date     date,
    disclosed_at date,
    shares       numeric,
    price        numeric,
    amount_min   numeric,              -- politician disclosure ranges
    amount_max   numeric,
    put_call     text not null default '',   -- '' | 'Put' | 'Call'
    owner        text,                 -- self | spouse | child (politicians)
    created_at   timestamptz not null default now()
);
-- dedupe re-runs; COALESCE keeps NULL dates from defeating the unique index
create unique index if not exists transactions_dedupe_idx
    on transactions (filing_id, security_id, txn_type, put_call, coalesce(txn_date,'1900-01-01'));
create index if not exists transactions_disclosed_idx on transactions (disclosed_at desc);
create index if not exists transactions_security_idx on transactions (security_id);
create index if not exists transactions_entity_idx on transactions (entity_id);

-- ── holdings (13F portfolio snapshots; powers portfolio view + QoQ diff) ─────
create table if not exists holdings (
    id           bigint generated always as identity primary key,
    filing_id    bigint not null references filings(id) on delete cascade,
    entity_id    bigint not null references entities(id) on delete cascade,
    security_id  bigint not null references securities(id) on delete cascade,
    as_of_date   date not null,
    shares       numeric,
    market_value numeric,
    put_call     text not null default '',
    created_at   timestamptz not null default now(),
    unique (filing_id, security_id, put_call)
);
create index if not exists holdings_entity_asof_idx on holdings (entity_id, as_of_date desc);

-- ── prices (EOD cache from the PriceProvider) ───────────────────────────────
create table if not exists prices (
    security_id bigint not null references securities(id) on delete cascade,
    date        date not null,
    open        numeric,
    high        numeric,
    low         numeric,
    close       numeric not null,
    volume      bigint,
    primary key (security_id, date)
);

-- ── short interest (FINRA; Phase 2 ticker overlay) ──────────────────────────
create table if not exists short_interest (
    security_id      bigint not null references securities(id) on delete cascade,
    settlement_date  date not null,
    short_interest   numeric,
    avg_daily_volume numeric,
    days_to_cover    numeric,
    primary key (security_id, settlement_date)
);

-- ── symbols cache (CUSIP/ticker -> resolved security; ask OpenFIGI once) ─────
create table if not exists symbols_cache (
    raw_identifier text primary key,
    security_id    bigint not null references securities(id) on delete cascade,
    provider       text not null default 'openfigi',
    fetched_at     timestamptz not null default now()
);

commit;

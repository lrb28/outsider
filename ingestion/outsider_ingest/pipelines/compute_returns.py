"""Investor returns from 13F filings, month by month.

A 13F lists a fund's US long positions at the end of a quarter. Each report
is treated as a portfolio bought on the report date with the reported weights
and held until the next report (weights drift with prices in between); the
months chain into yearly returns and a CAGR. This is the usual "13F clone":
what holding the reported portfolio earned, not the fund's own result.
Trading within the quarter, shorts, options, cash, bonds, fees and non-US
listings are not in a 13F.

Prices are Yahoo's monthly closes adjusted for dividends and splits. A ticker
is used only if its unadjusted close agrees with the 13F's own price (value /
shares) on the report date, which rejects reused tickers and wrong share
classes. Positions without a usable price are left out and the rest
re-weighted; `coverage` stores how much of the reported stock value counted.

Old CUSIPs resolve through the database's securities, then OpenFIGI; results
go to return_symbols, never to securities (the daily price job refreshes every
security, and ten years of former positions would swamp it).

Daily run: an investor is computed in full the first time; afterwards only
from its latest stored report on, and only when a new 13F arrived or the
stored months are a week old.

  PYTHONPATH=. python -m outsider_ingest.pipelines.compute_returns --all
  PYTHONPATH=. python -m outsider_ingest.pipelines.compute_returns --slug berkshire-hathaway-inc --full --dry-run
"""

from __future__ import annotations

import argparse
import os
import statistics
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Iterable, Optional

import requests

from outsider_ingest import config
from outsider_ingest.aggregate import aggregate_holdings
from outsider_ingest.models import Holding13F

START = date(2015, 12, 31)          # first report used: returns start in 2016
MAX_POSITIONS = int(os.environ.get("RETURNS_MAX_POSITIONS", "400"))
VALUE_COVER = 0.97                  # take the largest positions up to 97% of value
MAX_HOLD_MONTHS = 6                 # a report stands in for at most six months
PRICE_TOLERANCE = (0.8, 1.25)       # 13F price / Yahoo price, relative to the report's median
REFRESH_DAYS = 6
RETRY_UNRESOLVED_DAYS = 60
WORKERS = int(os.environ.get("RETURNS_WORKERS", "6"))
TIME_BUDGET_S = int(os.environ.get("RETURNS_TIME_BUDGET_S", str(50 * 60)))
BENCHMARK = "SPY"


# ── Pure parts (unit-tested) ─────────────────────────────────────────────────

Month = str  # "YYYY-MM"


def month_of(d: date) -> Month:
    return f"{d.year:04d}-{d.month:02d}"


def add_months(m: Month, n: int) -> Month:
    y, mo = int(m[:4]), int(m[5:7])
    i = y * 12 + (mo - 1) + n
    return f"{i // 12:04d}-{i % 12 + 1:02d}"


def months_after(start: Month, end: Month) -> list[Month]:
    """Months after `start` up to and including `end`."""
    out, m = [], add_months(start, 1)
    while m <= end:
        out.append(m)
        m = add_months(m, 1)
    return out


def month_end(m: Month) -> date:
    first_next = add_months(m, 1)
    return date(int(first_next[:4]), int(first_next[5:7]), 1) - timedelta(days=1)


@dataclass
class Position:
    cusip: str
    name: str
    value: float
    shares: float


@dataclass
class Report:
    period: date
    filed: Optional[date]
    positions: list[Position]

    @property
    def total(self) -> float:
        return sum(p.value for p in self.positions)


@dataclass
class PriceSeries:
    """Monthly closes: month -> (close, adjusted close). `close` is split
    adjusted (Yahoo's convention), `splits` lets us undo that."""
    months: dict[Month, tuple[float, float]]
    splits: list[tuple[date, float]] = field(default_factory=list)

    def unadjusted(self, m: Month) -> Optional[float]:
        row = self.months.get(m)
        if not row:
            return None
        factor = 1.0
        end = month_end(m)
        for when, ratio in self.splits:
            if when > end and ratio > 0:
                factor *= ratio
        return row[0] * factor

    def adjusted(self, m: Month) -> Optional[float]:
        row = self.months.get(m)
        return row[1] if row else None


def report_from_holdings(period: date, filed: Optional[date], holdings: Iterable[Holding13F]) -> Report:
    """Long stock positions only: no options, no bonds (PRN), nothing empty."""
    out = [
        Position(h.cusip, h.name_of_issuer, float(h.value_usd), float(h.shares_or_prn))
        for h in aggregate_holdings(list(holdings))
        if not h.put_call and (h.sh_prn_type or "SH").upper() == "SH" and h.value_usd > 0 and h.shares_or_prn > 0
    ]
    return Report(period, filed, out)


def select_positions(report: Report, max_n: int = MAX_POSITIONS, cover: float = VALUE_COVER) -> list[Position]:
    """The largest positions up to `cover` of the value, at most `max_n`.
    Point72 reports ~4,000 lines; the tail barely moves the result."""
    total = report.total
    if total <= 0:
        return []
    out, acc = [], 0.0
    for p in sorted(report.positions, key=lambda p: -p.value):
        if len(out) >= max_n or acc >= cover * total:
            break
        out.append(p)
        acc += p.value
    return out


@dataclass
class MonthReturn:
    month: Month
    ret: float
    coverage: float
    positions: int
    holdings_as_of: date


def accepted_positions(
    report: Report,
    tickers: dict[str, Optional[str]],
    prices: dict[str, Optional[PriceSeries]],
) -> list[tuple[Position, PriceSeries]]:
    """Positions whose Yahoo price on the report date matches the 13F's."""
    start = month_of(report.period)
    cands: list[tuple[Position, PriceSeries, float]] = []
    for p in select_positions(report):
        t = tickers.get(p.cusip)
        s = prices.get(t) if t else None
        if not s or s.adjusted(start) is None:
            continue
        unadj = s.unadjusted(start)
        if not unadj or unadj <= 0:
            continue
        cands.append((p, s, (p.value / p.shares) / unadj))
    if not cands:
        return []
    # Values are in dollars, so the ratio should sit at 1. The median guards
    # against a filer that reported in the wrong unit for the whole table.
    mid = statistics.median(r for _, _, r in cands) if len(cands) >= 5 else 1.0
    lo, hi = PRICE_TOLERANCE
    return [(p, s) for p, s, r in cands if mid > 0 and lo <= r / mid <= hi]


def segment_returns(
    report: Report,
    end: Month,
    tickers: dict[str, Optional[str]],
    prices: dict[str, Optional[PriceSeries]],
) -> list[MonthReturn]:
    """Buy and hold the report's portfolio from its month to `end`."""
    start = month_of(report.period)
    total = report.total
    held = accepted_positions(report, tickers, prices)
    if not held or total <= 0:
        return []
    weights = [p.value / total for p, _ in held]
    coverage = sum(weights)
    base = [s.adjusted(start) for _, s in held]
    last = list(base)
    prev_value = 1.0
    out = []
    for m in months_after(start, end):
        value = 0.0
        for i, (_, s) in enumerate(held):
            px = s.adjusted(m)
            if px is not None and px > 0:
                last[i] = px
            # A position with no price this month (taken over, delisted)
            # keeps its last value: it became cash.
            value += weights[i] * (last[i] / base[i])
        value /= coverage
        out.append(MonthReturn(m, value / prev_value - 1, coverage, len(held), report.period))
        prev_value = value
    return out


def segment_end(reports: list[Report], i: int, now: Month) -> Month:
    start = month_of(reports[i].period)
    cap = min(add_months(start, MAX_HOLD_MONTHS), now)
    if i + 1 < len(reports):
        return min(month_of(reports[i + 1].period), cap)
    return cap


def compute_series(
    reports: list[Report],
    tickers: dict[str, Optional[str]],
    prices: dict[str, Optional[PriceSeries]],
    now: Month,
) -> list[MonthReturn]:
    out: list[MonthReturn] = []
    for i, r in enumerate(reports):
        out.extend(segment_returns(r, segment_end(reports, i, now), tickers, prices))
    return out


def benchmark_series(s: PriceSeries, first: Month, now: Month) -> list[tuple[Month, float]]:
    out, prev = [], s.adjusted(first)
    for m in months_after(first, now):
        px = s.adjusted(m)
        if px is None or prev is None:
            prev = px
            continue
        out.append((m, px / prev - 1))
        prev = px
    return out


def latest_reports(refs) -> list:
    """One 13F-HR per quarter: the last one filed (a refiled original wins)."""
    by_period = {}
    for ref in refs:
        if ref.form_type.upper() != "13F-HR" or not ref.period_of_report:
            continue
        cur = by_period.get(ref.period_of_report)
        if cur is None or (ref.filed_at or date.min) > (cur.filed_at or date.min):
            by_period[ref.period_of_report] = ref
    return [by_period[k] for k in sorted(by_period)]


# ── Prices ───────────────────────────────────────────────────────────────────

_session = requests.Session()
_session.headers.update({"User-Agent": "Mozilla/5.0 (compatible; Outsider/0.1)"})


def yahoo_symbol(ticker: str) -> str:
    # Share classes: the app writes BRK.B, Yahoo BRK-B.
    return ticker.strip().upper().replace(".", "-").replace("/", "-")


def fetch_monthly(ticker: str, since: date) -> Optional[PriceSeries]:
    period1 = int(datetime(since.year, since.month, 1, tzinfo=timezone.utc).timestamp())
    period2 = int(time.time()) + 86400
    resp = None
    for attempt, host in enumerate(("query1", "query2", "query1", "query2")):
        url = (
            f"https://{host}.finance.yahoo.com/v8/finance/chart/{yahoo_symbol(ticker)}"
            f"?period1={period1}&period2={period2}&interval=1mo&events=split"
        )
        try:
            resp = _session.get(url, timeout=12)
        except requests.RequestException:
            time.sleep(1 + attempt)
            continue
        if resp.status_code == 429:
            time.sleep(2 * (attempt + 1))
            continue
        break
    if resp is None or resp.status_code != 200:
        return None
    try:
        result = resp.json()["chart"]["result"][0]
    except (KeyError, IndexError, TypeError, ValueError):
        return None
    ts = result.get("timestamp") or []
    ind = result.get("indicators", {})
    closes = (ind.get("quote") or [{}])[0].get("close") or []
    adj = (ind.get("adjclose") or [{}])[0].get("adjclose") or closes
    offset = int(result.get("meta", {}).get("gmtoffset") or 0)
    months: dict[Month, tuple[float, float]] = {}
    for i, epoch in enumerate(ts):
        c = closes[i] if i < len(closes) else None
        a = adj[i] if i < len(adj) else None
        if c is None or a is None or c <= 0 or a <= 0:
            continue
        local = datetime.fromtimestamp(epoch + offset, tz=timezone.utc).date()
        months[month_of(local)] = (float(c), float(a))  # a later bar in the month wins
    splits = []
    for ev in (result.get("events", {}) or {}).get("splits", {}).values():
        try:
            when = datetime.fromtimestamp(int(ev["date"]), tz=timezone.utc).date()
            splits.append((when, float(ev["numerator"]) / float(ev["denominator"])))
        except (KeyError, TypeError, ValueError, ZeroDivisionError):
            continue
    return PriceSeries(months, splits) if months else None


# ── Database and orchestration ───────────────────────────────────────────────

def _institutions(conn, slug: Optional[str]):
    sql = """select id, slug, full_name, external_ids->>'cik' from entities
             where type = 'institution' and external_ids ? 'cik'"""
    args: tuple = ()
    if slug:
        sql += " and slug = %s"
        args = (slug,)
    return conn.execute(sql + " order by slug", args).fetchall()


def _known_tickers(conn) -> dict[str, Optional[str]]:
    out: dict[str, Optional[str]] = {}
    for cusip, ticker in conn.execute(
        "select cusip, ticker from return_symbols where ticker is not null "
        "or checked_at > now() - make_interval(days => %s)", (RETRY_UNRESOLVED_DAYS,)
    ).fetchall():
        out[cusip] = ticker
    # The app's own mapping wins: tickers there were repaired by hand.
    for cusip, ticker in conn.execute(
        "select sc.raw_identifier, s.ticker from symbols_cache sc join securities s on s.id = sc.security_id "
        "where s.ticker is not null"
    ).fetchall():
        out[cusip] = ticker
    for cusip, ticker in conn.execute(
        "select cusip, ticker from securities where cusip is not null and ticker is not null"
    ).fetchall():
        out[cusip] = ticker
    return out


def _resolve(conn, cusips: set[str], known: dict[str, Optional[str]], names: dict[str, str], dry_run: bool = False) -> None:
    todo = sorted(c for c in cusips if c not in known)
    if not todo:
        return
    symbols = config.get_symbol_provider()
    try:
        found = symbols.resolve_batch(todo)
    except Exception as e:  # noqa: BLE001 — unresolved positions just don't count
        print(f"  OpenFIGI unavailable ({type(e).__name__}); {len(todo)} CUSIPs stay open")
        return
    rows = []
    for c in todo:
        ident = found.get(c)
        ticker = ident.ticker if ident and ident.ticker else None
        known[c] = ticker
        rows.append((c, ticker, (ident.name if ident else None) or names.get(c)))
    print(f"  resolved {sum(1 for r in rows if r[1])} of {len(rows)} new CUSIPs")
    if dry_run:
        return
    with conn.cursor() as cur:
        cur.executemany(
            "insert into return_symbols (cusip, ticker, name, checked_at) values (%s, %s, %s, now()) "
            "on conflict (cusip) do update set ticker = excluded.ticker, name = excluded.name, checked_at = now()",
            rows,
        )
    conn.commit()


class PriceCache:
    def __init__(self, since: date):
        self.since = since
        self.series: dict[str, Optional[PriceSeries]] = {}

    def load(self, tickers: Iterable[str]) -> None:
        todo = sorted({t for t in tickers if t and t not in self.series})
        if not todo:
            return
        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            for t, s in zip(todo, pool.map(lambda t: fetch_monthly(t, self.since), todo)):
                self.series[t] = s
        print(f"  prices: {sum(1 for t in todo if self.series[t])} of {len(todo)} tickers")


def _state(conn, entity_id: int):
    return conn.execute(
        "select max(holdings_as_of), max(computed_at) from investor_returns where entity_id = %s",
        (entity_id,),
    ).fetchone()


def run_investor(conn, sec, prices: PriceCache, known, row, full: bool, dry_run: bool, now: Month) -> None:
    entity_id, slug, name, cik = row
    last_as_of, computed_at = _state(conn, entity_id)
    refs = latest_reports(sec.list_filings(cik, ["13F-HR"], since=START - timedelta(days=1), include_older=True))
    refs = [r for r in refs if r.period_of_report >= START]
    if not refs:
        print("  no 13F-HR since 2016")
        return
    cutoff = None if full or last_as_of is None else last_as_of
    if cutoff is not None:
        fresh = computed_at and computed_at > datetime.now(timezone.utc) - timedelta(days=REFRESH_DAYS)
        if refs[-1].period_of_report <= cutoff and fresh:
            print("  up to date")
            return
        refs = [r for r in refs if r.period_of_report >= cutoff]
    reports: list[Report] = []
    for ref in refs:
        holdings = sec.get_13f_holdings(ref)
        reports.append(report_from_holdings(ref.period_of_report, ref.filed_at, holdings))
    used = {p.cusip: p.name for r in reports for p in select_positions(r)}
    _resolve(conn, set(used), known, used, dry_run)
    prices.load(known.get(c) for c in used)
    series = compute_series(reports, known, prices.series, now)
    if not series:
        print("  no priced positions")
        return
    cov = [m.coverage for m in series]
    print(f"  {len(reports)} reports, {len(series)} months {series[0].month}..{series[-1].month}, "
          f"coverage {min(cov):.0%}–{max(cov):.0%}")
    if dry_run:
        for m in series[-6:]:
            print(f"    {m.month} {m.ret:+.2%} cov {m.coverage:.0%} n={m.positions}")
        return
    with conn.cursor() as cur:
        if cutoff is None:
            cur.execute("delete from investor_returns where entity_id = %s", (entity_id,))
        else:
            cur.execute(
                "delete from investor_returns where entity_id = %s and month > %s",
                (entity_id, date(cutoff.year, cutoff.month, 1)),
            )
        cur.executemany(
            "insert into investor_returns (entity_id, month, ret, coverage, positions, holdings_as_of, partial, computed_at) "
            "values (%s, %s, %s, %s, %s, %s, %s, now()) "
            "on conflict (entity_id, month) do update set ret = excluded.ret, coverage = excluded.coverage, "
            "positions = excluded.positions, holdings_as_of = excluded.holdings_as_of, partial = excluded.partial, "
            "computed_at = now()",
            [
                (entity_id, date(int(m.month[:4]), int(m.month[5:]), 1), m.ret, m.coverage, m.positions,
                 m.holdings_as_of, m.month == now)
                for m in series
            ],
        )
    conn.commit()


def run_benchmark(conn, now: Month, dry_run: bool) -> None:
    s = fetch_monthly(BENCHMARK, START)
    if not s:
        print(f"[benchmark] no prices for {BENCHMARK}")
        return
    rows = benchmark_series(s, month_of(START), now)
    print(f"[benchmark] {BENCHMARK}: {len(rows)} months")
    if dry_run:
        return
    with conn.cursor() as cur:
        cur.executemany(
            "insert into benchmark_returns (symbol, month, ret, partial, computed_at) values (%s, %s, %s, %s, now()) "
            "on conflict (symbol, month) do update set ret = excluded.ret, partial = excluded.partial, computed_at = now()",
            [(BENCHMARK, date(int(m[:4]), int(m[5:]), 1), r, m == now) for m, r in rows],
        )
    conn.commit()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--slug")
    ap.add_argument("--full", action="store_true", help="recompute every month, not just the latest report on")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if not args.all and not args.slug:
        ap.error("pass --all or --slug")

    from outsider_ingest.db import connect

    began = time.monotonic()
    now = month_of(date.today())
    sec = config.get_filings_provider("sec")
    prices = PriceCache(START - timedelta(days=31))
    failures = []
    with connect(config.DATABASE_URL) as conn:
        run_benchmark(conn, now, args.dry_run)
        known = _known_tickers(conn)
        for row in _institutions(conn, args.slug):
            if time.monotonic() - began > TIME_BUDGET_S:
                print("Time budget used up; the next run continues.")
                break
            print(f"[returns] {row[2]}")
            try:
                run_investor(conn, sec, prices, known, row, args.full, args.dry_run, now)
            except Exception as e:  # noqa: BLE001 — one fund must not stop the rest
                conn.rollback()
                print(f"  FAILED: {type(e).__name__}: {e}")
                failures.append(row[2])
    if failures:
        raise RuntimeError(f"returns failed for {len(failures)} investors: {', '.join(failures)}")


if __name__ == "__main__":
    main()

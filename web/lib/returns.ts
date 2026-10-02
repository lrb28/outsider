// Investor returns from the monthly 13F-clone series (investor_returns) and
// the S&P 500 index fund (SPY) over the same months. Pure functions, so the
// API and the tests share them.
//
// A month is "YYYY-MM". The current month is still running ("partial").

export interface MonthReturn {
  month: string;
  ret: number;
  coverage?: number | null;
}

export interface YearReturn {
  year: number;
  ret: number;
  bench: number | null;
  /** Months in the series that year: under 12 for the first year and the
   *  running one (and where a fund filed late). */
  months: number;
  /** The running year. */
  current: boolean;
}

export interface ReturnSummary {
  /** First and last month of the series. */
  from: string;
  through: string;
  months: number;
  /** Compound annual growth over the whole series; null under two years. */
  cagr: number | null;
  benchCagr: number | null;
  /** The last twelve months (to the latest close). */
  oneYear: number | null;
  benchOneYear: number | null;
  total: number;
  benchTotal: number | null;
  /** Average share of the reported stock value that could be priced, last
   *  twelve months. Low coverage means the figure says less. */
  coverage: number | null;
  yearly: YearReturn[];
  /** Growth of 1 over the series, month by month, with the index alongside. */
  growth: { month: string; value: number; bench: number | null }[];
}

const compound = (rs: number[]) => rs.reduce((g, r) => g * (1 + r), 1) - 1;

export function annualize(total: number, months: number): number | null {
  if (months < 24 || total <= -1) return null;
  return Math.pow(1 + total, 12 / months) - 1;
}

export function addMonths(month: string, n: number): string {
  const i = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
}

export function summarize(series: MonthReturn[], benchmark: MonthReturn[]): ReturnSummary | null {
  const rows = [...series].filter((r) => Number.isFinite(r.ret)).sort((a, b) => a.month.localeCompare(b.month));
  if (!rows.length) return null;
  const bench = new Map(benchmark.map((b) => [b.month, b.ret]));
  const from = rows[0].month;
  const through = rows[rows.length - 1].month;
  // The index over the same months as the investor, so both cover equal time.
  const benchFor = (rs: MonthReturn[]) => {
    const got = rs.map((r) => bench.get(r.month));
    return got.every((v) => v !== undefined) ? compound(got as number[]) : null;
  };

  const total = compound(rows.map((r) => r.ret));
  const benchTotal = benchFor(rows);
  const lastYear = rows.filter((r) => r.month > addMonths(through, -12));
  const covered = lastYear.filter((r) => r.coverage != null);

  const byYear = new Map<number, MonthReturn[]>();
  for (const r of rows) {
    const y = Number(r.month.slice(0, 4));
    byYear.set(y, [...(byYear.get(y) ?? []), r]);
  }
  const currentYear = Number(through.slice(0, 4));
  const yearly = [...byYear.entries()].map(([year, rs]) => ({
    year,
    ret: compound(rs.map((r) => r.ret)),
    bench: benchFor(rs),
    months: rs.length,
    current: year === currentYear,
  }));

  let value = 1;
  let benchValue: number | null = 1;
  const growth = rows.map((r) => {
    value *= 1 + r.ret;
    const b = bench.get(r.month);
    benchValue = benchValue === null || b === undefined ? null : benchValue * (1 + b);
    return { month: r.month, value, bench: benchValue };
  });

  return {
    from,
    through,
    months: rows.length,
    cagr: annualize(total, rows.length),
    benchCagr: benchTotal === null ? null : annualize(benchTotal, rows.length),
    oneYear: lastYear.length >= 12 ? compound(lastYear.map((r) => r.ret)) : null,
    benchOneYear: lastYear.length >= 12 ? benchFor(lastYear) : null,
    total,
    benchTotal,
    coverage: covered.length ? covered.reduce((a, r) => a + (r.coverage as number), 0) / covered.length : null,
    yearly,
    growth,
  };
}

/** Below this share of priced value a return is shown with a caution and
 *  left out of rankings. */
export const MIN_COVERAGE = 0.6;

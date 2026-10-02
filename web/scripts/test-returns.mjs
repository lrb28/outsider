// Investor return maths: compounding, years, CAGR, the index over equal months.
import assert from "node:assert/strict";
import * as R from "../.tmp-returns.mjs";

const near = (a, b, eps = 1e-9) => assert.ok(a !== null && Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const months = (from, rets, coverage = 1) => rets.map((ret, i) => ({ month: R.addMonths(from, i), ret, coverage }));

assert.equal(R.addMonths("2025-11", 2), "2026-01");
assert.equal(R.addMonths("2026-01", -13), "2024-12");

// 30 months of +1%: total, CAGR, years.
const s = R.summarize(months("2024-05", Array(30).fill(0.01)), months("2024-05", Array(30).fill(0.005)));
near(s.total, 1.01 ** 30 - 1);
near(s.cagr, 1.01 ** 12 - 1);
near(s.benchCagr, 1.005 ** 12 - 1);
near(s.oneYear, 1.01 ** 12 - 1);
assert.deepEqual(s.yearly.map((y) => [y.year, y.months, y.current]), [[2024, 8, false], [2025, 12, false], [2026, 10, true]]);
near(s.yearly[1].ret, 1.01 ** 12 - 1);
near(s.growth.at(-1).value, 1.01 ** 30);
assert.equal(s.from, "2024-05");
assert.equal(s.through, "2026-10");

// Under two years there is no CAGR, under twelve months no one-year figure.
const short = R.summarize(months("2026-01", Array(10).fill(0.02)), []);
assert.equal(short.cagr, null);
assert.equal(short.oneYear, null);
assert.equal(short.benchTotal, null, "no index figure when the index lacks months");

// A missing index month makes that year's comparison unknown, not wrong.
const gap = R.summarize(months("2025-01", Array(12).fill(0)), months("2025-01", Array(11).fill(0)));
assert.equal(gap.yearly[0].bench, null);

// Coverage averages the last twelve months only.
const cov = R.summarize([...months("2024-01", Array(12).fill(0), 0.2), ...months("2025-01", Array(12).fill(0), 0.9)], []);
near(cov.coverage, 0.9);

assert.equal(R.summarize([], []), null);
console.log("  ✓ investor returns");

// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

// Ad Campaigns → Benchmark Grading — deterministic grading logic.
//
// Authoritative spec: grading-reference.py + benchmark-grading-spec.md (2026.10).
// Verified to agree campaign-for-campaign with the Python reference implementation.
//
// Grading methodology:
//   Every campaign is scored on one conversion metric and one cost metric.
//   Which pair depends on the campaign type:
//     • LinkedIn lead generation      — form completion rate + CPL
//     • LinkedIn website / engagement — CTR + CPC
//     • LinkedIn brand awareness      — CTR + CPM
//     • LinkedIn Sponsored Messaging  — open rate + cost per click
//     • Google Search                 — CTR + CPC, using WSO2 regional benchmarks
//
//   Conversion ratio = actual ÷ benchmark (above 1.0 = better)
//   Cost ratio       = benchmark ÷ actual  (above 1.0 = better)
//   Both ratios are capped between 0.1× and 4×.
//   Index = √(conversionRatio × costRatio)
//     ≥ 1.05 → "At benchmark"  (or "Optimize" when the cost ratio is below 1)
//     ≥ 0.80 → "Close"
//     < 0.80 → "Below"
//     Too little volume → "Too little data"
//
//   Letter grades: A ≥ 1.30 · B ≥ 1.05 · C ≥ 0.80 · D ≥ 0.50 · F < 0.50

import type {
  BenchmarkBoardRow,
  BenchmarkCampaignLine,
  BenchmarkGrade,
  GradedCampaignLine,
  LetterGrade,
  RegionCode,
} from "./benchmarkGradingTypes";

// ─── Benchmark tables ─────────────────────────────────────────────────────────

// Exported types so the editor UI can read + write the same shape.
export interface BmTableEntry { m: number; c: number }
export interface BenchmarkTables {
  lbm: Record<string, Record<string, BmTableEntry>>;
  gbm: Record<string, [number, number]>;
  sm: { openRate: number; cpc: number; minSends: number };
}

// LinkedIn benchmarks keyed by objective section → region code → { m (%), c ($) }
// m = main conversion metric (% — form completion rate OR CTR), c = cost metric ($)
const LBM: Record<string, Record<string, { m: number; c: number }>> = {
  "Lead Generation": {
    NAMER: { m: 6.52, c: 352 },
    EU: { m: 7.27, c: 135 },
    MEA: { m: 6.91, c: 69 },
    SEA: { m: 6.06, c: 104 },
    India: { m: 4.85, c: 55 },
  },
  // NAMER, EU and MEA are expensive click markets. The LinkedIn source figures
  // put their CPC benchmarks below $2, which no campaign in those markets
  // reaches. A $5.00 floor is applied to the click-costed objectives there.
  // SEA and India keep their source figures. CPL and CPM are untouched.
  "Website Visits": {
    NAMER: { m: 0.99, c: 5.00 },
    EU: { m: 0.49, c: 6.41 },
    MEA: { m: 0.66, c: 5.00 },
    SEA: { m: 0.78, c: 0.76 },
    India: { m: 0.78, c: 0.44 },
  },
  Engagement: {
    NAMER: { m: 3.01, c: 5.00 },
    EU: { m: 3.9, c: 5.00 },
    MEA: { m: 1.36, c: 5.00 },
    SEA: { m: 2.05, c: 0.29 },
    India: { m: 2.71, c: 0.13 },
  },
  "Brand Awareness": {
    NAMER: { m: 0.1, c: 6.8 },
    EU: { m: 0.1, c: 5.23 },
    MEA: { m: 0.13, c: 1.39 },
    SEA: { m: 0.07, c: 0.86 },
    India: { m: 0.14, c: 1.01 },
  },
};

// Map from LinkedIn objective string (lower-cased) to LBM section key
const OBJECTIVE_TO_SECTION: Record<string, string> = {
  "lead generation": "Lead Generation",
  "website visits": "Website Visits",
  "website conversions": "Website Visits",
  engagement: "Engagement",
  "brand awareness": "Brand Awareness",
  "video views": "Website Visits",
};

// Case-insensitive: the backend passes LinkedIn's objective label through as-is,
// and its casing isn't guaranteed to match the keys above.
function resolveObjective(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return OBJECTIVE_TO_SECTION[raw.toLowerCase()] ?? null;
}

// Map from region code to LBM region key
const REGION_TO_LBM: Record<RegionCode, string> = {
  NA: "NAMER",
  EU: "EU",
  UK: "EU",
  ME: "MEA",
  Africa: "MEA",
  APAC: "SEA",
  ANZ: "SEA",
  // LATAM and GLOBAL have no matching region → will fall through to global blend
};

// Global blend for a LinkedIn benchmark section — the most forgiving figure from
// any region: the lowest conversion requirement and the highest cost allowance.
// A global campaign spans every market and should not be judged against an
// average that no single-market campaign could meet.
function globalBlend(section: string): { m: number; c: number } | null {
  const r = LBM[section];
  if (!r) return null;
  const vals = Object.values(r);
  return {
    m: Math.min(...vals.map((v) => v.m)),
    c: Math.max(...vals.map((v) => v.c)),
  };
}

// Google Search benchmarks: region → [CTR, CPC_USD]
const GBM: Record<string, [number, number]> = {
  US: [0.036, 13.75],
  EU: [0.036, 13.75],
  UK: [0.036, 13.75],
  ANZ: [0.036, 13.75],
  India: [0.0795, 2.8875],
  "APAC ex-India / SEA": [0.0576, 6.1875],
  "Middle East": [0.0396, 8.9375],
  Africa: [0.0468, 4.125],
  LATAM: [0.0486, 5.5],
};

// Simple (non-APAC) region → Google benchmark key
const G_PREFIX: Record<string, string> = {
  NA: "US", EU: "EU", UK: "UK", ANZ: "ANZ",
  LATAM: "LATAM", Africa: "Africa", ME: "Middle East",
};

// Resolve the Google benchmark region from the campaign name.
// APAC is sub-resolved by looking for India/DPDP or Australia/Aus in the name.
function googleRegion(name: string): string | null {
  const prefix = name.split("|")[0].trim().split(/[_\s]+/)[0];
  if (prefix === "APAC") {
    if (/\b(India|DPDP)\b/i.test(name)) return "India";
    if (/\b(Australia|Aus)\b/i.test(name)) return "ANZ";
    return "APAC ex-India / SEA";
  }
  return G_PREFIX[prefix] ?? null;
}

function googleGlobalBlend(): [number, number] {
  const vals = Object.values(GBM);
  return [
    vals.reduce((a, v) => a + v[0], 0) / vals.length,
    vals.reduce((a, v) => a + v[1], 0) / vals.length,
  ];
}

// Sponsored Messaging benchmarks (DemandSense 2026)
const SM = { openRate: 0.25, cpc: 10.0, minSends: 200 };

// Export the defaults so the editor can read them and localStorage overrides can be applied.
export const DEFAULT_TABLES: BenchmarkTables = {
  lbm: LBM,
  gbm: GBM,
  sm: SM,
};

// Minimum impressions for a standard (non-SM) campaign to be gradeable
const MIN_IMPRESSIONS = 1000;

// ─── Index → grade / letter ───────────────────────────────────────────────────

function cap(v: number): number {
  return Math.min(Math.max(v, 0.1), 4.0);
}

// HTML dashboard thresholds: At benchmark ≥ 1.05, Close ≥ 0.80, Below < 0.80.
// "Optimize" is applied post-hoc when conversion clears 1.05 but cost ratio < 1.
function gradeFromIndex(idx: number): BenchmarkGrade {
  if (idx >= 1.05) return "At benchmark";
  if (idx >= 0.8) return "Close";
  return "Below";
}

// HTML letter thresholds: A ≥ 1.30 · B ≥ 1.05 · C ≥ 0.80 · D ≥ 0.50 · F < 0.50
function letterFromIndex(idx: number): LetterGrade {
  if (idx >= 1.3) return "A";
  if (idx >= 1.05) return "B";
  if (idx >= 0.8) return "C";
  if (idx >= 0.5) return "D";
  return "F";
}

function pct(v: number, decimals = 1): string {
  return `${(v * 100).toFixed(decimals)}%`;
}

function usd(v: number): string {
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function usd2(v: number): string {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Main grade() function ────────────────────────────────────────────────────

const BLANK_GRADE = {
  index: null as null,
  grade: "Too little data" as BenchmarkGrade,
  letter: "" as LetterGrade,
  benchmark_source: "",
  conversion_metric_name: "",
  conversion_benchmark: null as null,
  cost_metric_name: "",
  cost_benchmark: null as null,
  why: "",
};

export function gradeCampaign(line: BenchmarkCampaignLine): Omit<GradedCampaignLine, keyof BenchmarkCampaignLine> {
  const { spend, impressions, clicks, platform, format, objective, region } = line;

  // ── LinkedIn Sponsored Messaging ─────────────────────────────────────────
  if (platform === "linkedin" && format === "Sponsored Messaging") {
    const sends = line.sends ?? 0;
    const msgOpens = line.message_opens ?? 0;
    const msgClicks = line.message_clicks ?? 0;

    if (sends < SM.minSends || spend <= 0) {
      return { ...BLANK_GRADE, why: `Only ${sends.toLocaleString()} sends — not enough to judge.` };
    }

    const openRate = sends > 0 ? msgOpens / sends : null;
    const cpc = msgClicks > 0 ? spend / msgClicks : null;

    const r1 = openRate !== null ? cap(openRate / SM.openRate) : 1.0;
    const r2 = cpc !== null ? cap(SM.cpc / cpc) : 1.0;
    const idx = Math.sqrt(r1 * r2);

    let grade = gradeFromIndex(idx);
    if (grade === "At benchmark" && r2 < 1) grade = "Optimize";

    let why = `Index ${idx.toFixed(2)} (Sponsored Messaging). Open rate ${openRate !== null ? pct(openRate, 1) : "—"} vs ${pct(SM.openRate, 0)}`;
    if (cpc !== null) why += `. Cost per click ${usd2(cpc)} vs ${usd2(SM.cpc)}`;
    why += `. ${sends.toLocaleString()} sends, ${msgOpens.toLocaleString()} opens.`;
    if (grade === "Optimize") why += " Opening well above benchmark, but each click costs more than it should.";

    return {
      index: +idx.toFixed(2),
      grade,
      letter: letterFromIndex(idx),
      benchmark_source: "Sponsored Messaging",
      conversion_metric_name: "Open rate",
      conversion_benchmark: SM.openRate,
      cost_metric_name: "Cost per click",
      cost_benchmark: SM.cpc,
      why,
    };
  }

  // ── Minimum volume check (all other formats) ──────────────────────────────
  if (impressions < MIN_IMPRESSIONS || spend <= 0) {
    return {
      ...BLANK_GRADE,
      why: `Only ${impressions.toLocaleString()} impressions — not enough to judge.`,
    };
  }

  const ctr = impressions > 0 ? clicks / impressions : null;
  const cpc = clicks > 0 ? spend / clicks : null;

  // ── Google ────────────────────────────────────────────────────────────────
  if (platform === "google") {
    const googleKey = googleRegion(line.name);
    const benchmarkSource = googleKey ?? "Global blend";
    const [bc, bp] = googleKey && GBM[googleKey] ? GBM[googleKey] : googleGlobalBlend();

    const r1 = ctr !== null ? cap(ctr / bc) : 0.1;
    // null CPC (impressions but no clicks) is a genuine failure — penalise, not neutral
    const r2 = cpc !== null ? cap(bp / cpc) : 0.1;
    const idx = Math.sqrt(r1 * r2);

    let grade = gradeFromIndex(idx);
    if (grade === "At benchmark" && r2 < 1) grade = "Optimize";

    let why = `Index ${idx.toFixed(2)} (${benchmarkSource}). CTR ${ctr !== null ? pct(ctr, 2) : "—"} vs ${pct(bc, 2)}. `;
    why += cpc !== null ? `CPC ${usd2(cpc)} vs ${usd2(bp)}.` : `No clicks, so no CPC to compare against ${usd2(bp)}.`;
    if (grade === "Optimize") why += " Converting well but the click price is above benchmark.";

    return {
      index: +idx.toFixed(2),
      grade,
      letter: letterFromIndex(idx),
      benchmark_source: benchmarkSource,
      conversion_metric_name: "CTR",
      conversion_benchmark: bc,
      cost_metric_name: "CPC",
      cost_benchmark: bp,
      why,
    };
  }

  // ── LinkedIn (non-SM) ─────────────────────────────────────────────────────
  const section = resolveObjective(objective);
  if (!section) {
    return {
      ...BLANK_GRADE,
      why: `No benchmark exists for the ${objective ?? "unknown"} objective.`,
    };
  }

  const lbmRegion = region ? REGION_TO_LBM[region as RegionCode] : null;
  const b =
    lbmRegion && LBM[section]?.[lbmRegion] ? LBM[section][lbmRegion] : globalBlend(section);
  if (!b) {
    return { ...BLANK_GRADE, why: `Benchmark data unavailable for ${section}.` };
  }

  const benchmarkSource = lbmRegion && LBM[section]?.[lbmRegion] ? lbmRegion : "Global blend";
  const isLeadGen = section === "Lead Generation";
  const isBrandAwareness = section === "Brand Awareness";

  // Brand Awareness uses CPM rather than CPC as the cost metric
  const cpm = impressions > 0 ? (spend / impressions) * 1000 : null;

  // Conversion metric
  const formOpens = line.form_opens ?? 0;
  const leads = line.leads ?? 0;
  const formCompletionRate = isLeadGen ? (formOpens > 0 ? leads / formOpens : null) : null;

  const mainMetricValue = isLeadGen ? formCompletionRate : ctr;
  const mainMetricName = isLeadGen ? "Form completion" : "CTR";
  const mainBenchmark = b.m / 100; // LBM stores percentages, convert to ratio

  if (isLeadGen && mainMetricValue === null) {
    return {
      ...BLANK_GRADE,
      grade: "Below",
      letter: "",
      benchmark_source: benchmarkSource,
      conversion_metric_name: mainMetricName,
      conversion_benchmark: mainBenchmark,
      cost_metric_name: "CPL",
      cost_benchmark: b.c,
      why: "Nothing converting — no form opens recorded.",
    };
  }

  // Cost metric
  const costMetricName = isLeadGen ? "CPL" : isBrandAwareness ? "CPM" : "CPC";
  const cpl = leads > 0 ? spend / leads : null;
  const costMetricValue = isLeadGen ? cpl : isBrandAwareness ? cpm : cpc;
  const costBenchmark = b.c;

  const r1 = mainMetricValue !== null ? cap(mainMetricValue / mainBenchmark) : 0.1;
  const r2 = costMetricValue !== null && costBenchmark ? cap(costBenchmark / costMetricValue) : 1.0;
  const idx = Math.sqrt(r1 * r2);

  let grade = gradeFromIndex(idx);
  if (grade === "At benchmark" && r2 < 1) grade = "Optimize";

  const fmtMain = (v: number) =>
    isLeadGen ? pct(v, 1) : pct(v, 2);
  const fmtCost = (v: number) =>
    isLeadGen ? usd(v) : isBrandAwareness ? usd2(v) : usd2(v);

  let why = `Index ${idx.toFixed(2)} (${benchmarkSource}). ${mainMetricName} ${mainMetricValue !== null ? fmtMain(mainMetricValue) : "—"} vs ${fmtMain(mainBenchmark)}`;
  if (costMetricValue !== null) why += `. ${costMetricName} ${fmtCost(costMetricValue)} vs ${fmtCost(costBenchmark)}`;
  why += ".";
  if (grade === "Optimize" && mainMetricValue !== null) {
    why += ` ${mainMetricName} is ${(mainMetricValue / mainBenchmark).toFixed(1)}× benchmark, which outweighs the ${(costMetricValue !== null && costBenchmark ? costMetricValue / costBenchmark : 1).toFixed(1)}× cost — worth optimising, not cutting.`;
  } else if (grade === "Below") {
    why += " Both conversion and cost are short of the bar.";
  }

  return {
    index: +idx.toFixed(2),
    grade,
    letter: letterFromIndex(idx),
    benchmark_source: benchmarkSource,
    conversion_metric_name: mainMetricName,
    conversion_benchmark: mainBenchmark,
    cost_metric_name: costMetricName,
    cost_benchmark: costBenchmark,
    why,
  };
}

// Apply gradeCampaign() to every line and return GradedCampaignLine[].
export function gradeAll(lines: BenchmarkCampaignLine[]): GradedCampaignLine[] {
  return lines.map((line) => ({ ...line, ...gradeCampaign(line) }));
}

// Grade a single campaign with explicit (possibly overridden) benchmark tables.
// All logic is identical to gradeCampaign(); the only difference is table source.
export function gradeCampaignWith(
  line: BenchmarkCampaignLine,
  tables: BenchmarkTables,
): Omit<GradedCampaignLine, keyof BenchmarkCampaignLine> {
  const { spend, impressions, clicks, platform, format, objective, region } = line;
  const lbm = tables.lbm;
  const gbm = tables.gbm;
  const sm = tables.sm;

  if (platform === "linkedin" && format === "Sponsored Messaging") {
    const sends = line.sends ?? 0;
    const msgOpens = line.message_opens ?? 0;
    const msgClicks = line.message_clicks ?? 0;
    if (sends < sm.minSends || spend <= 0)
      return { ...BLANK_GRADE, why: `Only ${sends.toLocaleString()} sends — not enough to judge.` };
    const openRate = sends > 0 ? msgOpens / sends : null;
    const cpc = msgClicks > 0 ? spend / msgClicks : null;
    const r1 = openRate !== null ? cap(openRate / sm.openRate) : 1.0;
    const r2 = cpc !== null ? cap(sm.cpc / cpc) : 1.0;
    const idx = Math.sqrt(r1 * r2);
    let grade = gradeFromIndex(idx);
    if (grade === "At benchmark" && r2 < 1) grade = "Optimize";
    let why = `Index ${idx.toFixed(2)} (Sponsored Messaging). Open rate ${openRate !== null ? pct(openRate, 1) : "—"} vs ${pct(sm.openRate, 0)}`;
    if (cpc !== null) why += `. Cost per click ${usd2(cpc)} vs ${usd2(sm.cpc)}`;
    why += `. ${sends.toLocaleString()} sends, ${msgOpens.toLocaleString()} opens.`;
    if (grade === "Optimize") why += " Opening well above benchmark, but each click costs more than it should.";
    return { index: +idx.toFixed(2), grade, letter: letterFromIndex(idx), benchmark_source: "Sponsored Messaging", conversion_metric_name: "Open rate", conversion_benchmark: sm.openRate, cost_metric_name: "Cost per click", cost_benchmark: sm.cpc, why };
  }

  if (impressions < MIN_IMPRESSIONS || spend <= 0)
    return { ...BLANK_GRADE, why: `Only ${impressions.toLocaleString()} impressions — not enough to judge.` };

  const ctr = impressions > 0 ? clicks / impressions : null;
  const cpc = clicks > 0 ? spend / clicks : null;

  if (platform === "google") {
    const googleKey = googleRegion(line.name);
    const benchmarkSource = googleKey ?? "Global blend";
    const globalBlendGbm = (): [number, number] => {
      const vals = Object.values(gbm);
      return [vals.reduce((a, v) => a + v[0], 0) / vals.length, vals.reduce((a, v) => a + v[1], 0) / vals.length];
    };
    const [bc, bp] = googleKey && gbm[googleKey] ? gbm[googleKey] : globalBlendGbm();
    const r1 = ctr !== null ? cap(ctr / bc) : 0.1;
    const r2 = cpc !== null ? cap(bp / cpc) : 0.1;
    const idx = Math.sqrt(r1 * r2);
    let grade = gradeFromIndex(idx);
    if (grade === "At benchmark" && r2 < 1) grade = "Optimize";
    let why = `Index ${idx.toFixed(2)} (${benchmarkSource}). CTR ${ctr !== null ? pct(ctr, 2) : "—"} vs ${pct(bc, 2)}. `;
    why += cpc !== null ? `CPC ${usd2(cpc)} vs ${usd2(bp)}.` : `No clicks, so no CPC to compare against ${usd2(bp)}.`;
    if (grade === "Optimize") why += " Converting well but the click price is above benchmark.";
    return { index: +idx.toFixed(2), grade, letter: letterFromIndex(idx), benchmark_source: benchmarkSource, conversion_metric_name: "CTR", conversion_benchmark: bc, cost_metric_name: "CPC", cost_benchmark: bp, why };
  }

  const section = resolveObjective(objective);
  if (!section) return { ...BLANK_GRADE, why: `No benchmark exists for the ${objective ?? "unknown"} objective.` };

  const lbmRegion = region ? REGION_TO_LBM[region as RegionCode] : null;
  const globalBlendLbm = (sec: string): { m: number; c: number } | null => {
    const r = lbm[sec];
    if (!r) return null;
    const vals = Object.values(r);
    return { m: Math.min(...vals.map((v) => v.m)), c: Math.max(...vals.map((v) => v.c)) };
  };
  const b = lbmRegion && lbm[section]?.[lbmRegion] ? lbm[section][lbmRegion] : globalBlendLbm(section);
  if (!b) return { ...BLANK_GRADE, why: `Benchmark data unavailable for ${section}.` };
  const benchmarkSource = lbmRegion && lbm[section]?.[lbmRegion] ? lbmRegion : "Global blend";
  const isLeadGen = section === "Lead Generation";
  const isBrandAwareness = section === "Brand Awareness";
  const cpm = impressions > 0 ? (spend / impressions) * 1000 : null;
  const formOpens = line.form_opens ?? 0;
  const leads = line.leads ?? 0;
  const formCompletionRate = isLeadGen ? (formOpens > 0 ? leads / formOpens : null) : null;
  const mainMetricValue = isLeadGen ? formCompletionRate : ctr;
  const mainMetricName = isLeadGen ? "Form completion" : "CTR";
  const mainBenchmark = b.m / 100;
  if (isLeadGen && mainMetricValue === null)
    return { ...BLANK_GRADE, grade: "Below", letter: "", benchmark_source: benchmarkSource, conversion_metric_name: mainMetricName, conversion_benchmark: mainBenchmark, cost_metric_name: "CPL", cost_benchmark: b.c, why: "Nothing converting — no form opens recorded." };
  const costMetricName = isLeadGen ? "CPL" : isBrandAwareness ? "CPM" : "CPC";
  const cpl = leads > 0 ? spend / leads : null;
  const costMetricValue = isLeadGen ? cpl : isBrandAwareness ? cpm : cpc;
  const r1 = mainMetricValue !== null ? cap(mainMetricValue / mainBenchmark) : 0.1;
  const r2 = costMetricValue !== null && b.c ? cap(b.c / costMetricValue) : 1.0;
  const idx = Math.sqrt(r1 * r2);
  let grade = gradeFromIndex(idx);
  if (grade === "At benchmark" && r2 < 1) grade = "Optimize";
  const fmtMain = (v: number) => isLeadGen ? pct(v, 1) : pct(v, 2);
  const fmtCost = (v: number) => isLeadGen ? usd(v) : isBrandAwareness ? usd2(v) : usd2(v);
  let why = `Index ${idx.toFixed(2)} (${benchmarkSource}). ${mainMetricName} ${mainMetricValue !== null ? fmtMain(mainMetricValue) : "—"} vs ${fmtMain(mainBenchmark)}`;
  if (costMetricValue !== null) why += `. ${costMetricName} ${fmtCost(costMetricValue)} vs ${fmtCost(b.c)}`;
  why += ".";
  if (grade === "Optimize" && mainMetricValue !== null) why += ` ${mainMetricName} is ${(mainMetricValue / mainBenchmark).toFixed(1)}× benchmark, which outweighs the ${costMetricValue !== null && b.c ? (costMetricValue / b.c).toFixed(1) : "1.0"}× cost — worth optimising, not cutting.`;
  else if (grade === "Below") why += " Both conversion and cost are short of the bar.";
  return { index: +idx.toFixed(2), grade, letter: letterFromIndex(idx), benchmark_source: benchmarkSource, conversion_metric_name: mainMetricName, conversion_benchmark: mainBenchmark, cost_metric_name: costMetricName, cost_benchmark: b.c, why };
}

export function gradeAllWith(lines: BenchmarkCampaignLine[], tables: BenchmarkTables): GradedCampaignLine[] {
  return lines.map((line) => ({ ...line, ...gradeCampaignWith(line, tables) }));
}

// Aggregate summary over a filtered set of graded lines (for summary cards + stacked bar).
export interface BenchmarkSummary {
  total: number;
  nGood: number; // At benchmark
  nOpt: number;  // Optimize
  nClose: number;
  nBelow: number;
  nNone: number; // Too little data
  nMet: number;  // nGood + nOpt
  nGradeable: number; // nGood + nOpt + nClose + nBelow
  spendTotal: number;
  spendGood: number;
  spendOpt: number;
  spendClose: number;
  spendBelow: number;
  spendNone: number;
  spendMet: number;   // spendGood + spendOpt
  spendShare: number | null; // spendMet / spendTotal (all spend, HTML formula)
  campShare: number | null;  // nMet / nGradeable
  impressions: number;
  clicks: number;
  ctr: number | null;
  cpc: number | null;
}

export function summarize(lines: GradedCampaignLine[]): BenchmarkSummary {
  let nGood = 0, nOpt = 0, nClose = 0, nBelow = 0, nNone = 0;
  let spendGood = 0, spendOpt = 0, spendClose = 0, spendBelow = 0, spendNone = 0;
  let spendTotal = 0, impressions = 0, clicks = 0;

  for (const l of lines) {
    spendTotal += l.spend;
    impressions += l.impressions;
    clicks += l.clicks;
    if (l.grade === "At benchmark")       { nGood++;  spendGood  += l.spend; }
    else if (l.grade === "Optimize")      { nOpt++;   spendOpt   += l.spend; }
    else if (l.grade === "Close")         { nClose++; spendClose += l.spend; }
    else if (l.grade === "Below")         { nBelow++; spendBelow += l.spend; }
    else                                  { nNone++;  spendNone  += l.spend; }
  }

  const nMet = nGood + nOpt;
  const spendMet = spendGood + spendOpt;
  const nGradeable = nGood + nOpt + nClose + nBelow;

  return {
    total: lines.length,
    nGood, nOpt, nClose, nBelow, nNone, nMet, nGradeable,
    spendTotal, spendGood, spendOpt, spendClose, spendBelow, spendNone, spendMet,
    spendShare: spendTotal > 0 ? spendMet / spendTotal : null,
    campShare: nGradeable > 0 ? nMet / nGradeable : null,
    impressions,
    clicks,
    ctr: impressions > 0 ? clicks / impressions : null,
    cpc: clicks > 0 ? spendTotal / clicks : null,
  };
}

// ─── Summary board ────────────────────────────────────────────────────────────

// Aggregate graded lines by their `owner` label into summary board rows, sorted
// by total spend descending.
export function buildBoardRows(graded: GradedCampaignLine[]): BenchmarkBoardRow[] {
  const map = new Map<string, BenchmarkBoardRow>();

  for (const l of graded) {
    const key = l.owner ?? "Unknown";
    if (!map.has(key)) {
      map.set(key, {
        label: key,
        spend: 0,
        n: 0,
        n_gradeable: 0,
        n_at_benchmark: 0,
        n_close: 0,
        n_below: 0,
        spend_at_benchmark: 0,
        spend_close: 0,
        spend_below: 0,
        pct_spend: null,
        pct_camp: null,
      });
    }
    const row = map.get(key)!;
    row.spend += l.spend;
    row.n += 1;

    if (l.grade !== "Too little data") {
      row.n_gradeable += 1;
      if (l.grade === "At benchmark" || l.grade === "Optimize") {
        row.n_at_benchmark++;
        row.spend_at_benchmark += l.spend;
      } else if (l.grade === "Close") {
        row.n_close++;
        row.spend_close += l.spend;
      } else if (l.grade === "Below") {
        row.n_below++;
        row.spend_below += l.spend;
      }
    }
  }

  for (const row of map.values()) {
    row.pct_spend = row.spend > 0 ? row.spend_at_benchmark / row.spend : null;
    row.pct_camp = row.n_gradeable > 0 ? row.n_at_benchmark / row.n_gradeable : null;
  }

  return Array.from(map.values()).sort((a, b) => b.spend - a.spend);
}

// ─── Formatting helpers (also used by the UI) ─────────────────────────────────

export function fmtMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function fmtPct(n: number, decimals = 1): string {
  return `${(n * 100).toFixed(decimals)}%`;
}

export function fmtIndex(n: number | null): string {
  return n !== null ? n.toFixed(2) : "—";
}

// Fixed hex colors for grades — matches the HTML dashboard palette exactly.
export const GRADE_HEX: Record<BenchmarkGrade, string> = {
  "At benchmark": "#0E7C6B",
  Optimize: "#5B4BC4",
  Close: "#B26A00",
  Below: "#C0392B",
  "Too little data": "#9AA5B1",
};

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

// Pure benchmark grading logic — ported from the Marketing Ops pacing dashboard
// (do-not-read-temp/budget-phase/september-dashboard.html). No side effects;
// all functions are deterministic from their inputs.
//
// Benchmark sources:
//   LinkedIn: DemandSense 2026 B2B LinkedIn Benchmarks (by objective + region)
//   Google: WSO2-internal grading table (by region, derived from campaign name prefix)
//   LinkedIn SM: DemandSense 2026 Sponsored Messaging benchmarks

import type {
  BenchmarkGrade,
  BenchmarkLetter,
  BenchmarkLine,
  BenchmarkResult,
  BenchmarkSummary,
  GradedLine,
  GradeSortKey,
} from "./benchmarkGradingTypes";

// ─── LinkedIn benchmark table ─────────────────────────────────────────────────
// { section: { region: { m: main-metric%, c: cost } } }
// Lead Generation: m = form completion rate (%), c = CPL ($)
// Website Visits / Engagement: m = CTR (%), c = CPC ($)
// Brand Awareness: m = CTR (%), c = CPM ($)

const LBM: Record<string, Record<string, { m: number; c: number }>> = {
  "Lead Generation": {
    NAMER: { m: 6.52, c: 352 },
    EU: { m: 7.27, c: 135 },
    MEA: { m: 6.91, c: 69 },
    SEA: { m: 6.06, c: 104 },
    India: { m: 4.85, c: 55 },
  },
  "Website Visits": {
    NAMER: { m: 0.99, c: 1.89 },
    EU: { m: 0.49, c: 6.41 },
    MEA: { m: 0.66, c: 0.51 },
    SEA: { m: 0.78, c: 0.76 },
    India: { m: 0.78, c: 0.44 },
  },
  Engagement: {
    NAMER: { m: 3.01, c: 1.15 },
    EU: { m: 3.90, c: 0.82 },
    MEA: { m: 1.36, c: 0.23 },
    SEA: { m: 2.05, c: 0.29 },
    India: { m: 2.71, c: 0.13 },
  },
  "Brand Awareness": {
    NAMER: { m: 0.10, c: 6.80 },
    EU: { m: 0.10, c: 5.23 },
    MEA: { m: 0.13, c: 1.39 },
    SEA: { m: 0.07, c: 0.86 },
    India: { m: 0.14, c: 1.01 },
  },
};

// Objective string → benchmark section key
const OBJ_MAP: Record<string, string> = {
  "Lead generation": "Lead Generation",
  "Website visits": "Website Visits",
  "Website conversions": "Website Visits",
  Engagement: "Engagement",
  "Brand awareness": "Brand Awareness",
  "Video views": "Website Visits",
};

// Region code → benchmark region key
const REGION_TO_BM: Record<string, string> = {
  NA: "NAMER",
  EU: "EU",
  UK: "EU",
  ME: "MEA",
  Africa: "MEA",
  APAC: "SEA",
  India: "India",
};

function globalBlend(section: string): { m: number; c: number } | null {
  const rows = LBM[section];
  if (!rows) return null;
  const vals = Object.values(rows);
  return {
    m: vals.reduce((a, v) => a + v.m, 0) / vals.length,
    c: vals.reduce((a, v) => a + v.c, 0) / vals.length,
  };
}

// ─── LinkedIn Sponsored Messaging benchmarks (DemandSense 2026) ───────────────

const SM = { open: 0.25, cpc: 10.0, minSends: 200 };

// ─── Google Ads benchmark table (WSO2 grading, [CTR, CPC] per region) ─────────

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

const GOOGLE_PREFIX_TO_REGION: Record<string, string> = {
  NA: "US",
  EU: "EU",
  UK: "UK",
  ANZ: "ANZ",
  LATAM: "LATAM",
  Africa: "Africa",
  ME: "Middle East",
};

const GOOGLE_GLOBAL: [number, number] = [
  Object.values(GBM).reduce((a, v) => a + v[0], 0) / Object.keys(GBM).length,
  Object.values(GBM).reduce((a, v) => a + v[1], 0) / Object.keys(GBM).length,
];

// Derive Google region from campaign name prefix convention (e.g. "NA|...", "EU|...").
function googleRegionFromName(name: string): string | null {
  const prefix = name.split("|")[0].trim().split(/[_\s]+/)[0];
  if (prefix === "APAC") {
    if (/\b(India|DPDP)\b/i.test(name)) return "India";
    if (/\b(Australia|Aus)\b/i.test(name)) return "ANZ";
    return "APAC ex-India / SEA";
  }
  return GOOGLE_PREFIX_TO_REGION[prefix] ?? null;
}

// ─── Index helpers ────────────────────────────────────────────────────────────

// Cap ratio to [0.1, 4.0] so a single outlier can't dominate the geometric mean.
function cap(v: number): number {
  return Math.min(Math.max(v, 0.1), 4.0);
}

function gradeFromIndex(idx: number): BenchmarkGrade {
  if (idx >= 1.05) return "At benchmark";
  if (idx >= 0.80) return "Close";
  return "Below";
}

function letterFromIndex(idx: number): BenchmarkLetter {
  if (idx >= 1.3) return "A";
  if (idx >= 1.05) return "B";
  if (idx >= 0.8) return "C";
  if (idx >= 0.5) return "D";
  return "F";
}

// ─── Main grading function ────────────────────────────────────────────────────

const BLANK: BenchmarkResult = {
  grade: "Too little data",
  letter: "",
  idx: null,
  why: "",
  benchmarkSource: "",
  judgingMetricLabel: "",
  benchmarkMainValue: null,
  costMetricLabel: "",
  benchmarkCostValue: null,
};

export function grade(line: BenchmarkLine): BenchmarkResult {
  // LinkedIn Sponsored Messaging: graded on open rate + CPC; no impressions.
  if (line.platform === "LinkedIn" && line.format === "Sponsored Messaging") {
    if (line.sends < SM.minSends || line.spend <= 0) {
      return { ...BLANK, why: `Only ${fmt0(line.sends)} sends — not enough to grade.` };
    }
    const openRate = line.sends > 0 ? line.opens / line.sends : null;
    const cpc = line.smClicks > 0 ? line.spend / line.smClicks : null;
    const r1 = cap(openRate !== null ? openRate / SM.open : 1.0);
    const r2 = cap(cpc !== null ? SM.cpc / cpc : 1.0);
    const idx = Math.sqrt(r1 * r2);
    let g = gradeFromIndex(idx);
    if (g === "At benchmark" && r2 < 1) g = "Optimize";
    let why = `Index ${idx.toFixed(2)} (Sponsored Messaging). Open rate ${fmtPct(openRate ?? 0, 1)} vs ${fmtPct(SM.open, 0)}`;
    if (cpc !== null) why += `. CPC ${fmtUsd2(cpc)} vs ${fmtUsd2(SM.cpc)}`;
    why += `. ${fmt0(line.sends)} sends, ${fmt0(line.opens)} opens.`;
    if (g === "Optimize") why += " Opening well above benchmark, but each click costs more than it should.";
    return {
      grade: g,
      letter: letterFromIndex(idx),
      idx: +idx.toFixed(2),
      why,
      benchmarkSource: "Sponsored Messaging",
      judgingMetricLabel: "Open rate",
      benchmarkMainValue: SM.open,
      costMetricLabel: "Cost per click",
      benchmarkCostValue: SM.cpc,
    };
  }

  if (line.impressions < 1000 || line.spend <= 0) {
    return { ...BLANK, why: `Only ${fmt0(line.impressions)} impressions — not enough to grade.` };
  }

  const ctr = line.impressions > 0 ? line.clicks / line.impressions : null;
  const cpc = line.clicks > 0 ? line.spend / line.clicks : null;

  // Google Ads
  if (line.platform === "Google Ads") {
    const rg = googleRegionFromName(line.name);
    const benchmarkSource = rg ?? "Global blend";
    const [bc, bp] = GBM[rg ?? ""] ?? GOOGLE_GLOBAL;
    const r1 = cap(ctr !== null ? ctr / bc : 0.1);
    const r2 = cap(cpc !== null ? bp / cpc : 0.1);
    const idx = Math.sqrt(r1 * r2);
    let g = gradeFromIndex(idx);
    if (g === "At benchmark" && r2 < 1) g = "Optimize";
    let why = `Index ${idx.toFixed(2)} (${benchmarkSource}). CTR ${fmtPct(ctr ?? 0, 2)} vs ${fmtPct(bc, 2)}. CPC ${fmtUsd2(cpc ?? 0)} vs ${fmtUsd2(bp)}.`;
    if (g === "Optimize") why += " Converting well but the click price is above benchmark.";
    return {
      grade: g,
      letter: letterFromIndex(idx),
      idx: +idx.toFixed(2),
      why,
      benchmarkSource,
      judgingMetricLabel: "CTR",
      benchmarkMainValue: bc,
      costMetricLabel: "CPC",
      benchmarkCostValue: bp,
    };
  }

  // LinkedIn (non-SM)
  const section = OBJ_MAP[line.objective];
  if (!section) {
    return { ...BLANK, why: `No benchmark for the "${line.objective}" objective.` };
  }

  const bmRegion = REGION_TO_BM[line.region] ?? null;
  const benchmarkRow =
    bmRegion && LBM[section]?.[bmRegion] ? LBM[section][bmRegion] : globalBlend(section);
  const benchmarkSource = bmRegion && LBM[section]?.[bmRegion] ? bmRegion : "Global blend";

  if (!benchmarkRow) {
    return { ...BLANK, why: `No benchmark data for section "${section}".` };
  }

  const isLead = section === "Lead Generation";
  const isCPM = section === "Brand Awareness";

  const formRate = isLead ? (line.formOpens > 0 ? line.leads / line.formOpens : null) : ctr;
  const metricLabel = isLead ? "Form completion" : "CTR";
  const benchmarkMain = benchmarkRow.m / 100;

  if (formRate === null && isLead) {
    return {
      grade: "Below",
      letter: "",
      idx: null,
      why: "Nothing converting — no form opens recorded.",
      benchmarkSource,
      judgingMetricLabel: metricLabel,
      benchmarkMainValue: benchmarkMain,
      costMetricLabel: "CPL",
      benchmarkCostValue: benchmarkRow.c,
    };
  }

  const cpm = line.impressions > 0 ? (line.spend / line.impressions) * 1000 : null;
  const costValue = isLead
    ? line.leads > 0 ? line.spend / line.leads : null
    : isCPM ? cpm : cpc;
  const costLabel = isLead ? "CPL" : isCPM ? "CPM" : "CPC";
  const benchmarkCost = benchmarkRow.c;

  const r1 = cap((formRate ?? 0) / benchmarkMain);
  const r2 = costValue !== null && benchmarkCost > 0 ? cap(benchmarkCost / costValue) : 1.0;
  const idx = Math.sqrt(r1 * r2);
  let g = gradeFromIndex(idx);
  if (g === "At benchmark" && r2 < 1) g = "Optimize";

  const fmtMetric = isLead ? (v: number) => fmtPct(v, 1) : (v: number) => fmtPct(v, 2);
  const fmtCost = costLabel === "CPL" ? (v: number) => fmtUsd(v) : (v: number) => fmtUsd2(v);

  let why = `Index ${idx.toFixed(2)} (${benchmarkSource}). ${metricLabel} ${fmtMetric(formRate ?? 0)} vs ${fmtMetric(benchmarkMain)}`;
  if (costValue !== null) why += `. ${costLabel} ${fmtCost(costValue)} vs ${fmtCost(benchmarkCost)}`;
  why += ".";
  if (g === "Optimize" && formRate !== null && costValue !== null) {
    why += ` ${metricLabel} is ${(formRate / benchmarkMain).toFixed(1)}× benchmark, which outweighs the ${(costValue / benchmarkCost).toFixed(1)}× cost — worth optimising, not cutting.`;
  } else if (g === "Below") {
    why += " Both conversion and cost are short of the bar.";
  }

  return {
    grade: g,
    letter: letterFromIndex(idx),
    idx: +idx.toFixed(2),
    why,
    benchmarkSource,
    judgingMetricLabel: metricLabel,
    benchmarkMainValue: benchmarkMain,
    costMetricLabel: costLabel,
    benchmarkCostValue: benchmarkCost,
  };
}

export function gradeAll(lines: BenchmarkLine[]): GradedLine[] {
  return lines.map((l) => ({ ...l, ...grade(l) }));
}

// ─── Summary computation ──────────────────────────────────────────────────────

function toneKey(g: BenchmarkGrade): "good" | "opt" | "watch" | "poor" | "none" {
  if (g === "At benchmark") return "good";
  if (g === "Optimize") return "opt";
  if (g === "Close") return "watch";
  if (g === "Below") return "poor";
  return "none";
}

export function summarize(lines: GradedLine[]): BenchmarkSummary {
  const counts = { good: 0, opt: 0, watch: 0, poor: 0, none: 0 };
  const spends = { good: 0, opt: 0, watch: 0, poor: 0, none: 0 };
  let spendTotal = 0;
  let impressions = 0;
  let clicks = 0;

  for (const l of lines) {
    const k = toneKey(l.grade);
    counts[k]++;
    spends[k] += l.spend;
    spendTotal += l.spend;
    impressions += l.impressions;
    clicks += l.clicks;
  }

  const nGradeable = counts.good + counts.opt + counts.watch + counts.poor;
  const spendGradeable = spends.good + spends.opt + spends.watch + spends.poor;
  const spendMet = spends.good + spends.opt;

  return {
    total: lines.length,
    nGood: counts.good,
    nOpt: counts.opt,
    nWatch: counts.watch,
    nPoor: counts.poor,
    nNone: counts.none,
    nGradeable,
    spendTotal,
    spendGood: spends.good,
    spendOpt: spends.opt,
    spendWatch: spends.watch,
    spendPoor: spends.poor,
    spendNone: spends.none,
    spendGradeable,
    spendMet,
    spendShare: spendGradeable > 0 ? spendMet / spendGradeable : null,
    campShare: nGradeable > 0 ? (counts.good + counts.opt) / nGradeable : null,
    impressions,
    clicks,
    ctr: impressions > 0 ? clicks / impressions : null,
    cpc: clicks > 0 ? spendTotal / clicks : null,
  };
}

// ─── Sorting ──────────────────────────────────────────────────────────────────

const GRADE_ORDER: Record<BenchmarkGrade, number> = {
  "At benchmark": 0,
  Optimize: 1,
  Close: 2,
  Below: 3,
  "Too little data": 4,
};

export function sortLines(
  lines: GradedLine[],
  key: GradeSortKey,
  dir: "asc" | "desc",
): GradedLine[] {
  return [...lines].sort((a, b) => {
    let x: number, y: number;
    switch (key) {
      case "name":
        return dir === "asc"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      case "grade":
        x = GRADE_ORDER[a.grade];
        y = GRADE_ORDER[b.grade];
        break;
      case "letter": {
        const lmap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, F: 4, "": 5 };
        x = lmap[a.letter] ?? 5;
        y = lmap[b.letter] ?? 5;
        break;
      }
      case "spend": x = a.spend; y = b.spend; break;
      case "impressions": x = a.impressions; y = b.impressions; break;
      case "clicks": x = a.clicks; y = b.clicks; break;
      case "ctr":
        x = a.impressions > 0 ? a.clicks / a.impressions : -1;
        y = b.impressions > 0 ? b.clicks / b.impressions : -1;
        break;
      case "cpc":
        x = a.clicks > 0 ? a.spend / a.clicks : 1e9;
        y = b.clicks > 0 ? b.spend / b.clicks : 1e9;
        break;
      case "idx":
        x = a.idx ?? -1;
        y = b.idx ?? -1;
        break;
      default:
        return 0;
    }
    return dir === "asc" ? x - y : y - x;
  });
}

// ─── CSV parsing ──────────────────────────────────────────────────────────────
//
// Accepts combined CSV exports — either the output of the HTML dashboard's own
// export, or the raw LinkedIn/Google Ads exports. Column name matching is
// case-insensitive and handles the most common aliases from both platforms.
//
// Expected columns (all optional except Name and Platform):
//   Campaign Name / Campaign / Name
//   Platform (Google Ads / LinkedIn) — if absent, inferred from format column
//   Objective / Campaign Objective
//   Ad Format / Format
//   Region / Campaign Group
//   Status / Campaign Status    (Active / Enabled → live)
//   Spend / Cost / Amount Spent (USD) / Cost (USD)
//   Impressions
//   Clicks / Link Clicks / All Clicks
//   Leads / Lead Conversions
//   Form Opens
//   SM Clicks / Message Clicks
//   Opens / Message Opens
//   Sends / Total Sends

function findCol(headers: string[], ...aliases: string[]): number {
  const lower = aliases.map((a) => a.toLowerCase());
  for (const alias of lower) {
    const i = headers.findIndex((h) => h.toLowerCase().trim() === alias);
    if (i >= 0) return i;
  }
  return -1;
}

function num(v: string | undefined): number {
  if (!v) return 0;
  const s = v.replace(/[$,\s]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function inferPlatform(format: string, objective: string): "Google Ads" | "LinkedIn" | null {
  const f = format.toLowerCase();
  const o = objective.toLowerCase();
  if (f.includes("search") || f.includes("display") || f.includes("performance max")) return "Google Ads";
  if (
    f.includes("sponsored") || f.includes("image ad") || f.includes("video ad") ||
    f.includes("carousel") || f.includes("text ad") || f.includes("spotlight") ||
    o.includes("lead generation") || o.includes("website visits") || o.includes("brand awareness")
  )
    return "LinkedIn";
  return null;
}

export interface ParsedCsvResult {
  lines: BenchmarkLine[];
  skipped: number;
  warnings: string[];
}

export function parseBenchmarkCsv(csvText: string): ParsedCsvResult {
  const rows = csvText.split(/\r?\n/);
  if (rows.length < 2) return { lines: [], skipped: 0, warnings: ["Empty file"] };

  const headers = rows[0].split(",").map((h) => h.replace(/^["']|["']$/g, "").trim());
  const warnings: string[] = [];
  const lines: BenchmarkLine[] = [];
  let skipped = 0;

  const ci = {
    name: findCol(headers, "campaign name", "campaign", "name"),
    platform: findCol(headers, "platform", "ad platform"),
    objective: findCol(headers, "objective", "campaign objective"),
    format: findCol(headers, "ad format", "format", "ad type"),
    region: findCol(headers, "region", "campaign group", "geo"),
    status: findCol(headers, "status", "campaign status"),
    spend: findCol(headers, "amount spent (usd)", "cost (usd)", "spend", "cost", "amount spent"),
    impressions: findCol(headers, "impressions"),
    clicks: findCol(headers, "clicks", "link clicks", "all clicks"),
    leads: findCol(headers, "leads", "lead conversions", "form submissions"),
    formOpens: findCol(headers, "form opens", "opens (form)", "lead form opens"),
    smClicks: findCol(headers, "sm clicks", "message clicks", "sponsored messaging clicks"),
    opens: findCol(headers, "message opens", "opens", "sponsored messaging opens"),
    sends: findCol(headers, "total sends", "sends", "sponsored messaging sends"),
  };

  if (ci.name < 0) {
    warnings.push('No "Campaign Name" column found — cannot parse');
    return { lines, skipped, warnings };
  }

  for (let i = 1; i < rows.length; i++) {
    const raw = rows[i];
    if (!raw.trim()) continue;

    // Simple CSV parse that handles quoted fields.
    const cols: string[] = [];
    let cur = "";
    let inQ = false;
    for (const ch of raw) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) { cols.push(cur); cur = ""; continue; }
      cur += ch;
    }
    cols.push(cur);

    const get = (idx: number) => (idx >= 0 ? cols[idx]?.trim() ?? "" : "");

    const name = get(ci.name);
    if (!name) { skipped++; continue; }

    const rawPlatform = get(ci.platform);
    const format = get(ci.format);
    const objective = get(ci.objective);

    let platform: "Google Ads" | "LinkedIn";
    if (rawPlatform.toLowerCase().includes("google")) platform = "Google Ads";
    else if (rawPlatform.toLowerCase().includes("linkedin")) platform = "LinkedIn";
    else {
      const inferred = inferPlatform(format, objective);
      if (!inferred) {
        warnings.push(`Row ${i + 1}: could not determine platform for "${name}" — skipped`);
        skipped++;
        continue;
      }
      platform = inferred;
    }

    const statusStr = get(ci.status).toLowerCase();
    const live = statusStr === "" || statusStr === "active" || statusStr === "enabled";

    lines.push({
      name,
      platform,
      objective,
      format,
      region: get(ci.region),
      live,
      spend: num(get(ci.spend)),
      impressions: num(get(ci.impressions)),
      clicks: num(get(ci.clicks)),
      leads: num(get(ci.leads)),
      formOpens: num(get(ci.formOpens)),
      smClicks: num(get(ci.smClicks)),
      opens: num(get(ci.opens)),
      sends: num(get(ci.sends)),
    });
  }

  return { lines, skipped, warnings };
}

// ─── Display helpers ──────────────────────────────────────────────────────────

export function fmtMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtUsd(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtUsd2(n: number): string {
  return `$${n.toFixed(2)}`;
}

function fmtPct(n: number, dp = 1): string {
  return `${(n * 100).toFixed(dp)}%`;
}

function fmt0(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export { fmtPct, fmtUsd2 };

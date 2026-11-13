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

// Types for the Benchmark Grading page — the second major screen under
// Ad Campaigns. Grading logic (pure functions) lives in benchmarkGradingLogic.ts.
//
// A "line" is one campaign as it comes from an ad-platform CSV export. After
// grading, a GradedLine carries the original metrics plus the computed result.

export type CampaignPlatform = "Google Ads" | "LinkedIn";

// Raw objective strings as LinkedIn reports them; grading maps them to a
// benchmark section via OBJ_MAP in benchmarkGradingLogic.ts.
export const LINKEDIN_OBJECTIVES = [
  "Lead generation",
  "Website visits",
  "Website conversions",
  "Engagement",
  "Brand awareness",
  "Video views",
] as const;

// The five grading outcomes. 'Optimize' is a nuanced 'At benchmark' — the
// conversion metric clears the bar but the cost metric doesn't, so it's worth
// optimizing rather than cutting.
export type BenchmarkGrade =
  | "At benchmark"
  | "Optimize"
  | "Close"
  | "Below"
  | "Too little data";

export type BenchmarkLetter = "A" | "B" | "C" | "D" | "F" | "";

// Region codes as used in the data, mapping to benchmark region keys.
export const REGIONS = ["NA", "EU", "UK", "APAC", "ME", "Africa", "LATAM", "ANZ"] as const;
export type Region = (typeof REGIONS)[number];

// One campaign row from the uploaded CSV, after normalization.
export interface BenchmarkLine {
  name: string;
  platform: CampaignPlatform;
  objective: string;    // LinkedIn objective string; unused for Google
  format: string;       // e.g. 'Sponsored Messaging', 'Single Image Ad'
  region: Region | string;
  live: boolean;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;        // form submissions (LinkedIn lead gen)
  formOpens: number;    // LinkedIn lead gen: form opens (denominator for form rate)
  smClicks: number;     // LinkedIn Sponsored Messaging: message clicks
  opens: number;        // LinkedIn Sponsored Messaging: message opens
  sends: number;        // LinkedIn Sponsored Messaging: total sends
}

// Computed grading result for one line.
export interface BenchmarkResult {
  grade: BenchmarkGrade;
  letter: BenchmarkLetter;
  idx: number | null;              // geometric mean of main/cost ratios, 0.1–4.0 capped
  why: string;                     // human-readable explanation shown in the table
  benchmarkSource: string;         // e.g. 'EU', 'NAMER', 'Global blend', 'Sponsored Messaging'
  judgingMetricLabel: string;      // 'Open rate', 'CTR', 'Form completion'
  benchmarkMainValue: number | null; // benchmark threshold for the judging metric
  costMetricLabel: string;           // 'CPC', 'CPL', 'CPM', 'Cost per click'
  benchmarkCostValue: number | null;
}

export interface GradedLine extends BenchmarkLine, BenchmarkResult {}

// Aggregate summary over a filtered set of lines.
export interface BenchmarkSummary {
  total: number;
  nGood: number;
  nOpt: number;
  nWatch: number;
  nPoor: number;
  nNone: number;
  nGradeable: number;
  spendTotal: number;
  spendGood: number;
  spendOpt: number;
  spendWatch: number;
  spendPoor: number;
  spendNone: number;
  spendGradeable: number;
  spendMet: number;      // good + opt
  spendShare: number | null;   // spendMet / spendGradeable
  campShare: number | null;    // (nGood + nOpt) / nGradeable
  impressions: number;
  clicks: number;
  ctr: number | null;
  cpc: number | null;
}

export type GradeSortKey =
  | "name"
  | "spend"
  | "impressions"
  | "clicks"
  | "ctr"
  | "cpc"
  | "idx"
  | "grade"
  | "letter";

// Column choices for the grade filter toggle row.
export const GRADE_LETTERS: Array<Exclude<BenchmarkLetter, "">> = ["A", "B", "C", "D", "F"];

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

// Ad Campaigns → Benchmark Grading types.
//
// A campaign line is the raw per-campaign data returned by the backend. The
// graded line is what the frontend computes from it (see benchmarkGradingLogic.ts).
// The backend endpoint is POST /api/ad-campaigns/benchmark-grading/run; it fetches
// the same campaigns the ad platforms expose but in the richer shape grading needs
// (objective, format, region, LinkedIn-specific form/messaging metrics, etc.).

import type { DateWindow } from "../analytics/adAnalyticsTypes";

export type { DateWindow };

// Ad platform as reported by the benchmark grading backend.
export type BmPlatform = "google" | "linkedin";

// LinkedIn ad formats that affect which benchmark applies.
export type LinkedInFormat =
  | "Single Image Ad"
  | "Carousel Ad"
  | "Video Ad"
  | "Text Ad"
  | "Spotlight Ad"
  | "Sponsored Messaging"
  | "Conversation Ad"
  | "Document Ad"
  | "Event Ad"
  | string; // future formats

// LinkedIn campaign objectives that determine which benchmark metric pair is used.
export type LinkedInObjective =
  | "Lead generation"
  | "Website visits"
  | "Website conversions"
  | "Engagement"
  | "Brand awareness"
  | "Video views"
  | string;

// A region code as the backend produces it — broad geographic groupings used to
// look up the right regional benchmark.
export type RegionCode = "NA" | "EU" | "UK" | "ANZ" | "LATAM" | "Africa" | "ME" | "APAC" | string;

// Raw campaign line from the backend — all numbers are period totals for the
// requested window; null means the platform does not expose or report that field.
export interface BenchmarkCampaignLine {
  id: string;
  platform: BmPlatform;
  name: string;
  owner: string | null; // BU or owner label
  objective: LinkedInObjective | null; // LinkedIn only; null for Google
  format: LinkedInFormat | null; // LinkedIn only; null for Google
  region: RegionCode | null;

  // Core spend + engagement
  spend: number; // USD
  impressions: number;
  clicks: number;

  // LinkedIn lead generation
  form_opens: number | null; // LI lead gen only
  leads: number | null; // LI lead gen only
  // Where `leads` came from: 'extended' (lead-gen metrics) or 'conversions'
  // (LinkedIn conversions, the fallback). They count differently.
  leads_source: string | null;

  // LinkedIn Sponsored Messaging (no impressions in this format)
  sends: number | null;
  message_opens: number | null;
  message_clicks: number | null; // clicks within a Sponsored Message

  // When the campaign started within the window (for cohort filters)
  started_at: string | null; // ISO date or null

  // Whether the campaign is currently running
  is_live: boolean;
}

// The backend wraps lines in a report envelope with period metadata.
export interface BenchmarkGradingReport {
  window_start: string;
  window_end: string;
  campaigns: BenchmarkCampaignLine[];
  // One sentence per source that failed and was left out; empty when every
  // source answered.
  warnings: string[];
}

// The request body for POST /api/ad-campaigns/benchmark-grading/run.
export interface BenchmarkGradingRequest {
  window: DateWindow;
}

// ─── Computed grade (client-side) ────────────────────────────────────────────

// Grade bands derived from the composite index (matches HTML dashboard spec):
//   At benchmark  ≥ 1.05 (conversion and cost both at or above benchmark)
//   Optimize      ≥ 1.05 on conversion but cost ratio < 1 (conversion clears, cost lags)
//   Close         ≥ 0.80 and < 1.05
//   Below         < 0.80
//   Too little data  insufficient volume
export type BenchmarkGrade = "At benchmark" | "Optimize" | "Close" | "Below" | "Too little data";

// Letter grades derived from the same index (A ≥ 1.30 · B ≥ 1.05 · C ≥ 0.80 · D ≥ 0.50 · F < 0.50).
export type LetterGrade = "A" | "B" | "C" | "D" | "F" | "";

// A fully graded campaign line — the raw line plus all computed grading fields.
export interface GradedCampaignLine extends BenchmarkCampaignLine {
  // The composite index (geometric mean of conversion + cost ratios, each capped
  // between 0.1× and 4×). null = "Too little data" case.
  index: number | null;

  grade: BenchmarkGrade;
  letter: LetterGrade;

  // Which benchmark source was applied (e.g. "EU", "NAMER", "Global blend",
  // "Sponsored Messaging", "India"). Shown in the Why column.
  benchmark_source: string;

  // The main conversion metric name ("CTR", "Form completion", "Open rate")
  // and its benchmark value. null when grading is not applicable.
  conversion_metric_name: string;
  conversion_benchmark: number | null;

  // The cost metric name ("CPC", "CPL", "CPM", "Cost per click") and its benchmark.
  cost_metric_name: string;
  cost_benchmark: number | null;

  // Human-readable explanation, shown in the "Why" column.
  why: string;
}

// ─── Summary board row (By Budget Line) ──────────────────────────────────────

// Aggregated grade distribution for one "budget line" (usually an owner/BU label).
// This is the data for the bmboard-style summary table (matches HTML `bmboard` columns).
// Note: n_at_benchmark includes both "At benchmark" and "Optimize" grades (the HTML
// boards both together as "At benchmark"); Close and Below are tracked separately.
export interface BenchmarkBoardRow {
  label: string; // owner / BU
  spend: number;
  n: number; // total campaigns in this group
  n_gradeable: number; // campaigns with enough data to grade
  n_at_benchmark: number; // At benchmark + Optimize
  n_close: number;
  n_below: number;
  spend_at_benchmark: number; // At benchmark + Optimize spend
  spend_close: number;
  spend_below: number;
  pct_spend: number | null; // (spend_at_benchmark) / spend (all campaigns in group)
  pct_camp: number | null; // n_at_benchmark / n_gradeable
}

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

// Pins the grade bands (At benchmark ≥ 1.05 · Close ≥ 0.80 · Below), the letter
// cut-offs, case-insensitive objective lookup, and the summary/board roll-ups.

import { describe, expect, it } from "vitest";
import type { BenchmarkCampaignLine } from "./benchmarkGradingTypes";
import { buildBoardRows, DEFAULT_TABLES, gradeAllWith, summarize } from "./benchmarkGradingLogic";

// LinkedIn Website Visits, NA → NAMER benchmark: CTR 0.99%, CPC $5.00.
function line(over: Partial<BenchmarkCampaignLine>): BenchmarkCampaignLine {
  return {
    id: "c1",
    platform: "linkedin",
    name: "NA-Test",
    owner: "BU One",
    objective: "Website visits",
    format: "Single Image Ad",
    region: "NA",
    spend: 495,
    impressions: 10_000,
    clicks: 99,
    form_opens: null,
    leads: null,
    leads_source: null,
    sends: null,
    message_opens: null,
    message_clicks: null,
    started_at: "2026-10-01",
    is_live: true,
    ...over,
  };
}

const grade = (over: Partial<BenchmarkCampaignLine>) => gradeAllWith([line(over)], DEFAULT_TABLES)[0];

describe("benchmark grading", () => {
  it("grades exactly-at-benchmark (index 1.0) as Close / C", () => {
    const g = grade({});
    expect(g.index).toBeCloseTo(1, 5);
    expect(g.grade).toBe("Close");
    expect(g.letter).toBe("C");
  });

  it("grades index ≥ 1.05 with cost at benchmark as At benchmark / B", () => {
    const g = grade({ clicks: 120, spend: 600 }); // CTR 1.2%, CPC $5.00
    expect(g.index!).toBeGreaterThanOrEqual(1.05);
    expect(g.grade).toBe("At benchmark");
    expect(g.letter).toBe("B");
  });

  it("marks a strong converter with expensive clicks as Optimize", () => {
    const g = grade({ clicks: 300, spend: 1800 }); // CTR 3%, CPC $6 > $5
    expect(g.grade).toBe("Optimize");
  });

  it("grades a weak campaign as Below / F", () => {
    const g = grade({ clicks: 10, spend: 500 }); // CTR 0.1%, CPC $50
    expect(g.grade).toBe("Below");
    expect(g.letter).toBe("F");
  });

  it("matches the objective case-insensitively", () => {
    expect(grade({ objective: "WEBSITE VISITS" }).grade).toBe("Close");
  });

  it("maps ANZ to the SEA LinkedIn benchmark", () => {
    expect(grade({ region: "ANZ" }).benchmark_source).toBe("SEA");
  });

  it("does not grade under 1,000 impressions", () => {
    const g = grade({ impressions: 500, clicks: 5 });
    expect(g.grade).toBe("Too little data");
    expect(g.letter).toBe("");
  });

  it("counts Optimize as met in the summary and board, and Close separately", () => {
    const graded = gradeAllWith(
      [
        line({ id: "a", clicks: 300, spend: 1800 }), // Optimize
        line({ id: "b" }), // Close
        line({ id: "c", impressions: 500, clicks: 5 }), // Too little data
      ],
      DEFAULT_TABLES,
    );

    const s = summarize(graded);
    expect(s.nMet).toBe(1);
    expect(s.nClose).toBe(1);
    expect(s.nGradeable).toBe(2);
    expect(s.campShare).toBeCloseTo(0.5);

    const [row] = buildBoardRows(graded);
    expect(row.n).toBe(3);
    expect(row.n_at_benchmark).toBe(1);
    expect(row.n_close).toBe(1);
    expect(row.pct_camp).toBeCloseTo(0.5);
  });
});

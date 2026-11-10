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

// Pins grading to benchmark-grading spec 2026.10: bands (At benchmark ≥ 0.80, no
// Close), letters A–D, the metric pairing, region lookup, the edge cases in §6,
// the spend/count shares in §8 (which leave out "Too little data"), and the
// verification checks in §12 that caught real bugs.

import { describe, expect, it } from "vitest";
import type { BenchmarkCampaignLine } from "./benchmarkGradingTypes";
import { buildBoardRows, DEFAULT_TABLES, gradeAllWith, summarize, type BenchmarkTables } from "./benchmarkGradingLogic";

// LinkedIn Website Visits, NA → NAMER benchmark: CTR 0.99%, CPC $5.00. As given
// (99 clicks, $495) it sits exactly on the benchmark: index 1.0.
function line(over: Partial<BenchmarkCampaignLine>): BenchmarkCampaignLine {
  return {
    id: "c1",
    platform: "linkedin",
    name: "NA_IAM | Test",
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

const gradeWith = (tables: BenchmarkTables, over: Partial<BenchmarkCampaignLine>) => gradeAllWith([line(over)], tables)[0];
const grade = (over: Partial<BenchmarkCampaignLine>) => gradeWith(DEFAULT_TABLES, over);

describe("bands and letters (spec §7)", () => {
  it("grades index 1.0 as At benchmark / B", () => {
    const g = grade({});
    expect(g.index).toBe(1);
    expect(g.grade).toBe("At benchmark");
    expect(g.letter).toBe("B");
  });

  it("has no Close band: index 0.84 is At benchmark", () => {
    const g = grade({ clicks: 70, spend: 350 }); // CTR 0.70%, CPC $5.00
    expect(g.index).toBe(0.84);
    expect(g.grade).toBe("At benchmark");
    expect(g.letter).toBe("B");
  });

  it("grades index 0.50–0.80 as Below / C", () => {
    const g = grade({ clicks: 40, spend: 200 }); // CTR 0.40%, CPC $5.00 → 0.64
    expect(g.grade).toBe("Below");
    expect(g.letter).toBe("C");
  });

  it("grades index under 0.50 as Below / D (there is no F)", () => {
    const g = grade({ clicks: 10, spend: 500 }); // CTR 0.10%, CPC $50
    expect(g.grade).toBe("Below");
    expect(g.letter).toBe("D");
  });

  it("flags a passing campaign whose cost is above benchmark as Optimize", () => {
    const g = grade({ clicks: 300, spend: 1800 }); // CTR 3%, CPC $6 > $5
    expect(g.grade).toBe("Optimize");
    expect(g.letter).toBe("A");
  });

  it("doesn't claim both metrics missed when an index is Below", () => {
    expect(grade({ clicks: 40, spend: 200 }).why).not.toMatch(/both/i);
  });
});

describe("metric pairing and lookup (spec §3, §5)", () => {
  it("matches the objective case-insensitively", () => {
    expect(grade({ objective: "WEBSITE VISITS" }).grade).toBe("At benchmark");
  });

  it("doesn't grade an objective with no benchmark", () => {
    const g = grade({ objective: "Talent leads" });
    expect(g.grade).toBe("Too little data");
    expect(g.why).toMatch(/No benchmark exists/);
  });

  it("uses the global blend for LinkedIn regions outside the map (LATAM, ANZ)", () => {
    expect(grade({ region: "LATAM" }).benchmark_source).toBe("Global blend");
    expect(grade({ region: "ANZ" }).benchmark_source).toBe("Global blend");
  });

  it("costs Brand Awareness on CPM", () => {
    // NAMER: CTR 0.10%, CPM $6.80 — 100 clicks on 100k impressions, $680 spend
    const g = grade({ objective: "Brand awareness", impressions: 100_000, clicks: 100, spend: 680 });
    expect(g.cost_metric_name).toBe("CPM");
    expect(g.index).toBe(1);
  });

  it("uses the India Google benchmark for an APAC campaign with India in the name", () => {
    const g = grade({ platform: "google", name: "APAC_IAM | India Search", objective: null, clicks: 795, spend: 2295.5625 });
    expect(g.benchmark_source).toBe("India");
    expect(g.index).toBe(1);
  });

  it("puts a Google campaign with impressions but no clicks in Below, not Too little data", () => {
    const g = grade({ platform: "google", name: "NA_IAM | Search", objective: null, clicks: 0 });
    expect(g.grade).toBe("Below");
    expect(g.why).toMatch(/No clicks/);
  });
});

describe("Sponsored Messaging", () => {
  const sm = { format: "Sponsored Messaging", impressions: 0, sends: 1000, message_opens: 250, message_clicks: 50, spend: 500 };

  it("grades on open rate without impressions", () => {
    const g = grade(sm); // open rate 25%, $10 per click
    expect(g.conversion_metric_name).toBe("Open rate");
    expect(g.index).toBe(1);
  });

  it("treats zero message clicks as a neutral cost ratio", () => {
    expect(grade({ ...sm, message_clicks: 0 }).index).toBe(1);
  });

  it("needs 200 sends", () => {
    expect(grade({ ...sm, sends: 150 }).grade).toBe("Too little data");
  });
});

describe("lead generation and volume (spec §4, §6)", () => {
  const leadGen = { objective: "Lead generation", spend: 11_616, leads: 33 }; // CPL $352 (NAMER)

  it("grades form completion against CPL", () => {
    const g = grade({ ...leadGen, form_opens: 500 }); // 6.6% vs 6.52%
    expect(g.conversion_metric_name).toBe("Form completion");
    expect(g.cost_metric_name).toBe("CPL");
    expect(g.grade).toBe("At benchmark");
  });

  it("puts measured zero form opens in Below with no index or letter", () => {
    const g = grade({ ...leadGen, form_opens: 0, leads: 0 });
    expect(g.grade).toBe("Below");
    expect(g.index).toBeNull();
    expect(g.letter).toBe("");
  });

  it("doesn't grade lead gen when form opens aren't reported", () => {
    const g = grade({ ...leadGen, form_opens: null });
    expect(g.grade).toBe("Too little data");
    expect(g.why).toMatch(/aren't reported/);
  });

  it("does not grade under 1,000 impressions", () => {
    const g = grade({ impressions: 500, clicks: 5 });
    expect(g.grade).toBe("Too little data");
    expect(g.letter).toBe("");
  });
});

describe("edited benchmark tables", () => {
  it("grades against an edited LinkedIn cost benchmark", () => {
    const tables: BenchmarkTables = {
      ...DEFAULT_TABLES,
      lbm: { ...DEFAULT_TABLES.lbm, "Website Visits": { ...DEFAULT_TABLES.lbm["Website Visits"], NAMER: { m: 0.99, c: 10 } } },
    };
    expect(gradeWith(tables, {}).letter).toBe("A"); // CPC $5 vs $10 → index 1.41
  });

  it("grades against an edited Google benchmark", () => {
    const tables: BenchmarkTables = { ...DEFAULT_TABLES, gbm: { ...DEFAULT_TABLES.gbm, US: [0.0099, 5] } };
    expect(gradeWith(tables, { platform: "google", objective: null }).index).toBe(1);
  });

  it("applies an edited Sponsored Messaging minimum-send threshold", () => {
    const tables: BenchmarkTables = { ...DEFAULT_TABLES, sm: { ...DEFAULT_TABLES.sm, minSends: 1500 } };
    const g = gradeWith(tables, { format: "Sponsored Messaging", impressions: 0, sends: 1000, message_opens: 250, message_clicks: 50, spend: 500 });
    expect(g.grade).toBe("Too little data");
  });
});

describe("summary and board (spec §8)", () => {
  const graded = gradeAllWith(
    [
      line({ id: "a", clicks: 300, spend: 1800 }), // Optimize
      line({ id: "b" }), // At benchmark, $495
      line({ id: "c", impressions: 500, clicks: 5 }), // Too little data, $495
      line({ id: "d", clicks: 10, spend: 500 }), // Below
    ],
    DEFAULT_TABLES,
  );

  it("counts Optimize as met and leaves Too little data out of both shares", () => {
    const s = summarize(graded);
    expect(s.nMet).toBe(2);
    expect(s.nGradeable).toBe(3);
    expect(s.campShare).toBeCloseTo(2 / 3);
    expect(s.spendTotal).toBe(3290);
    expect(s.spendMet).toBe(2295);
    expect(s.spendNone).toBe(495);
    expect(s.spendGradeable).toBe(2795);
    expect(s.spendShare).toBeCloseTo(2295 / 2795);
  });

  it("returns null shares when nothing is gradeable", () => {
    const s = summarize([graded[2]]);
    expect(s.spendShare).toBeNull();
    expect(s.campShare).toBeNull();
  });

  it("rolls the same figures up per budget line", () => {
    const [row] = buildBoardRows(graded);
    expect(row.n).toBe(4);
    expect(row.n_gradeable).toBe(3);
    expect(row.n_at_benchmark).toBe(2);
    expect(row.n_below).toBe(1);
    expect(row.spend).toBe(3290);
    expect(row.spend_gradeable).toBe(2795);
    expect(row.spend_at_benchmark).toBe(2295);
    expect(row.pct_spend).toBeCloseTo(2295 / 2795);
    expect(row.pct_camp).toBeCloseTo(2 / 3);
  });
});

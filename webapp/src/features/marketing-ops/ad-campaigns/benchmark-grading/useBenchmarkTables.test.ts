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

// Stored benchmark edits: only valid, known, positive cells are read back, and
// they apply over the current defaults rather than replacing the whole table.

import { describe, expect, it } from "vitest";
import { DEFAULT_TABLES } from "./benchmarkGradingLogic";
import { applyOverrides, readOverrides } from "./useBenchmarkTables";

describe("readOverrides", () => {
  it("keeps only known cells with positive numbers", () => {
    const raw = JSON.stringify({
      "lbm|Website Visits|NAMER|c": 10,
      "gbm|US|0": 0, // not positive
      "sm|cpc": "7", // not a number
      "sm|bogus": 5, // unknown field
      "lbm|Nope|NAMER|m": 1, // unknown section
    });
    expect(readOverrides(raw)).toEqual({ "lbm|Website Visits|NAMER|c": 10 });
  });

  it("ignores storage that isn't an object of edits", () => {
    expect(readOverrides(null)).toEqual({});
    expect(readOverrides("not json")).toEqual({});
    expect(readOverrides("[1,2]")).toEqual({});
    // the old full-table snapshot shape
    expect(readOverrides(JSON.stringify({ lbm: {}, gbm: {} }))).toEqual({});
  });
});

describe("applyOverrides", () => {
  it("returns the defaults when nothing is edited", () => {
    expect(applyOverrides({})).toEqual(DEFAULT_TABLES);
  });

  it("changes only the edited cell and keeps current defaults elsewhere", () => {
    const t = applyOverrides({ "lbm|Website Visits|NAMER|c": 10, "gbm|US|0": 0.05, "sm|minSends": 300 });
    expect(t.lbm["Website Visits"].NAMER).toEqual({ m: DEFAULT_TABLES.lbm["Website Visits"].NAMER.m, c: 10 });
    expect(t.lbm["Website Visits"].EU).toEqual(DEFAULT_TABLES.lbm["Website Visits"].EU);
    expect(t.gbm.US).toEqual([0.05, DEFAULT_TABLES.gbm.US[1]]);
    expect(t.sm).toEqual({ ...DEFAULT_TABLES.sm, minSends: 300 });
  });
});

// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

import { describe, expect, it } from "vitest";
import { normalizeUmtPlatformStats } from "./umtPlatformStats";

describe("UMT platform stats wire format", () => {
  it("sorts months ascending whatever order the backend sent them in", () => {
    expect(normalizeUmtPlatformStats({ "2026-03": 3, "2026-01": 1, "2026-02": 2 })).toEqual([
      { month: "2026-01", value: 1 },
      { month: "2026-02", value: 2 },
      { month: "2026-03", value: 3 },
    ]);
  });

  it("keeps a breakdown object's own keys as the series names", () => {
    expect(normalizeUmtPlatformStats({ "2026-01": { WSO2AM: 4, "WSO2 IS": 2 } })).toEqual([
      { month: "2026-01", WSO2AM: 4, "WSO2 IS": 2 },
    ]);
  });

  it("joins product and version into one series and sums repeated entries", () => {
    expect(
      normalizeUmtPlatformStats({
        "2026-01": [
          { product: "WSO2AM", version: "4.0.0", count: 2 },
          { product: "WSO2AM", version: "4.1.0", count: 9 },
          { product: "WSO2AM", version: "4.0.0", count: 3 },
        ],
      }),
    ).toEqual([{ month: "2026-01", "WSO2AM 4.0.0": 5, "WSO2AM 4.1.0": 9 }]);
  });

  it("returns no rows for an empty response", () => {
    expect(normalizeUmtPlatformStats({})).toEqual([]);
  });
});

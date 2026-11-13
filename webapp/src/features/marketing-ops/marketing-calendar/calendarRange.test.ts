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

import { describe, expect, it } from "vitest";
import { monthRange, parseIsoDate, resolveRange } from "./calendarRange";

const NOVEMBER = { year: 2026, month: 11 };
const NOVEMBER_RANGE = { from: "2026-11-01", to: "2026-11-30" };

describe("parseIsoDate", () => {
  it("reads back only a real YYYY-MM-DD", () => {
    expect(parseIsoDate("2026-11-05")).toEqual({ year: 2026, month: 11, day: 5 });
    expect(parseIsoDate("2028-02-29")).toEqual({ year: 2028, month: 2, day: 29 });
    expect(parseIsoDate("2027-02-29")).toBeNull();
    expect(parseIsoDate("2026-11-31")).toBeNull();
    expect(parseIsoDate("2026-13-01")).toBeNull();
    expect(parseIsoDate("2026-11-5")).toBeNull();
    expect(parseIsoDate("")).toBeNull();
    expect(parseIsoDate(null)).toBeNull();
  });
});

describe("monthRange", () => {
  it("runs from the 1st to the month's last day", () => {
    expect(monthRange(NOVEMBER)).toEqual(NOVEMBER_RANGE);
    expect(monthRange({ year: 2028, month: 2 })).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(monthRange({ year: 2026, month: 12 })).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });
});

describe("resolveRange", () => {
  it("defaults to the month in view, with no error, when the URL names no range", () => {
    expect(resolveRange(null, null, NOVEMBER)).toEqual({ range: NOVEMBER_RANGE, errors: {} });
  });

  it("applies a valid range, including a single day", () => {
    expect(resolveRange("2026-11-15", "2027-01-10", NOVEMBER)).toEqual({
      range: { from: "2026-11-15", to: "2027-01-10" },
      errors: {},
    });
    expect(resolveRange("2026-11-15", "2026-11-15", NOVEMBER).range).toEqual({
      from: "2026-11-15",
      to: "2026-11-15",
    });
  });

  it("falls back to the month when a date is missing or not a real day, naming the input", () => {
    expect(resolveRange("2026-11-15", null, NOVEMBER)).toEqual({
      range: NOVEMBER_RANGE,
      errors: { to: "Enter a valid date" },
    });
    expect(resolveRange("2026-02-30", "", NOVEMBER)).toEqual({
      range: NOVEMBER_RANGE,
      errors: { from: "Enter a valid date", to: "Enter a valid date" },
    });
  });

  it("falls back when To is before From", () => {
    expect(resolveRange("2026-11-20", "2026-11-19", NOVEMBER)).toEqual({
      range: NOVEMBER_RANGE,
      errors: { to: "Must be on or after From" },
    });
  });

  it("allows up to 92 days, both ends included, and no more, as the backend does", () => {
    expect(resolveRange("2026-11-01", "2027-01-31", NOVEMBER).errors).toEqual({});
    expect(resolveRange("2026-11-01", "2027-02-01", NOVEMBER)).toEqual({
      range: NOVEMBER_RANGE,
      errors: { to: "At most 92 days" },
    });
  });
});

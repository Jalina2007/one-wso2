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
import { below, ceilingOK, covers, startOf } from "./tiers";

describe("volume discount tiers (D169)", () => {
  it("works out the range each start covers", () => {
    expect(covers([10, 101, 201, 501, 1001])).toEqual([
      "10 – 100",
      "101 – 200",
      "201 – 500",
      "501 – 1,000",
      "1,001 and above",
    ]);
    expect(covers([1, 2, 3, 4, 5])).toEqual(["1", "2", "3", "4", "5 and above"]);
    expect(covers([35000])).toEqual(["35,000 and above"]);
  });

  it("shows a dash while a start is missing or doesn't go up", () => {
    expect(covers([1, null, 25])).toEqual(["–", "–", "–"]);
    expect(covers([10, 5, 20])).toEqual(["–", "–", "20 and above"]);
  });

  it("names what is below the first tier", () => {
    expect(below(10)).toBe("Below 10");
    expect(below(35000)).toBe("Below 35,000");
    expect(below(1)).toBeNull();
    expect(below(null)).toBeNull();
  });

  it("reads starts and ceilings as typed", () => {
    expect(startOf(" 25 ")).toBe(25);
    expect(startOf("0")).toBeNull();
    expect(startOf("2.5")).toBeNull();
    expect(ceilingOK("6.44")).toBe(true);
    expect(ceilingOK("100")).toBe(true);
    expect(ceilingOK("2.083")).toBe(false);
    expect(ceilingOK("100.01")).toBe(false);
    expect(ceilingOK("")).toBe(false);
  });
});

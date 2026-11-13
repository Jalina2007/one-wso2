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
import { bindingsSummary, unitOfMeasureFor } from "./pricingFormula";

describe("pricing formula text", () => {
  it("fills %LIST_PRICE% in a unit of measure with the price-book price (D154)", () => {
    expect(unitOfMeasureFor("Annual, higher of %LIST_PRICE% or 10% of subscription", "25000")).toBe(
      "Annual, higher of 25,000 or 10% of subscription",
    );
    expect(unitOfMeasureFor("At least %LIST_PRICE%", "1234.5")).toBe("At least 1,234.50");
    expect(unitOfMeasureFor("LIST_PRICE stays", "100")).toBe("LIST_PRICE stays");
    expect(unitOfMeasureFor("At least %LIST_PRICE%", "")).toBe("At least %LIST_PRICE%");
  });

  it("names a category binding (D153)", () => {
    expect(bindingsSummary([{ name: "$1", kind: "VALUE", value: "10%" }, { name: "$2", kind: "CATEGORY", category: "SUBSCRIPTION" }])).toBe(
      "$1 = 10% · $2 = total of Subscription",
    );
  });
});

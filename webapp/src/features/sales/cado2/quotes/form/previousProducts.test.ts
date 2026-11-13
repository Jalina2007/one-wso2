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
import { groupByProduct, shortOpportunityName, type PreviousOpportunity } from "./previousProducts";

const line = (id: string, productName: string | null, productCode: string | null) => ({
  id, productName, productCode, quantity: "1", salesPrice: "100", discount: null, totalPrice: "100.00", commissionPercent: null,
  serviceStartDate: null, serviceEndDate: null,
});
const opp = (id: string, lines: ReturnType<typeof line>[]): PreviousOpportunity => ({
  id, name: id, shortName: id, data: { opportunityName: id, subsStartDate: null, subsEndDate: null, currency: "USD", lines },
});

describe("shortOpportunityName", () => {
  it("drops the account's name and the separator after it", () => {
    expect(shortOpportunityName("Pinecrest Health - Integration 2026", "Pinecrest Health")).toBe("Integration 2026");
    expect(shortOpportunityName("pinecrest health – Renewal", "Pinecrest Health")).toBe("Renewal");
  });
  it("keeps a name that doesn't start with it, or would be left empty", () => {
    expect(shortOpportunityName("Integration 2026", "Pinecrest Health")).toBe("Integration 2026");
    expect(shortOpportunityName("Pinecrest Health", "Pinecrest Health")).toBe("Pinecrest Health");
    expect(shortOpportunityName("Pinecrest Health - X", "")).toBe("Pinecrest Health - X");
  });
});

describe("groupByProduct", () => {
  it("groups by product code (else name), in first-seen order, a line per listing", () => {
    const groups = groupByProduct([
      opp("A", [line("1", "Micro Integrator", "SUB-MI"), line("2", "Support", "SLA-E"), line("3", "Micro Integrator", "SUB-MI")]),
      opp("B", [line("4", "Micro Integrator (renamed)", "SUB-MI"), line("5", "Training", null)]),
    ]);
    expect(groups.map((g) => [g.name, g.code, g.lines.map((l) => l.line.id), g.opportunityCount])).toEqual([
      ["Micro Integrator", "SUB-MI", ["1", "3", "4"], 2],
      ["Support", "SLA-E", ["2"], 1],
      ["Training", null, ["5"], 1],
    ]);
  });
});

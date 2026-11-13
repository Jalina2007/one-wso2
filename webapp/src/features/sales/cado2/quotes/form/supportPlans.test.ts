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
import type { SupportPlans } from "@features/sales/cado2/quotes/api/quoteTypes";
import { lineFromProduct, supportCheckOn, supportProblems, supportRole, yearHasEnterprise } from "./supportPlans";

const plans: SupportPlans = {
  enterprise: { productId: "01tENT", name: "Enterprise", code: "SU-E" },
  standard: { productId: "01tSTD", name: "Standard", code: "SU-S" },
  premium: [{ productId: "01tPRE", name: "Premium", code: null }],
  updatedByEmail: null,
  updatedAt: null,
};
const sub = (yearNumber: number) => ({ productId: "01tAPIM", category: "SUBSCRIPTION" as const, yearNumber });
const of = (productId: string, yearNumber: number) => ({ productId, category: "SUPPORT" as const, yearNumber });

describe("support plan check (D155)", () => {
  it("is off until an Enterprise or Standard product is set up", () => {
    expect(supportCheckOn(null)).toBe(false);
    expect(supportCheckOn({ ...plans, enterprise: null, standard: null })).toBe(false);
    expect(supportProblems([sub(1)], { ...plans, enterprise: null, standard: null })).toEqual([]);
    expect(supportCheckOn(plans)).toBe(true);
  });

  it("names each configured product's role", () => {
    expect(supportRole("01tENT", plans)).toBe("ENTERPRISE");
    expect(supportRole("01tSTD", plans)).toBe("STANDARD");
    expect(supportRole("01tPRE", plans)).toBe("PREMIUM");
    expect(supportRole("01tAPIM", plans)).toBeNull();
  });

  it("checks only years with a subscription, one plan each, Premium only with Enterprise", () => {
    const lines = [
      sub(1), // no plan
      sub(2), of("01tENT", 2), of("01tPRE", 2), // fine
      sub(3), of("01tSTD", 3), of("01tENT", 3), // two plans
      sub(4), of("01tSTD", 4), of("01tPRE", 4), // Premium without Enterprise
      of("01tPRE", 5), // no subscription: not checked
    ];
    expect(supportProblems(lines, plans).map((p) => p.message)).toEqual([
      "Year 1 has no support plan.",
      "Year 3 has 2 support plans (Standard and Enterprise). Keep one.",
      "Year 4 has Premium Support without Enterprise Support.",
    ]);
    expect(supportProblems([sub(1), of("01tENT", 1), of("01tENT", 1)], plans)[0].message).toBe(
      "Year 1 has 2 support plans (Enterprise and Enterprise). Keep one.",
    );
    expect(yearHasEnterprise(lines, plans, 2)).toBe(true);
    expect(yearHasEnterprise(lines, plans, 4)).toBe(false);
  });

  it("counts a legacy support line (Support, not set up) as the year's plan", () => {
    expect(supportProblems([sub(1), of("01tLEGACY", 1)], plans)).toEqual([]);
    expect(supportProblems([sub(1), of("01tLEGACY", 1), of("01tENT", 1)], plans)).toEqual([]);
    // Classified as a subscription, it isn't recognised as support.
    expect(supportProblems([sub(1), { productId: "01tLEGACY", category: "SUBSCRIPTION" as const, yearNumber: 1 }], plans)).toHaveLength(1);
  });

  it("makes a support product a quantity-1 line in its year; a one-off covers the year", () => {
    const product = {
      id: "01tSTD", name: "Standard", productCode: "SU-S", description: null, family: null, unitOfMeasure: null, productUnit: null,
      classification: "SS", category: "SUPPORT" as const, recurring: false, classificationProblem: null,
      pricebookEntries: [{ id: "01uSTD", unitPrice: "0", currencyIsoCode: "USD", isActive: true, pricebook: { id: "01sUSD", name: "USD Book" } }],
    };
    const year = { number: 2, start: "2028-01-01", end: "2028-12-31" };
    expect(lineFromProduct(product, year, "Annual")).toMatchObject({
      pricebookEntryId: "01uSTD", productId: "01tSTD", quantity: "1", discount: "0", yearNumber: 2,
      startDate: "2028-01-01", endDate: "2028-12-31", category: "SUPPORT", unitOfMeasure: "Annual", pricebookName: "USD Book",
    });
    expect(lineFromProduct({ ...product, pricebookEntries: [] }, year)).toBeNull();
  });
});

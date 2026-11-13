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

// The support plan check (D155): each contract year with a subscription
// should have exactly one Enterprise or Standard Support line, and Premium
// only with Enterprise. A warning, never a block; the backend gives Deal
// Desk the same problems as notes. Nothing is added by itself. A legacy
// support line (in Support, not on Admin → Support Plans) counts as the
// year's plan; Deal Desk gets a note on it.

import type { Product, SupportPlans } from "@features/sales/cado2/quotes/api/quoteTypes";
import { newLineKey, type LineValue } from "./draftForm";

/** A configured support product's role; null for any other product. */
export type SupportRole = "ENTERPRISE" | "STANDARD" | "PREMIUM";

/** Whether the check runs: an Admin picked an Enterprise or a Standard product. */
export const supportCheckOn = (plans: SupportPlans | null | undefined): plans is SupportPlans =>
  Boolean(plans && (plans.enterprise || plans.standard));

export function supportRole(productId: string | undefined, plans: SupportPlans | null | undefined): SupportRole | null {
  if (!productId || !plans) return null;
  if (plans.enterprise?.productId === productId) return "ENTERPRISE";
  if (plans.standard?.productId === productId) return "STANDARD";
  if (plans.premium.some((p) => p.productId === productId)) return "PREMIUM";
  return null;
}

/** One year's problem, worded as Deal Desk's note is. */
export interface SupportProblem {
  readonly year: number;
  readonly kind: "NONE" | "SEVERAL" | "PREMIUM_ALONE";
  readonly message: string;
}

type CheckedLine = Pick<LineValue, "productId" | "category" | "yearNumber">;

const joinAnd = (items: readonly string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/**
 * Each year with a Subscription line: no support plan (no Enterprise,
 * Standard or legacy support line), more than one Enterprise or Standard
 * line, or Premium without Enterprise. E.g. "Year 1 has no support plan."
 */
export function supportProblems(lines: readonly CheckedLine[], plans: SupportPlans | null | undefined): SupportProblem[] {
  if (!supportCheckOn(plans)) return [];
  const years = new Map<number, { subscription: boolean; premium: boolean; legacy: boolean; plans: string[] }>();
  for (const l of lines) {
    if (!l.yearNumber) continue;
    const y = years.get(l.yearNumber) ?? { subscription: false, premium: false, legacy: false, plans: [] };
    years.set(l.yearNumber, y);
    const role = supportRole(l.productId, plans);
    if (role === "ENTERPRISE") y.plans.push("Enterprise");
    else if (role === "STANDARD") y.plans.push("Standard");
    else if (role === "PREMIUM") y.premium = true;
    else if (l.category === "SUPPORT") y.legacy = true;
    else if (l.category === "SUBSCRIPTION") y.subscription = true;
  }
  const out: SupportProblem[] = [];
  for (const n of [...years.keys()].sort((a, b) => a - b)) {
    const y = years.get(n)!;
    if (!y.subscription) continue;
    if (y.plans.length === 0 && !y.legacy) {
      out.push({ year: n, kind: "NONE", message: `Year ${n} has no support plan.` });
    } else if (y.plans.length > 1) {
      out.push({ year: n, kind: "SEVERAL", message: `Year ${n} has ${y.plans.length} support plans (${joinAnd(y.plans)}). Keep one.` });
    }
    if (y.premium && !y.plans.includes("Enterprise")) {
      out.push({ year: n, kind: "PREMIUM_ALONE", message: `Year ${n} has Premium Support without Enterprise Support.` });
    }
  }
  return out;
}

/** Whether a year has an Enterprise Support line, so Premium can be offered. */
export const yearHasEnterprise = (lines: readonly CheckedLine[], plans: SupportPlans | null | undefined, year: number) =>
  lines.some((l) => l.yearNumber === year && supportRole(l.productId, plans) === "ENTERPRISE");

/** Whether a year already has a Premium Support line: Premium is then no longer offered. */
export const yearHasPremium = (lines: readonly CheckedLine[], plans: SupportPlans | null | undefined, year: number) =>
  lines.some((l) => l.yearNumber === year && supportRole(l.productId, plans) === "PREMIUM");

/**
 * A support product as a new line in a year: quantity 1, no discount, priced
 * from the quote's book (a formula, if the product has one, is applied by the
 * pricing). A one-off product covers its whole year. Null when the book
 * doesn't price it.
 */
export function lineFromProduct(p: Product, year: { number: number; start: string; end: string }, unitOfMeasure = ""): LineValue | null {
  const e = p.pricebookEntries[0];
  if (!e) return null;
  return {
    lineId: null,
    pricebookEntryId: e.id,
    productId: p.id,
    productName: p.name ?? p.id,
    productCode: p.productCode ?? "",
    productDescription: p.description ?? "",
    pricebookId: e.pricebook?.id ?? "",
    pricebookName: e.pricebook?.name ?? "",
    unitPrice: e.unitPrice ?? "",
    category: p.category ?? "",
    recurring: p.recurring,
    classification: p.classification ?? "",
    unitOfMeasure,
    quantity: "1",
    discount: "0",
    yearNumber: year.number,
    startDate: p.recurring ? "" : year.start,
    endDate: p.recurring ? "" : year.end,
    salesPrice: "",
    key: newLineKey(),
  };
}

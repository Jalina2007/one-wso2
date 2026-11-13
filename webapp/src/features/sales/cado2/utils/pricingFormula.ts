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

import type { FormulaBinding } from "@features/sales/cado2/quotes/api/quoteTypes";
import { formatDate, LINE_CATEGORIES } from "@features/sales/cado2/quotes/form/draftForm";

/**
 * "$1 = 25000 · $3 = total of Gateway + Integrator", or "… $3 = total of
 * Subscription" for a category (D153): a formula's bindings on one line (D81).
 */
export function bindingsSummary(bindings: readonly FormulaBinding[]): string {
  return bindings.map((b) => `${b.name} = ${bindingText(b)}`).join(" · ");
}

function bindingText(b: FormulaBinding): string {
  switch (b.kind) {
    case "VALUE":
      return b.value ?? "";
    case "PRODUCTS":
      return `total of ${(b.products ?? []).map((p) => p.name).join(" + ")}`;
    case "CATEGORY":
      return `total of ${LINE_CATEGORIES.find((c) => c.value === b.category)?.label ?? b.category ?? ""}`;
  }
}

/** "v3 · 15 Oct 2026": a formula version and the day it was made (D82). */
export function versionLabel(version: number, day: string): string {
  return `v${version} · ${formatDate(day.slice(0, 10))}`;
}

/** In a formula's unit of measure, the line's price-book price (D154). */
export const UNIT_LIST_PRICE = "%LIST_PRICE%";

/**
 * A formula's unit of measure as a line priced at `listPrice` shows it:
 * "Annual, higher of %LIST_PRICE% or …" → "Annual, higher of 25,000 or …".
 * The backend fills it in the same way when the line is saved.
 */
export function unitOfMeasureFor(unitOfMeasure: string, listPrice: string): string {
  if (!listPrice) return unitOfMeasure;
  const [whole, frac] = Number(listPrice).toFixed(2).split(".");
  const shown = `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${frac === "00" ? "" : `.${frac}`}`;
  return unitOfMeasure.split(UNIT_LIST_PRICE).join(shown);
}

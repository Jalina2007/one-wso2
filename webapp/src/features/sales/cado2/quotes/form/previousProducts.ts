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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import type { OpportunityLineView, OpportunityLines } from "@features/sales/cado2/quotes/api/quoteTypes";

/** A previous opportunity as the Previous year's products dialog shows it (D159). */
export interface PreviousOpportunity {
  readonly id: string;
  /** Its Salesforce name, or its Id when it has none. */
  readonly name: string;
  /** The name without the account's, which every row would repeat. */
  readonly shortName: string;
  readonly data: OpportunityLines;
}

/** A line of a product group: one line on one opportunity. */
export interface ProductGroupLine {
  readonly opportunity: PreviousOpportunity;
  readonly line: OpportunityLineView;
}

/** A distinct product across the opportunities, with every line of it. */
export interface ProductGroup {
  readonly key: string;
  readonly name: string;
  readonly code: string | null;
  readonly lines: readonly ProductGroupLine[];
  /** How many of the opportunities it is on. */
  readonly opportunityCount: number;
}

/**
 * The opportunity's name without the account's: "Pinecrest Health -
 * Integration 2026" on Pinecrest Health → "Integration 2026". Unchanged when
 * it doesn't start with the account's name, or nothing would be left.
 */
export function shortOpportunityName(name: string, accountName: string): string {
  const account = accountName.trim();
  if (!account || !name.toLowerCase().startsWith(account.toLowerCase())) return name;
  const rest = name.slice(account.length).replace(/^[\s\-–—:|]+/, "");
  return rest || name;
}

/**
 * The lines grouped by product (by product code, else name), in the order
 * the products first appear; within a product, in the opportunities' order.
 * A product listed twice on one opportunity has two lines.
 */
export function groupByProduct(opportunities: readonly PreviousOpportunity[]): ProductGroup[] {
  const groups = new Map<string, { name: string; code: string | null; lines: ProductGroupLine[] }>();
  for (const opportunity of opportunities) {
    for (const line of opportunity.data.lines) {
      const name = line.productName ?? "Unnamed product";
      const key = line.productCode ? `code:${line.productCode}` : `name:${name}`;
      const group = groups.get(key) ?? { name, code: line.productCode, lines: [] };
      group.lines.push({ opportunity, line });
      groups.set(key, group);
    }
  }
  return [...groups.entries()].map(([key, g]) => ({
    key,
    ...g,
    opportunityCount: new Set(g.lines.map((l) => l.opportunity.id)).size,
  }));
}

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

// The Quotes page (My Quotes 2026-09-25; tabs, list and tree layouts, D70):
// the backend searches, sorts and pages the list (D148); the page groups the
// rows it is shown (the status chips were removed on 2026-10-15). Pure
// functions, unit-tested.
//
// A list, not a report (D70): one row per quote with its own figures; groups
// only organise rows, with no totals.

import type { QuoteListItem } from "@features/sales/cado2/quotes/api/quoteTypes";

/** How the quotes are laid out (D70): one row each, or the account › opportunity › quote tree. */
export type QuoteLayout = "list" | "tree";

export interface OpportunityGroup {
  readonly opportunityId: string;
  readonly opportunityName: string;
  /** Its primary quote, if it is in the list. */
  readonly primary: QuoteListItem | undefined;
  readonly quotes: readonly QuoteListItem[];
}

export interface AccountGroup {
  readonly accountId: string;
  readonly accountName: string;
  readonly quotes: readonly QuoteListItem[];
  readonly opportunities: readonly OpportunityGroup[];
}

/**
 * Groups the rows by account, and within each by opportunity, in the list's
 * order (most recently changed first): a group comes where its first quote
 * would. Organises rows only; nothing is added up (D70).
 */
export function groupQuotes(items: readonly QuoteListItem[]): AccountGroup[] {
  const accounts = new Map<string, { name: string; quotes: QuoteListItem[]; opps: Map<string, QuoteListItem[]> }>();
  for (const q of items) {
    let a = accounts.get(q.sfAccountId);
    if (!a) {
      a = { name: q.accountName ?? "No account", quotes: [], opps: new Map() };
      accounts.set(q.sfAccountId, a);
    }
    a.quotes.push(q);
    const list = a.opps.get(q.sfOpportunityId) ?? [];
    list.push(q);
    a.opps.set(q.sfOpportunityId, list);
  }
  return [...accounts.entries()].map(([accountId, a]) => ({
    accountId,
    accountName: a.name,
    quotes: a.quotes,
    opportunities: [...a.opps.entries()].map(([opportunityId, quotes]) => ({
      opportunityId,
      opportunityName: quotes[0].opportunityName ?? "No opportunity",
      primary: quotes.find((q) => q.isPrimary),
      quotes,
    })),
  }));
}

/** "just now", "5 min ago", "2 h ago", "3 d ago", else the date. */
export function changedAgo(iso: string, now: Date): string {
  const then = new Date(iso);
  const mins = Math.floor((now.getTime() - then.getTime()) / 60_000);
  if (Number.isNaN(mins)) return iso;
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d ago`;
  return then.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** A column the Quotes page sorts on (D70). */
export type QuoteSortKey = "quote" | "account" | "opportunity" | "status" | "owner" | "created" | "updated";
export interface QuoteSort {
  readonly key: QuoteSortKey;
  readonly dir: "asc" | "desc";
}
/** Most recently changed first. The backend sorts (D148); ties keep this order. */
export const DEFAULT_SORT: QuoteSort = { key: "updated", dir: "desc" };

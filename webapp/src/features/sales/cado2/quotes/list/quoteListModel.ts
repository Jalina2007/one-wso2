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

// My Quotes (2026-09-25): the list is loaded once and counted, filtered
// and searched in the browser. Pure functions, unit-tested.
//
// Known limit: the list endpoint returns at most 200 quotes per call; past
// that, filtering and search need server-side paging.

import type { QuoteListItem, VersionStatus } from "@features/sales/cado2/quotes/api/quoteTypes";
import { expiryState } from "@features/sales/cado2/quotes/sheet/sheetModel";

/**
 * A status, quotes expiring within seven days, or quotes back with the owner
 * to revise or close (recalled, rejected, changes requested). "" = all.
 */
export type QuoteFilter = "" | VersionStatus | "EXPIRING" | "TO_REVISE";

export interface QuoteCounts {
  readonly all: number;
  readonly drafts: number;
  readonly submitted: number;
  readonly approved: number;
  readonly toRevise: number;
  readonly expiringSoon: number;
  readonly recalled: number;
  readonly closed: number;
}

/** Back with the owner: in none of these is anything in flight. */
export const TO_REVISE: readonly VersionStatus[] = ["RECALLED", "REJECTED", "CHANGES_REQUESTED"];

/** In approval or approved, and expiring within seven days (today included), not already expired. */
export function isExpiringSoon(q: QuoteListItem, now: Date): boolean {
  return (
    (q.status === "SUBMITTED" || q.status === "APPROVED") &&
    q.expiryDate !== null &&
    expiryState(q.expiryDate, now).tone === "soon"
  );
}

export function countQuotes(items: readonly QuoteListItem[], now: Date): QuoteCounts {
  const by = (s: VersionStatus) => items.filter((q) => q.status === s).length;
  return {
    all: items.length,
    drafts: by("DRAFT"),
    submitted: by("SUBMITTED"),
    approved: by("APPROVED"),
    toRevise: items.filter((q) => TO_REVISE.includes(q.status)).length,
    expiringSoon: items.filter((q) => isExpiringSoon(q, now)).length,
    recalled: by("RECALLED"),
    closed: by("CLOSED"),
  };
}

/** Case-insensitive match on quote number, account or opportunity. */
export function filterQuotes(items: readonly QuoteListItem[], filter: QuoteFilter, search: string, now: Date): QuoteListItem[] {
  const term = search.trim().toLowerCase();
  return items.filter((q) => {
    if (filter === "EXPIRING") {
      if (!isExpiringSoon(q, now)) return false;
    } else if (filter === "TO_REVISE") {
      if (!TO_REVISE.includes(q.status)) return false;
    } else if (filter && q.status !== filter) {
      return false;
    }
    if (!term) return true;
    return [q.quoteNumber, q.accountName, q.opportunityName].some((f) => f?.toLowerCase().includes(term));
  });
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

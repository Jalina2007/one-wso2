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
import type { QuoteListItem } from "@features/sales/cado2/quotes/api/quoteTypes";
import { changedAgo, countQuotes, filterQuotes } from "./quoteListModel";

const now = new Date("2026-10-01T12:00:00Z");
const q = (id: number, over: Partial<QuoteListItem>): QuoteListItem => ({
  id,
  quoteNumber: `Q-26-0000${id}`,
  status: "DRAFT",
  ownerEmail: "rep@wso2.com",
  accountName: "Acme Corp",
  opportunityName: "Acme renewal",
  versionNumber: 1,
  currencyIsoCode: "USD",
  tcv: "100.00",
  expiryDate: null,
  updatedAt: "2026-10-01T11:00:00Z",
  ...over,
});
const items = [
  q(1, {}),
  q(2, { status: "SUBMITTED", expiryDate: "2026-10-05", accountName: "Northwind Logistics", opportunityName: "API Platform 2027" }),
  q(3, { status: "SUBMITTED", expiryDate: "2026-10-31" }),
  q(4, { status: "SUBMITTED", expiryDate: "2026-09-20" }),
  q(5, { status: "RECALLED" }),
  q(6, { status: "CLOSED" }),
  q(7, { status: "APPROVED", expiryDate: "2026-10-03" }),
  q(8, { status: "CHANGES_REQUESTED" }),
];

describe("My Quotes model", () => {
  it("counts by status and flags quotes expiring within seven days", () => {
    expect(countQuotes(items, now)).toEqual({
      all: 8, drafts: 1, submitted: 3, approved: 1, toRevise: 2, expiringSoon: 2, recalled: 1, closed: 1,
    });
    // "To revise" gathers what is back with the owner.
    expect(filterQuotes(items, "TO_REVISE", "", now).map((x) => x.id)).toEqual([5, 8]);
  });

  it("filters by status or expiring soon", () => {
    expect(filterQuotes(items, "SUBMITTED", "", now).map((x) => x.id)).toEqual([2, 3, 4]);
    expect(filterQuotes(items, "EXPIRING", "", now).map((x) => x.id)).toEqual([2, 7]); // in approval or approved
    expect(filterQuotes(items, "", "", now)).toHaveLength(8);
  });

  it("searches quote number, account and opportunity, ignoring case", () => {
    expect(filterQuotes(items, "", "northWIND", now).map((x) => x.id)).toEqual([2]);
    expect(filterQuotes(items, "", "api platform", now).map((x) => x.id)).toEqual([2]);
    expect(filterQuotes(items, "", "Q-26-00005", now).map((x) => x.id)).toEqual([5]);
    expect(filterQuotes(items, "DRAFT", "northwind", now)).toEqual([]);
  });

  it("says when a quote last changed", () => {
    expect(changedAgo("2026-10-01T11:59:40Z", now)).toBe("just now");
    expect(changedAgo("2026-10-01T11:55:00Z", now)).toBe("5 min ago");
    expect(changedAgo("2026-10-01T10:00:00Z", now)).toBe("2 h ago");
    expect(changedAgo("2026-09-28T12:00:00Z", now)).toBe("3 d ago");
    expect(changedAgo("2026-09-01T12:00:00Z", now)).toBe("1 Sept 2026");
  });
});

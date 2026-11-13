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
import { changedAgo, groupQuotes } from "./quoteListModel";

const now = new Date("2026-10-01T12:00:00Z");
const q = (id: number, over: Partial<QuoteListItem>): QuoteListItem => ({
  id,
  quoteNumber: `Q-26-0000${id}`,
  status: "DRAFT",
  ownerEmail: "rep@wso2.com",
  sfAccountId: "001ACME",
  sfOpportunityId: "006ACMEREN",
  isPrimary: false,
  canEdit: true,
  accountName: "Acme Corp",
  opportunityName: "Acme renewal",
  versionNumber: 1,
  currencyIsoCode: "USD",
  tcv: "100.00",
  expiryDate: null,
  createdAt: "2026-09-30T09:00:00Z",
  updatedAt: "2026-10-01T11:00:00Z",
  ...over,
});

describe("My Quotes model", () => {
  it("says when a quote last changed", () => {
    expect(changedAgo("2026-10-01T11:59:40Z", now)).toBe("just now");
    expect(changedAgo("2026-10-01T11:55:00Z", now)).toBe("5 min ago");
    expect(changedAgo("2026-10-01T10:00:00Z", now)).toBe("2 h ago");
    expect(changedAgo("2026-09-28T12:00:00Z", now)).toBe("3 d ago");
    expect(changedAgo("2026-09-01T12:00:00Z", now)).toBe("1 Sept 2026");
  });
});

// D70: the Quotes page.
describe("Quotes page model", () => {
  it("groups by account, then opportunity, in list order, naming each opportunity's primary quote", () => {
    const groups = groupQuotes([
      q(1, {}),
      q(2, { sfAccountId: "001NW", accountName: "Northwind", sfOpportunityId: "006NW", opportunityName: "API Platform" }),
      q(3, { sfOpportunityId: "006ACMEIAM", opportunityName: "Acme IAM", isPrimary: true }),
      q(4, { isPrimary: true }),
    ]);

    expect(groups.map((g) => [g.accountName, g.quotes.map((x) => x.id)])).toEqual([
      ["Acme Corp", [1, 3, 4]],
      ["Northwind", [2]],
    ]);
    expect(groups[0].opportunities.map((o) => [o.opportunityName, o.quotes.map((x) => x.id), o.primary?.id])).toEqual([
      ["Acme renewal", [1, 4], 4],
      ["Acme IAM", [3], 3],
    ]);
    expect(groups[1].opportunities[0].primary).toBeUndefined();
  });
});

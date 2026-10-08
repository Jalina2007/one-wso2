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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import type { QuoteListItem } from "@features/sales/cado2/quotes/api/quoteTypes";
import { ready } from "@features/sales/cado2/quotes/testing/fixtures";
import MyQuotesPage from "./MyQuotesPage";

const list = { data: undefined as unknown, error: null as unknown, isPending: true, isFetching: false, refetch: vi.fn() };
const listCalls: [string][] = [];

vi.mock("@features/sales/cado2/quotes/api/useQuoteApi", () => ({
  useQuoteList: (status: string) => {
    listCalls.push([status]);
    return list;
  },
  // The draft a row menu deletes is loaded first.
  useQuoteVersion: () => ({ data: ready, error: null, isFetching: false, refetch: vi.fn() }),
  useDeleteDraft: () => deleteDraft,
}));
const deleteDraft = { mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null };

const soon = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
const later = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
const item = (id: number, over: Partial<QuoteListItem> = {}): QuoteListItem => ({
  id,
  quoteNumber: `Q-26-0000${id}`,
  status: "DRAFT",
  ownerEmail: "rep@wso2.com",
  accountName: "Acme Corp",
  opportunityName: "Acme APIM renewal",
  versionNumber: 1,
  currencyIsoCode: "USD",
  tcv: "123000.00",
  expiryDate: null,
  updatedAt: new Date().toISOString(),
  ...over,
});
const items = [
  item(1, { versionNumber: 2 }),
  // Issued (approved) quotes carry an expiry; one still in approval has none.
  item(2, { status: "APPROVED", expiryDate: soon, accountName: "Northwind Logistics", opportunityName: "API Platform 2027" }),
  item(3, { status: "APPROVED", expiryDate: later }),
  item(5, { status: "SUBMITTED" }),
  item(4, { status: "RECALLED" }),
];

function renderPage() {
  render(
    <MemoryRouter>
      <MyQuotesPage />
    </MemoryRouter>,
  );
}

const rows = () => within(screen.getByRole("list", { name: "Quotes" })).getAllByRole("listitem");

beforeEach(() => {
  Object.assign(list, { data: undefined, error: null, isPending: true });
  listCalls.length = 0;
});

describe("MyQuotesPage", () => {
  it("shows the counts and one row per quote, each opening its quote page", () => {
    Object.assign(list, { isPending: false, data: { items, total: 5 } });
    renderPage();

    expect(screen.getByRole("heading", { name: "My Quotes" })).toBeInTheDocument();
    // Nothing under the title (frontend.md, "Page titles").
    expect(screen.queryByText("5 quotes")).toBeNull();
    const counts = within(screen.getByRole("group", { name: "Quote counts" }));
    expect(counts.getByRole("button", { name: "Drafts: 1" })).toBeInTheDocument();
    expect(counts.getByRole("button", { name: "In approval: 1" })).toBeInTheDocument();
    expect(counts.getByRole("button", { name: "Approved: 2" })).toBeInTheDocument();
    expect(counts.getByRole("button", { name: "Expiring within 7 days: 1" })).toBeInTheDocument();
    expect(counts.getByRole("button", { name: "To revise: 1" })).toBeInTheDocument();
    expect(counts.getByRole("button", { name: "Closed: 0" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Filter by status" })).toBeNull(); // merged into the cards

    expect(rows()).toHaveLength(5);
    const first = within(rows()[0]);
    expect(first.getByRole("link")).toHaveAttribute("href", "/sales/cado2/quotes/1/quote");
    expect(first.getByText("Draft (v2)")).toBeInTheDocument();
    expect(first.getByText("USD 123,000.00")).toBeInTheDocument();
    expect(first.getByText("just now")).toBeInTheDocument();
    expect(within(rows()[1]).getByText("3 days left")).toBeInTheDocument();
    expect(within(rows()[4]).queryByText(/left/)).toBeNull(); // in approval: the clock hasn't started
    expect(screen.getByRole("link", { name: "Create Quote" })).toHaveAttribute("href", "/sales/cado2/quotes/new");
  });

  it("filters from a KPI card, and clears it with a second click", async () => {
    Object.assign(list, { isPending: false, data: { items, total: 5 } });
    renderPage();
    const user = userEvent.setup();
    const expiring = screen.getByRole("button", { name: "Expiring within 7 days: 1" });

    await user.click(expiring);
    expect(expiring).toHaveAttribute("aria-pressed", "true");
    expect(rows()).toHaveLength(1);
    expect(within(rows()[0]).getByText("Northwind Logistics")).toBeInTheDocument();
    expect(screen.getByText(/Showing 1 of 5 · Expiring within 7 days/)).toBeInTheDocument();

    await user.click(expiring);
    expect(expiring).toHaveAttribute("aria-pressed", "false");
    expect(rows()).toHaveLength(5);
  });

  it("filters by a status card, shows all again, and searches, all in the browser", async () => {
    Object.assign(list, { isPending: false, data: { items, total: 5 } });
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Approved: 2" }));
    expect(rows()).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Show all" }));
    expect(rows()).toHaveLength(5);
    expect(screen.queryByRole("button", { name: "Show all" })).toBeNull();
    await user.type(screen.getByRole("textbox", { name: "Search quotes" }), "northwind");
    expect(rows()).toHaveLength(1);
    expect(listCalls.every(([status]) => status === "")).toBe(true);

    await user.clear(screen.getByRole("textbox", { name: "Search quotes" }));
    await user.type(screen.getByRole("textbox", { name: "Search quotes" }), "zzz");
    expect(screen.getByText("No quotes match")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(rows()).toHaveLength(5);
  });

  it("welcomes a rep with no quotes", () => {
    Object.assign(list, { isPending: false, data: { items: [], total: 0 } });
    renderPage();
    expect(screen.getByText("No quotes yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create your first quote" })).toHaveAttribute("href", "/sales/cado2/quotes/new");
  });

  it("lists only the caller's own quotes: there is no Everyone switch", () => {
    Object.assign(list, { isPending: false, data: { items, total: 5 } });
    renderPage();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.getByRole("heading", { name: "My Quotes" })).toBeInTheDocument();
    expect(listCalls.at(-1)).toEqual([""]);
  });

  it("offers Delete draft in a draft row's menu, and asks first", async () => {
    Object.assign(list, { isPending: false, data: { items, total: 5 } });
    renderPage();
    const user = userEvent.setup();

    // Only draft rows have the menu.
    expect(within(rows()[0]).getByRole("button", { name: "Actions for Q-26-00001" })).toBeInTheDocument();
    for (const r of rows().slice(1)) expect(within(r).queryByRole("button", { name: /^Actions for/ })).toBeNull();

    await user.click(within(rows()[0]).getByRole("button", { name: "Actions for Q-26-00001" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete draft" }));
    const dialog = screen.getByRole("dialog", { name: "Delete this draft quote?" }); // never submitted, so no number
    await user.click(within(dialog).getByRole("button", { name: "Delete quote" }));
    expect(deleteDraft.mutate).toHaveBeenCalledWith(
      { quoteId: ready.quote.id, version: ready.version.versionNumber, expectedUpdatedAt: ready.version.updatedAt },
      expect.anything(),
    );
  });

  it("shows Not submitted where a never-submitted quote's number would be", () => {
    Object.assign(list, { isPending: false, data: { items: [item(9, { quoteNumber: null })], total: 1 } });
    renderPage();
    const row = within(rows()[0]);
    expect(row.getByText("Not submitted")).toBeInTheDocument();
    expect(row.getByText("Acme Corp")).toBeInTheDocument();
    expect(row.getByRole("button", { name: "Actions for Acme Corp · Acme APIM renewal" })).toBeInTheDocument();
  });
});

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
import type { JSX } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import type { QuoteListItem } from "@features/sales/cado2/quotes/api/quoteTypes";
import type { QuoteListQuery } from "@features/sales/cado2/quotes/api/useQuoteApi";
import { quoteStatusLabel } from "@features/sales/cado2/quotes/lifecycle/lifecycle";
import { ready } from "@features/sales/cado2/quotes/testing/fixtures";
import MyQuotesPage from "./MyQuotesPage";

// The Quotes page (D70): tabs, status chips, list and tree layouts. The
// backend searches, sorts and pages (D148); `served` stands in for it.

const query = () => ({
  data: undefined as unknown,
  error: null as unknown,
  isPending: true,
  isFetching: false,
  refetch: vi.fn(),
});
const lists = { mine: query(), all: query() };
const setPrimary = {
  mutate: vi.fn(),
  reset: vi.fn(),
  isPending: false,
  error: null,
};
// D108 from the list: clones the row's latest version.
const clone = { mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null as unknown };
const deleteDraft = {
  mutate: vi.fn(),
  reset: vi.fn(),
  isPending: false,
  error: null,
};

const PAGE = 50;
const ACCOUNTS = 20;
const sortText: Record<string, (q: QuoteListItem) => string> = {
  quote: (q) => q.quoteNumber ?? "",
  account: (q) => q.accountName ?? "",
  opportunity: (q) => q.opportunityName ?? "",
  status: (q) => quoteStatusLabel(q.status, q.versionNumber),
  owner: (q) => q.ownerEmail,
  created: (q) => q.createdAt,
  updated: (q) => q.updatedAt,
};
/** The backend's GET /quotes over a tab's quotes: search, sort, page. */
function served(scope: "mine" | "all", query: QuoteListQuery = {}) {
  const base = lists[scope];
  const data = base.data as { items: QuoteListItem[] } | undefined;
  if (!data) return base;
  const term = (query.search ?? "").trim().toLowerCase();
  const sort = query.sort ?? { key: "updated", dir: "desc" };
  const sign = sort.dir === "asc" ? 1 : -1;
  const matched = data.items
    .filter((q) => !term || [q.quoteNumber, q.accountName, q.opportunityName, q.ownerEmail].some((f) => f?.toLowerCase().includes(term)))
    .map((q, i) => ({ q, i }))
    .sort((a, b) => sign * sortText[sort.key](a.q).localeCompare(sortText[sort.key](b.q), undefined, { sensitivity: "base" }) || a.i - b.i)
    .map((x) => x.q);
  if (query.byAccount) {
    // An account sits where its first quote would, with all its quotes.
    const accounts = [...new Set(matched.map((q) => q.sfAccountId))];
    const from = (query.page ?? 0) * ACCOUNTS;
    const shown = new Set(accounts.slice(from, from + ACCOUNTS));
    const items = [...shown].flatMap((a) => matched.filter((q) => q.sfAccountId === a));
    return { ...base, data: { items, total: accounts.length } };
  }
  const limit = query.limit ?? PAGE;
  const from = (query.page ?? 0) * limit;
  return { ...base, data: { items: matched.slice(from, from + limit), total: matched.length } };
}

vi.mock("@hooks/useDebouncedValue", () => ({ useDebouncedValue: <T,>(v: T) => v }));
vi.mock("@features/sales/cado2/quotes/api/useQuoteApi", () => ({
  QUOTE_PAGE: 50,
  ACCOUNT_PAGE: 20,
  useQuoteList: (scope: "mine" | "all", query?: QuoteListQuery) => served(scope, query),
  useSetPrimary: () => setPrimary,
  useOpportunityQuotes: () => ({
    data: [],
    error: null,
    isPending: false,
    isFetching: false,
  }),
  // The draft a row menu deletes is loaded first.
  useQuoteVersion: () => ({
    data: ready,
    error: null,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useDeleteDraft: () => deleteDraft,
  useCloneQuote: () => clone,
}));

// A rep by default; Deal Desk without the Sales role in its own test (D127).
const me = { data: { sub: "s", email: "rep@wso2.com", roles: ["SALES"] as string[], approverRoles: [] as string[] } };
vi.mock("@features/sales/cado2/api/useCado2Me", async (actual) => ({
  ...(await actual<typeof import("@features/sales/cado2/api/useCado2Me")>()),
  useCado2Me: () => me,
}));

const NOW = new Date().toISOString();
const item = (
  id: number,
  over: Partial<QuoteListItem> = {},
): QuoteListItem => ({
  id,
  quoteNumber: `Q-26-0000${id}`,
  status: "DRAFT",
  ownerEmail: "rep@wso2.com",
  sfAccountId: "001ACME",
  sfOpportunityId: "006ACMEAPIM",
  isPrimary: false,
  canEdit: true,
  accountName: "Acme Corp",
  opportunityName: "Acme APIM renewal",
  versionNumber: 1,
  currencyIsoCode: "USD",
  tcv: "123000.00",
  expiryDate: null,
  createdAt: "2026-10-02T08:00:00Z",
  // One time for every item: a fresh new Date() per item could tick between
  // items and reorder the list, which is sorted by last update.
  updatedAt: NOW,
  ...over,
});
const mine = [
  item(1, { versionNumber: 2, isPrimary: true }),
  item(2, {
    status: "APPROVED",
    sfAccountId: "001NW",
    accountName: "Northwind Logistics",
    sfOpportunityId: "006NW",
    opportunityName: "API Platform 2027",
    expiryDate: "2099-12-11", // its order form is issued (D160)
  }),
  item(3, { status: "APPROVED", expiryDate: "2026-01-05" }), // issued, and expired
  item(5, {
    status: "SUBMITTED",
    sfOpportunityId: "006ACMEIAM",
    opportunityName: "Acme IAM",
  }),
  item(4, { status: "RECALLED" }),
];
const everyone = [
  ...mine,
  item(6, {
    ownerEmail: "nimesha@wso2.com",
    canEdit: false,
    sfAccountId: "001SUVA",
    accountName: "Suva",
    sfOpportunityId: "006SUVA",
    opportunityName: "Renewal 2027",
  }),
];

function Where(): JSX.Element {
  const l = useLocation();
  return <output aria-label="Location">{l.pathname + l.search}</output>;
}

function renderPage(path = "/sales/quickquote/quotes") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/sales/quickquote/quotes" element={<MyQuotesPage />} />
        <Route path="/sales/quickquote/quotes/:id/quote" element={<Where />} />
        <Route path="/sales/quickquote/quotes/:id/versions/:n/edit" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

const table = (name = "Quotes") => screen.getByRole("table", { name });
const bodyRows = (name = "Quotes") =>
  within(table(name)).getAllByRole("row").slice(1);

beforeEach(() => {
  Object.assign(lists.mine, {
    data: { items: mine, total: mine.length },
    error: null,
    isPending: false,
  });
  Object.assign(lists.all, {
    data: { items: everyone, total: everyone.length },
    error: null,
    isPending: false,
  });
  setPrimary.mutate = vi.fn();
  me.data = { sub: "s", email: "rep@wso2.com", roles: ["SALES"], approverRoles: [] };
  localStorage.clear();
});

describe("Quotes page", () => {
  it("shows my quotes as compact rows, with each tab's count", async () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Quotes" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "My quotes 5" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("tab", { name: "All quotes 6" }),
    ).toBeInTheDocument();
    // Gone (2026-10-15 feedback): the status chips; the Status column stays.
    expect(screen.queryByRole("group", { name: "Filter by status" })).toBeNull();
    expect(within(table()).getByRole("columnheader", { name: /Status/ })).toBeInTheDocument();
    // Gone (2026-10-12 feedback): the big cards, "Needs your attention", "Expiring within 7 days".
    expect(screen.queryByRole("group", { name: "Quote counts" })).toBeNull();
    expect(
      screen.queryByText(/Needs your attention|Expiring within/),
    ).toBeNull();

    expect(
      within(table()).queryByRole("columnheader", { name: "Owner" }),
    ).toBeNull(); // always you
    const first = within(bodyRows()[0]);
    expect(first.getByLabelText("Primary quote")).toBeInTheDocument();
    expect(first.getByRole("link", { name: "Q-26-00001" })).toHaveAttribute(
      "href",
      "/sales/quickquote/quotes/1/quote",
    );
    expect(first.getByText("Draft (v2)")).toBeInTheDocument();
    expect(first.getByText("2 Oct 2026")).toBeInTheDocument(); // created
    expect(first.getByText("just now")).toBeInTheDocument(); // updated
    expect(
      within(table()).queryByRole("columnheader", { name: /Total/ }),
    ).toBeNull(); // not needed (2026-10-12)

    await userEvent
      .setup()
      .click(within(bodyRows()[1]).getByText("Northwind Logistics"));
    expect(screen.getByLabelText("Location")).toHaveTextContent(
      "/sales/quickquote/quotes/2/quote",
    ); // the whole row opens it
  });

  it("searches, and clears the search", async () => {
    renderPage();
    const user = userEvent.setup();

    await user.type(
      screen.getByRole("textbox", { name: "Search quotes" }),
      "northwind",
    );
    expect(bodyRows()).toHaveLength(1);
    await user.clear(screen.getByRole("textbox", { name: "Search quotes" }));
    await user.type(
      screen.getByRole("textbox", { name: "Search quotes" }),
      "zzz",
    );
    expect(screen.getByText("No quotes match")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(bodyRows()).toHaveLength(5);
    expect(screen.getByRole("textbox", { name: "Search quotes" })).toHaveValue("");
  });

  // 2026-10-15: the tabs, search and layout are the table's own toolbar.
  it("puts the tabs, search and layout on the table's card", () => {
    renderPage();
    const card = table().closest(".MuiPaper-root") as HTMLElement;
    expect(within(card).getByRole("tablist", { name: "Whose quotes" })).toBeInTheDocument();
    expect(within(card).getByRole("textbox", { name: "Search quotes" })).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
    expect(within(card).getByRole("button", { name: "Tree" })).toBeInTheDocument();
  });


  it("shows everyone's quotes on All quotes, with an Owner column, found by search; others' rows are read-only", async () => {
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole("tab", { name: "All quotes 6" }));
    expect(
      within(table()).getByRole("columnheader", { name: "Owner" }),
    ).toBeInTheDocument();
    const suva = within(bodyRows()[5]);
    expect(suva.getByText("nimesha@wso2.com")).toBeInTheDocument();
    // Another AM's quote: read-only, but it can be cloned (D108).
    await user.click(suva.getByRole("button", { name: /^Actions for/ }));
    expect(screen.getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["Clone quote"]);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("combobox", { name: "Owner" })).toBeNull(); // no owner dropdown (2026-10-12)
    await user.type(
      screen.getByRole("textbox", { name: "Search quotes" }),
      "nimesha",
    );
    expect(bodyRows()).toHaveLength(1);
  });

  it("lays quotes out as a tree, account › opportunity › quote, each branch collapsible, and remembers the choice", async () => {
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Tree" }));
    const tree = "Quotes by account and opportunity";
    expect(within(table(tree)).getByText("Acme Corp")).toBeInTheDocument();
    expect(
      within(table(tree)).getByText("Acme APIM renewal"),
    ).toBeInTheDocument();
    expect(
      within(table(tree)).getByText("★ Q-26-00001 is primary"),
    ).toBeInTheDocument();
    expect(
      within(table(tree)).getByText("Northwind Logistics"),
    ).toBeInTheDocument();
    expect(within(table(tree)).getAllByRole("link")).toHaveLength(5);

    await user.click(
      screen.getByRole("button", { name: "Collapse Acme APIM renewal" }),
    );
    expect(within(table(tree)).getAllByRole("link")).toHaveLength(2); // Acme IAM's and Northwind's
    await user.click(
      screen.getByRole("button", { name: "Collapse Acme Corp" }),
    );
    expect(within(table(tree)).queryByText("Acme IAM")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Expand Acme Corp" }));
    expect(within(table(tree)).getByText("Acme IAM")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(within(table(tree)).queryAllByRole("link")).toHaveLength(0);
    // A search opens every branch with a match.
    await user.type(
      screen.getByRole("textbox", { name: "Search quotes" }),
      "Q-26-00003",
    );
    expect(within(table(tree)).getAllByRole("link")).toHaveLength(1);

    expect(localStorage.getItem("cado2.quotes.layout")).toBe("tree");
  });

  it("makes a quote primary from its row menu, after asking; Delete draft only on drafts", async () => {
    renderPage();
    const user = userEvent.setup();

    await user.click(
      within(bodyRows()[2]).getByRole("button", {
        name: "Actions for Q-26-00003",
      }),
    );
    expect(screen.queryByRole("menuitem", { name: "Delete draft" })).toBeNull(); // approved, not a draft
    await user.click(screen.getByRole("menuitem", { name: "Make primary" }));
    // D168: approved, so it is written to the opportunity now.
    expect(screen.getByRole("dialog")).toHaveTextContent("Its products are written to the opportunity in Salesforce now");
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Make primary",
      }),
    );
    expect(setPrimary.mutate).toHaveBeenCalledWith(
      { quoteId: 3, primary: true },
      expect.anything(),
    );
  });

  it("deletes a draft from its row menu, after asking", async () => {
    renderPage();
    const user = userEvent.setup();

    await user.click(
      within(bodyRows()[0]).getByRole("button", {
        name: "Actions for Q-26-00001",
      }),
    );
    // The quote page's menu (2026-10-13): the everyday action first, Delete draft last.
    expect(screen.getAllByRole("menuitem").map((m) => m.textContent)).toEqual(["Clone quote", "Remove primary", "Delete draft"]); // this draft is the primary
    await user.click(screen.getByRole("menuitem", { name: "Delete draft" }));
    const dialog = screen.getByRole("dialog", {
      name: "Delete this draft quote?",
    }); // never submitted, so no number
    await user.click(
      within(dialog).getByRole("button", { name: "Delete quote" }),
    );
    expect(deleteDraft.mutate).toHaveBeenCalledWith(
      {
        quoteId: ready.quote.id,
        version: ready.version.versionNumber,
        expectedUpdatedAt: ready.version.updatedAt,
      },
      expect.anything(),
    );
  });

  // D108 from the list: clone a row's latest version, after asking, then open the new draft.
  it("clones a quote from its row menu", async () => {
    clone.mutate.mockImplementation((_v: unknown, o: { onSuccess: (r: unknown) => void }) =>
      o.onSuccess({ quote: { id: 99 }, version: { versionNumber: 1 } }),
    );
    renderPage();
    const user = userEvent.setup();
    await user.click(within(bodyRows()[0]).getByRole("button", { name: "Actions for Q-26-00001" }));
    await user.click(screen.getByRole("menuitem", { name: "Clone quote" }));
    const dialog = within(screen.getByRole("dialog", { name: "Clone Q-26-00001 v2?" }));
    expect(screen.getByRole("table", { name: "Quotes", hidden: true })).toBeInTheDocument(); // still on the list: the click didn't open the quote
    await user.click(dialog.getByRole("button", { name: "Clone" }));
    expect(clone.mutate).toHaveBeenCalledWith({ quoteId: 1, version: 2 }, expect.anything());
    expect(screen.getByLabelText("Location")).toHaveTextContent("/sales/quickquote/quotes/99/versions/1/edit");
  });

  // D160: when an issued order form expires; a dash before it is issued, red once passed.
  it("shows when an issued order form expires", () => {
    renderPage();
    const header = within(table()).getByRole("columnheader", { name: "Expires" });
    expect(within(header).queryByRole("button")).toBeNull(); // not sorted
    const row = (n: string) => within(bodyRows().find((r) => within(r).queryByRole("link", { name: n }))!);
    expect(row("Q-26-00001").getByText("—")).toBeInTheDocument();
    expect(row("Q-26-00002").getByText("11 Dec 2099")).not.toHaveAttribute("title");
    expect(row("Q-26-00003").getByText("5 Jan 2026")).toHaveAttribute("title", "Expired");
  });

  it("sorts on any column, ascending then descending", async () => {
    renderPage();
    const user = userEvent.setup();
    const numbers = () =>
      bodyRows().map((r) => within(r).getAllByRole("link")[0].textContent);

    await user.click(screen.getByRole("button", { name: "Account" }));
    expect(
      within(bodyRows()[4]).getByText("Northwind Logistics"),
    ).toBeInTheDocument(); // A to Z
    await user.click(screen.getByRole("button", { name: "Account" }));
    expect(
      within(bodyRows()[0]).getByText("Northwind Logistics"),
    ).toBeInTheDocument(); // Z to A
    expect(
      screen.getByRole("columnheader", { name: /Account/ }),
    ).toHaveAttribute("aria-sort", "descending");

    await user.click(screen.getByRole("button", { name: "Quote" }));
    expect(numbers()).toEqual([
      "Q-26-00001",
      "Q-26-00002",
      "Q-26-00003",
      "Q-26-00004",
      "Q-26-00005",
    ]);
  });

  it("shows Deal Desk without the Sales role every quote, with no My quotes tab and no New Quote (D127)", () => {
    me.data = { sub: "s", email: "dd@wso2.com", roles: [], approverRoles: ["DEAL_DESK"] };
    renderPage();
    expect(screen.queryByRole("tab", { name: /My quotes/ })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /All quotes/ })).toHaveAttribute("aria-selected", "true");
    expect(bodyRows()).toHaveLength(everyone.length);
    expect(screen.queryByRole("link", { name: "New Quote" })).not.toBeInTheDocument();
  });

  // D148: 50 rows a page; the count is every match.
  it("pages through more quotes than fit on one page", async () => {
    const many = Array.from({ length: 120 }, (_, i) => item(i + 1, { quoteNumber: `Q-26-${String(i + 1).padStart(5, "0")}` }));
    Object.assign(lists.mine, { data: { items: many, total: many.length } });
    renderPage();
    const user = userEvent.setup();

    expect(screen.getByRole("tab", { name: "My quotes 120" })).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(50);
    expect(screen.getByText("1–50 of 120")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("101–120 of 120")).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(20);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    // A search starts again from the first page, and finds a quote past it.
    await user.type(screen.getByRole("textbox", { name: "Search quotes" }), "Q-26-00119");
    expect(screen.getByText("1–1 of 1")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "My quotes 120" })).toBeInTheDocument(); // still the whole count
  }, 15_000); // 50 rows twice and a typed search: slow when every test file runs at once

  // D148: the tree pages accounts, so an account's quotes stay together.
  it("pages the tree by account, each account with all its quotes", async () => {
    const accounts = Array.from({ length: 25 }, (_, i) =>
      item(i + 1, {
        sfAccountId: `001A${i + 1}`,
        accountName: `Account ${i + 1}`,
        sfOpportunityId: `006A${i + 1}`,
        opportunityName: `Deal ${i + 1}`,
        updatedAt: new Date(Date.UTC(2026, 9, 1, 0, 100 - i)).toISOString(),
      }),
    );
    // Account 1's other quote is the oldest of all: in a list by quote it
    // would be on the last page.
    const oldest = item(99, {
      sfAccountId: "001A1",
      accountName: "Account 1",
      sfOpportunityId: "006A1",
      opportunityName: "Deal 1",
      updatedAt: "2026-01-01T00:00:00Z",
    });
    Object.assign(lists.mine, { data: { items: [...accounts, oldest], total: 26 } });
    renderPage("/sales/quickquote/quotes?layout=tree");
    const user = userEvent.setup();
    const tree = "Quotes by account and opportunity";

    expect(screen.getByText("Accounts 1–20 of 25")).toBeInTheDocument();
    expect(within(table(tree)).getByRole("link", { name: "Q-26-00001" })).toBeInTheDocument();
    expect(within(table(tree)).getByRole("link", { name: "Q-26-000099" })).toBeInTheDocument(); // with its account
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Accounts 21–25 of 25")).toBeInTheDocument();
    expect(within(table(tree)).getAllByRole("link")).toHaveLength(5);

    await user.click(screen.getByRole("button", { name: "List" }));
    expect(screen.getByText("1–26 of 26")).toBeInTheDocument(); // back to quotes, from page 1
  });

  it("welcomes a rep with no quotes", () => {
    Object.assign(lists.mine, { data: { items: [], total: 0 } });
    renderPage();
    expect(screen.getByText("No quotes yet")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create your first quote" }),
    ).toHaveAttribute("href", "/sales/quickquote/quotes/new");
  });
});

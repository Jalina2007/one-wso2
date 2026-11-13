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
import type { JSX } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { AdapterDateFns, DatePickers } from "@wso2/oxygen-ui";
import {
  emptyDraftForm,
  type DraftFormValues,
  type LineValue,
} from "@features/sales/cado2/quotes/form/draftForm";
import ProductsStep from "./ProductsStep";

// D72: products brought in from the opportunity.

// D159: a previous opportunity's line items in Salesforce.
const previousLines = {
  opportunityName: "Acme - Integration 2026", subsStartDate: "2026-01-01", subsEndDate: "2026-12-31", currency: "USD",
  lines: [{ id: "00kA", productName: "API Manager", productCode: "P-APIM", quantity: "4", salesPrice: "9000", discount: "25", totalPrice: "27000.00",
    commissionPercent: null, serviceStartDate: "2026-01-01", serviceEndDate: "2026-12-31" }],
};
// D155: Admin → Support Plans, and those products in the quote's book.
const supportProduct = (id: string, name: string, code: string) => ({
  id, name, productCode: code, description: null, family: null, unitOfMeasure: null, classification: "ES",
  category: "SUPPORT" as const, recurring: true, classificationProblem: null as string | null,
  pricebookEntries: [{ id: `01u${id}`, unitPrice: "25000", currencyIsoCode: "USD", isActive: true, pricebook: { id: "01sUSD", name: "USD Price Book" } }],
});
const plans = {
  enterprise: { productId: "01tENT", name: "WSO2 Enterprise Support Plan", code: "SU-E" },
  standard: { productId: "01tSTD", name: "WSO2 Standard Support Plan", code: "SU-S" },
  premium: [{ productId: "01tPRE", name: "Premium Support Subscription", code: "SV-PREMIUM-SUPPORT" }],
  updatedByEmail: null,
  updatedAt: null,
};
const quoteSettings: { supportPlans: unknown; error: Error | null } = { supportPlans: null, error: null };
const supportProducts = {
  data: [
    supportProduct("01tENT", "WSO2 Enterprise Support Plan", "SU-E"),
    supportProduct("01tSTD", "WSO2 Standard Support Plan", "SU-S"),
    supportProduct("01tPRE", "Premium Support Subscription", "SV-PREMIUM-SUPPORT"),
  ],
};
const empty = {
  data: [],
  error: null,
  isPending: false,
  isFetching: false,
  refetch: vi.fn(),
};
vi.mock("@features/sales/cado2/quotes/api/useQuoteApi", () => ({
  useAccountOpportunities: () => empty,
  usePreviousOpportunityLines: (ids: readonly string[]) => ids.map(() => ({ ...empty, data: previousLines })),
  usePricingFormulas: () => empty,
  useQuoteSettings: () =>
    quoteSettings.error
      ? { ...empty, data: undefined, error: quoteSettings.error }
      : { ...empty, data: { validityDays: 30, supportPlans: quoteSettings.supportPlans } },
  useProductsByIds: () => ({ ...empty, data: supportProducts.data }),
  useCurrencies: () => ({ ...empty, data: ["USD"] }),
  usePricebooks: () => empty,
  useProducts: () => ({
    ...empty,
    data: { pages: [] },
    hasNextPage: false,
    fetchNextPage: vi.fn(),
  }),
}));

const line = (name: string, category: LineValue["category"]): LineValue => ({
  lineId: null,
  pricebookEntryId: `01u${name}`,
  productName: name,
  productCode: "",
  productDescription: "",
  pricebookId: "01sUSD",
  pricebookName: "USD Price Book",
  unitPrice: "360",
  category,
  recurring: category !== "PROFESSIONAL_SERVICE",
  classification: "PS",
  unitOfMeasure: "",
  quantity: "1",
  discount: "",
  yearNumber: 1,
  startDate: "",
  endDate: "",
  salesPrice: "",
  key: `k-${Math.random()}`,
});

/** Each line's quantity, by key, to check what the form holds. */
function Quantities(): JSX.Element {
  const lines = useWatch<DraftFormValues, "lines">({ name: "lines" });
  return <p aria-label="Quantities">{lines.map((l) => `${l.key}=${l.quantity}`).join(" ")}</p>;
}

function Harness({
  startDate = "2027-01-01",
  values = {},
}: { startDate?: string; values?: Partial<DraftFormValues> } = {}): JSX.Element {
  const form = useForm<DraftFormValues>({
    defaultValues: {
      ...emptyDraftForm(),
      accountId: "001A",
      currencyIsoCode: "USD",
      defaultPricebookId: "01sUSD",
      defaultPricebookName: "USD Price Book",
      startDate,
      dealKind: "FIRST_SALE",
      lines: [
        line("WSO2 Gateway", "SUBSCRIPTION"),
        line("WSO2 Integrator", ""),
      ],
      ...values,
    },
  });
  return (
    <DatePickers.LocalizationProvider dateAdapter={AdapterDateFns}>
      <FormProvider {...form}>
        <ProductsStep preview={null} />
        <Quantities />
      </FormProvider>
    </DatePickers.LocalizationProvider>
  );
}

describe("ProductsStep (Products & Pricing)", () => {
  beforeEach(() => {
    quoteSettings.supportPlans = null;
    quoteSettings.error = null;
    supportProducts.data = supportProducts.data.map((p) => ({ ...p, classificationProblem: null }));
  });

  // A failed lookup says so, instead of looking like "no support plans".
  it("says when the support plans couldn't be loaded", () => {
    quoteSettings.error = new Error("down");
    render(<Harness values={{ opportunityId: "006A", opportunityName: "Acme renewal", dealKind: "RENEWAL" }} />);
    expect(screen.getByText(/Couldn't load the support plans, so this quote's support isn't checked/)).toBeInTheDocument();
  });

  it("won't add a support product whose classification isn't set up", () => {
    quoteSettings.supportPlans = plans;
    supportProducts.data = supportProducts.data.map((p) =>
      p.id === "01tENT" ? { ...p, classificationProblem: "WSO2 Enterprise Support Plan's classification, SS, isn't set up in QuickQuote." } : p,
    );
    render(<Harness />);
    expect(screen.getByRole("button", { name: "Add Enterprise Support" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add Standard Support" })).toBeEnabled();
  });

  // D155: a year with a subscription is reminded of its support plan; nothing is added by itself.
  it("warns a year with no support plan and adds Enterprise Support in one click", async () => {
    quoteSettings.supportPlans = plans;
    const user = userEvent.setup();
    render(<Harness />);
    const warning = screen.getByRole("alert", { name: "Support plan" });
    expect(warning).toHaveTextContent("Year 1 has no support plan.");
    expect(screen.queryByText("WSO2 Enterprise Support Plan")).toBeNull();

    await user.click(within(warning).getByRole("button", { name: "Add Enterprise Support" }));
    expect(screen.getByText("WSO2 Enterprise Support Plan")).toBeInTheDocument();
    expect(screen.queryByRole("alert", { name: "Support plan" })).toBeNull();
  });

  it("has no switch between plans: the AM removes one and adds the other", () => {
    quoteSettings.supportPlans = plans;
    const enterprise = { ...line("WSO2 Enterprise Support Plan", "SUPPORT"), productId: "01tENT" };
    render(<Harness values={{ lines: [line("WSO2 Gateway", "SUBSCRIPTION"), enterprise] }} />);
    expect(screen.queryByRole("alert", { name: "Support plan" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Switch to/ })).toBeNull();
  });

  it("warns about two support plans, and offers Premium with Enterprise until one is added", async () => {
    quoteSettings.supportPlans = plans;
    const user = userEvent.setup();
    const enterprise = { ...line("WSO2 Enterprise Support Plan", "SUPPORT"), productId: "01tENT" };
    const standard = { ...line("WSO2 Standard Support Plan", "SUPPORT"), productId: "01tSTD" };
    render(<Harness values={{ lines: [line("WSO2 Gateway", "SUBSCRIPTION"), enterprise, standard] }} />);
    expect(screen.getByRole("alert", { name: "Support plan" })).toHaveTextContent(
      "Year 1 has 2 support plans (Enterprise and Standard). Keep one.",
    );

    await user.click(screen.getByRole("button", { name: "Add Premium Support" }));
    await user.click(screen.getByRole("menuitem", { name: "Premium Support Subscription · SV-PREMIUM-SUPPORT" }));
    expect(screen.getByText("Premium Support Subscription")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Premium Support" })).toBeNull();
  });

  it("checks nothing while no support plan is set up", () => {
    render(<Harness />);
    expect(screen.queryByRole("alert", { name: "Support plan" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add Premium Support" })).toBeNull();
  });

  // D159: a renewal's previous opportunities' products, read only, synced or not.
  it("shows the previous year's products on a renewal once its previous opportunities are chosen", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness values={{ opportunityId: "006A", opportunityName: "Acme renewal" }} />);
    expect(screen.queryByRole("button", { name: "Previous year's products" })).toBeNull(); // a first sale
    unmount();

    // None chosen in Overview yet: disabled, saying where to choose them.
    const none = render(<Harness values={{ opportunityId: "006A", opportunityName: "Acme renewal", dealKind: "RENEWAL" }} />);
    expect(screen.getByRole("button", { name: "Previous year's products" })).toBeDisabled();
    await user.hover(screen.getByRole("button", { name: "Previous year's products" }).parentElement!);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Choose the opportunities this renewal replaces in Overview to see their products.");
    none.unmount();

    render(
      <Harness values={{ opportunityId: "006A", opportunityName: "Acme renewal", dealKind: "RENEWAL", previousOpportunityIds: ["006P1"] }} />,
    );
    await user.click(screen.getByRole("button", { name: "Previous year's products" }));
    const dialog = within(screen.getByRole("dialog", { name: /Previous year's products/ }));
    expect(dialog.getByText("Acme - Integration 2026")).toBeInTheDocument();
    expect(dialog.getByText("API Manager")).toBeInTheDocument();
    expect(dialog.queryByRole("button", { name: /Load|Add/ })).toBeNull(); // read only
    await user.click(dialog.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("WSO2 Gateway")).toBeInTheDocument(); // the quote's own lines untouched
  });

  // D151: a rate per year, from the Partner Commission card.
  it("splits the commission into a rate per year, and back to one after asking", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness values={{ dealType: "PARTNER", partnerCommissionPercent: "10", yearCount: 1 }} />);
    expect(screen.queryByRole("checkbox", { name: "Different rate per year" })).toBeNull(); // one year
    unmount();

    render(<Harness values={{ dealType: "PARTNER", partnerCommissionPercent: "10", yearCount: 3 }} />);
    await user.click(screen.getByRole("checkbox", { name: "Different rate per year" }));
    const perYear = within(screen.getByLabelText("Commission per year"));
    expect(perYear.getAllByRole("textbox").map((t) => (t as HTMLInputElement).value)).toEqual(["10", "10", "10"]);
    const year1 = perYear.getByRole("textbox", { name: "Year 1" });
    await user.clear(year1);
    await user.type(year1, "15");

    await user.click(screen.getByRole("checkbox", { name: "Different rate per year" }));
    expect(screen.getByText("Every year will use Year 1's 15%.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Use 15%" }));
    expect(screen.queryByLabelText("Commission per year")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Commission" })).toHaveValue("15");
  });

  // D78: products can be added and kept before the start date; they are
  // priced once it is chosen.
  it("lets the AM add products before the start date is chosen", () => {
    render(<Harness startDate="" />);
    expect(screen.getByRole("button", { name: "Add product to Year 1" })).toBeEnabled();
    expect(screen.getByText("Amounts appear once the start date is chosen.")).toBeInTheDocument();
  });

  // Currency and price book first, then the term right above the products it
  // lays out (2026-10-23); billing and payment terms are on Commercials (D86).
  // An empty quote (2026-10-26): one way to add a product, no year to add,
  // no clone or delete, and no totals of nothing.
  it("starts an empty quote with one Add product and nothing else", () => {
    render(<Harness values={{ lines: [] }} />);
    expect(screen.getByText(/^No products yet/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add product to Year 1" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /^Clone/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete Year 1" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Add Year 2/ })).toBeNull();
    expect(screen.queryByText(/Total order value/)).toBeNull();
  });

  // A new year (added or cloned) only once every year has products, so empty
  // years don't pile up; an empty year can still be deleted.
  it("adds or clones a year only once every year has products, and deletes an empty one", async () => {
    const user = userEvent.setup();
    render(<Harness values={{ lines: [{ ...line("WSO2 Gateway", "SUBSCRIPTION"), recurring: true }] }} />);
    await user.click(screen.getByRole("button", { name: "Add Year 2" }));
    expect(screen.getByRole("button", { name: "Add Year 3" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Clone/ })).toBeDisabled();
    const year2 = within(screen.getByRole("region", { name: "Year 2" }));
    expect(year2.getByText(/^No products yet/)).toBeInTheDocument();
    expect(year2.queryByRole("button", { name: /^Clone/ })).toBeNull();

    await user.click(year2.getByRole("button", { name: "Delete Year 2" }));
    expect(screen.queryByRole("region", { name: "Year 2" })).toBeNull();
    expect(screen.getByRole("button", { name: "Add Year 2" })).toBeEnabled();
  });

  // A quote always has Year 1: the only year can't be deleted, empty or not.
  it("never deletes the only year", () => {
    const { unmount } = render(<Harness values={{ lines: [] }} />);
    expect(screen.queryByRole("button", { name: "Delete Year 1" })).toBeNull();
    unmount();
    render(<Harness />);
    expect(screen.getByRole("region", { name: "Year 1" })).not.toHaveTextContent(/\d+ products?/); // no product count (2026-11-08)
    expect(screen.queryByRole("button", { name: "Delete Year 1" })).toBeNull();
  });

  // The last year's end date is clickable: a calendar brings it forward, and
  // "Full year" puts it back. Earlier years' dates are plain text.
  it("shortens the last year from its end date in the header", async () => {
    const user = userEvent.setup();
    render(<Harness values={{ yearCount: 1 }} />);
    await user.click(screen.getByRole("button", { name: /^Year 1 ends 31 Dec 2027\. Shorten Year 1/ }));
    const calendar = within(screen.getByLabelText("When Year 1 ends"));
    expect(calendar.queryByRole("button", { name: "Full year" })).toBeNull();
    await user.click(calendar.getByRole("gridcell", { name: "15" }));
    expect(screen.getByRole("button", { name: /^Year 1 ends 15 Dec 2027\. Change when Year 1 ends/ })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Year 1" })).toHaveTextContent("11 months");

    await user.click(screen.getByRole("button", { name: /^Year 1 ends 15 Dec 2027\. Change when Year 1 ends/ }));
    await user.click(within(screen.getByLabelText("When Year 1 ends")).getByRole("button", { name: "Full year" }));
    expect(screen.getByRole("button", { name: /^Year 1 ends 31 Dec 2027\. Shorten Year 1/ })).toBeInTheDocument();
  });

  // The year's actions sit beside its toggle, not inside
  // a button, so screen readers announce them.
  it("keeps a year's actions outside its fold toggle", () => {
    render(<Harness />);
    const toggle = screen.getByRole("button", { name: /^Year 1, (fold|unfold)$/ });
    const clone = screen.getByRole("button", { name: /^Clone/ });
    expect(toggle.contains(clone)).toBe(false);
  });

  it("puts the term right above the products", () => {
    render(<Harness />);
    const regions = screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"));
    expect(regions[0]).toBe("Currency & Price Book");
    expect(regions.indexOf("Term")).toBe(regions.indexOf("Products") - 1);
    expect(regions.indexOf("Year 1")).toBeGreaterThan(regions.indexOf("Products")); // a section inside the Products card
    expect(regions).not.toContain("Billing Frequency");
    expect(regions).not.toContain("Payment Terms");
  });

  // D152: a line whose classification isn't set up sits first under "Not set up"; only an Admin can fix it.
  it("puts a line whose classification isn't set up under Not set up, saying an Admin sets it", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const table = screen.getByRole("table", { name: "Products" });
    expect(within(table).queryByRole("combobox")).toBeNull(); // no dropdown on the line
    // Framed by a thin red line, first.
    const group = within(table).getByRole("rowgroup", { name: "Not set up" });
    expect(within(group).getByText("WSO2 Integrator")).toBeInTheDocument();
    expect(within(group).queryByText("WSO2 Gateway")).toBeNull();
    expect(within(table).getByText(/Classification not set up · ask an Admin/)).toBeInTheDocument();

    // Line 2 is WSO2 Integrator: its dialog says the same, with nothing to choose.
    await user.click(within(table).getByRole("button", { name: "Edit line 2" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("alert", { name: "Classification" })).toHaveTextContent(/ask an Admin/);
    expect(within(dialog).queryByRole("combobox", { name: "Category" })).toBeNull();
  });

  // D91, amended 2026-10-23: the commission card sits above the term and the products, before any product too.
  it("puts the partner commission card above the term and the products", () => {
    render(<Harness values={{ dealType: "PARTNER", lines: [] }} />);
    const regions = screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"));
    expect(regions.indexOf("Partner Commission")).toBe(regions.indexOf("Term") - 1);
    expect(regions.indexOf("Partner Commission")).toBeGreaterThan(regions.indexOf("Currency & Price Book"));
  });

  it("has no commission card on a direct deal (D91)", () => {
    render(<Harness values={{ dealType: "DIRECT" }} />);
    expect(screen.queryByRole("region", { name: "Partner Commission" })).toBeNull();
  });
});

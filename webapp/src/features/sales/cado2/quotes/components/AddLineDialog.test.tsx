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

import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdapterDateFns, DatePickers } from "@wso2/oxygen-ui";
import type { LineValue } from "@features/sales/cado2/quotes/form/draftForm";
import AddLineDialog from "./AddLineDialog";

const gateway = {
  id: "01t000000000001",
  name: "WSO2 API Manager",
  productCode: "APIM-GW",
  family: null,
  unitOfMeasure: "Gateways",
  pricebookEntries: [
    { id: "01u000000000001", unitPrice: "360", currencyIsoCode: "USD", isActive: true, pricebook: { id: "01s1", name: "FY26 USD" } },
  ],
};

// Mapped by an Admin.
const support = {
  ...gateway,
  id: "01t000000000002",
  name: "WSO2 Enterprise Support Plan - APIM",
  productCode: "SUP-APIM",
  // Its description repeats the name first, as in Salesforce.
  description: "WSO2 Enterprise Support Plan - APIM. Based on the number of production gateways.",
  category: "SUPPORT" as const,
  pricebookEntries: [{ ...gateway.pricebookEntries[0], id: "01u000000000002", unitPrice: "25000" }],
};

// The backend lists the quote's price book only. `more` stands for a
// next page still to load; `book` records the book asked for.
const productPages = { more: false, fetchNextPage: vi.fn(), book: "" };
vi.mock("@features/sales/cado2/quotes/api/useQuoteApi", () => ({
  useProducts: (_currency: string, _term: string, book: string) => {
    productPages.book = book;
    return {
      data: book ? [gateway, support] : [],
      isPending: false,
      fetchStatus: "idle",
      hasNextPage: productPages.more,
      isFetchingNextPage: false,
      fetchNextPage: productPages.fetchNextPage,
    };
  },
}));

const quoteBook = { id: "01s1", name: "FY26 USD" };

function renderDialog(onSave = vi.fn(), line: LineValue | null = null) {
  render(
    <DatePickers.LocalizationProvider dateAdapter={AdapterDateFns}>
      <AddLineDialog open line={line} currency="USD" pricebook={quoteBook} onSave={onSave} onClose={vi.fn()} />
    </DatePickers.LocalizationProvider>,
  );
  return onSave;
}

async function pick(name: RegExp) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox", { name: /Product/ }));
  await user.click(await screen.findByRole("option", { name }));
  return user;
}

describe("AddLineDialog", () => {
  it("groups the fields and shows the chosen product and its price-book price", async () => {
    const onSave = renderDialog();
    const user = userEvent.setup();
    for (const group of ["Product", "Quantity & discount"]) {
      expect(screen.getByRole("region", { name: group })).toBeInTheDocument();
    }
    // Lines have no dates of their own: they cover the quote's term.
    expect(screen.queryByRole("region", { name: "Period" })).toBeNull();
    expect(screen.getByText("Priced from FY26 USD in USD")).toBeInTheDocument();
    expect(screen.queryByLabelText("Chosen product")).toBeNull();

    await user.click(screen.getByRole("combobox", { name: /Product/ }));
    await user.click(await screen.findByRole("option", { name: /WSO2 API Manager/ }));

    const card = within(screen.getByLabelText("Chosen product"));
    expect(card.getByText("WSO2 API Manager")).toBeInTheDocument();
    expect(card.getByText("APIM-GW")).toBeInTheDocument();
    expect(card.getByText("FY26 USD")).toBeInTheDocument();
    expect(card.getByText("USD 360")).toBeInTheDocument();

    // Not mapped: the rep must choose the category.
    expect(screen.getByText(/No category is set up for this product/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add line" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Choose the category")).toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: /Category/ }));
    await user.click(screen.getByRole("option", { name: "Subscription" }));

    await user.click(screen.getByRole("button", { name: "Add line" }));
    // Product_Unit__c is the product family, so it no longer pre-fills the unit (2026-09-26).
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        pricebookEntryId: "01u000000000001",
        unitPrice: "360",
        unitOfMeasure: "",
        category: "SUBSCRIPTION",
        categorySource: "REP",
      }),
    );
  });

  it("takes a mapped product's category, with no choice to make", async () => {
    const onSave = renderDialog();
    const user = await pick(/Enterprise Support Plan/);

    expect(within(screen.getByLabelText("Category")).getByText("Support")).toBeInTheDocument();
    expect(screen.getByText("Set for this product by an Admin")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Category/ })).toBeNull();
    expect(screen.queryByText(/No category is set up/)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Add line" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ category: "SUPPORT", categorySource: "MAPPED" }));
  });

  it("keeps a saved line's category locked when it came from a mapping", async () => {
    const line: LineValue = {
      lineId: 7,
      pricebookEntryId: "01u000000000002",
      productName: "WSO2 Enterprise Support Plan - APIM",
      productCode: "SUP-APIM",
      productDescription: "",
      pricebookId: "01s1",
      pricebookName: "FY26 USD",
      unitPrice: "25000",
      category: "SUPPORT",
      categorySource: "MAPPED",
      unitOfMeasure: "",
      quantity: "1",
      discount: "0",
    };
    const onSave = renderDialog(vi.fn(), line);

    expect(screen.queryByRole("combobox", { name: /Category/ })).toBeNull();
    await userEvent.setup().click(screen.getByRole("button", { name: "Update line" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ lineId: 7, category: "SUPPORT", categorySource: "MAPPED" }));
  });

  it("lists the quote's price book only, with its prices, and no choice of book", async () => {
    const onSave = renderDialog();
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: /Product/ }));

    expect(productPages.book).toBe("01s1");
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "WSO2 API Manager (APIM-GW)",
      "WSO2 Enterprise Support Plan - APIM (SUP-APIM)Based on the number of production gateways.",
    ]);
    expect(screen.getByText("All 2 products shown")).toBeInTheDocument();
    expect(screen.queryByText(/Not in |No category|Other price books/)).toBeNull();

    await user.click(screen.getByRole("option", { name: /Enterprise Support Plan/ }));
    expect(within(screen.getByLabelText("Chosen product")).getByText("FY26 USD")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Price book/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Add line" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ pricebookId: "01s1", pricebookName: "FY26 USD", unitPrice: "25000" }));
  });

  it("says more are coming and loads the next page on scrolling to the end", async () => {
    productPages.more = true;
    try {
      renderDialog();
      await userEvent.setup().click(screen.getByRole("combobox", { name: /Product/ }));
      expect(screen.getByText("Showing 2 · scroll for more")).toBeInTheDocument();

      const list = screen.getByRole("listbox");
      Object.defineProperties(list, { scrollHeight: { value: 600 }, clientHeight: { value: 300 } });
      list.scrollTop = 290;
      list.dispatchEvent(new Event("scroll"));
      expect(productPages.fetchNextPage).toHaveBeenCalled();
    } finally {
      productPages.more = false;
    }
  });

  it("shows the description under the name, without repeating the name, and on the chosen product", async () => {
    const onSave = renderDialog();
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: /Product/ }));

    const option = screen.getByRole("option", { name: /Enterprise Support Plan/ });
    const about = within(option).getByText("Based on the number of production gateways.");
    expect(about).toHaveAttribute("title", "Based on the number of production gateways.");
    expect(within(screen.getByRole("option", { name: /WSO2 API Manager/ })).queryByText(/Based on/)).toBeNull();

    await user.click(option);
    expect(within(screen.getByLabelText("Chosen product")).getByText("Based on the number of production gateways.")).toBeInTheDocument();
    // And again at the unit of measure, which the rep words from it.
    expect(screen.getByRole("textbox", { name: "Unit of measure" })).toHaveAccessibleDescription(
      "Product description: Based on the number of production gateways.",
    );
    await user.click(screen.getByRole("button", { name: "Add line" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        productDescription: "WSO2 Enterprise Support Plan - APIM. Based on the number of production gateways.",
      }),
    );
  });

  it("says nothing at the unit of measure for a product without a description", async () => {
    renderDialog();
    await pick(/WSO2 API Manager/);
    expect(screen.getByRole("textbox", { name: "Unit of measure" })).not.toHaveAccessibleDescription();
  });
});

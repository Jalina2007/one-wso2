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
import ProductClassificationsPage from "./ProductClassificationsPage";

const data = { data: undefined as unknown, error: null as unknown, isPending: true, isFetching: false, refetch: vi.fn() };
const set = { mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null as unknown, variables: undefined as unknown };

// Mocked so the page is tested without Asgardeo, the network or window.config.
vi.mock("@features/sales/cado2/admin/product-classifications/api/useProductClassifications", () => ({
  useProductClassifications: () => data,
  useSetProductClassification: () => set,
}));

const row = (classification: string, category: string | null, recurring: boolean | null, productCount: number, deployment: string | null = null) => ({
  classification,
  category,
  recurring,
  deployment,
  productCount,
  updatedByEmail: category ? "migration" : null,
  updatedAt: category ? "2026-11-10T10:00:00Z" : null,
});

function show(items: unknown[], extra: Record<string, unknown> = {}) {
  Object.assign(data, { isPending: false, data: { items, salesforceAvailable: true, unclassifiedProducts: 0, ...extra } });
  render(<ProductClassificationsPage />);
}

beforeEach(() => {
  Object.assign(data, { data: undefined, error: null, isPending: true });
  set.mutate.mockReset();
});

describe("ProductClassificationsPage", () => {
  it("lists the classifications under their categories, with product counts", () => {
    show([row("CO", "PROFESSIONAL_SERVICE", false, 110), row("ES", "SUPPORT", true, 5), row("PS", "SUBSCRIPTION", true, 1)]);
    const table = within(screen.getByRole("table", { name: "Product classifications" }));
    const text = table.getAllByRole("row").map((r) => r.textContent);
    expect(text.slice(1)).toEqual([
      "Subscription",
      expect.stringMatching(/^PS.*Subscription.*Recurring.*1 product$/),
      "Support",
      expect.stringMatching(/^ES.*Support.*Recurring.*5 products$/),
      "Professional Services",
      expect.stringMatching(/^CO.*Professional Services.*Non-recurring.*110 products$/),
    ]);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("saves a change straight away, with both values", async () => {
    show([row("ES", "SUPPORT", true, 5)]);
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Type of ES" }));
    await user.click(screen.getByRole("option", { name: "Non-recurring" }));
    expect(set.mutate).toHaveBeenLastCalledWith(
      { classification: "ES", category: "SUPPORT", recurring: false, deployment: null },
      expect.anything(),
    );
  });

  it("puts a new classification first, and saves it once both are chosen", async () => {
    show([row("AI", null, null, 2), row("PS", "SUBSCRIPTION", true, 331)], { unclassifiedProducts: 3 });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "1 classification isn't set up. Products classified AI can't be added to a quote until you choose its category and type.",
    );
    expect(screen.getByText("3 active products have no classification in Salesforce, so they can't be quoted.")).toBeInTheDocument();
    const rows = within(screen.getByRole("table", { name: "Product classifications" })).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Not set up");

    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Category of AI" }));
    await user.click(screen.getByRole("option", { name: "Subscription" }));
    expect(set.mutate).not.toHaveBeenCalled();
    await user.click(screen.getByRole("combobox", { name: "Type of AI" }));
    await user.click(screen.getByRole("option", { name: "Recurring" }));
    expect(set.mutate).toHaveBeenLastCalledWith(
      { classification: "AI", category: "SUBSCRIPTION", recurring: true, deployment: null },
      expect.anything(),
    );
  });

  // D163: how a classification's products are deployed, saved with the rest.
  it("sets the deployment, and says where each setting is used", async () => {
    show([row("PS", "SUBSCRIPTION", true, 1, "ON_PREMISES"), row("ES", "SUPPORT", true, 5)]);
    expect(screen.getByRole("combobox", { name: "Deployment of PS" })).toHaveTextContent("On-premises");
    expect(screen.getByRole("combobox", { name: "Deployment of ES" })).toHaveTextContent("Not applicable");

    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Deployment of PS" }));
    await user.click(screen.getByRole("option", { name: "SaaS" }));
    expect(set.mutate).toHaveBeenLastCalledWith(
      { classification: "PS", category: "SUBSCRIPTION", recurring: true, deployment: "SAAS" },
      expect.anything(),
    );
    await user.click(screen.getByRole("combobox", { name: "Deployment of PS" }));
    await user.click(screen.getByRole("option", { name: "Not applicable" }));
    expect(set.mutate).toHaveBeenLastCalledWith(expect.objectContaining({ classification: "PS", deployment: null }), expect.anything());

    const uses = within(screen.getByRole("region", { name: "Where these settings are used" }));
    expect(uses.getByText("Deployment")).toBeInTheDocument();
    expect(uses.getByText(/the on-premises terms for on-premises products, the SaaS terms for SaaS products/)).toBeInTheDocument();
  });

  it("says so when Salesforce can't be read", () => {
    show([row("PS", "SUBSCRIPTION", true, 0)], { salesforceAvailable: false });
    expect(screen.getByRole("alert")).toHaveTextContent(/Salesforce couldn't be read/);
    expect(screen.queryByText("0 products")).toBeNull();
  });
});

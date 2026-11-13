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
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PreviousProductsDialog from "./PreviousProductsDialog";

const sfLine = (id: string, name: string, code: string, quantity: string, salesPrice: string, discount: string | null, total: string, start: string) => ({
  id, productName: name, productCode: code, quantity, salesPrice, discount, totalPrice: total, commissionPercent: null,
  serviceStartDate: start, serviceEndDate: "2026-12-31",
});
// D159: two coterminating opportunities this renewal replaces.
const full = {
  opportunityName: "Pinecrest Health - Integration 2026", subsStartDate: "2026-01-01", subsEndDate: "2026-12-31", currency: "USD",
  lines: [
    sfLine("00k1", "WSO2 Micro Integrator (cores)", "SUB-MI", "4", "20700", "10", "74520.00", "2026-01-01"),
    sfLine("00k2", "WSO2 Enterprise Support Plan - Integration", "SLA-E", "1", "53000", null, "53000.00", "2026-01-01"),
  ],
};
const expansion = {
  opportunityName: "Pinecrest Health - Integration expansion 2026", subsStartDate: "2026-07-01", subsEndDate: "2026-12-31", currency: "USD",
  lines: [
    sfLine("00k3", "WSO2 Micro Integrator (cores)", "SUB-MI", "2", "10350", null, "20700.00", "2026-07-01"),
    sfLine("00k4", "WSO2 Integration Platform (Additional Pre-Prod Environments)", "SUB-PRE", "1", "100", null, "100.00", "2026-07-01"),
  ],
};
const results: Record<string, { data?: unknown; error: Error | null }> = {};
const refetch = vi.fn();
vi.mock("@features/sales/cado2/quotes/api/useQuoteApi", () => ({
  usePreviousOpportunityLines: (ids: readonly string[]) =>
    ids.map((id) => ({ ...results[id], isPending: false, isFetching: false, refetch })),
}));

const renderDialog = () =>
  render(<PreviousProductsDialog open opportunityIds={["006F", "006E"]} accountName="Pinecrest Health" onClose={() => {}} />);

describe("PreviousProductsDialog (D159)", () => {
  beforeEach(() => {
    results["006F"] = { data: full, error: null };
    results["006E"] = { data: expansion, error: null };
  });

  it("shows each opportunity's products, read only, each section opening and closing", async () => {
    const user = userEvent.setup();
    renderDialog();
    const dialog = within(screen.getByRole("dialog", { name: /Previous year's products/ }));
    expect(dialog.getByText(/On the 2 opportunities this renewal replaces/)).toBeInTheDocument();
    expect(dialog.getByText("Subscription 1 Jan 2026 – 31 Dec 2026 · USD · 2 products")).toBeInTheDocument();
    const fullTable = within(dialog.getByRole("table", { name: "Products on Pinecrest Health - Integration 2026" }));
    expect(fullTable.getByText("74,520.00")).toBeInTheDocument();
    expect(fullTable.getByText("10%")).toBeInTheDocument();
    expect(dialog.getByText("2 opportunities · 3 distinct products")).toBeInTheDocument();
    expect(dialog.getAllByRole("button").map((b) => b.textContent)).not.toContain("Load into quote");

    await user.click(dialog.getByRole("button", { name: /Integration expansion 2026, collapse/ }));
    await waitFor(() => expect(dialog.queryByRole("table", { name: /Integration expansion 2026/ })).toBeNull());
    expect(dialog.getByRole("table", { name: /Integration 2026$/ })).toBeInTheDocument();

    await user.click(dialog.getByRole("button", { name: "Collapse all" }));
    await waitFor(() => expect(dialog.queryAllByRole("table")).toHaveLength(0));
    await user.click(dialog.getByRole("button", { name: "Expand all" }));
    expect(dialog.getAllByRole("table")).toHaveLength(2);
  });

  it("groups by product, a line for each opportunity it is on, in full", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: "By product" }));
    const table = within(screen.getByRole("table", { name: "Products by product" }));
    const mi = table.getByRole("button", { name: /WSO2 Micro Integrator \(cores\), collapse/ });
    expect(mi).toHaveTextContent("on 2 opportunities");
    expect(table.getByRole("button", { name: /Pre-Prod Environments/ })).toHaveTextContent("on 1 opportunity");
    // The account's name is dropped from the opportunities' names.
    expect(table.getAllByText("Integration 2026")).toHaveLength(2);
    expect(table.getAllByText("Integration expansion 2026")).toHaveLength(2);
    expect(table.getByText("20,700.00", { selector: "td" })).toBeInTheDocument();

    await user.click(mi);
    expect(table.getAllByText("Integration 2026")).toHaveLength(1);
  });

  it("says when an opportunity couldn't be read, and shows the others", async () => {
    const user = userEvent.setup();
    results["006E"] = { error: new Error("down") };
    renderDialog();
    expect(screen.getByText(/Couldn't read 1 of the opportunities from/)).toBeInTheDocument();
    expect(screen.getByRole("table", { name: /Integration 2026/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Retry/ }));
    expect(refetch).toHaveBeenCalled();
  });
});

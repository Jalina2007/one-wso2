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
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SupportPlansPage from "./SupportPlansPage";

const data = { data: undefined as unknown, error: null as unknown, isPending: true, isFetching: false, refetch: vi.fn() };
const save = { mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null as unknown, variables: undefined as unknown };
// The Salesforce product picker's list.
const productList = {
  data: [{ id: "01tPRE", name: "Premium Support Subscription", code: "SV-PREMIUM-SUPPORT", description: null }] as unknown[],
  isPending: false,
  fetchStatus: "idle",
  error: null,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
};

// Mocked so the page is tested without Asgardeo, the network or window.config.
vi.mock("@features/sales/cado2/admin/support-plans/api/useSupportPlans", () => ({
  useSupportPlans: () => data,
  useSaveSupportPlans: () => save,
}));
vi.mock("@features/sales/cado2/admin/pricing-formulas/api/usePricingFormulaAdmin", () => ({
  useFormulaProducts: () => productList,
}));

const configured = {
  enterprise: { productId: "01tENT", name: "WSO2 Enterprise Support Plan", code: "SU-E" },
  standard: { productId: "01tSTD", name: "WSO2 Standard Support Plan", code: "SU-S" },
  premium: [],
  updatedByEmail: "admin@wso2.com",
  updatedAt: "2026-11-11T09:00:00Z",
};

beforeEach(() => {
  Object.assign(data, { data: undefined, error: null, isPending: true });
  save.mutate.mockReset();
});

describe("SupportPlansPage (D155)", () => {
  it("shows the Enterprise and Standard products, an empty Premium list, and who changed them", () => {
    Object.assign(data, { isPending: false, data: configured });
    render(<SupportPlansPage />);
    expect(screen.getByRole("combobox", { name: "Enterprise Support" })).toHaveValue("WSO2 Enterprise Support Plan (SU-E)");
    expect(screen.getByRole("combobox", { name: "Standard Support" })).toHaveValue("WSO2 Standard Support Plan (SU-S)");
    expect(screen.getByText("Offered in a year that has Enterprise Support. Empty: not offered.")).toBeInTheDocument();
    expect(screen.getByText(/Leave Enterprise and Standard empty to switch the check off/)).toBeInTheDocument();
    expect(screen.getByText(/Last changed by admin@wso2.com on 11 Nov 2026/)).toBeInTheDocument();
  });

  it("saves the whole set when a Premium product is added", async () => {
    Object.assign(data, { isPending: false, data: configured });
    const user = userEvent.setup();
    render(<SupportPlansPage />);
    await user.click(screen.getAllByRole("combobox").at(-1)!);
    await user.click(await screen.findByRole("option", { name: /Premium Support Subscription/ }));
    expect(save.mutate).toHaveBeenCalledWith(
      { enterpriseProductId: "01tENT", standardProductId: "01tSTD", premiumProductIds: ["01tPRE"] },
      expect.anything(),
    );
  });

  it("clears Standard Support", async () => {
    Object.assign(data, { isPending: false, data: configured });
    const user = userEvent.setup();
    render(<SupportPlansPage />);
    await user.click(screen.getByRole("button", { name: "Clear Standard Support" }));
    expect(save.mutate).toHaveBeenCalledWith(
      { enterpriseProductId: "01tENT", standardProductId: null, premiumProductIds: [] },
      expect.anything(),
    );
  });
});

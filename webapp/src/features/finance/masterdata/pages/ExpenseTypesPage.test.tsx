/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../useMasterData", () => ({
  isFinanceMasterDataBackendConfigured: () => true,
  useExpenseTypeAutoComplete: () => ({ data: undefined, isLoading: false, isError: false }),
  useExpenseTypes: () => ({
    data: [],
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

const { default: ExpenseTypesPage } = await import("./ExpenseTypesPage");
const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");

function show() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NotificationsProvider>
        <ExpenseTypesPage />
      </NotificationsProvider>
    </QueryClientProvider>,
  );
}

const filterBar = () => screen.queryByText(/please fill in at least one|expense category/i);

// Nothing is loaded until the first Apply (`hasApplied` in the page), so
// opening on an already-expanded bar showed a filter form above a screen that
// had not asked for anything yet. Collapsed is the honest starting state —
// "Show Filters" is a click the reader makes on purpose.
describe("Expense Types' filter bar", () => {
  it("starts collapsed, behind a Show Filters toggle", () => {
    show();

    expect(screen.getByRole("button", { name: /show filters/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /hide filters/i })).not.toBeInTheDocument();
  });

  it("expands only once that toggle is clicked", async () => {
    const user = userEvent.setup();
    show();

    await user.click(screen.getByRole("button", { name: /show filters/i }));

    expect(screen.getByRole("button", { name: /hide filters/i })).toBeInTheDocument();
    expect(screen.getByText(/please select filters/i)).toBeInTheDocument();
  });

  it("collapses again on a second click", async () => {
    const user = userEvent.setup();
    show();

    const toggle = screen.getByRole("button", { name: /show filters/i });
    await user.click(toggle);
    await user.click(screen.getByRole("button", { name: /hide filters/i }));

    expect(screen.getByRole("button", { name: /show filters/i })).toBeInTheDocument();
  });

  // The table-side empty state ("Please select filters") is independent of
  // the bar's own open/closed state — collapsing the bar after Apply must not
  // make it look like nothing was ever asked for.
  it("still shows the pre-Apply placeholder on first load, bar collapsed", () => {
    show();

    expect(screen.getByText(/please select filters/i)).toBeInTheDocument();
    expect(filterBar()).not.toBeInTheDocument();
  });
});

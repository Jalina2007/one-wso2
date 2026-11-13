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
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdapterDateFns, DatePickers } from "@wso2/oxygen-ui";
import LastYearEnd from "./LastYearEnd";

function renderEnd(earliest: { date: string; productName: string } | null) {
  render(
    <DatePickers.LocalizationProvider dateAdapter={AdapterDateFns}>
      <LastYearEnd
        yearNumber={3}
        start="2028-01-01"
        end="2028-06-30"
        fullEnd="2028-12-31"
        earliest={earliest}
        onChange={vi.fn()}
      />
    </DatePickers.LocalizationProvider>,
  );
}

describe("LastYearEnd", () => {
  // D146: the last year can't end before its one-off lines do.
  it("won't offer an end before the last one-off line ends, and says why", async () => {
    renderEnd({ date: "2028-06-14", productName: "Configuration Review" });
    await userEvent.setup().click(screen.getByRole("button", { name: /Year 3 ends/ }));

    expect(
      screen.getByText("Can't end before 14 Jun 2028: Configuration Review runs until then. Change its dates first."),
    ).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: "13" })).toBeDisabled();
    expect(screen.getByRole("gridcell", { name: "14" })).toBeEnabled();
  });

  it("says only the last year can be shorter when nothing holds it back", async () => {
    renderEnd(null);
    await userEvent.setup().click(screen.getByRole("button", { name: /Year 3 ends/ }));

    expect(screen.getByText("Only the last year can be shorter.")).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: "13" })).toBeEnabled();
  });
});

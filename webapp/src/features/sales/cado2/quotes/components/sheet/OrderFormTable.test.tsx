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
import { render, screen, within } from "@testing-library/react";
import type { SheetLine } from "@features/sales/cado2/quotes/sheet/sheetModel";
import OrderFormTable from "./OrderFormTable";

const line = (number: number, code: string, discount: string, ceiling: string | null, discretionary: string | null): SheetLine => ({
  number, productName: `Product ${number}`, productCode: code, productDescription: null, pricebookName: "FY26 USD",
  category: "SUBSCRIPTION", recurring: true, quantity: "3", unitOfMeasure: null, unitPrice: "4800",
  discountPercent: discount, volumeCeilingPercent: ceiling, discretionaryPercent: discretionary, formula: null, yearNumber: 1,
  startDate: "2027-01-01", endDate: "2027-12-31", annualList: null, annualNet: null, arr: null, acv: null, tcv: "1.00", commission: "0.00",
  schedule: [],
});

const lines = [
  line(1, "SH-API-PORTAL", "4.17", "4.17", "0"),
  line(2, "C-API-PORTAL", "5", "2.08", "2.92"),
  line(3, "SH-API-APIM-CORE", "3", null, "3"),
  line(4, "SH-API-GW", "0", "6.44", "0"),
];

describe("OrderFormTable's volume discount ceilings (D169)", () => {
  it("puts the ceiling under each discount in the wizard, with whether it needs approval", () => {
    render(<OrderFormTable lines={lines} currency="USD" discountDetail="hints" />);
    const row = (code: string) => within(screen.getByText(code).closest("tr")!);
    expect(row("SH-API-PORTAL").getByText("Volume discount ceiling 4.17%")).toBeInTheDocument();
    expect(row("SH-API-PORTAL").getByText("No approval needed")).toBeInTheDocument();
    expect(row("C-API-PORTAL").getByText("2.92% needs approval")).toBeInTheDocument();
    expect(row("SH-API-APIM-CORE").getByText("No volume discount ceiling for this product")).toBeInTheDocument();
    expect(row("SH-API-GW").getByText("Volume discount ceiling 6.44%")).toBeInTheDocument();
    expect(row("SH-API-GW").queryByText("No approval needed")).not.toBeInTheDocument();
  });

  it("adds Volume discount ceiling and Discretionary columns in the read-only views", () => {
    render(<OrderFormTable lines={lines} currency="USD" discountDetail="columns" />);
    expect(screen.getByRole("columnheader", { name: "Volume discount ceiling" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Entered discount" })).toBeInTheDocument();
    const cells = (code: string) => within(screen.getByText(code).closest("tr")!).getAllByRole("cell").map((c) => c.textContent);
    expect(cells("C-API-PORTAL").slice(4, 7)).toEqual(["2.08%", "5%", "2.92%"]);
    expect(cells("SH-API-APIM-CORE").slice(4, 7)).toEqual(["–", "3%", "3%"]);
  });

  it("shows the discount alone otherwise", () => {
    render(<OrderFormTable lines={lines} currency="USD" />);
    expect(screen.queryByRole("columnheader", { name: "Volume discount ceiling" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Volume discount ceiling/)).not.toBeInTheDocument();
  });
});

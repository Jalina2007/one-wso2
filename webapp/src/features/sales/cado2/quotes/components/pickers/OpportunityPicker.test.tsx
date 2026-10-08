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
import { useState, type JSX } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Opportunity } from "@features/sales/cado2/quotes/api/quoteTypes";
import OpportunityPicker from "./OpportunityPicker";

const opp = (id: string, name: string, over: Partial<Opportunity> = {}): Opportunity => ({
  id,
  name,
  stageName: "Proposal",
  closeDate: "2026-12-15",
  createdDate: "2026-03-12",
  currencyIsoCode: "USD",
  isWon: false,
  isClosed: false,
  directChannel: "Direct",
  dealType: "DIRECT",
  partner: null,
  recordTypeName: "First Sale",
  dealKind: "FIRST_SALE",
  arr: null,
  ...over,
});
const list = [
  opp("006A", "API Platform 2027"),
  opp("006B", "Identity renewal FY26", { stageName: "Closed Won", isWon: true, isClosed: true, createdDate: "2025-06-01", closeDate: "2026-06-30" }),
  opp("006C", "Choreo pilot", { createdDate: "2025-01-10" }),
];

function Harness({ multiple = false, initial = [] as string[] }): JSX.Element {
  const [selected, setSelected] = useState<string[]>(initial);
  return <OpportunityPicker label="Opportunity" multiple={multiple} opportunities={list} loading={false} selected={selected} onChange={setSelected} />;
}
const options = () => within(screen.getByRole("listbox", { name: "Opportunity" })).getAllByRole("option");

describe("OpportunityPicker (F5 review: like the contact picker)", () => {
  it("lists opportunities in the order given (newest created first), with their dates", () => {
    render(<Harness />);
    expect(options().map((o) => o.getAttribute("aria-label"))).toEqual(["API Platform 2027", "Identity renewal FY26", "Choreo pilot"]);
    expect(options()[0]).toHaveTextContent("Proposal · Created 12 Mar 2026 · Closes 15 Dec 2026");
    expect(options()[1]).toHaveTextContent("Closed 30 Jun 2026");
  });

  it("closes once one is picked, and Change opens it again", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: "Search opportunity" }), "choreo");
    expect(options()).toHaveLength(1);
    await user.click(options()[0]);

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByLabelText("Chosen: Choreo pilot")).toHaveTextContent("Created 10 Jan 2025");

    await user.click(screen.getByRole("button", { name: "Change opportunity" }));
    expect(screen.getByRole("listbox", { name: "Opportunity" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByLabelText("Chosen: Choreo pilot")).toBeInTheDocument();
  });

  it("with several allowed, each pick closes the list and adds a removable row", async () => {
    render(<Harness multiple />);
    const user = userEvent.setup();
    await user.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Identity renewal FY26" }));
    expect(screen.queryByRole("listbox")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Add another" }));
    expect(options().map((o) => o.getAttribute("aria-label"))).toEqual(["API Platform 2027", "Choreo pilot"]); // chosen ones are left out
    await user.click(options()[1]);
    expect(screen.getByLabelText("Chosen: Identity renewal FY26")).toBeInTheDocument();
    expect(screen.getByLabelText("Chosen: Choreo pilot")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove Identity renewal FY26" }));
    expect(screen.queryByLabelText("Chosen: Identity renewal FY26")).toBeNull();
  });

  it("offers no Change when locked", () => {
    render(<OpportunityPicker label="Opportunity" opportunities={list} loading={false} selected={["006A"]} onChange={vi.fn()} locked />);
    expect(screen.getByLabelText("Chosen: API Platform 2027")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change opportunity" })).toBeNull();
  });
});

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

// The sheet around the grid: tabs with counts, search and filters, and saving an edit —
// the new value shows while it saves, then "Saved", or the server's reason if refused.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { SheetTab } from "../leadImportTypes";

const save = vi.fn();
let rebuilding = false;
vi.mock("../../api/useLeadImport", () => ({
  useSaveLeadEdits: () => ({ mutateAsync: save }),
  useLeadImportRebuilding: () => rebuilding,
  leadImportError: (e: Error) => e.message,
}));

const { default: LeadSheet } = await import("./LeadSheet");

const column = (key: string, label: string, editable = true) => ({
  key,
  label,
  header: label,
  editable,
  options: null,
  formula: null,
});

const TABS: SheetTab[] = [
  {
    name: "Booth",
    columns: [column("email", "Email", false), column("company", "Company name")],
    rows: [
      { row: 2, email: "ana@acme.io", cells: ["ana@acme.io", "Acme"] },
      {
        row: 3,
        email: "raj@globex.in",
        cells: ["raj@globex.in", "Globex"],
        marks: { email: { id: "c-0002", status: "pending", kind: "remove_row", reason: "test" } },
      },
    ],
  },
  { name: "Session", columns: [column("email", "Email", false)], rows: [{ row: 2, email: "lee@x.sg", cells: ["lee@x.sg"] }] },
];

function renderSheet(tabs: SheetTab[] = TABS) {
  return render(
    <LeadSheet runId="run-1" tabs={tabs} changes={[]} userEdits={[]} editable busyId={null} onAct={vi.fn()} />,
  );
}

function editCompany(value: string) {
  fireEvent.click(screen.getByText("Acme"));
  const input = screen.getByRole("textbox", { name: "Company name, row 2" });
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter" });
}

// mockClear, not mockReset: under Vitest 4 a reset mock's rejection is reported as
// unhandled even when the component catches it.
beforeEach(() => {
  rebuilding = false;
  save.mockClear();
  save.mockResolvedValue(undefined);
});

describe("LeadSheet", () => {
  it("shows a tab per lead tab and filters its rows", () => {
    renderSheet();
    expect(screen.getByRole("tab", { name: /Booth/ })).toHaveTextContent("Booth2");
    fireEvent.click(screen.getByRole("button", { name: /isn.t applied yet/ }));
    expect(screen.queryByText("ana@acme.io")).not.toBeInTheDocument();
    expect(screen.getByText("raj@globex.in")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Session/ }));
    expect(screen.getByText("lee@x.sg")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Search this tab"), { target: { value: "nobody" } });
    expect(screen.getByText("No rows match.")).toBeInTheDocument();
  });

  it("saves an edit, showing the new value until the server has it", async () => {
    let finish!: () => void;
    save.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    renderSheet();
    editCompany("ACME Ltd");
    expect(save).toHaveBeenCalledWith({
      id: "run-1",
      cells: [{ tab: "Booth", email: "ana@acme.io", column: "company", value: "ACME Ltd" }],
    });
    expect(screen.getByText("ACME Ltd")).toBeInTheDocument();
    expect(screen.getByText("Saving your edit…")).toBeInTheDocument();
    await act(async () => finish());
    expect(screen.getByText(/Saved — the download matches the sheet/)).toBeInTheDocument();
  });

  it("says why an edit was refused and puts the cell back", async () => {
    save.mockRejectedValue(new Error("Not saved: Email can't be edited."));
    renderSheet();
    editCompany("Nope");
    expect(await screen.findByText("Not saved: Email can't be edited.")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
  });

  it("shows all rows when the chosen filter has no rows left", () => {
    const { rerender } = renderSheet();
    fireEvent.click(screen.getByRole("button", { name: /isn.t applied yet/ }));
    expect(screen.queryByText("ana@acme.io")).not.toBeInTheDocument();

    // The last pending change was applied: its mark is now "applied".
    const applied: SheetTab[] = [
      {
        ...TABS[0],
        rows: TABS[0].rows.map((r) =>
          r.marks ? { ...r, marks: { email: { ...r.marks.email, status: "applied" as const } } } : r,
        ),
      },
      TABS[1],
    ];
    rerender(<LeadSheet runId="run-1" tabs={applied} changes={[]} userEdits={[]} editable busyId={null} onAct={vi.fn()} />);
    expect(screen.getByText("ana@acme.io")).toBeInTheDocument();
    expect(screen.queryByText("No rows match.")).not.toBeInTheDocument();
  });

  it("allows no cell edit while the workbook rebuilds", () => {
    rebuilding = true;
    renderSheet();
    fireEvent.click(screen.getByText("Acme"));
    expect(screen.queryByRole("textbox", { name: "Company name, row 2" })).not.toBeInTheDocument();
  });

  it("doesn't save a cell left as it was", () => {
    renderSheet();
    editCompany("Acme");
    expect(save).not.toHaveBeenCalled();
  });
});

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

// The lead sheet grid: windowed rows, one cell editing at a time, read-only columns, the
// template's dropdowns, saving drafts, and the tooltip behind a marked cell.

import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import LeadSheetGrid, { type LeadSheetGridProps } from "./LeadSheetGrid";
import { MarkDetails } from "./LeadSheet";
import type { SheetColumn, SheetRow } from "../leadImportTypes";
import { cellKey } from "../lib/leadSheet";

const COLUMNS: SheetColumn[] = [
  { key: "email", label: "Email", header: "Email", editable: false, options: null, formula: null },
  { key: "company", label: "Company name", header: "Company name", editable: true, options: null, formula: null },
  { key: "hot_lead", label: "Hot Lead", header: "Hot Lead", editable: true, options: ["1", "0"], formula: null },
];

const rowsOf = (n: number): SheetRow[] =>
  Array.from({ length: n }, (_, i) => ({ row: i + 2, email: `p${i}@acme.io`, cells: [`p${i}@acme.io`, `Acme ${i}`, ""] }));

function renderGrid(extra: Partial<LeadSheetGridProps> = {}) {
  const props: LeadSheetGridProps = {
    tab: "Booth",
    columns: COLUMNS,
    rows: rowsOf(3),
    drafts: {},
    editable: true,
    onEdit: vi.fn(),
    describeMark: (m) => `mark ${m.id}`,
    ...extra,
  };
  render(<LeadSheetGrid {...props} />);
  return props;
}

const dataRows = () => document.querySelectorAll("tr[data-row]");

describe("LeadSheetGrid", () => {
  it("puts only the rows near the viewport in the DOM, even for 2,490 leads", () => {
    renderGrid({ rows: rowsOf(2490) });
    expect(dataRows().length).toBeLessThan(60);
    expect(screen.getByText("Acme 0")).toBeInTheDocument();
    expect(screen.queryByText("Acme 2000")).not.toBeInTheDocument();

    const scroller = screen.getByTestId("lead-sheet-scroll");
    act(() => {
      scroller.scrollTop = 2000 * 30;
      fireEvent.scroll(scroller);
    });
    expect(screen.getByText("Acme 2000")).toBeInTheDocument();
    expect(screen.queryByText("Acme 0")).not.toBeInTheDocument();
  });

  it("keeps an open editor, and what was typed, when its row scrolls out of view", () => {
    const props = renderGrid({ rows: rowsOf(2490) });
    fireEvent.click(screen.getByText("Acme 1"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "ACME Ltd" } });

    const scroller = screen.getByTestId("lead-sheet-scroll");
    act(() => {
      scroller.scrollTop = 2000 * 30;
      fireEvent.scroll(scroller);
    });
    expect(screen.getByText("Acme 2000")).toBeInTheDocument();
    expect(dataRows().length).toBeLessThan(60);     // only the one row is added
    const input = screen.getByRole("textbox", { name: "Company name, row 3" });
    expect(input).toHaveValue("ACME Ltd");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(props.onEdit).toHaveBeenCalledWith(props.rows[1], COLUMNS[1], "ACME Ltd");
  });

  it("edits a cell on click and saves on Enter", () => {
    const props = renderGrid();
    fireEvent.click(screen.getByText("Acme 1"));
    const input = screen.getByRole("textbox", { name: "Company name, row 3" });
    fireEvent.change(input, { target: { value: "ACME Ltd" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(props.onEdit).toHaveBeenCalledTimes(1);
    expect(props.onEdit).toHaveBeenCalledWith(props.rows[1], COLUMNS[1], "ACME Ltd");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("cancels on Escape and saves when the cell is left", () => {
    const props = renderGrid();
    fireEvent.keyDown(screen.getByRole("cell", { name: "Company name, row 2: Acme 0" }), { key: "Enter" });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(props.onEdit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Acme 0"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Acme SA" } });
    fireEvent.blur(input);
    expect(props.onEdit).toHaveBeenCalledWith(props.rows[0], COLUMNS[1], "Acme SA");
  });

  it("does not save on an Enter that confirms an IME composition", () => {
    const props = renderGrid();
    fireEvent.click(screen.getByText("Acme 0"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "株式会社" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(props.onEdit).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(props.onEdit).toHaveBeenCalledWith(props.rows[0], COLUMNS[1], "株式会社");
  });

  it("returns focus to the cell after Enter or Escape, not after the cell is left", () => {
    renderGrid();
    fireEvent.click(screen.getByText("Acme 0"));
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(document.activeElement).toBe(screen.getByRole("cell", { name: "Company name, row 2: Acme 0" }));

    fireEvent.click(screen.getByText("Acme 1"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Acme Two" } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(document.activeElement?.getAttribute("data-cell")).toBe("p1@acme.io|company");

    fireEvent.click(screen.getByText("Acme 2"));
    const input = screen.getByRole("textbox");
    input.focus();
    fireEvent.blur(input);
    expect(document.activeElement?.getAttribute("data-cell")).not.toBe("p2@acme.io|company");
  });

  it("offers the template's list for a dropdown column", () => {
    const props = renderGrid();
    fireEvent.click(screen.getByRole("cell", { name: "Hot Lead, row 2: blank" }));
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "1" }));
    expect(props.onEdit).toHaveBeenCalledWith(props.rows[0], COLUMNS[2], "1");
  });

  it("never edits read-only cells, a cell being saved, or anything when editing is over", () => {
    const rows = rowsOf(2);
    renderGrid({ rows, drafts: { [cellKey("Booth", "p1@acme.io", "company")]: "Saving Co" } });
    fireEvent.click(screen.getByText("p0@acme.io"));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("Saving Co")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Saving Co"));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("is read-only after Finish", () => {
    renderGrid({ editable: false });
    fireEvent.click(screen.getByText("Acme 0"));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("explains a marked cell on hover", async () => {
    const rows = rowsOf(1);
    rows[0].marks = { company: { id: "c-0007", status: "applied", kind: "swap_fields", reason: "swapped" } };
    renderGrid({ rows });
    fireEvent.mouseOver(screen.getByText("Acme 0"));
    expect(await screen.findByText("mark c-0007")).toBeInTheDocument();
  });
});

describe("MarkDetails", () => {
  it("offers the action the status allows", () => {
    const onAct = vi.fn();
    render(
      <MarkDetails
        mark={{ id: "c-0002", status: "pending", kind: "remove_row", reason: "a test entry" }}
        editable
        onAct={onAct}
      />,
    );
    expect(screen.getByText("Lead removed · Waiting for you")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onAct.mock.calls).toEqual([
      ["c-0002", "confirm"],
      ["c-0002", "undo"],
    ]);
  });

  it("shows what a user edit replaced, with its undo", () => {
    const onAct = vi.fn();
    render(
      <MarkDetails
        mark={{ id: "u-0001", status: "applied", kind: "user_edit", reason: null }}
        edit={{ id: "u-0001", tab: "Booth", email: "a@b.io", column: "company", from: "Acme", to: "ACME", status: "applied" }}
        editable
        onAct={onAct}
      />,
    );
    expect(screen.getByText("Edited by you · Applied")).toBeInTheDocument();
    expect(screen.getByText("Was Acme")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onAct).toHaveBeenCalledWith("u-0001", "undo");
  });

  it("has no actions once editing is over", () => {
    render(
      <MarkDetails mark={{ id: "c-0001", status: "applied", kind: "set_country", reason: null }} editable={false} onAct={vi.fn()} />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

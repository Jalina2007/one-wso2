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
import type { SheetMark, SheetRow } from "../leadImportTypes";
import { userEditAsChange } from "./leadImport";
import { cellKey, filterCounts, filterRows, markTone, renderedSlices, visibleRange } from "./leadSheet";

const mark = (status: SheetMark["status"], kind = "set_country"): SheetMark => ({
  id: "c-0001",
  status,
  kind,
  reason: null,
});

const row = (email: string, cells: string[], marks?: SheetRow["marks"]): SheetRow => ({
  row: 2,
  email,
  cells,
  marks,
});

const ROWS: SheetRow[] = [
  row("ana@acme.io", ["Ana", "Acme"], { country: mark("applied") }),
  row("raj@globex.in", ["Raj", "Globex"], { email: mark("pending", "remove_row") }),
  row("lee@initech.sg", ["Lee", "Initech"], { company: mark("applied", "user_edit") }),
  row("kim@umbrella.kr", ["Kim", "Umbrella"], { company: mark("undone") }),
];

describe("lead sheet helpers", () => {
  it("tells Claude's changes, pending ones, your edits and undone ones apart", () => {
    expect(markTone(mark("applied"))).toBe("claude");
    expect(markTone(mark("pending"))).toBe("pending");
    expect(markTone(mark("dismissed"))).toBe("off");
    expect(markTone(mark("applied", "user_edit"))).toBe("edited");
    expect(markTone(mark("undone", "user_edit"))).toBe("off");
  });

  it("filters rows by what touched them and by search text", () => {
    const emails = (rows: SheetRow[]) => rows.map((r) => r.email);
    expect(emails(filterRows(ROWS, "", "changed"))).toEqual(["ana@acme.io", "raj@globex.in", "lee@initech.sg"]);
    expect(emails(filterRows(ROWS, "", "pending"))).toEqual(["raj@globex.in"]);
    expect(emails(filterRows(ROWS, "", "edited"))).toEqual(["lee@initech.sg"]);
    expect(emails(filterRows(ROWS, " GLOBEX ", "all"))).toEqual(["raj@globex.in"]);
    expect(filterRows(ROWS, "globex", "edited")).toEqual([]);
    expect(filterCounts(ROWS)).toEqual({ all: 4, changed: 3, pending: 1, edited: 1 });
  });

  it("windows a long list around the scroll position", () => {
    expect(visibleRange(0, 600, 30, 2490, 12)).toEqual({ first: 0, last: 32 });
    expect(visibleRange(3000, 600, 30, 2490, 12)).toEqual({ first: 88, last: 132 });
    expect(visibleRange(1e6, 600, 30, 2490, 12)).toEqual({ first: 2490, last: 2490 });
    expect(visibleRange(0, 600, 30, 5, 12)).toEqual({ first: 0, last: 5 });
  });

  it("keeps the row of an open editor in the DOM when it scrolls out of the window", () => {
    expect(renderedSlices(88, 132, -1)).toEqual([[88, 132]]);
    expect(renderedSlices(88, 132, 100)).toEqual([[88, 132]]);
    expect(renderedSlices(88, 132, 3)).toEqual([[3, 4], [88, 132]]);
    expect(renderedSlices(88, 132, 2000)).toEqual([[88, 132], [2000, 2001]]);
  });

  it("keys a cell by tab, email (any case) and column", () => {
    expect(cellKey("Booth", "Ana@Acme.io", "company")).toBe(cellKey("Booth", "ana@acme.io", "company"));
    expect(cellKey("Booth", "ana@acme.io", "company")).not.toBe(cellKey("Session", "ana@acme.io", "company"));
  });

  it("lists a user edit like a change", () => {
    const change = userEditAsChange({
      id: "u-0001",
      tab: "Booth",
      email: "ana@acme.io",
      column: "company",
      from: "Acme",
      to: "ACME",
      status: "applied",
    });
    expect(change).toMatchObject({
      id: "u-0001",
      kind: "user_edit",
      sheet: "Booth",
      edits: [{ field: "company", from: "Acme", to: "ACME" }],
      status: "applied",
    });
  });
});

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

// @vitest-environment node
// (jsdom's File and Blob have no text() or arrayBuffer(); Node's do.)

// Reading a raw lead file: formats, limits, the heading row and the source columns.

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  columnLetter,
  defaultSheet,
  headerRowOf,
  LeadFileError,
  MAX_COLUMNS,
  MAX_DATA_ROWS,
  readLeadFile,
  SAMPLE_CHARS,
  sourceColumns,
} from "./leadFile";

async function xlsx(sheets: Record<string, unknown[][]>, name = "leads.xlsx"): Promise<File> {
  const workbook = new ExcelJS.Workbook();
  for (const [sheetName, rows] of Object.entries(sheets)) {
    const sheet = workbook.addWorksheet(sheetName);
    rows.forEach((row) => sheet.addRow(row));
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return new File([buffer], name);
}

describe("readLeadFile", () => {
  it("reads every sheet with data, with a title row above the headings", async () => {
    const file = await xlsx({
      "Booth leads": [["AGNTCon booth report"], [], ["Email", "Name"], ["ana@acme.io", "Ana Silva"]],
      Empty: [],
    });
    const sheets = await readLeadFile(file);
    expect(sheets.map((s) => s.name)).toEqual(["Booth leads"]);
    expect(sheets[0].rows).toEqual([["AGNTCon booth report"], [], ["Email", "Name"], ["ana@acme.io", "Ana Silva"]]);
    expect(headerRowOf(sheets[0].rows)).toBe(2);
  });

  it("reads a CSV with a byte-order mark as one sheet named after the file", async () => {
    const file = new File(["﻿Correo,Empresa\nana@acme.io,ACME\n\n"], "Apidays - Booth.csv");
    const sheets = await readLeadFile(file);
    expect(sheets).toEqual([
      {
        name: "Apidays - Booth",
        rows: [
          ["Correo", "Empresa"],
          ["ana@acme.io", "ACME"],
        ],
      },
    ]);
  });

  it.each([
    ["leads.xls", /save it as \.xlsx/],
    ["leads.pdf", /Upload an \.xlsx or \.csv/],
  ])("refuses %s", async (name, message) => {
    await expect(readLeadFile(new File(["x"], name))).rejects.toThrow(message);
  });

  it("refuses a file with no data", async () => {
    await expect(readLeadFile(new File(["\n\n"], "empty.csv"))).rejects.toThrow("no data");
  });

  it("counts the heading in the row limit My Submissions reads, and refuses rather than cuts", async () => {
    const csv = (rows: number) =>
      new File([["Email", ...Array.from({ length: rows - 1 }, (_, i) => `p${i}@x.io`)].join("\n")], "big.csv");
    await expect(readLeadFile(csv(MAX_DATA_ROWS))).resolves.toHaveLength(1);
    await expect(readLeadFile(csv(MAX_DATA_ROWS + 1))).rejects.toBeInstanceOf(LeadFileError);
  });

  it("refuses a CSV with a quote that never closes, instead of folding leads into one cell", async () => {
    const file = new File(['Email,Notes\na@x.io,"asked for a demo\nb@x.io,fine\nc@x.io,ok\n'], "leads.csv");
    await expect(readLeadFile(file)).rejects.toThrow(/quoted value that never closes/);
  });

  it("refuses a sheet wider than the limit", async () => {
    const header = Array.from({ length: MAX_COLUMNS + 1 }, (_, i) => `c${i}`).join(",");
    await expect(readLeadFile(new File([header], "wide.csv"))).rejects.toThrow(/columns/);
  });
});

describe("the sheet and its columns", () => {
  it("starts with the sheet that has the most rows", () => {
    expect(
      defaultSheet([
        { name: "Summary", rows: [["Total", "3"]] },
        { name: "Leads", rows: [["Email"], ["a@x.io"], ["b@x.io"]] },
      ]),
    ).toBe(1);
  });

  it("lists each column with a heading or a value, with distinct samples cut short", () => {
    const long = "x".repeat(SAMPLE_CHARS + 20);
    const rows = [["Email", "", "Notes"], ["a@x.io", "", long], ["a@x.io", "B1", ""], ["b@x.io"]];
    expect(sourceColumns(rows, 0)).toEqual([
      { index: 0, heading: "Email", samples: ["a@x.io", "b@x.io"], filled: 3 },
      { index: 1, heading: "", samples: ["B1"], filled: 1 },
      { index: 2, heading: "Notes", samples: ["x".repeat(SAMPLE_CHARS)], filled: 1 },
    ]);
  });

  it("names columns as a spreadsheet does", () => {
    expect([0, 25, 26, 51, 52].map(columnLetter)).toEqual(["A", "Z", "AA", "AZ", "BA"]);
  });
});

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
import { HttpError } from "@api/http";
import { leadImportError } from "../../api/useLeadImport";
import {
  changeActions,
  changeWhere,
  kindLabel,
  runTitle,
  sheetNameWarning,
  tabsLine,
  timeLeft,
} from "./leadImport";

describe("lead import helpers", () => {
  it("offers the action each status allows", () => {
    expect(changeActions("pending")).toEqual({ confirm: "Apply", undo: "Dismiss" });
    expect(changeActions("applied")).toEqual({ undo: "Undo" });
    expect(changeActions("undone")).toEqual({ confirm: "Redo" });
    expect(changeActions("dismissed")).toEqual({ confirm: "Apply" });
  });

  it("counts down the time a run is kept", () => {
    const now = Date.parse("2026-11-05T10:00:00Z");
    expect(timeLeft("2026-11-05T11:12:30Z", now)).toBe("1 h 12 min left");
    expect(timeLeft("2026-11-05T10:08:00Z", now)).toBe("8 min left");
    expect(timeLeft("2026-11-05T10:00:30Z", now)).toBe("Expiring");
    expect(timeLeft(null, now)).toBe("—");
  });

  it("names runs and changes the way a person reads them", () => {
    expect(runTitle({ event_name: "  ", source_name: "leads.xlsx" })).toBe("leads.xlsx");
    expect(runTitle({ event_name: "AGNTCon", source_name: "leads.xlsx" })).toBe("AGNTCon");
    expect(changeWhere({ sheet: "Listado", row: 29, section: "x" })).toBe("Listado, row 29");
    expect(changeWhere({ sheet: null, row: null, section: "Booth" })).toBe("Booth");
    expect(kindLabel("swap_fields")).toBe("Fields swapped");
    expect(kindLabel("something_new")).toBe("something new");
    expect(tabsLine({ Attendees: 12, Booth: 40, Session: 0 })).toBe("Booth 40 · Attendees 12");
  });

  it("accepts a file named for the chosen sheet type", () => {
    const event = "FOST Australia 2026 - Cloud Native and AI Summit_ Melbourne";
    expect(sheetNameWarning(`${event} - Booth.csv`, "booth")).toBeNull();
    expect(sheetNameWarning(`${event} - Attendees.xlsx`, "attendee")).toBeNull();
    expect(sheetNameWarning(`${event} - Session.csv`, "session")).toBeNull();
    expect(sheetNameWarning("Summit - Registrants.xls", "registrant")).toBeNull();
    expect(sheetNameWarning("Summit - content  syndication.csv", "content_syndication")).toBeNull();
    // A browser's copy marker isn't part of the name.
    expect(sheetNameWarning("Summit - Booth (1).csv", "booth")).toBeNull();
  });

  it("warns when the name says another sheet type", () => {
    expect(sheetNameWarning("Summit - Attendees.csv", "booth")).toMatch(
      /says "Attendees" \(Attendee\), but you chose Booth Scan/,
    );
  });

  it("warns when the name doesn't follow the convention", () => {
    for (const name of ["leads.csv", "Summit Booth.csv", " - Booth.csv", "Summit - Booths.csv"]) {
      expect(sheetNameWarning(name, "booth")).toMatch(/naming convention "<Event name> - Booth"/);
    }
  });

  it("surfaces the backend's refusal message from FastAPI's detail", () => {
    const err = new HttpError(
      "u",
      400,
      JSON.stringify({ detail: { code: "UNSUPPORTED_FILE", message: "Upload an .xlsx file." } }),
    );
    expect(leadImportError(err)).toBe("Upload an .xlsx file.");
    expect(leadImportError(new HttpError("u", 502, "<html>gateway</html>"))).toBe(
      "Something went wrong (HTTP 502).",
    );
  });
});

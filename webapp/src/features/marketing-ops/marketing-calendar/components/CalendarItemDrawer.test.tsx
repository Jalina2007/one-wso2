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
import { longDate } from "../calendarDates";
import type { CalendarItem } from "../marketingCalendarTypes";
import { sampleItem } from "../testing/fixtures";
import CalendarItemDrawer from "./CalendarItemDrawer";

// The panel's rows per category, from items in a real API response.

function renderDrawer(item: CalendarItem) {
  render(<CalendarItemDrawer item={item} onClose={() => {}} />);
  return screen.getByRole("presentation");
}

/** The panel's rows as [label, value] pairs, in order. */
function rows(panel: HTMLElement): [string, string][] {
  return within(panel)
    .queryAllByRole("term")
    .map((term) => [term.textContent ?? "", term.nextElementSibling?.textContent ?? ""]);
}

function rowValue(panel: HTMLElement, label: string): HTMLElement {
  const term = within(panel).getAllByRole("term").find((candidate) => candidate.textContent === label);
  if (!term?.nextElementSibling) throw new Error(`No row ${label}`);
  return term.nextElementSibling as HTMLElement;
}

describe("content", () => {
  it("lists the content fields, with the date as the Publish Date", () => {
    const panel = renderDrawer(sampleItem("42:content"));
    expect(within(panel).getByRole("heading", { name: "[Whitepaper] Securing agent-to-API traffic" })).toBeVisible();
    expect(within(panel).getByText("Planned · Open")).toBeVisible();
    expect(rows(panel)).toEqual([
      ["Author", "writer@example.com"],
      ["Content type", "SEO/GEO"],
      ["Format", "Whitepaper"],
      ["Target persona", "Architect"],
      ["Publish Date", longDate("2026-11-12")],
      ["BU", "API"],
      ["Abstract", "Fake abstract for calendar testing.\nIt has a second line."],
    ]);
  });

  it("shows the abstract as plain text with its line breaks kept", () => {
    const panel = renderDrawer(sampleItem("42:content"));
    const abstract = rowValue(panel, "Abstract");
    expect(abstract).toHaveStyle({ whiteSpace: "pre-wrap" });
    expect(abstract.children).toHaveLength(0);
  });

  it("hides the rows an item has no value for", () => {
    const panel = renderDrawer(sampleItem("81:content"));
    expect(rows(panel).map(([label]) => label)).toEqual(["Publish Date", "BU", "Abstract"]);
  });
});

describe("event", () => {
  it("lists the event fields under the Event Name, with its own start and end dates", () => {
    const panel = renderDrawer(sampleItem("84:event"));
    expect(within(panel).getByRole("heading", { name: "Identity and API Day Frankfurt" })).toBeVisible();
    expect(rows(panel)).toEqual([
      ["Event Start Date", longDate("2026-11-25")],
      ["Event End Date", longDate("2026-11-25")],
      ["Event Type", "Self-Hosted Event"],
      ["BU", "API, IAM"],
      ["Region", "Europe, North America"],
    ]);
  });

  it("links a Salesforce Campaign that is an https URL", () => {
    const panel = renderDrawer(sampleItem("45:event"));
    const link = within(rowValue(panel, "Salesforce Campaign")).getByRole("link");
    expect(link).toHaveAttribute("href", "https://wso2.my.salesforce.com/701FAKE000000001");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows any other Salesforce Campaign as text", () => {
    const panel = renderDrawer(sampleItem("86:event"));
    const value = rowValue(panel, "Salesforce Campaign");
    expect(value).toHaveTextContent("Campaign 701FAKE (ask Sam)");
    expect(within(value).queryByRole("link")).toBeNull();
  });

  it("shows the event's own dates, never its Due Date as the Event Start Date", () => {
    // Issue #72's shape: Due 4 Nov (the calendar date), the event itself 5-6 Nov.
    const base = sampleItem("84:event");
    if (base.category !== "event") throw new Error("not an event");
    const item: CalendarItem = {
      ...base,
      date: "2026-11-04",
      details: { ...base.details, startDate: "2026-11-05", endDate: "2026-11-06" },
    };
    const panel = renderDrawer(item);
    expect(rowValue(panel, "Event Start Date")).toHaveTextContent(longDate("2026-11-05"));
    expect(rowValue(panel, "Event End Date")).toHaveTextContent(longDate("2026-11-06"));
    expect(within(panel).queryByText(longDate("2026-11-04"))).toBeNull();
  });

  it("leaves out the dates an event doesn't have", () => {
    const panel = renderDrawer(sampleItem("76:event"));
    expect(rows(panel).map(([label]) => label)).toEqual(["Event Type", "BU", "Region"]);
  });
});

describe("social", () => {
  it("lists the social fields, with the date as the Post Date", () => {
    const panel = renderDrawer(sampleItem("40:social"));
    expect(within(panel).getByText("Completed · Closed")).toBeVisible();
    expect(rows(panel)).toEqual([
      ["Post Date", longDate("2026-10-27")],
      ["Platform", "LinkedIn"],
      ["Handle", "OpenChoreo"],
      ["BU", "Choreo"],
    ]);
  });

  it("shows only the date and BU when the post has no details", () => {
    const panel = renderDrawer(sampleItem("73:social"));
    expect(rows(panel).map(([label]) => label)).toEqual(["Post Date", "BU"]);
  });
});

describe("email", () => {
  it("lists the email fields, with the date as the Send Date", () => {
    const panel = renderDrawer(sampleItem("58:email"));
    expect(rows(panel)).toEqual([
      ["Send Date", longDate("2026-11-26")],
      ["BU", "Agent"],
      ["Region", "Middle East"],
      ["Subject line", "A private briefing on agent platforms"],
      ["Sender", "Alex Perera (alex.perera@example.com)"],
      [
        "Email body copy",
        "Hi [Name],\n\nFake body copy for calendar testing.\nIt runs over several lines.\n\nBest regards,\nThe WSO2 Team",
      ],
    ]);
    expect(rowValue(panel, "Email body copy")).toHaveStyle({ whiteSpace: "pre-wrap" });
  });

  it("never renders the body copy as markup", () => {
    const item = sampleItem("58:email");
    const panel = renderDrawer({
      ...item,
      category: "email",
      details: { bodyCopy: "<b>Bold</b> and [a link](https://example.com)" },
    });
    const body = rowValue(panel, "Email body copy");
    expect(body).toHaveTextContent("<b>Bold</b> and [a link](https://example.com)");
    expect(body.children).toHaveLength(0);
  });

  it("leaves out the BU row for an email with no BU", () => {
    const panel = renderDrawer(sampleItem("87:email"));
    expect(rows(panel).map(([label]) => label)).not.toContain("BU");
  });
});

describe("release", () => {
  it("lists the release fields, with the date as the Marketing Launch Date", () => {
    const panel = renderDrawer(sampleItem("88:release"));
    expect(within(panel).getByRole("heading", { name: "[Release-LTS] API Manager 4.6" })).toBeVisible();
    expect(rows(panel)).toEqual([
      ["Product name", "API Manager"],
      ["Version", "4.6"],
      ["BU", "API"],
      ["Release type", "LTS"],
      ["Tier", "Tier 1"],
      ["Website Availability Date", longDate("2026-11-19")],
      ["Marketing Launch Date", longDate("2026-11-24")],
    ]);
  });

  it("leaves out a website availability date the form doesn't give", () => {
    const panel = renderDrawer(sampleItem("91:release"));
    expect(rows(panel).map(([label]) => label)).not.toContain("Website Availability Date");
  });
});

it("always offers the issue on GitHub", () => {
  const panel = renderDrawer(sampleItem("55:social"));
  expect(within(panel).getByRole("link", { name: "Open in GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/Plan2-Go/marketing-team/issues/55",
  );
});

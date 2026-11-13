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
import { CATEGORY_FILTERS, filterOptions } from "./calendarFilters";
import {
  categoryFilterState,
  filterItems,
  showParamValue,
  shownCategories,
  type CalendarView,
} from "./filterItems";
import { SAMPLE_ITEMS } from "./testing/fixtures";

/** The issue numbers and categories a view shows for a query string, e.g. ["45:event"]. */
function shown(view: CalendarView, search: string): string[] {
  return filterItems(SAMPLE_ITEMS, view, new URLSearchParams(search)).map((item) => item.id.split("#")[1]);
}

describe("the All view", () => {
  it("shows every category when ?show= is absent", () => {
    expect(shown("all", "")).toHaveLength(SAMPLE_ITEMS.length);
  });

  it("shows only the categories ?show= names", () => {
    expect(shown("all", "show=social,email")).toEqual([
      "55:social",
      "73:social",
      "40:social",
      "58:email",
      "83:email",
      "87:email",
    ]);
  });

  it("ignores unknown categories, and shows everything when none is known", () => {
    expect(shownCategories(new URLSearchParams("show=email,podcast"))).toEqual(["email"]);
    expect(shown("all", "show=podcast")).toHaveLength(SAMPLE_ITEMS.length);
  });

  it("ignores a type tab's filters", () => {
    expect(shown("all", "bu=API")).toHaveLength(SAMPLE_ITEMS.length);
  });

  it("writes no ?show= when every category is on, and keeps the legend's order otherwise", () => {
    expect(showParamValue(["email", "content", "social", "event", "release"])).toBeNull();
    expect(showParamValue(["email", "content"])).toBe("content,email");
  });
});

describe("a type tab", () => {
  it("shows only its own category with no filter on", () => {
    expect(shown("event", "")).toEqual(["45:event", "86:event", "76:event", "84:event"]);
  });

  it("matches any selected value within one filter (OR)", () => {
    expect(shown("event", "event-type=Partner Event,Self-Hosted Event")).toEqual([
      "45:event",
      "86:event",
      "76:event",
      "84:event",
    ]);
    expect(shown("content", "format=Whitepaper,Blog")).toEqual(["42:content", "73:content"]);
  });

  it("requires every active filter to match (AND)", () => {
    expect(shown("event", "event-type=Self-Hosted Event&region=APAC")).toEqual(["45:event"]);
    expect(shown("content", "format=Blog&bu=API")).toEqual([]);
  });

  it("matches an item with several BUs when any of them is selected", () => {
    expect(shown("event", "bu=IAM")).toEqual(["45:event", "84:event"]);
    expect(shown("event", "bu=API")).toEqual(["84:event"]);
    expect(shown("event", "region=North America")).toEqual(["84:event"]);
  });

  it("hides an item with no value for an active filter", () => {
    // #81 has only an abstract: no format, so a format filter hides it.
    expect(shown("content", "")).toContain("81:content");
    expect(shown("content", "format=Blog,Whitepaper,Report")).not.toContain("81:content");
    // #73's social post has no platform or handle.
    expect(shown("social", "handle=WSO2,OpenChoreo")).toEqual(["55:social", "40:social"]);
    // #87 carries no BU label.
    expect(shown("email", "bu=Agent,NEW")).toEqual(["58:email", "83:email"]);
  });

  it("ignores unknown values in the URL, and a filter left with none is off", () => {
    expect(shown("social", "platform=Myspace")).toEqual(["55:social", "73:social", "40:social"]);
    expect(shown("social", "platform=Myspace,Facebook")).toEqual(["55:social"]);
  });

  it("ignores another tab's filters", () => {
    expect(shown("social", "format=Blog&event-type=Partner Event")).toHaveLength(3);
  });

  it("treats a value found only in the data as a known option", () => {
    expect(shown("email", "region=oceania")).toEqual(["83:email"]);
  });

  it("filters releases by BU, product name, release type and tier", () => {
    expect(shown("release", "")).toEqual(["88:release", "89:release", "91:release"]);
    expect(shown("release", "bu=Choreo,Integration")).toEqual(["89:release", "91:release"]);
    expect(shown("release", "product=API Manager")).toEqual(["88:release"]);
    expect(shown("release", "release-type=LTS")).toEqual(["88:release", "91:release"]);
    expect(shown("release", "release-type=LTS&tier=Tier 4")).toEqual(["91:release"]);
  });
});

describe("filter options", () => {
  const bu = CATEGORY_FILTERS.email.find((filter) => filter.param === "bu")!;

  it("are the fixed list, then the data's other values appended", () => {
    expect(filterOptions(bu, SAMPLE_ITEMS)).toEqual([...bu.options, "NEW"]);
  });

  it("keep the fixed list when the data has nothing new", () => {
    const handle = CATEGORY_FILTERS.social.find((filter) => filter.param === "handle")!;
    expect(filterOptions(handle, SAMPLE_ITEMS)).toEqual(["WSO2", "OpenChoreo"]);
  });

  it("offer the month's product names, which have no fixed list", () => {
    const product = CATEGORY_FILTERS.release.find((filter) => filter.param === "product")!;
    expect(filterOptions(product, SAMPLE_ITEMS)).toEqual(["API Manager", "Choreo", "Integrator"]);
  });

  it("come from the tab's own items", () => {
    // "NEW" is only on an email, so the Events tab doesn't offer it.
    const state = categoryFilterState(SAMPLE_ITEMS, "event", new URLSearchParams("bu=NEW,IAM"));
    const buState = state.find(({ filter }) => filter.param === "bu")!;
    expect(buState.options).not.toContain("NEW");
    expect(buState.selected).toEqual(["IAM"]);
  });
});

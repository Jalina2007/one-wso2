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
import { shortDate } from "./calendarRange";
import { coversDay, itemDateText, lastDayOf, layoutWeek } from "./calendarSpans";
import type { CalendarItem } from "./marketingCalendarTypes";

// The week of Monday 30 November 2026, as the December grid's first row draws it.
const WEEK = ["2026-11-30", "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05", "2026-12-06"];

function item(number: number, date: string, endDate?: string): CalendarItem {
  return {
    id: `Plan2-Go/marketing-team#${number}:event`,
    title: `Event ${number}`,
    url: `https://github.com/Plan2-Go/marketing-team/issues/${number}`,
    category: "event",
    date,
    ...(endDate ? { endDate } : {}),
    state: "open",
    bu: [],
    region: [],
    details: {},
  };
}

const placed = (items: CalendarItem[], maxLanes = 3) =>
  layoutWeek(WEEK, items, maxLanes).strips.map(
    ({ item: { title }, startColumn, span, lane, continuesBefore, continuesAfter }) => ({
      title,
      startColumn,
      span,
      lane,
      continuesBefore,
      continuesAfter,
    }),
  );

describe("an item's days", () => {
  it("runs from date to endDate, or is the one day", () => {
    expect(lastDayOf(item(1, "2026-11-30", "2026-12-04"))).toBe("2026-12-04");
    expect(lastDayOf(item(2, "2026-11-30"))).toBe("2026-11-30");
    expect(coversDay(item(1, "2026-11-30", "2026-12-04"), "2026-12-02")).toBe(true);
    expect(coversDay(item(1, "2026-11-30", "2026-12-04"), "2026-12-05")).toBe(false);
  });

  it("names both ends for an item over several days", () => {
    expect(itemDateText(item(1, "2026-11-30", "2026-12-04"))).toBe(
      `${shortDate("2026-11-30")} – ${shortDate("2026-12-04")}`,
    );
    expect(itemDateText(item(2, "2026-11-30"))).not.toContain("–");
  });
});

describe("layoutWeek", () => {
  it("draws an event over several days as one strip across its days", () => {
    expect(placed([item(6878, "2026-11-30", "2026-12-04")])).toEqual([
      { title: "Event 6878", startColumn: 0, span: 5, lane: 0, continuesBefore: false, continuesAfter: false },
    ]);
  });

  it("cuts a strip at the week's edges and marks it as continuing", () => {
    expect(placed([item(1, "2026-11-27", "2026-12-08")])).toEqual([
      { title: "Event 1", startColumn: 0, span: 7, lane: 0, continuesBefore: true, continuesAfter: true },
    ]);
    expect(placed([item(2, "2026-12-05", "2026-12-09")])[0]).toMatchObject({
      startColumn: 5,
      span: 2,
      continuesBefore: false,
      continuesAfter: true,
    });
  });

  it("leaves out items with no day in the week", () => {
    expect(placed([item(1, "2026-11-20", "2026-11-29"), item(2, "2026-12-07")])).toEqual([]);
  });

  it("puts one-day items beside a strip in a free lane, longer strips first", () => {
    const layout = placed([item(1, "2026-12-01"), item(2, "2026-11-30", "2026-12-02"), item(3, "2026-12-03")]);
    expect(layout.map(({ title, lane, startColumn }) => [title, lane, startColumn])).toEqual([
      ["Event 2", 0, 0],
      ["Event 1", 1, 1],
      ["Event 3", 0, 3],
    ]);
  });

  it("hides what doesn't fit on every day it covers and counts it per day", () => {
    const items = [
      item(1, "2026-11-30", "2026-12-01"),
      item(2, "2026-11-30", "2026-12-01"),
      item(3, "2026-11-30", "2026-12-02"),
    ];
    const layout = layoutWeek(WEEK, items, 2);
    expect(layout.strips.map((strip) => strip.item.title)).toEqual(["Event 3", "Event 1"]);
    expect(layout.laneCount).toBe(2);
    expect(layout.hiddenByColumn).toEqual([1, 1, 0, 0, 0, 0, 0]);
    expect(layout.itemsByColumn[1].map((shown) => shown.title)).toEqual(["Event 3", "Event 1", "Event 2"]);
    expect(layout.itemsByColumn[2].map((shown) => shown.title)).toEqual(["Event 3"]);
  });
});

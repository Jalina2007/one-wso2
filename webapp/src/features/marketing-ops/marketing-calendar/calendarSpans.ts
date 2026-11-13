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

// How items sit in one week of the month grid. An event over several days
// (`endDate`) is one strip across its days rather than a chip on its first day;
// one that crosses a week boundary is cut into a strip per week, each marked as
// continuing. Pure, so the layout rules are tested on their own:
//
// - Each strip takes a lane (a row inside the week), the first lane free on all
//   of its days, so strips never overlap and a long one stays straight.
// - Strips are laid in order of their first day in the week, longer first on the
//   same day (so multi-day strips sit on top and short ones fill around them),
//   then in the order the items came (the backend's date, title order).
// - Only `maxLanes` lanes are drawn. A strip that doesn't fit is hidden on every
//   day it covers, and those days say "+N more".
//
// Dates are compared as YYYY-MM-DD text, which sorts like the dates themselves.

import { longDate } from "./calendarDates";
import { shortDate } from "./calendarRange";
import type { CalendarItem } from "./marketingCalendarTypes";

export interface WeekStrip {
  item: CalendarItem;
  // 0 (Monday) to 6 (Sunday): the first column the strip covers in this week.
  startColumn: number;
  // How many columns it covers, 1 to 7.
  span: number;
  // 0 is the top lane.
  lane: number;
  // The item started before this week / goes on after it.
  continuesBefore: boolean;
  continuesAfter: boolean;
}

export interface WeekLayout {
  // The strips that fit in `maxLanes`.
  strips: WeekStrip[];
  // How many lanes the strips use, at most maxLanes.
  laneCount: number;
  // Per column: every item on that day, shown or not, for its "+N more" list.
  itemsByColumn: CalendarItem[][];
  // Per column: how many of those are hidden.
  hiddenByColumn: number[];
}

/** The item's last day, YYYY-MM-DD: its `endDate`, or its `date` for a one-day item. */
export function lastDayOf(item: CalendarItem): string {
  return item.endDate && item.endDate > item.date ? item.endDate : item.date;
}

/** Whether the item is on `day` (YYYY-MM-DD). */
export function coversDay(item: CalendarItem, day: string): boolean {
  return item.date <= day && day <= lastDayOf(item);
}

/** "Monday, 30 November 2026", or "30 Nov 2026 – 4 Dec 2026" for an item over several days. */
export function itemDateText(item: CalendarItem): string {
  const lastDay = lastDayOf(item);
  return lastDay === item.date ? longDate(item.date) : `${shortDate(item.date)} – ${shortDate(lastDay)}`;
}

/** Lays the items out over one week's days (seven YYYY-MM-DD, Monday first). */
export function layoutWeek(days: readonly string[], items: readonly CalendarItem[], maxLanes: number): WeekLayout {
  const firstDay = days[0];
  const lastDay = days[days.length - 1];

  const segments = items
    .map((item, order) => ({ item, order }))
    .filter(({ item }) => item.date <= lastDay && lastDayOf(item) >= firstDay)
    .map(({ item, order }) => {
      const startColumn = item.date < firstDay ? 0 : days.indexOf(item.date);
      const endColumn = lastDayOf(item) > lastDay ? days.length - 1 : days.indexOf(lastDayOf(item));
      return {
        item,
        order,
        startColumn,
        span: endColumn - startColumn + 1,
        continuesBefore: item.date < firstDay,
        continuesAfter: lastDayOf(item) > lastDay,
      };
    })
    .sort((a, b) => a.startColumn - b.startColumn || b.span - a.span || a.order - b.order);

  // lanes[lane][column]: whether that slot is taken.
  const lanes: boolean[][] = [];
  const strips: WeekStrip[] = [];
  const hiddenByColumn = days.map(() => 0);

  for (const { item, startColumn, span, continuesBefore, continuesAfter } of segments) {
    const columns = Array.from({ length: span }, (_, offset) => startColumn + offset);
    let lane = lanes.findIndex((taken) => columns.every((column) => !taken[column]));
    if (lane === -1 && lanes.length < maxLanes) {
      lanes.push(days.map(() => false));
      lane = lanes.length - 1;
    }
    if (lane === -1) {
      for (const column of columns) hiddenByColumn[column] += 1;
      continue;
    }
    for (const column of columns) lanes[lane][column] = true;
    strips.push({ item, startColumn, span, lane, continuesBefore, continuesAfter });
  }

  return {
    strips,
    laneCount: lanes.length,
    itemsByColumn: days.map((day) => segments.filter(({ item }) => coversDay(item, day)).map(({ item }) => item)),
    hiddenByColumn,
  };
}

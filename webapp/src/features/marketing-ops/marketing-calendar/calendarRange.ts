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

// The List view's date range, kept in the URL (`?from=2026-11-01&to=2026-11-30`)
// like the month, so a list can be shared as a link. Pure, so the rules are
// tested on their own:
//
// - With no `from` and no `to`, the list covers the month in `?month=`.
// - A range applies only when both dates are real days, From is on or before
//   To, and it spans at most MAX_RANGE_DAYS, the backend's own cap (it reads
//   every day live from GitHub, so it refuses longer ranges). Anything else
//   falls back to the month and says why, so a bad link still shows something.
//
// Civil dates throughout, stepped through Date.UTC as calendarDates does.

import { isoDate, type CalendarMonth, type CivilDate } from "./calendarDates";

export const MAX_RANGE_DAYS = 92;

const DAY_MS = 86_400_000;

/** The days a list covers, YYYY-MM-DD, both included. */
export interface CalendarRange {
  from: string;
  to: string;
}

export interface ResolvedRange {
  // The range to fetch and list: the URL's when it is valid, else the month.
  range: CalendarRange;
  // Why the URL's range was set aside, by input; empty when it applies or none was given.
  errors: { from?: string; to?: string };
}

/** A "YYYY-MM-DD" back into a civil date, or null when it isn't a real day. */
export function parseIsoDate(value: string | null): CivilDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  if (month < 1 || month > 12) return null;
  // Day 0 of the next month is the last day of this one.
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) return null;
  return { year, month, day };
}

/** The first to the last day of a month. */
export function monthRange({ year, month }: CalendarMonth): CalendarRange {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: isoDate({ year, month, day: 1 }), to: isoDate({ year, month, day: daysInMonth }) };
}

/** The range the List view shows for the URL's `from` and `to`, given the month in view. */
export function resolveRange(from: string | null, to: string | null, month: CalendarMonth): ResolvedRange {
  const fallback = monthRange(month);
  if (from === null && to === null) return { range: fallback, errors: {} };

  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  if (!start || !end) {
    const errors: ResolvedRange["errors"] = {};
    if (!start) errors.from = "Enter a valid date";
    if (!end) errors.to = "Enter a valid date";
    return { range: fallback, errors };
  }

  const days = (utcDay(end) - utcDay(start)) / DAY_MS + 1;
  if (days < 1) return { range: fallback, errors: { to: "Must be on or after From" } };
  if (days > MAX_RANGE_DAYS) return { range: fallback, errors: { to: `At most ${MAX_RANGE_DAYS} days` } };
  return { range: { from: isoDate(start), to: isoDate(end) }, errors: {} };
}

/** "1 Nov 2026" for a "YYYY-MM-DD", in the reader's locale: the List view's empty note. */
export function shortDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(Date.UTC(year, month - 1, day));
}

function utcDay({ year, month, day }: CivilDate): number {
  return Date.UTC(year, month - 1, day);
}

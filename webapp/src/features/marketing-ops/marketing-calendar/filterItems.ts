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

import { CALENDAR_CATEGORIES } from "./calendarCategories";
import { CATEGORY_FILTERS, filterOptions, type CalendarFilter } from "./calendarFilters";
import type { CalendarCategory, CalendarItem } from "./marketingCalendarTypes";

// Which items a view shows, worked out from the URL alone, so a filtered view is
// a link that can be shared. Pure, and kept apart from the components so the
// rules below are tested on their own.
//
// - All: `?show=social,email` names the categories that are on; absent means all of them.
// - A type tab: its own items, narrowed by its filters (`?bu=Corporate,Integration&format=Blog`).
//   Within one filter any selected value matches; across filters all must match.
//   An item with several BUs matches when any of them is selected, and an item
//   with no value for an active filter is hidden.
// - A value in the URL that isn't one of the filter's options is ignored, and a
//   filter left with no known value is off.

export type CalendarView = "all" | CalendarCategory;

export const SHOW_PARAM = "show";

const ALL_CATEGORY_KEYS = CALENDAR_CATEGORIES.map((style) => style.key);

/** A comma-separated query value as a list, blanks dropped. */
function listParam(params: URLSearchParams, name: string): string[] {
  return (params.get(name) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

/** The query value for a list: null, to drop the parameter, when the list is empty. */
export function listParamValue(values: readonly string[]): string | null {
  return values.length > 0 ? values.join(",") : null;
}

/** The categories the All view shows: those `?show=` names, or all of them when it names none. */
export function shownCategories(params: URLSearchParams): CalendarCategory[] {
  const named = new Set(listParam(params, SHOW_PARAM));
  const shown = ALL_CATEGORY_KEYS.filter((key) => named.has(key));
  return shown.length > 0 ? shown : ALL_CATEGORY_KEYS;
}

/** The `?show=` value for a selection: null, to drop it, when every category is on. */
export function showParamValue(categories: readonly CalendarCategory[]): string | null {
  const on = ALL_CATEGORY_KEYS.filter((key) => categories.includes(key));
  return on.length === ALL_CATEGORY_KEYS.length ? null : listParamValue(on);
}

export interface FilterState {
  filter: CalendarFilter;
  // What the control offers: the fixed list, then values only the data has.
  options: string[];
  // The URL's values that are among the options.
  selected: string[];
}

/** A type tab's filters as the URL sets them, over that category's items. */
export function categoryFilterState(
  items: readonly CalendarItem[],
  category: CalendarCategory,
  params: URLSearchParams,
): FilterState[] {
  const own = items.filter((item) => item.category === category);
  return CATEGORY_FILTERS[category].map((filter) => {
    const options = filterOptions(filter, own);
    const selected = listParam(params, filter.param).filter((value) => options.includes(value));
    return { filter, options, selected };
  });
}

export function filterItems(
  items: readonly CalendarItem[],
  view: CalendarView,
  params: URLSearchParams,
): CalendarItem[] {
  if (view === "all") {
    const shown = new Set(shownCategories(params));
    return items.filter((item) => shown.has(item.category));
  }

  const active = categoryFilterState(items, view, params).filter((state) => state.selected.length > 0);
  return items.filter(
    (item) =>
      item.category === view &&
      active.every(({ filter, selected }) => filter.values(item).some((value) => selected.includes(value))),
  );
}

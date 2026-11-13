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

import type { CalendarCategory, CalendarItem, CalendarItemOf } from "./marketingCalendarTypes";

// Each type tab's filters, in the order the tab shows them, with fixed option
// lists so the choices don't change from month to month. The lists copy the
// #460 project fields and the issue templates' dropdowns; BU and Region are the
// display names the backend maps the BU_* and REG_* labels to. A value found in
// the data but missing here is appended (filterOptions), so a template change
// never leaves an item unfilterable.

const BU_OPTIONS = ["Agent", "API", "Corporate", "Choreo", "IAM", "Integration", "Solutions"] as const;
const REGION_OPTIONS = [
  "Global",
  "North America",
  "Europe",
  "APAC",
  "LATAM",
  "Middle East",
  "Africa",
] as const;

export interface CalendarFilter {
  // The query-string key: `?bu=Corporate,Integration`.
  param: string;
  label: string;
  options: readonly string[];
  // The item's values for this filter; empty when it has none.
  values: (item: CalendarItem) => readonly string[];
}

const BU: CalendarFilter = { param: "bu", label: "BU", options: BU_OPTIONS, values: (item) => item.bu };
const REGION: CalendarFilter = {
  param: "region",
  label: "Region",
  options: REGION_OPTIONS,
  values: (item) => item.region,
};

// One `details` field as a filter's values.
function detail<C extends CalendarCategory>(category: C, key: keyof CalendarItemOf<C>["details"]) {
  return (item: CalendarItem): readonly string[] => {
    if (item.category !== category) return [];
    const value = (item.details as Partial<Record<typeof key, string>>)[key];
    return value ? [value] : [];
  };
}

export const CATEGORY_FILTERS: Record<CalendarCategory, readonly CalendarFilter[]> = {
  content: [
    {
      param: "content-type",
      label: "Content type",
      options: ["Thought Leadership", "SEO/GEO", "Feature-Oriented", "Campaign/Gated", "Announcement", "Other"],
      values: detail("content", "contentType"),
    },
    {
      param: "format",
      label: "Format",
      options: [
        "Blog",
        "Whitepaper",
        "Report",
        "Article",
        "Video",
        "Demo",
        "Guide",
        "Other Content",
        "Ebook",
        "Case Study",
      ],
      values: detail("content", "format"),
    },
    {
      param: "persona",
      label: "Target persona",
      options: ["ITDM / CXO", "Architect", "Developer", "Non-technical influencer", "Other"],
      values: detail("content", "targetPersona"),
    },
    BU,
  ],
  event: [
    REGION,
    {
      param: "event-type",
      label: "Event Type",
      options: ["Industry Event", "Self-Hosted Event", "Co-hosted Event", "Partner Event"],
      values: detail("event", "eventType"),
    },
    BU,
  ],
  social: [
    {
      param: "platform",
      label: "Platform",
      options: ["LinkedIn", "X", "Instagram", "Facebook", "TikTok", "YouTube", "Other"],
      values: detail("social", "platform"),
    },
    {
      param: "handle",
      label: "Handle",
      options: ["WSO2", "OpenChoreo"],
      values: detail("social", "handle"),
    },
    BU,
  ],
  email: [BU, REGION],
  release: [
    BU,
    {
      // Product names are free text in the form, so the options are the ones the
      // month's releases carry.
      param: "product",
      label: "Product Name",
      options: [],
      values: detail("release", "productName"),
    },
    {
      param: "release-type",
      label: "Release Type",
      options: ["LTS", "STS"],
      values: detail("release", "releaseType"),
    },
    {
      param: "tier",
      label: "Tier",
      options: ["Tier 1", "Tier 2", "Tier 3", "Tier 4"],
      values: detail("release", "tier"),
    },
  ],
};

/** The filter's fixed options, then any other value the items carry, in alphabetical order. */
export function filterOptions(filter: CalendarFilter, items: readonly CalendarItem[]): string[] {
  const known = new Set(filter.options);
  const extra = new Set<string>();
  for (const item of items) {
    for (const value of filter.values(item)) {
      if (!known.has(value)) extra.add(value);
    }
  }
  return [...filter.options, ...[...extra].sort((a, b) => a.localeCompare(b))];
}

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


// The Marketing Calendar's data, as GET /api/marketing-calendar/items returns it. Each item
// is one GitHub issue under one calendar category: an issue with two calendar
// labels arrives twice, once per category, with a different `id`.
//
// The backend sends data and the frontend owns the wording: the field labels,
// their order and the layout live in CalendarItemDrawer. Empty values are left
// out rather than sent as "".

export type CalendarCategory = "event" | "content" | "social" | "email" | "release";

interface CalendarItemCommon {
  // "<owner>/<repo>#<number>:<category>"
  id: string;
  title: string;
  // The issue on github.com.
  url: string;
  // A civil date, YYYY-MM-DD: the Due Date, or for an event with none, its
  // Event start date.
  date: string;
  // Only on an event over several days: its Event end date, the last day it runs
  // (included), always after `date`. Such an event is sent when any of its days is
  // in the requested range, so `date` can be before the range's first day.
  endDate?: string;
  state: "open" | "closed";
  // The project's Status, e.g. "Planned".
  status?: string;
  // Display names mapped from the BU_* and REG_* labels.
  bu: string[];
  region: string[];
}

export interface ContentDetails {
  // An email address.
  author?: string;
  contentType?: string;
  format?: string;
  targetPersona?: string;
  // Plain text from the issue body, line breaks kept.
  abstract?: string;
}

export interface EventDetails {
  eventName?: string;
  // YYYY-MM-DD.
  startDate?: string;
  endDate?: string;
  eventType?: string;
  // Whatever the form says: a URL or free text.
  salesforceCampaign?: string;
}

export interface SocialDetails {
  platform?: string;
  handle?: string;
}

export interface EmailDetails {
  subjectLine?: string;
  sender?: string;
  // Plain text from the issue body, line breaks kept.
  bodyCopy?: string;
}

export interface ReleaseDetails {
  productName?: string;
  version?: string;
  // "STS" or "LTS".
  releaseType?: string;
  // "Tier 1" to "Tier 4".
  tier?: string;
  // YYYY-MM-DD, from the issue body. The release's calendar date is its Due
  // Date, which the template sets to the marketing launch date.
  websiteDate?: string;
}

export type CalendarItem = CalendarItemCommon &
  (
    | { category: "content"; details: ContentDetails }
    | { category: "event"; details: EventDetails }
    | { category: "social"; details: SocialDetails }
    | { category: "email"; details: EmailDetails }
    | { category: "release"; details: ReleaseDetails }
  );

/** One category's items, with that category's `details`. */
export type CalendarItemOf<C extends CalendarCategory> = Extract<CalendarItem, { category: C }>;

export interface CalendarItemsResponse {
  // When the backend read GitHub, as an ISO-8601 UTC instant.
  fetchedAt: string;
  items: CalendarItem[];
}

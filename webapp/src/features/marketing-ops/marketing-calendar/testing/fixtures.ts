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

import type { CalendarItem, CalendarItemsResponse } from "../marketingCalendarTypes";

// Items copied from a real GET /api/marketing-calendar/items response for the
// November 2026 grid (26 Oct to 6 Dec), against the local test project. Chosen to
// cover each category's fields, the gaps (an event with no dates, a social post
// with no details, an email with no BU, a release with no website date), a
// Salesforce Campaign as a URL and as text, several BUs and Regions on one item,
// and values missing from the fixed option lists (BU "NEW", Region "oceania").

export const SAMPLE_ITEMS: CalendarItem[] = [
  {
    id: "Plan2-Go/marketing-team#42:content",
    title: "[Whitepaper] Securing agent-to-API traffic",
    url: "https://github.com/Plan2-Go/marketing-team/issues/42",
    category: "content",
    date: "2026-11-12",
    state: "open",
    bu: ["API"],
    region: [],
    details: {
      author: "writer@example.com",
      contentType: "SEO/GEO",
      format: "Whitepaper",
      targetPersona: "Architect",
      abstract: "Fake abstract for calendar testing.\nIt has a second line.",
    },
    status: "Planned",
  },
  {
    id: "Plan2-Go/marketing-team#81:content",
    title: "Content brief: Event-driven agents explained",
    url: "https://github.com/Plan2-Go/marketing-team/issues/81",
    category: "content",
    date: "2026-11-09",
    state: "open",
    bu: ["Agent"],
    region: [],
    details: {
      abstract: "Fake abstract from the unbuilt form.",
    },
    status: "Planned",
  },
  {
    id: "Plan2-Go/marketing-team#73:content",
    title: "[Blog] Integrator 5.1 launch recap",
    url: "https://github.com/Plan2-Go/marketing-team/issues/73",
    category: "content",
    date: "2026-11-26",
    state: "open",
    bu: ["Integration"],
    region: [],
    details: {
      contentType: "Announcement",
      format: "Blog",
      targetPersona: "Developer",
      abstract: "Fake abstract for calendar testing.\nIt has a second line.",
    },
    status: "Planned",
  },
  {
    id: "Plan2-Go/marketing-team#45:event",
    title: "[Event] Identity Summit Colombo 2026",
    url: "https://github.com/Plan2-Go/marketing-team/issues/45",
    category: "event",
    date: "2026-11-10",
    state: "open",
    bu: ["IAM"],
    region: ["APAC"],
    details: {
      eventName: "Identity Summit Colombo",
      startDate: "2026-11-10",
      endDate: "2026-11-12",
      eventType: "Self-Hosted Event",
      salesforceCampaign: "https://wso2.my.salesforce.com/701FAKE000000001",
    },
    status: "Planned",
  },
  {
    id: "Plan2-Go/marketing-team#86:event",
    title: "[Event] Solutions Roundtable Johannesburg 2026",
    url: "https://github.com/Plan2-Go/marketing-team/issues/86",
    category: "event",
    date: "2026-11-30",
    state: "open",
    bu: ["Solutions"],
    region: ["Africa"],
    details: {
      eventName: "Solutions Roundtable Johannesburg",
      startDate: "2026-11-30",
      endDate: "2026-11-30",
      eventType: "Partner Event",
      salesforceCampaign: "Campaign 701FAKE (ask Sam)",
    },
    status: "Planned",
  },
  {
    id: "Plan2-Go/marketing-team#76:event",
    title: "[Event] Partner webinar series",
    url: "https://github.com/Plan2-Go/marketing-team/issues/76",
    category: "event",
    date: "2026-11-11",
    state: "open",
    bu: ["Solutions"],
    region: ["Global"],
    details: {
      eventName: "Partner webinar series",
      eventType: "Partner Event",
    },
    status: "Planned",
  },
  {
    id: "Plan2-Go/marketing-team#84:event",
    title: "[Event] Identity and API Day Frankfurt 2026",
    url: "https://github.com/Plan2-Go/marketing-team/issues/84",
    category: "event",
    date: "2026-11-25",
    state: "open",
    bu: ["API", "IAM"],
    region: ["Europe", "North America"],
    details: {
      eventName: "Identity and API Day Frankfurt",
      startDate: "2026-11-25",
      endDate: "2026-11-25",
      eventType: "Self-Hosted Event",
    },
    status: "Planned",
  },
  {
    id: "Plan2-Go/marketing-team#55:social",
    title: "[Social] Facebook: Solutions team in Nairobi",
    url: "https://github.com/Plan2-Go/marketing-team/issues/55",
    category: "social",
    date: "2026-11-30",
    state: "open",
    bu: ["Solutions"],
    region: ["Africa"],
    details: {
      platform: "Facebook",
      handle: "WSO2",
    },
    status: "Planned",
  },
  {
    id: "Plan2-Go/marketing-team#73:social",
    title: "[Blog] Integrator 5.1 launch recap",
    url: "https://github.com/Plan2-Go/marketing-team/issues/73",
    category: "social",
    date: "2026-11-26",
    state: "open",
    bu: ["Integration"],
    region: [],
    details: {},
    status: "Planned",
  },
  {
    id: "Plan2-Go/marketing-team#40:social",
    title: "[Social] LinkedIn: Community call 5 - Brownfield Adoption",
    url: "https://github.com/Plan2-Go/marketing-team/issues/40",
    category: "social",
    date: "2026-10-27",
    state: "closed",
    bu: ["Choreo"],
    region: ["Global"],
    details: {
      platform: "LinkedIn",
      handle: "OpenChoreo",
    },
    status: "Completed",
  },
  {
    id: "Plan2-Go/marketing-team#58:email",
    title: "[Email] Agent platform briefing ME",
    url: "https://github.com/Plan2-Go/marketing-team/issues/58",
    category: "email",
    date: "2026-11-26",
    state: "open",
    bu: ["Agent"],
    region: ["Middle East"],
    details: {
      subjectLine: "A private briefing on agent platforms",
      sender: "Alex Perera (alex.perera@example.com)",
      bodyCopy:
        "Hi [Name],\n\nFake body copy for calendar testing.\nIt runs over several lines.\n\nBest regards,\nThe WSO2 Team",
    },
    status: "Awaiting Review",
  },
  {
    id: "Plan2-Go/marketing-team#83:email",
    title: "[Email] Oceania partner update",
    url: "https://github.com/Plan2-Go/marketing-team/issues/83",
    category: "email",
    date: "2026-11-23",
    state: "open",
    bu: ["NEW"],
    region: ["oceania"],
    details: {
      subjectLine: "Partner news for Oceania",
      sender: "WSO2",
      bodyCopy:
        "Hi [Name],\n\nFake body copy for calendar testing.\nIt runs over several lines.\n\nBest regards,\nThe WSO2 Team",
    },
    status: "Planned",
  },
  {
    id: "Plan2-Go/marketing-team#87:email",
    title: "[Email] Year-end customer thank you",
    url: "https://github.com/Plan2-Go/marketing-team/issues/87",
    category: "email",
    date: "2026-12-02",
    state: "open",
    bu: [],
    region: ["Global"],
    details: {
      subjectLine: "Thank you for 2026",
      sender: "WSO2 BU team",
      bodyCopy:
        "Hi [Name],\n\nFake body copy for calendar testing.\nIt runs over several lines.\n\nBest regards,\nThe WSO2 Team",
    },
    status: "Planned",
  },
  {
    id: "Plan2-Go/marketing-team#88:release",
    title: "[Release-LTS] API Manager 4.6",
    url: "https://github.com/Plan2-Go/marketing-team/issues/88",
    category: "release",
    date: "2026-11-24",
    state: "open",
    bu: ["API"],
    region: ["Global"],
    details: {
      productName: "API Manager",
      version: "4.6",
      releaseType: "LTS",
      tier: "Tier 1",
      websiteDate: "2026-11-19",
    },
    status: "Planned",
  },
  {
    id: "Plan2-Go/marketing-team#89:release",
    title: "[Release-STS] Choreo 2.1",
    url: "https://github.com/Plan2-Go/marketing-team/issues/89",
    category: "release",
    date: "2026-11-09",
    state: "open",
    bu: ["Choreo"],
    region: ["Global"],
    details: {
      productName: "Choreo",
      version: "2.1",
      releaseType: "STS",
      tier: "Tier 3",
      websiteDate: "2026-11-05",
    },
    status: "Planned",
  },
  {
    id: "Plan2-Go/marketing-team#91:release",
    title: "[Release-LTS] Integrator 5.2",
    url: "https://github.com/Plan2-Go/marketing-team/issues/91",
    category: "release",
    date: "2026-12-01",
    state: "open",
    bu: ["Integration"],
    region: ["Europe"],
    details: {
      productName: "Integrator",
      version: "5.2",
      releaseType: "LTS",
      tier: "Tier 4",
    },
    status: "Planned",
  },
];

export const SAMPLE_RESPONSE: CalendarItemsResponse = {
  fetchedAt: "2026-10-29T09:18:35Z",
  items: SAMPLE_ITEMS,
};

/** The sample item with this `id` suffix, e.g. `"45:event"`. */
export function sampleItem(key: string): CalendarItem {
  const item = SAMPLE_ITEMS.find((candidate) => candidate.id.endsWith(`#${key}`));
  if (!item) throw new Error(`No sample item ${key}`);
  return item;
}

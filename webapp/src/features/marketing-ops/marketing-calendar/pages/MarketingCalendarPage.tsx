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

// Marketing Calendar: a month of the events, content, social posts, emails and releases the
// marketing team plans in GitHub.
//
// The page is the shell and the access check. The calendar itself is a layout
// route (MarketingCalendarLayout) with one tab per view: All, Events, Content,
// Social, Email and Releases (routes.tsx).

import { Alert } from "@wso2/oxygen-ui";
import { MARKETING_OPS_EYEBROW } from "@constants/marketingOpsApps";
import MarketingOpsShell from "../../components/MarketingOpsShell";
import { useMarketingOpsGate } from "../../api/useMarketingOpsGate";
import MarketingCalendarLayout from "./MarketingCalendarLayout";

const GATE_ID = "mops-marketing-calendar";

export default function MarketingCalendarPage() {
  return (
    <MarketingOpsShell
      eyebrow={MARKETING_OPS_EYEBROW.marketingCalendar}
      title="Calendar"
      subtitle="Events, content, social posts, emails and releases planned in GitHub. Click an item for its details."
    >
      <CalendarAccessCheck />
    </MarketingOpsShell>
  );
}

// The shell has already settled that the caller may use Marketing Ops at all; this
// checks the Marketing Calendar capability itself, at the route, so a typed or shared
// URL gets an answer rather than a failed request. One capability covers all six
// tabs, since they show the same data. The calendar (and its query) mounts only
// once that passes.
function CalendarAccessCheck() {
  const gate = useMarketingOpsGate();
  if (!gate.canSee(GATE_ID)) {
    return (
      <Alert severity="info" sx={{ mt: 1.5 }}>
        The Marketing Calendar isn&apos;t available to you. Ask a Marketing Ops admin to add you to
        the Marketing Calendar group.
      </Alert>
    );
  }
  return <MarketingCalendarLayout />;
}

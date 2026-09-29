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

// The Admin Portal — ports promotion-app's own view/administration/
// administration.tsx ("Admin Portal", route.ts: allowRoles: [Role.HR_ADMIN]).
// Five tabs, matching source's own tab bar order exactly: Promotion Cycle,
// Time Based Promotions, Individual Contributor Promotion, Withdrawal
// Requests, User Management.
import { Navigate, Outlet } from "react-router";
import { ClipboardIcon, ClockIcon, RotateCwIcon, Undo2Icon, UserCogIcon, WrenchIcon } from "@wso2/oxygen-ui-icons-react";
import PromotionPageShell from "../components/PromotionPageShell";
import PromotionTabs, { type PromotionTabDef } from "../components/PromotionTabs";

const BASE_PATH = "/people-ops/promotion/admin";

const TABS: PromotionTabDef[] = [
  { segment: "cycle", label: "Promotion Cycle", icon: <RotateCwIcon size={18} /> },
  { segment: "time-based", label: "Time Based Promotions", icon: <ClockIcon size={18} /> },
  { segment: "individual-contributor", label: "Individual Contributor Promotion", icon: <ClipboardIcon size={18} /> },
  { segment: "withdrawal-requests", label: "Withdrawal Requests", icon: <Undo2Icon size={18} /> },
  { segment: "users", label: "User Management", icon: <UserCogIcon size={18} /> },
];

export default function PromotionAdminPortalPage() {
  return (
    <PromotionPageShell
      icon={<WrenchIcon size={34} strokeWidth={1.5} />}
      title="Admin Portal"
      tabs={<PromotionTabs basePath={BASE_PATH} tabs={TABS} ariaLabel="Promotion admin portal" />}
    >
      <Outlet />
    </PromotionPageShell>
  );
}

/** The group's index route — sends straight to Promotion Cycle, source's
 * own first/default tab. */
export function PromotionAdminPortalIndex() {
  return <Navigate to={`${BASE_PATH}/cycle`} replace />;
}

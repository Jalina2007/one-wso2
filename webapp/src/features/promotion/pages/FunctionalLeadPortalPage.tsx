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

// The Functional Lead Portal — ports promotion-app's own
// functionalLead.tsx ("Functional Lead Portal", route.ts: allowRoles:
// [Role.FUNCTIONAL_LEAD]). Four tabs, matching source's own tab bar order
// exactly: Active Promotion Requests, Approved Requests, Rejected
// Requests, Time Based Promotions.
import { Navigate, Outlet } from "react-router";
import { CheckIcon, ClipboardListIcon, RotateCcwIcon, UsersRoundIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import PromotionPageShell from "../components/PromotionPageShell";
import PromotionTabs, { type PromotionTabDef } from "../components/PromotionTabs";

const BASE_PATH = "/people-ops/promotion/functional-lead";

const TABS: PromotionTabDef[] = [
  { segment: "active", label: "Active Promotion Requests", icon: <ClipboardListIcon size={18} /> },
  { segment: "approved", label: "Approved Requests", icon: <CheckIcon size={18} /> },
  { segment: "rejected", label: "Rejected Requests", icon: <XIcon size={18} /> },
  { segment: "time-based", label: "Time Based Promotions", icon: <RotateCcwIcon size={18} /> },
];

export default function FunctionalLeadPortalPage() {
  return (
    <PromotionPageShell
      icon={<UsersRoundIcon size={34} strokeWidth={1.5} />}
      title="Functional Lead Portal"
      tabs={<PromotionTabs basePath={BASE_PATH} tabs={TABS} ariaLabel="Functional lead portal" />}
    >
      <Outlet />
    </PromotionPageShell>
  );
}

/** The group's index route — sends straight to Active Promotion Requests,
 * source's own first/default tab. */
export function FunctionalLeadPortalIndex() {
  return <Navigate to={`${BASE_PATH}/active`} replace />;
}

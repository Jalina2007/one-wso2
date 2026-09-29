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

import type { PromotionRequestStatus, RecommendationStatus } from "../api/types";

// Ports promotion-app's own utils/utils.ts status→colour/label helpers,
// used by the Lead Portal's History tab (and, once ported, every other
// history-style grid this app's admin/board/functional-lead portals show).

/** A cycle-scoped request status reads as "in progress" while its cycle is
 * still the open one — otherwise the raw status (APPROVED/REJECTED/...)
 * would misleadingly look final for a request whose cycle can still move
 * it further (e.g. FL_APPROVED still needs the Promotion Board). */
export function promotionRequestStatusLabel(
  status: PromotionRequestStatus,
  isActiveCycle: boolean,
): PromotionRequestStatus {
  if (
    isActiveCycle &&
    (status === "APPROVED" || status === "REJECTED" || status === "FL_APPROVED" ||
      status === "FL_REJECTED" || status === "SUBMITTED")
  ) {
    return "IN_PROGRESS";
  }
  return status;
}

export function promotionRequestColor(status: PromotionRequestStatus): string {
  switch (status) {
    case "DECLINED":
      return "#FF5630";
    case "IN_PROGRESS":
    case "DRAFT":
      return "#FFAB00";
    case "REQUESTED":
    case "APPROVED":
      return "#76BA1B";
    case "SUBMITTED":
      return "#A980FF";
    case "WITHDRAW":
      return "#172B4D";
    case "FL_APPROVED":
      return "#FF5630";
    case "FL_REJECTED":
    case "REJECTED":
      return "#FF0000";
    case "REMOVED":
      return "#DE350B";
    case "EXPIRED":
      return "#727681";
    default:
      return "#0052CC";
  }
}

export function recommendationColor(status: RecommendationStatus): string {
  switch (status) {
    case "DECLINED":
      return "#FF5630";
    case "REQUESTED":
      return "#36B37E";
    case "SUBMITTED":
      return "#6554C0";
    case "EXPIRED":
      return "#DE350B";
    default:
      return "#0052CC";
  }
}

/** Source shows "APPROVED" for a SUBMITTED recommendation — the lead's own
 * act of submitting IS their approval of the recommendation; SUBMITTED is
 * the wire status, "Approved" is what it means to the lead reading it. */
export function recommendationStatusLabel(status: RecommendationStatus): string {
  return status === "SUBMITTED" ? "APPROVED" : status;
}

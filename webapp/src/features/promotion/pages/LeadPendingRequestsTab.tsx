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

// Ports promotion-app's own view/lead/panels/recommendationList.tsx — the
// Lead Portal's default tab: every REQUESTED recommendation for the open
// cycle, each row's "Start" swapping the list for RecommendationEditForm
// (source keeps this in Redux's currentEditObject; here it's just local
// state, since nothing else on the page needs to reach into it).
import { useState } from "react";
import { Box, IconButton, Skeleton, Tooltip } from "@wso2/oxygen-ui";
import { CalendarOffIcon, InboxIcon, RefreshCwIcon, TriangleAlertIcon } from "@wso2/oxygen-ui-icons-react";
import { useUserInfo } from "@api/useUserInfo";
import { useAsgardeoUser } from "@hooks/useAsgardeoUser";
import { humanizeHttpError } from "@api/http";
import { useActivePromotionCycle, isPromotionDeadlinePast } from "../api/usePromotionCycle";
import { useLeadRecommendations } from "../api/useLeadRecommendations";
import { formatDate } from "../util/promotionHistory";
import PromotionDeadlineBanner from "../components/PromotionDeadlineBanner";
import PromotionEmptyState from "../components/PromotionEmptyState";
import PromotionTableHeader from "../components/PromotionTableHeader";
import RecommendationCard from "../components/RecommendationCard";
import RecommendationEditForm from "../components/RecommendationEditForm";

const COLUMNS = [
  { title: "Employee Name", size: 4, align: "left" as const },
  { title: "Promotion Cycle", size: 2, align: "left" as const },
  { title: "Employee Email", size: 4, align: "left" as const },
  { title: "Actions", size: 2, align: "right" as const },
];

export default function LeadPendingRequestsTab() {
  const userInfo = useUserInfo();
  const asgardeoUser = useAsgardeoUser();
  const leadEmail = userInfo.data?.workEmail ?? asgardeoUser.email;

  const cycle = useActivePromotionCycle();
  const deadlinePast = isPromotionDeadlinePast(cycle.cycle?.leadDeadline);

  const recommendations = useLeadRecommendations(
    leadEmail,
    ["REQUESTED"],
    cycle.cycle?.id,
    !cycle.isPending && Boolean(cycle.cycle) && !deadlinePast,
  );

  const [editingId, setEditingId] = useState<number | null>(null);
  const list = recommendations.data?.recommendations ?? [];
  const editing = list.find((r) => r.recommendationID === editingId) ?? null;

  return (
    <>
      {cycle.cycle && !deadlinePast && (
        <PromotionDeadlineBanner>
          Please review (Approve / Reject) eligible employees before the deadline:{" "}
          {formatDate(cycle.cycle.leadDeadline)}
        </PromotionDeadlineBanner>
      )}

      {!editing && (
        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={() => void recommendations.refetch()}>
              <RefreshCwIcon size={16} />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {!editing && cycle.cycle && !deadlinePast && list.length > 0 && (
        <PromotionTableHeader columns={COLUMNS} />
      )}

      {cycle.isPending || (recommendations.isPending && Boolean(cycle.cycle) && !deadlinePast) ? (
        <Box>
          <Skeleton variant="rectangular" height={76} sx={{ borderRadius: 1, mb: 1.5 }} />
          <Skeleton variant="rectangular" height={76} sx={{ borderRadius: 1 }} />
        </Box>
      ) : cycle.isError ? (
        <PromotionEmptyState
          icon={<TriangleAlertIcon size={28} />}
          tone="error"
          message={`Unable to load the promotion cycle. ${humanizeHttpError(cycle.error)}`}
        />
      ) : !cycle.cycle ? (
        <PromotionEmptyState
          icon={<CalendarOffIcon size={28} />}
          message="We are not accepting promotion requests right now"
        />
      ) : deadlinePast ? (
        <PromotionEmptyState icon={<CalendarOffIcon size={28} />} message="The Lead deadline has passed." />
      ) : recommendations.isError ? (
        <PromotionEmptyState
          icon={<TriangleAlertIcon size={28} />}
          tone="error"
          message={`Unable to load recommendation requests. ${humanizeHttpError(recommendations.error)}`}
        />
      ) : editing ? (
        <RecommendationEditForm
          recommendation={editing}
          leadEmail={leadEmail ?? ""}
          onBack={() => setEditingId(null)}
        />
      ) : list.length === 0 ? (
        <PromotionEmptyState icon={<InboxIcon size={28} />} message="There are no pending promotion requests." />
      ) : (
        list.map((r) => (
          <RecommendationCard key={r.recommendationID} recommendation={r} onStart={() => setEditingId(r.recommendationID)} />
        ))
      )}
    </>
  );
}

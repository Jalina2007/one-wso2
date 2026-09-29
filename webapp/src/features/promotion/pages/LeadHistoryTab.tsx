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

// Ports promotion-app's own view/lead/panels/recommendationHistory.tsx —
// every SUBMITTED/DECLINED/EXPIRED recommendation this lead has ever made,
// across every cycle (not scoped to the open one — source's own
// getRecommendationsHistory never passes a promotionCycleId either),
// narrowed to TIME_BASED (source's own RecommendationHistorySlice filters
// the same way: this page is specifically Time Based Promotions, and the
// shared /promotion/recommendations resource can carry other promotion
// types too).
import { Box, IconButton, Skeleton, Tooltip } from "@wso2/oxygen-ui";
import { InboxIcon, RefreshCwIcon, TriangleAlertIcon } from "@wso2/oxygen-ui-icons-react";
import { useUserInfo } from "@api/useUserInfo";
import { useAsgardeoUser } from "@hooks/useAsgardeoUser";
import { humanizeHttpError } from "@api/http";
import { useActivePromotionCycle } from "../api/usePromotionCycle";
import { useLeadRecommendations } from "../api/useLeadRecommendations";
import PromotionEmptyState from "../components/PromotionEmptyState";
import PromotionTableHeader from "../components/PromotionTableHeader";
import RecommendationHistoryCard from "../components/RecommendationHistoryCard";

const COLUMNS = [
  { title: "Employee Name", size: 2, align: "left" as const },
  { title: "Employee Email", size: 2, align: "center" as const },
  { title: "Promotion Cycle", size: 2, align: "center" as const },
  { title: "Lead Status", size: 2, align: "center" as const },
  { title: "Promotion Status", size: 2, align: "center" as const },
  { title: "Actions", size: 2, align: "right" as const },
];

export default function LeadHistoryTab() {
  const userInfo = useUserInfo();
  const asgardeoUser = useAsgardeoUser();
  const leadEmail = userInfo.data?.workEmail ?? asgardeoUser.email;

  // Only for the "is this row's cycle still the open one" comparison each
  // card needs — a failed/loading fetch here just means every row reads as
  // not-active-cycle, which is never wrong for a row whose cycle really
  // has closed, and no worse than source's own handling (activeCycleId
  // stays null until its own fetch resolves there too).
  const cycle = useActivePromotionCycle();

  const history = useLeadRecommendations(leadEmail, ["SUBMITTED", "DECLINED", "EXPIRED"]);
  const list = (history.data?.recommendations ?? []).filter((r) => r.promotionType === "TIME_BASED");

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={() => void history.refetch()}>
            <RefreshCwIcon size={16} />
          </IconButton>
        </Tooltip>
      </Box>

      {list.length > 0 && <PromotionTableHeader columns={COLUMNS} />}

      {history.isPending ? (
        <Box>
          <Skeleton variant="rectangular" height={64} sx={{ borderRadius: 1, mb: 1.5 }} />
          <Skeleton variant="rectangular" height={64} sx={{ borderRadius: 1 }} />
        </Box>
      ) : history.isError ? (
        <PromotionEmptyState
          icon={<TriangleAlertIcon size={28} />}
          tone="error"
          message={`Unable to load recommendations history. ${humanizeHttpError(history.error)}`}
        />
      ) : list.length === 0 ? (
        <PromotionEmptyState icon={<InboxIcon size={28} />} message="There are no submitted requests!" />
      ) : (
        list.map((r) => (
          <RecommendationHistoryCard
            key={r.recommendationID}
            recommendation={r}
            isActiveCycle={cycle.cycle?.id === r.promotionCycleId}
          />
        ))
      )}
    </>
  );
}

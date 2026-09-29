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

// Ports promotion-app's own view/functionalLead/panels/timeBased.tsx —
// informational only ("No action is required"): every TIME_BASED request
// in the functional lead's own BU scope, for the open cycle, showing each
// recommending lead's own status. Not a grid — source's own screen is a
// plain card list, matching the Lead Portal's own row style rather than
// CustomTable (this is the one FL tab source itself didn't build on that
// component).
import { Box, Chip, Grid, IconButton, Skeleton, Tooltip, Typography } from "@wso2/oxygen-ui";
import { ArrowRightIcon, InboxIcon, RefreshCwIcon, TriangleAlertIcon } from "@wso2/oxygen-ui-icons-react";
import { humanizeHttpError } from "@api/http";
import { useActivePromotionCycle } from "../api/usePromotionCycle";
import { usePromotionRequests } from "../api/usePromotionRequests";
import PromotionDeadlineBanner from "../components/PromotionDeadlineBanner";
import PromotionEmptyState from "../components/PromotionEmptyState";
import PromotionTableHeader from "../components/PromotionTableHeader";

const COLUMNS = [
  { title: "Employee Email", size: 3, align: "left" as const },
  { title: "Lead Status", size: 2, align: "left" as const },
  { title: "Lead Email", size: 3, align: "left" as const },
  { title: "Team", size: 2, align: "left" as const },
  { title: "Promote to", size: 2, align: "right" as const },
];

function recommendationStatusChip(status: string) {
  if (status === "REQUESTED") return { label: "Pending", bg: "#172B4D" };
  if (status === "SUBMITTED") return { label: "Submitted", bg: "#76BA1B" };
  return { label: status, bg: "grey.500" };
}

export default function FLTimeBasedTab() {
  const cycle = useActivePromotionCycle();
  const requests = usePromotionRequests(
    { enableBuFilter: true, type: "TIME_BASED", cycleId: cycle.cycle?.id },
    !cycle.isPending && Boolean(cycle.cycle),
  );

  const rows = requests.data?.promotionRequests ?? [];

  return (
    <>
      {cycle.cycle && (
        <PromotionDeadlineBanner>
          Functional leads can view eligible employees for time-based promotions within their team and check the
          status here. No action is required; this is for information purposes only.
        </PromotionDeadlineBanner>
      )}

      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1.5 }}>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={() => void requests.refetch()}>
            <RefreshCwIcon size={16} />
          </IconButton>
        </Tooltip>
      </Box>

      {cycle.isPending || (requests.isPending && Boolean(cycle.cycle)) ? (
        <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 1 }} />
      ) : cycle.isError ? (
        <PromotionEmptyState
          icon={<TriangleAlertIcon size={28} />}
          tone="error"
          message={`Unable to load the promotion cycle. ${humanizeHttpError(cycle.error)}`}
        />
      ) : !cycle.cycle ? (
        <PromotionEmptyState icon={<InboxIcon size={28} />} message="There are no active promotion cycles" />
      ) : requests.isError ? (
        <PromotionEmptyState
          icon={<TriangleAlertIcon size={28} />}
          tone="error"
          message={`Unable to load promotion requests. ${humanizeHttpError(requests.error)}`}
        />
      ) : rows.length === 0 ? (
        <PromotionEmptyState icon={<InboxIcon size={28} />} message="There are no time based promotion requests" />
      ) : (
        <>
          <PromotionTableHeader columns={COLUMNS} />
          {rows.map((request) => (
            <Box
              key={request.id}
              sx={{ border: 1, borderStyle: "dashed", borderColor: "divider", borderRadius: 1, p: 2, mb: 1.25 }}
            >
              <Grid container spacing={2} sx={{ width: "100%", alignItems: "center" }}>
                <Grid size={3}>
                  <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{request.employeeEmail}</Typography>
                </Grid>
                <Grid size={2}>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {request.recommendations.map((rec) => {
                      const chip = recommendationStatusChip(rec.recommendationStatus);
                      return (
                        <Chip
                          key={rec.recommendationID}
                          label={chip.label}
                          size="small"
                          sx={{ bgcolor: chip.bg, color: "white" }}
                        />
                      );
                    })}
                  </Box>
                </Grid>
                <Grid size={3}>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {request.recommendations.map((rec) => (
                      <Chip key={rec.recommendationID} label={`Lead: ${rec.leadEmail}`} size="small" variant="outlined" />
                    ))}
                  </Box>
                </Grid>
                <Grid size={2}>
                  <Typography sx={{ fontSize: 14 }}>{request.team}</Typography>
                </Grid>
                <Grid size={2} sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 0.5 }}>
                  <Chip label={`JB ${request.currentJobBand}`} size="small" variant="outlined" />
                  <ArrowRightIcon size={16} />
                  <Chip label={`JB ${request.nextJobBand}`} size="small" variant="outlined" />
                </Grid>
              </Grid>
            </Box>
          ))}
        </>
      )}
    </>
  );
}

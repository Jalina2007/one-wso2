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

import { useState } from "react";
import { Box, Chip, Collapse, Grid, IconButton, Tooltip, Typography } from "@wso2/oxygen-ui";
import { CheckIcon, ChevronDownIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import JobBandTransitionChips from "./JobBandTransitionChips";
import PromotionRichTextContent from "./PromotionRichTextContent";
import { decodePromotionText } from "../util/promotionRichText";
import type { PromotionRequestFull } from "../api/types";

// Ports promotion-app's own component/promotion/withdrawalRequestLine.tsx —
// a card, not a DataGrid row (source built this one on its own line
// component, not CustomTable, matching that choice here rather than
// forcing every admin list into the same grid shape).
export default function WithdrawalRequestCard({
  request,
  onApprove,
  onReject,
  approving,
  rejecting,
}: {
  request: PromotionRequestFull;
  onApprove: () => void;
  onReject: () => void;
  approving: boolean;
  rejecting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isRemoved = request.status === "REMOVED";
  const isPending = request.status === "WITHDRAW";

  return (
    <Box
      sx={{
        border: 1,
        borderStyle: "dashed",
        borderColor: "divider",
        borderRadius: 1,
        mb: 1.25,
        bgcolor: isRemoved ? "error.50" : undefined,
      }}
    >
      <Grid container spacing={2} sx={{ width: "100%", alignItems: "center", p: 2 }}>
        <Grid size={3}>
          <Typography sx={{ fontWeight: 600, fontSize: 15 }}>{request.employeeEmail}</Typography>
        </Grid>
        <Grid size={2}>
          <Typography sx={{ fontSize: 14 }}>{request.promotionCycle}</Typography>
        </Grid>
        <Grid size={2}>
          <JobBandTransitionChips currentJobBand={request.currentJobBand} nextJobBand={request.nextJobBand} />
        </Grid>
        <Grid size={2}>
          {isRemoved && <Chip label="Withdrawal Approved" size="small" color="error" />}
        </Grid>
        <Grid size={3} sx={{ display: "flex", justifyContent: "flex-end", gap: 0.5 }}>
          {isPending && (
            <>
              <Tooltip title="Approve withdrawal">
                <IconButton size="small" onClick={onApprove} disabled={approving || rejecting}>
                  <CheckIcon size={16} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Reject withdrawal">
                <IconButton size="small" onClick={onReject} disabled={approving || rejecting}>
                  <XIcon size={16} />
                </IconButton>
              </Tooltip>
            </>
          )}
          <IconButton size="small" onClick={() => setExpanded((v) => !v)}>
            <ChevronDownIcon
              size={18}
              style={{ transform: expanded ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }}
            />
          </IconButton>
        </Grid>
      </Grid>
      <Collapse in={expanded}>
        <Box sx={{ px: 2.5, pb: 2.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>Request</Typography>
          <Box sx={{ mb: 1.5 }}>
            <PromotionRichTextContent content={decodePromotionText(request.promotionStatement)} />
          </Box>
          {request.recommendations.length > 0 && (
            <>
              <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>Recommendations</Typography>
              {request.recommendations.map((r) => (
                <Box key={r.recommendationID} sx={{ mb: 1.5 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.25 }}>{r.leadEmail}</Typography>
                  <PromotionRichTextContent content={decodePromotionText(r.recommendationStatement)} />
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, mt: 0.5 }}>
                    {r.recommendationStatus}
                  </Typography>
                </Box>
              ))}
            </>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

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
import { Box, Chip, Collapse, Grid, IconButton, Typography } from "@wso2/oxygen-ui";
import { ChevronDownIcon } from "@wso2/oxygen-ui-icons-react";
import type { PromotionRecommendation } from "../api/types";
import { decodePromotionText } from "../util/promotionRichText";
import {
  promotionRequestColor,
  promotionRequestStatusLabel,
  recommendationColor,
  recommendationStatusLabel,
} from "../util/promotionStatus";
import PromotionRichTextContent from "./PromotionRichTextContent";

// Ports promotion-app's own component/recommendation/historyLine.tsx — one
// row per SUBMITTED/DECLINED/EXPIRED recommendation, expandable to show the
// statement/comment (SUBMITTED) or decline reason (DECLINED); an EXPIRED
// row has nothing further to show and stays collapsed (matching source,
// which gates the detail sections on SUBMITTED/DECLINED specifically).
export default function RecommendationHistoryCard({
  recommendation,
  isActiveCycle,
}: {
  recommendation: PromotionRecommendation;
  isActiveCycle: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const canExpand =
    recommendation.recommendationStatus === "SUBMITTED" || recommendation.recommendationStatus === "DECLINED";

  return (
    <Box sx={{ border: 1, borderStyle: "dashed", borderColor: "divider", borderRadius: 1, mb: 1.25 }}>
      <Box sx={{ display: "flex", p: 2 }}>
        <Grid container spacing={2} sx={{ width: "100%", alignItems: "center" }}>
          <Grid size={2}>
            <Typography sx={{ fontWeight: 600, fontSize: 15 }}>{recommendation.employeeName}</Typography>
          </Grid>
          <Grid size={2} sx={{ display: "flex", justifyContent: "center" }}>
            <Typography sx={{ fontWeight: 600, fontSize: 15 }}>{recommendation.employeeEmail}</Typography>
          </Grid>
          <Grid size={2} sx={{ display: "flex", justifyContent: "center" }}>
            <Typography sx={{ fontWeight: 600, fontSize: 15 }}>{recommendation.promotionCycle}</Typography>
          </Grid>
          <Grid size={2} sx={{ display: "flex", justifyContent: "center" }}>
            <Chip
              label={recommendationStatusLabel(recommendation.recommendationStatus)}
              size="small"
              sx={{ bgcolor: recommendationColor(recommendation.recommendationStatus), color: "white" }}
            />
          </Grid>
          <Grid size={2} sx={{ display: "flex", justifyContent: "center" }}>
            <Chip
              label={promotionRequestStatusLabel(recommendation.promotionRequestStatus, isActiveCycle)}
              size="small"
              sx={{
                bgcolor: promotionRequestColor(
                  promotionRequestStatusLabel(recommendation.promotionRequestStatus, isActiveCycle),
                ),
                color: "white",
              }}
            />
          </Grid>
          <Grid size={2} sx={{ display: "flex", justifyContent: "flex-end" }}>
            {canExpand && (
              <IconButton onClick={() => setExpanded((v) => !v)}>
                <ChevronDownIcon
                  size={20}
                  style={{ transform: expanded ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }}
                />
              </IconButton>
            )}
          </Grid>
        </Grid>
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ px: 2.5, pb: 2.5 }}>
          {recommendation.recommendationStatus === "SUBMITTED" && (
            <>
              <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>Your Recommendation</Typography>
              <Box sx={{ mb: 1.5 }}>
                <PromotionRichTextContent content={decodePromotionText(recommendation.recommendationStatement)} />
              </Box>
              <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>Additional Comment</Typography>
              <Box sx={{ mb: 1.5 }}>
                <PromotionRichTextContent
                  content={decodePromotionText(recommendation.recommendationAdditionalComment)}
                />
              </Box>
              {(recommendation.promotionRequestStatus === "REJECTED" ||
                recommendation.promotionRequestStatus === "FL_REJECTED") && (
                <>
                  <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>Reason for the Rejection</Typography>
                  <PromotionRichTextContent content={decodePromotionText(recommendation.reasonForRejection)} />
                </>
              )}
            </>
          )}
          {recommendation.recommendationStatus === "DECLINED" && (
            <>
              <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>Reason for Decline</Typography>
              <PromotionRichTextContent
                content={decodePromotionText(recommendation.recommendationAdditionalComment)}
              />
            </>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

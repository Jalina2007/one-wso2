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

import { Accordion, AccordionDetails, AccordionSummary, Chip, IconButton, Stack, Tooltip, Typography } from "@wso2/oxygen-ui";
import { ChevronDownIcon, CopyIcon } from "@wso2/oxygen-ui-icons-react";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { parseLegacyFeedback360 } from "../util/parLegacyHistory";
import { ParCommentView } from "./ParContent";
import ParEmptyState from "./ParEmptyState";
import type { ParLegacyThreeSixtyReview } from "../api/types";

// Read-only legacy counterpart of ParHistoryReviewSection, ported from
// LegacyThreeSixtyFeedbackSection.tsx — sourced from the migrated
// `par_360_feedback` JSON column instead of a fetched review list. Legacy
// data has no reviewer email, only a name, and no rejected/pending state to
// filter on — every parsed entry is shown.
export default function ParLegacyReviewSection({ feedback360 }: { feedback360: string | null }) {
  const { showSuccess, showError } = useNotifications();
  const reviews = parseLegacyFeedback360(feedback360);

  const copyReview = (review: ParLegacyThreeSixtyReview) => {
    const text = `${review.reviewerName}:\nRating: ${review.reviewRating}\nFeedback: ${
      review.reviewComment ?? "No comment provided"
    }`;
    navigator.clipboard.writeText(text).then(
      () => showSuccess("Review copied to clipboard"),
      () => showError("Unable to copy review to clipboard"),
    );
  };

  return (
    <Accordion disabled={reviews.length === 0}>
      <AccordionSummary expandIcon={<ChevronDownIcon size={18} />}>
        <Typography variant="h6">360° Feedback</Typography>
      </AccordionSummary>
      <AccordionDetails>
        {reviews.length === 0 ? (
          <ParEmptyState text="No 360° feedback available for this cycle" />
        ) : (
          <Stack spacing={1.5}>
            {reviews.map((review) => (
              <Accordion key={review.reviewerName} variant="outlined">
                <AccordionSummary expandIcon={<ChevronDownIcon size={16} />}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ width: "100%" }}>
                    <Typography sx={{ mr: "auto", fontWeight: 500 }}>{review.reviewerName}</Typography>
                    <Chip size="small" label={`Rating: ${review.reviewRating}`} />
                    <Tooltip title="Copy review">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyReview(review);
                        }}
                      >
                        <CopyIcon size={14} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <ParCommentView html={review.reviewComment ?? ""} />
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>
        )}
      </AccordionDetails>
    </Accordion>
  );
}

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

import { Accordion, AccordionDetails, AccordionSummary, Avatar, Card, Chip, Divider, Grid, Stack, Typography } from "@wso2/oxygen-ui";
import { ChevronDownIcon } from "@wso2/oxygen-ui-icons-react";
import { deriveLegacyRatingFromScore, parseLegacyQuestionAnswers } from "../util/parLegacyHistory";
import { ParCommentView } from "./ParContent";
import ParLegacyReviewSection from "./ParLegacyReviewSection";
import ParStatusChip from "./ParStatusChip";
import type { ParLegacyHistory } from "../api/types";

function InfoItem({ label, value, secondaryValue }: { label: string; value: string; secondaryValue: string }) {
  return (
    <Grid size="grow">
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, mb: 0.25 }}
      >
        {label}
      </Typography>
      <Typography variant="body1" sx={{ fontWeight: 600 }}>
        {value || "—"}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {secondaryValue || "—"}
      </Typography>
    </Grid>
  );
}

function isMeaningfulLegacyText(text: string | null | undefined): text is string {
  return Boolean(text) && text!.trim() !== "" && text!.trim() !== "N/A";
}

// One legacy record's full detail — extracted out of ParEmployeeHistoryView.tsx
// (which shows it for one fixed employee's own history) so
// ParAdminLegacyCycleView.tsx's org-wide drill-down can render the exact
// same content for any employee's record without duplicating this rendering.
export default function ParLegacyRecordDetail({
  record,
  employeeEmail,
  employeeName,
  thumbnail,
}: {
  record: ParLegacyHistory;
  employeeEmail: string;
  employeeName: string;
  thumbnail?: string;
}) {
  const legacyEmployeeContent = parseLegacyQuestionAnswers(record.questionAnswers)
    .map((qa) => qa.employeeAnswer)
    .filter(isMeaningfulLegacyText)
    .join("\n\n");
  const legacyLeadContent = isMeaningfulLegacyText(record.overallCommentManager) ? record.overallCommentManager! : "";
  const derived = deriveLegacyRatingFromScore(record.managerScoreCode);
  const rating = record.overallRating ?? derived.rating;
  const special = record.overallSpecialRating ?? derived.special;

  return (
    <Stack spacing={2}>
      <Card variant="outlined" sx={{ p: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size="auto">
            <Avatar variant="rounded" src={thumbnail} alt="Employee Thumbnail" sx={{ width: 100, height: 100 }} />
          </Grid>
          <Grid size="grow">
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {special && special !== "NOT_ASSIGNED" && <ParStatusChip content={special} />}
              {rating && rating !== "NOT_ASSIGNED" && <ParStatusChip content={rating} />}
            </Stack>
            {(record.reviewerEmail || record.reviewerName) && (
              <Chip
                size="small"
                variant="outlined"
                sx={{ mt: 1 }}
                label={`PAR shared by: ${record.reviewerEmail ?? record.reviewerName}`}
              />
            )}
          </Grid>
          <InfoItem label="Employee" value={employeeName} secondaryValue={employeeEmail} />
          <InfoItem label="Lead" value={record.reviewerName ?? record.reviewerEmail ?? ""} secondaryValue={record.reviewerEmail ?? ""} />
          <InfoItem label="Team" value={record.team ?? ""} secondaryValue={record.department ?? ""} />
        </Grid>
      </Card>

      <Accordion variant="outlined" disabled={!legacyEmployeeContent} defaultExpanded={Boolean(legacyEmployeeContent)}>
        <AccordionSummary expandIcon={<ChevronDownIcon size={18} />}>Employee PAR</AccordionSummary>
        <AccordionDetails>
          <Divider sx={{ my: 1 }} />
          <ParCommentView html={legacyEmployeeContent} />
        </AccordionDetails>
      </Accordion>
      <Accordion variant="outlined" disabled={!legacyLeadContent} defaultExpanded={Boolean(legacyLeadContent)}>
        <AccordionSummary expandIcon={<ChevronDownIcon size={18} />}>Lead's Feedback</AccordionSummary>
        <AccordionDetails>
          <Divider sx={{ my: 1 }} />
          <ParCommentView html={legacyLeadContent} />
        </AccordionDetails>
      </Accordion>

      <ParLegacyReviewSection feedback360={record.feedback360} />
    </Stack>
  );
}

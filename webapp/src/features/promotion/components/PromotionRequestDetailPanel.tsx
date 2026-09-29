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

import { Alert, AlertTitle, Avatar, Box, Chip, Stack, Typography } from "@wso2/oxygen-ui";
import type { PromotionRequestFull } from "../api/types";
import { decodePromotionText } from "../util/promotionRichText";
import { recommendationStatusLabel, recommendationColor } from "../util/promotionStatus";
import PromotionRichTextContent from "./PromotionRichTextContent";

// Ports source's own component/tables/row.tsx expand panel — an employee
// avatar, a rejection-reason alert (only for a REJECTED/FL_REJECTED
// request), and every lead recommendation on the request (statement +
// additional comment, decoded/sanitized — see PromotionRichTextContent's
// own comment on why source's read-side sanitization gap isn't reproduced).
export default function PromotionRequestDetailPanel({ request }: { request: PromotionRequestFull }) {
  const isRejected = request.status === "REJECTED" || request.status === "FL_REJECTED";

  return (
    <Box sx={{ p: 2.5, display: "flex", gap: 3 }}>
      {isRejected && request.reasonForRejection && (
        <Alert severity="error" sx={{ position: "absolute", top: 8, left: 8, right: 8 }}>
          <AlertTitle>Reason For Rejection</AlertTitle>
          {request.reasonForRejection}
        </Alert>
      )}

      <Avatar sx={{ width: 100, height: 100, flexShrink: 0, mt: isRejected ? 6 : 0 }}>
        {request.employeeEmail.charAt(0).toUpperCase()}
      </Avatar>

      <Box sx={{ flex: 1, minWidth: 0, mt: isRejected ? 6 : 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 1 }}>Lead Recommendations</Typography>
        {request.recommendations.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
            There are no lead recommendations.
          </Typography>
        ) : (
          <Stack spacing={1.5} sx={{ maxHeight: 260, overflow: "auto", pr: 1 }}>
            {request.recommendations.map((rec) => (
              <Box key={rec.recommendationID} sx={{ borderTop: 1, borderColor: "divider", pt: 1.5 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{rec.leadEmail}</Typography>
                  <Chip
                    label={recommendationStatusLabel(rec.recommendationStatus)}
                    size="small"
                    sx={{ bgcolor: recommendationColor(rec.recommendationStatus), color: "white", height: 20, fontSize: 10.5 }}
                  />
                </Stack>
                <PromotionRichTextContent content={decodePromotionText(rec.recommendationStatement)} />
                {rec.recommendationAdditionalComment && (
                  <>
                    <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: "text.secondary", mt: 0.5 }}>
                      Additional Comment
                    </Typography>
                    <PromotionRichTextContent content={decodePromotionText(rec.recommendationAdditionalComment)} />
                  </>
                )}
              </Box>
            ))}
          </Stack>
        )}
      </Box>
    </Box>
  );
}

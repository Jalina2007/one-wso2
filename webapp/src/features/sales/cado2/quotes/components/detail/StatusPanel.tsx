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

import type { JSX, ReactNode } from "react";
import { Box, Chip, Divider, Paper, Stack, Typography } from "@wso2/oxygen-ui";
import { HourglassIcon } from "@wso2/oxygen-ui-icons-react";
import type { AuditEvent, DraftResponse } from "@features/sales/cado2/quotes/api/quoteTypes";
import { formatDate } from "@features/sales/cado2/quotes/form/draftForm";
import { expiryState } from "@features/sales/cado2/quotes/sheet/sheetModel";
import { lifecycleSteps } from "@features/sales/cado2/quotes/sheet/lifecycleSteps";

const day = (iso: string) => formatDate(iso.slice(0, 10));

const TONE_COLOR = { ok: "success", soon: "warning", expired: "error" } as const;

/** The quote page's side panel: lifecycle, expiry, approvals and details. */
export default function StatusPanel({
  latest,
  events,
  approvals,
  documents,
}: {
  latest: DraftResponse;
  events: readonly AuditEvent[];
  /** Where the approval stands (the Approvals tab has the detail). */
  approvals?: ReactNode;
  /** The order form, once approved. */
  documents?: ReactNode;
}): JSX.Element {
  const v = latest.version;
  const steps = lifecycleSteps(latest, events);
  const expiry =
    (v.status === "SUBMITTED" || v.status === "APPROVED") && v.expiryDate ? expiryState(v.expiryDate, new Date()) : null;
  return (
    <Stack spacing={2} component="aside" aria-label="Status" sx={{ position: { lg: "sticky" }, top: { lg: 16 } }}>
      {documents}
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          Status
        </Typography>
        {expiry ? (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <HourglassIcon size={16} />
            <Chip size="small" color={TONE_COLOR[expiry.tone]} label={expiry.label} />
          </Stack>
        ) : null}
        <Stack component="ol" aria-label="Lifecycle" spacing={0} sx={{ listStyle: "none", m: 0, p: 0 }}>
          {steps.map((s, i) => (
            <Box
              component="li"
              key={`${s.label}-${i}`}
              sx={{
                position: "relative",
                pl: 3,
                pb: i === steps.length - 1 ? 0 : 2,
                ml: 0.75,
                borderLeft: 2,
                borderColor: i === steps.length - 1 ? "transparent" : "divider",
                "&::before": {
                  content: '""',
                  position: "absolute",
                  left: -7,
                  top: 3,
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  border: 2,
                  borderColor: s.tone ? `${s.tone}.main` : "primary.main",
                  bgcolor: s.done ? (s.tone ? `${s.tone}.main` : "primary.main") : "background.paper",
                },
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {s.label}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                {s.when}
                {s.who ? ` · ${s.who}` : ""}
              </Typography>
              {s.note ? (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ fontStyle: "italic" }}>
                  “{s.note}”
                </Typography>
              ) : null}
            </Box>
          ))}
        </Stack>
        <Divider sx={{ my: 2 }} />
        <Stack spacing={0.75}>
          <Typography variant="caption" color="text.secondary">
            Owner · {latest.quote.ownerEmail}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Last changed {day(v.updatedAt)} · {v.updatedByEmail}
          </Typography>
        </Stack>
      </Paper>
      {approvals}
    </Stack>
  );
}

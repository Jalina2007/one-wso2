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

import type { JSX } from "react";
import { Box, CircularProgress, Stack, Typography } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useAuditEvents } from "@features/sales/cado2/quotes/api/useQuoteApi";
import { describeEvent, groupHistory } from "@features/sales/cado2/quotes/lifecycle/lifecycle";

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

/** History tab: the audit events as a timeline, newest first. */
export default function HistoryTab({ quoteId }: { quoteId: number }): JSX.Element {
  const { data, error, isPending, isFetching, refetch } = useAuditEvents(quoteId);
  if (isPending) return <CircularProgress size={24} aria-label="Loading the history" />;
  if (error) {
    return (
      <ErrorNotice error={error} onRetry={() => void refetch()} retrying={isFetching}>
        Couldn&apos;t load the history.
      </ErrorNotice>
    );
  }
  const entries = groupHistory(data).reverse();
  return (
    <Stack component="ol" aria-label="History" spacing={0} sx={{ listStyle: "none", m: 0, p: 0 }}>
      {entries.map((entry, i) => (
        <Box
          component="li"
          key={entry.event.id}
          sx={{
            position: "relative",
            pl: 3,
            pb: i === entries.length - 1 ? 0 : 2,
            borderLeft: i === entries.length - 1 ? "2px solid transparent" : "2px solid",
            borderColor: "divider",
            ml: 0.75,
            "&::before": {
              content: '""',
              position: "absolute",
              left: -7,
              top: 4,
              width: 12,
              height: 12,
              borderRadius: "50%",
              bgcolor: "primary.main",
            },
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {when(entry.event.occurredAt)} · {entry.event.actorEmail}
          </Typography>
          <Typography variant="body2">{describeEvent(entry)}</Typography>
          {entry.event.comment ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
              “{entry.event.comment}”
            </Typography>
          ) : null}
        </Box>
      ))}
    </Stack>
  );
}

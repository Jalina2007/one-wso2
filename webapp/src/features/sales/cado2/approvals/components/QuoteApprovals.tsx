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
import { Alert, Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from "@wso2/oxygen-ui";
import { ShieldCheckIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import type { ApprovalPreview, ApprovalWorkflow } from "@features/sales/cado2/approvals/api/approvalTypes";
import { WORKFLOW_STATUS } from "@features/sales/cado2/approvals/model/approvalText";
import LazyApprovalDiagram from "./LazyApprovalDiagram";
import ApprovalPreviewPanel from "./ApprovalPreviewPanel";

interface QuoteApprovalsProps {
  /** A draft shows what it would need; a submitted version its workflow. */
  readonly isDraft: boolean;
  readonly workflow: { data: ApprovalWorkflow | null | undefined; isPending: boolean; error: Error | null; refetch: () => void };
  readonly preview: { data: ApprovalPreview | undefined; isPending: boolean; isFetching: boolean; error: Error | null };
}

/** The quote page's Approvals tab. */
export default function QuoteApprovals({ isDraft, workflow, preview }: QuoteApprovalsProps): JSX.Element {
  if (isDraft) {
    return (
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <ApprovalPreviewPanel preview={preview.data} loading={preview.isFetching} error={preview.error} />
      </Paper>
    );
  }
  if (workflow.isPending) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
        <CircularProgress aria-label="Loading the approvals" />
      </Box>
    );
  }
  if (workflow.error) {
    return (
      <ErrorNotice error={workflow.error} onRetry={workflow.refetch}>
        Couldn&apos;t load the approvals.
      </ErrorNotice>
    );
  }
  const wf = workflow.data;
  if (!wf) {
    return <Alert severity="info">This version was submitted before approvals were tracked in CadO2.</Alert>;
  }
  const status = WORKFLOW_STATUS[wf.status];
  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <ShieldCheckIcon size={18} />
        <Typography variant="subtitle1" sx={{ fontWeight: 600, flexGrow: 1 }}>
          Approvals
        </Typography>
        <Chip size="small" color={status.color} label={status.label} />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Worked out from this exact version when it was submitted. Deal Desk goes first; the discount and commercial
        approvals then run in parallel. Click a role to see why it is needed.
      </Typography>
      <LazyApprovalDiagram steps={wf.steps} />
    </Paper>
  );
}

/** The status panel's short version: where the approval stands. */
export function ApprovalSummary({
  isDraft,
  workflow,
  preview,
  onOpen,
}: QuoteApprovalsProps & { onOpen: () => void }): JSX.Element | null {
  const wf = workflow.data;
  let line: string | null = null;
  let chip: { label: string; color: "default" | "primary" | "success" | "warning" | "error" | "info" } | null = null;
  if (isDraft) {
    const steps = preview.data?.steps ?? [];
    if (preview.data?.blockers.length) line = "Can't be submitted until the approval blockers are fixed.";
    else if (steps.length) line = `Needs ${steps.length} approval${steps.length === 1 ? "" : "s"}: ${steps.map((s) => s.roleLabel).join(", ")}.`;
  } else if (wf) {
    chip = WORKFLOW_STATUS[wf.status];
    const waiting = wf.steps.filter((s) => s.status === "PENDING");
    const done = wf.steps.filter((s) => s.status === "APPROVED").length;
    line =
      wf.status === "IN_PROGRESS"
        ? `Waiting on ${waiting.map((s) => s.roleLabel).join(" and ")} · ${done} of ${wf.steps.length} approved`
        : `${done} of ${wf.steps.length} approved`;
  }
  if (!line && !chip) return null;
  return (
    <Paper component="section" variant="outlined" sx={{ p: 2.5, borderRadius: 2 }} aria-label="Approval summary">
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <ShieldCheckIcon size={16} />
        <Typography variant="subtitle1" sx={{ fontWeight: 600, flexGrow: 1 }}>
          Approvals
        </Typography>
        {chip ? <Chip size="small" color={chip.color} label={chip.label} /> : null}
      </Stack>
      {line ? (
        <Typography variant="body2" sx={{ mb: 1 }}>
          {line}
        </Typography>
      ) : null}
      <Button size="small" onClick={onOpen}>
        See who approves and why
      </Button>
    </Paper>
  );
}

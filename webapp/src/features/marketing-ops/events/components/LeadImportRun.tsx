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

import { useMemo, useState, type ReactNode } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import { Check, ChevronDown, Download, RefreshCw } from "@wso2/oxygen-ui-icons-react";
import {
  leadImportError,
  useApplyLeadChanges,
  useDownloadLeadFile,
  useFinishLeadImport,
  useLeadImportOptions,
  useLeadImportRebuilding,
  useLeadImportRun,
  useLeadImportSheet,
} from "../../api/useLeadImport";
import type {
  LeadImportDetail,
  LeadImportFileKind,
  LeadImportResult,
  LeadImportRun as Run,
  UserEdit,
} from "../leadImportTypes";
import { fieldLabel, runTitle, tabsLine, timeLeft, userEditAsChange } from "../lib/leadImport";
import { ConfirmDialog, EventsLoading, Panel, WorkspaceHead } from "./EventsUi";
import { RunStatus } from "./LeadImport";
import { AllChanges, PendingChanges } from "./LeadImportChanges";
import LeadSheet from "./LeadSheet";
import { primaryBtn, quietBtn } from "./eventsStyles";

// One conversion: a static note while the server works, then the review. The page does
// not poll: the server emails the uploader when the run is ready, and the email links here.
//
// The review LEADS WITH THE SHEET: the converted List Import Template itself, read back
// from the workbook file, so what a person checks and fixes is exactly what downloads.
// Claude's changes are highlighted in their cells; the ones code decided need a person
// (removing a lead, changing an email, uncertain routing, low confidence) wait, amber,
// until confirmed. A person's own cell and Data tab edits are saved on the server as
// they're made — the workbook is rebuilt from the saved plan (seconds, no Claude call)
// and every edit is listed and undoable like a change.
//
// The workbook is downloadable from the moment the run is ready. Finish ends editing,
// deletes the upload, and downloads the workbook.

export default function LeadImportRun({ id, onBack }: { id: string; onBack: () => void }) {
  const query = useLeadImportRun(id);
  const detail = query.data;

  if (query.isError) {
    return (
      <Box>
        <WorkspaceHead title="Conversion" onBack={onBack} backLabel="All conversions" />
        <Alert severity="error">{leadImportError(query.error)}</Alert>
      </Box>
    );
  }
  if (!detail) return <EventsLoading messages={["Opening the conversion…"]} />;

  const { run } = detail;
  return (
    <Box>
      <Head run={run} workbook={detail.result?.files.workbook ?? null} onBack={onBack} />
      <Steps run={run} />
      {run.status === "processing" ? (
        <Converting onRefresh={() => void query.refetch()} refreshing={query.isFetching} />
      ) : run.status === "failed" ? (
        <Alert severity="error" sx={{ fontSize: 13 }}>
          {run.error ?? "The file could not be converted."} The upload has been deleted.
        </Alert>
      ) : detail.result ? (
        <Review detail={detail} result={detail.result} />
      ) : null}
    </Box>
  );
}

// ---- head: finish & download ------------------------------------------------------------

function Head({ run, workbook, onBack }: { run: Run; workbook: string | null; onBack: () => void }) {
  const finish = useFinishLeadImport();
  const download = useDownloadLeadFile();
  const hours = useLeadImportOptions().data?.finished_retention_hours ?? 2;
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function done() {
    setError(null);
    try {
      await finish.mutateAsync(run.id);
      setAsking(false);
      if (workbook) await download.mutateAsync({ id: run.id, kind: "workbook", filename: workbook });
    } catch (e) {
      setAsking(false);
      setError(leadImportError(e));
    }
  }

  return (
    <>
      <WorkspaceHead
        title={runTitle(run)}
        caption={`${run.source_name} · uploaded ${new Date(run.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`}
        onBack={onBack}
        backLabel="All conversions"
        status={<RunStatus run={run} />}
      >
        {run.status === "ready" && !run.finished_at && (
          <Button
            variant="contained"
            sx={primaryBtn}
            startIcon={<Download size={15} />}
            onClick={() => setAsking(true)}
          >
            Finish & download
          </Button>
        )}
      </WorkspaceHead>
      {error && (
        <Alert severity="error" sx={{ mb: 1.5, fontSize: 13 }}>
          {error}
        </Alert>
      )}
      <ConfirmDialog
        open={asking}
        title="Finish and download the workbook?"
        body={
          <>
            The workbook downloads as the sheet shows it. The uploaded file is deleted now, so
            nothing can be edited, confirmed or undone after this.
            {run.pending_count
              ? ` ${run.pending_count} change${run.pending_count === 1 ? "" : "s"} still waiting for you will stay unapplied.`
              : ""}{" "}
            The downloads stay available for {hours} hours.
          </>
        }
        confirmLabel="Finish & download"
        busy={finish.isPending || download.isPending}
        onConfirm={() => void done()}
        onCancel={() => setAsking(false)}
      />
    </>
  );
}

// ---- where the run is: upload -> convert -> review -> finish ------------------------------

const STEPS = ["Upload", "Convert", "Review the sheet", "Finish & download"];

function Steps({ run }: { run: Run }) {
  if (run.status === "failed") return null;
  const current = run.status === "processing" ? 1 : run.finished_at ? 4 : 2;
  return (
    <Box component="ol" sx={{ display: "flex", gap: 2.5, flexWrap: "wrap", listStyle: "none", p: 0, m: 0, mb: 2 }}>
      {STEPS.map((label, i) => {
        const state = i < current ? "done" : i === current ? "now" : "next";
        return (
          <Box
            component="li"
            key={label}
            aria-current={state === "now" ? "step" : undefined}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              fontSize: 12.5,
              fontWeight: state === "now" ? 700 : 500,
              color: state === "next" ? "text.disabled" : state === "now" ? "primary.main" : "text.secondary",
            }}
          >
            <Box
              sx={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                fontSize: 10.5,
                fontWeight: 700,
                border: 1,
                borderColor: "currentColor",
                ...(state === "done" ? { bgcolor: "success.main", borderColor: "success.main", color: "#fff" } : {}),
              }}
            >
              {state === "done" ? <Check size={11} /> : i + 1}
            </Box>
            {label}
          </Box>
        );
      })}
    </Box>
  );
}

// ---- converting -------------------------------------------------------------------------

function Converting({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  return (
    <Panel sx={{ p: 4, textAlign: "center" }}>
      <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
        Still converting. An email will be sent when it's ready.
      </Typography>
      <Typography sx={{ fontSize: 12.5, color: "text.secondary", mt: 0.5 }}>
        Most files take 30 seconds to 2 minutes. The email links back to this conversion.
      </Typography>
      <Button
        size="small"
        onClick={onRefresh}
        disabled={refreshing}
        startIcon={<RefreshCw size={14} />}
        sx={{ mt: 2, fontSize: 12 }}
      >
        Refresh
      </Button>
    </Panel>
  );
}

// ---- review ---------------------------------------------------------------------------

const NO_EDITS: UserEdit[] = [];

function Review({ detail, result }: { detail: LeadImportDetail; result: LeadImportResult }) {
  const { run } = detail;
  const apply = useApplyLeadChanges();
  const sheet = useLeadImportSheet(run.id, true);
  const rebuilding = useLeadImportRebuilding();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, which: "confirm" | "undo") {
    setError(null);
    setBusyId(id);
    try {
      await apply.mutateAsync({
        id: run.id,
        confirm: which === "confirm" ? [id] : [],
        undo: which === "undo" ? [id] : [],
      });
    } catch (e) {
      setError(leadImportError(e));
    } finally {
      setBusyId(null);
    }
  }
  const onAct = (id: string, which: "confirm" | "undo") => void act(id, which);

  // A person's edits are listed with Claude's changes, so one list holds everything that
  // differs from the conversion, each with its own undo.
  const userEdits = detail.user_edits ?? NO_EDITS;
  const everything = useMemo(
    () => [...detail.changes, ...userEdits.map(userEditAsChange)],
    [detail.changes, userEdits],
  );
  // One rebuild at a time: no change action while a cell edit or another action saves.
  const editable = run.can_edit && !rebuilding;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Notices run={run} result={result} />
      {error && (
        <Alert severity="error" sx={{ fontSize: 13 }}>
          {error}
        </Alert>
      )}

      <Outcome run={run} result={result} />

      {sheet.isError ? (
        <Alert severity="error" sx={{ fontSize: 13 }}>
          Could not load the sheet. {leadImportError(sheet.error)} The downloads above still work.
        </Alert>
      ) : !sheet.data ? (
        <EventsLoading messages={["Opening the workbook…"]} />
      ) : (
        <>
          <LeadSheet
            runId={run.id}
            tabs={sheet.data.tabs}
            changes={detail.changes}
            userEdits={userEdits}
            editable={run.can_edit}
            busyId={busyId}
            onAct={onAct}
          />
        </>
      )}

      <PendingChanges changes={detail.changes} editable={editable} busyId={busyId} onAct={onAct} />
      {everything.length > 0 && (
        <AllChanges changes={everything} editable={editable} busyId={busyId} onAct={onAct} />
      )}

      <Details result={result} />
    </Box>
  );
}

function Notices({ run, result }: { run: Run; result: LeadImportResult }) {
  return (
    <>
      {!result.counts.reconciles && (
        <Alert severity="error" sx={{ fontSize: 13 }}>
          The row counts don't add up: {result.counts.rows_read} rows read, but{" "}
          {result.counts.leads_written} written + {result.counts.duplicates_merged} merged +{" "}
          {result.counts.rows_rejected} rejected. Don't import this workbook; send the file to the
          Marketing Ops team.
        </Alert>
      )}
      {run.finished_at && (
        <Alert severity="success" sx={{ fontSize: 13 }}>
          Finished. The upload is deleted; the downloads stay available for{" "}
          {timeLeft(run.expires_at).replace(" left", "")}.
        </Alert>
      )}
      {!run.finished_at && Boolean(run.pending_count) && (
        <Alert severity="warning" sx={{ fontSize: 13 }}>
          {run.pending_count} change{run.pending_count === 1 ? "" : "s"} wait
          {run.pending_count === 1 ? "s" : ""} for you — the amber cells in the sheet, also listed
          under it. Nothing is applied until you say so.
        </Alert>
      )}
    </>
  );
}

const DOWNLOADS: { kind: LeadImportFileKind; label: string }[] = [
  { kind: "workbook", label: "List Import Template" },
  { kind: "rejects", label: "Rejects" },
  { kind: "warnings", label: "Warnings" },
  { kind: "changes", label: "Changes" },
];

/** The numbers in one band, and the downloads. Deliberately compact: the sheet is the page. */
function Outcome({ run, result }: { run: Run; result: LeadImportResult }) {
  const download = useDownloadLeadFile();
  const [error, setError] = useState<string | null>(null);
  const c = result.counts;

  async function save(kind: LeadImportFileKind) {
    const filename = result.files[kind];
    if (!filename) return;
    setError(null);
    try {
      await download.mutateAsync({ id: run.id, kind, filename });
    } catch (e) {
      setError(leadImportError(e));
    }
  }

  return (
    <Panel sx={{ px: 2.5, py: 1.75 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}>
        <Stat label="Rows read" n={c.rows_read} />
        <Stat label="Leads written" n={c.leads_written} />
        <Stat label="Duplicates merged" n={c.duplicates_merged} />
        <Stat label="Rejected" n={c.rows_rejected} hint={c.rows_removed ? `${c.rows_removed} removed by you or Claude` : undefined} />
        <Stat label="Warnings" n={result.fill?.warnings_count ?? 0} />
        <Box sx={{ flex: 1 }} />
        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
          {DOWNLOADS.filter((d) => result.files[d.kind]).map((d) => (
            <Button
              key={d.kind}
              // Before Finish the head's "Finish & download" is the one filled button.
              variant={d.kind === "workbook" && run.finished_at ? "contained" : "text"}
              sx={d.kind === "workbook" && run.finished_at ? primaryBtn : quietBtn}
              startIcon={<Download size={15} />}
              disabled={download.isPending}
              onClick={() => void save(d.kind)}
            >
              {d.label}
            </Button>
          ))}
        </Box>
      </Box>
      <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 1 }}>
        {result.summary?.text ? `${result.summary.text}. ` : ""}
        {tabsLine(result.rows_per_tab) || "No leads written"}
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mt: 1.5, fontSize: 13 }}>
          {error}
        </Alert>
      )}
    </Panel>
  );
}

function Stat({ label, n, hint }: { label: string; n: number; hint?: string }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
        {n.toLocaleString()}
      </Typography>
      <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>{label}</Typography>
      {hint && <Typography sx={{ fontSize: 10.5, color: "text.disabled" }}>{hint}</Typography>}
    </Box>
  );
}

// ---- details (collapsed) ------------------------------------------------------------------

function Details({ result }: { result: LeadImportResult }) {
  const notes = [
    ...(result.fill?.file_warnings ?? []),
    ...result.warnings,
    ...(result.problems ?? []),
  ];
  const rejectReasons = Object.entries(result.fill?.reject_reasons ?? {});

  return (
    <Box>
      <Fold title={`How the file was read (${result.sections.length} section${result.sections.length === 1 ? "" : "s"})`}>
        {result.sections.map((s) => (
          <Box key={`${s.sheet}-${s.title}`} sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>
              {s.title} → {s.tab}
              {s.tab_confidence ? ` (${s.tab_confidence} confidence)` : ""}
            </Typography>
            <Typography sx={{ fontSize: 11.5, color: "text.secondary", mb: 0.75 }}>
              {s.sheet ? `Sheet ${s.sheet}` : ""}
              {s.header_row ? `, header on row ${s.header_row}` : ""}
              {s.rows != null ? `, ${s.rows} rows` : ""}
              {s.tab_reason ? ` — ${s.tab_reason}` : ""}
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>Column in the file</TableCell>
                  <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>Template field</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {s.mapping.map((m) => (
                  <TableRow key={`${m.column}-${m.field}`}>
                    <TableCell sx={{ fontSize: 12 }}>{m.column}</TableCell>
                    <TableCell sx={{ fontSize: 12, color: m.field && m.field !== "ignore" ? "text.primary" : "text.disabled" }}>
                      {m.field && m.field !== "ignore" ? fieldLabel(m.field) : "Not imported"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ))}
      </Fold>
      {(notes.length > 0 || rejectReasons.length > 0) && (
        <Fold title="Notes and reject reasons">
          {rejectReasons.length > 0 && (
            <Typography sx={{ fontSize: 12.5, mb: 1 }}>
              Rejected: {rejectReasons.map(([reason, n]) => `${reason} (${n})`).join(" · ")}
            </Typography>
          )}
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {notes.map((n, i) => (
              <Typography component="li" key={i} sx={{ fontSize: 12.5, color: "text.secondary" }}>
                {n}
              </Typography>
            ))}
          </Box>
        </Fold>
      )}
    </Box>
  );
}

function Fold({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Accordion disableGutters elevation={0} sx={{ border: 1, borderColor: "divider", "& + &": { borderTop: 0 } }}>
      <AccordionSummary expandIcon={<ChevronDown size={16} />}>
        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{title}</Typography>
      </AccordionSummary>
      <AccordionDetails>{children}</AccordionDetails>
    </Accordion>
  );
}


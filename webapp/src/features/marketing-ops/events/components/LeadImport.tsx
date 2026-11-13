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

import { useRef, useState, type DragEvent } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { Download, FileSpreadsheet, RefreshCw, Trash2, Upload } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import {
  leadImportError,
  useDeleteLeadImport,
  useDownloadLeadFile,
  useLeadImportOptions,
  useLeadImportRuns,
  useUploadLeadFile,
} from "../../api/useLeadImport";
import type { LeadImportRun } from "../leadImportTypes";
import {
  runTitle,
  SHEET_TYPES,
  sheetNameWarning,
  tabsLine,
  timeLeft,
  type SheetType,
} from "../lib/leadImport";
import { ConfirmDialog, Empty, EventsLoading, Panel, Timestamp } from "./EventsUi";
import { primaryBtn } from "./eventsStyles";

// Lead import — the landing screen: drop a raw event lead file, and the list of
// everything you converted recently.
//
// The file and its sheet type are the only decisions asked for up front. The type is
// checked against the file name ("<Event name> - Booth") so a misnamed or mixed-up file
// is caught before it converts; the warning never blocks the upload. The type is sent
// with the file and reaches Claude as a routing hint.
// Everything else — layout, mapping, routing — is worked out on the server, and the
// handful of calls that need a person are asked AFTER, on the run's own screen.
//
// The conversion takes a minute or two, so the upload does not wait for it: the page stays
// here and says that an email will come when the file is ready. Nothing polls. The email
// links to the run, and Refresh updates the list for anyone who waits on the page.

export default function LeadImport({ onOpen }: { onOpen: (id: string) => void }) {
  const options = useLeadImportOptions();
  const runs = useLeadImportRuns();
  const upload = useUploadLeadFile();

  const [sheetType, setSheetType] = useState<SheetType | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // The server refuses uploads without a configured conversion; say so, and don't offer one.
  const unavailable = options.data !== undefined && !options.data.claude_configured;
  const accepted = options.data?.accepted ?? [".xlsx", ".xls", ".csv"];
  const maxBytes = options.data?.max_bytes ?? 10 * 1024 * 1024;
  const hours = options.data?.retention_hours ?? 24;
  const finishedHours = options.data?.finished_retention_hours ?? 2;

  // Refuse here what the server would refuse, so the user isn't made to wait on an
  // upload to learn the file was a PDF. The server checks again regardless.
  function pick(candidate: File | undefined) {
    setError(null);
    setStarted(null);
    if (!candidate) return;
    const ext = candidate.name.slice(candidate.name.lastIndexOf(".")).toLowerCase();
    if (!accepted.includes(ext)) {
      setError("Upload an .xlsx, .xls or .csv file. PDFs and scanned images can't be converted.");
      return;
    }
    if (candidate.size > maxBytes) {
      setError(`The file is over ${Math.round(maxBytes / (1024 * 1024))} MB.`);
      return;
    }
    setFile(candidate);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files?.[0]);
  }

  async function convert() {
    if (!file || !sheetType) return;
    setError(null);
    try {
      await upload.mutateAsync({ file, sheetType });
      setStarted(file.name);
      setFile(null);
      setSheetType("");
    } catch (e) {
      setError(leadImportError(e));
    }
  }

  const rows = runs.data ?? [];
  const nameWarning = file && sheetType ? sheetNameWarning(file.name, sheetType) : null;

  return (
    <Box>
      <Panel sx={{ p: 2.5, mb: 3 }}>
        {unavailable && (
          <Alert severity="warning" sx={{ mb: 2, fontSize: 13 }}>
            Lead import isn't available on this server because Claude isn't configured. Ask the
            Marketing Ops team.
          </Alert>
        )}

        <Box
          role="button"
          tabIndex={0}
          aria-label="Choose a lead file"
          onClick={() => input.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          sx={{
            border: 1.5,
            borderStyle: "dashed",
            borderColor: dragging ? "primary.main" : "divider",
            bgcolor: dragging ? "action.hover" : "transparent",
            borderRadius: 1.25,
            py: 4,
            px: 2,
            textAlign: "center",
            cursor: "pointer",
            transition: "all .12s",
            "&:hover, &:focus-visible": { borderColor: "primary.main", outline: "none" },
          }}
        >
          <input
            ref={input}
            type="file"
            hidden
            accept={accepted.join(",")}
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {file ? (
            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
              <FileSpreadsheet size={20} />
              <Box sx={{ textAlign: "left" }}>
                <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{file.name}</Typography>
                <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                  {(file.size / 1024).toFixed(0)} KB · click to choose a different file
                </Typography>
              </Box>
            </Box>
          ) : (
            <>
              <Upload size={22} />
              <Typography sx={{ fontSize: 14, fontWeight: 700, mt: 1 }}>
                Drop the raw lead file here, or click to choose it
              </Typography>
              <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.5 }}>
                Badge scans, booth captures, delegate lists, webinar reports — any layout, any
                language. .xlsx, .xls or .csv, up to {Math.round(maxBytes / (1024 * 1024))} MB.
              </Typography>
            </>
          )}
        </Box>

        <Box
          sx={{
            display: "flex",
            alignItems: "flex-end",
            gap: 2,
            mt: 2,
            flexWrap: "wrap",
          }}
        >
          <Select
            size="small"
            displayEmpty
            value={sheetType}
            onChange={(e) => setSheetType(e.target.value as SheetType)}
            inputProps={{ "aria-label": "Sheet type" }}
            sx={{ minWidth: 220, fontSize: 13 }}
          >
            <MenuItem value="" disabled sx={{ fontSize: 13 }}>
              Choose the sheet type
            </MenuItem>
            {SHEET_TYPES.map((t) => (
              <MenuItem key={t.value} value={t.value} sx={{ fontSize: 13 }}>
                {t.label}
              </MenuItem>
            ))}
          </Select>
          <Box sx={{ flex: 1 }} />
          <Button
            variant="contained"
            sx={primaryBtn}
            disabled={unavailable || !file || !sheetType || upload.isPending}
            onClick={() => void convert()}
            startIcon={upload.isPending ? <CircularProgress size={15} color="inherit" /> : undefined}
          >
            {upload.isPending ? "Uploading…" : "Convert to List Import Template"}
          </Button>
        </Box>

        {nameWarning && (
          <Alert severity="warning" sx={{ mt: 2, fontSize: 13 }}>
            {nameWarning}
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2, fontSize: 13 }}>
            {error}
          </Alert>
        )}

        {started && (
          <Alert severity="info" sx={{ mt: 2, fontSize: 13 }} onClose={() => setStarted(null)}>
            Converting <strong>{started}</strong>. An email will be sent when it's ready.
          </Alert>
        )}
      </Panel>

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Recently converted</Typography>
        <Button
          size="small"
          onClick={() => void runs.refetch()}
          disabled={runs.isFetching}
          startIcon={<RefreshCw size={14} />}
          sx={{ fontSize: 12 }}
        >
          Refresh
        </Button>
      </Box>
      {runs.isError ? (
        <Alert severity="error">Could not load recent conversions. {describeError(runs.error)}</Alert>
      ) : runs.isLoading ? (
        <EventsLoading messages={["Loading recent conversions…"]} />
      ) : rows.length === 0 ? (
        <Empty>
          Nothing converted in the last {hours} hours.
          <Box sx={{ mt: 0.5 }}>
            Converted files stay here for {hours} hours, or for {finishedHours} hours after you finish
            with them. Then they're deleted.
          </Box>
        </Empty>
      ) : (
        <RecentTable rows={rows} onOpen={onOpen} />
      )}
    </Box>
  );
}

function RecentTable({ rows, onOpen }: { rows: LeadImportRun[]; onOpen: (id: string) => void }) {
  const download = useDownloadLeadFile();
  const remove = useDeleteLeadImport();
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<LeadImportRun | null>(null);

  async function save(run: LeadImportRun) {
    const name = run.files.workbook;
    if (!name) return;
    setError(null);
    try {
      await download.mutateAsync({ id: run.id, kind: "workbook", filename: name });
    } catch (e) {
      setError(leadImportError(e));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setError(null);
    try {
      await remove.mutateAsync(deleting.id);
    } catch (e) {
      setError(leadImportError(e));
    }
    setDeleting(null);
  }

  return (
    <>
      {error && (
        <Alert severity="error" sx={{ mb: 1.5, fontSize: 13 }}>
          {error}
        </Alert>
      )}
      <ConfirmDialog
        open={deleting !== null}
        title="Delete this conversion?"
        body={
          deleting && (
            <>
              <strong>{runTitle(deleting)}</strong> and all its files (the workbook, rejects,
              warnings and changes) are deleted for everyone now. This can't be undone.
            </>
          )
        }
        confirmLabel="Delete"
        tone="danger"
        busy={remove.isPending}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
      <Panel>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>Event</TableCell>
              <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>Leads per tab</TableCell>
              <TableCell align="right" sx={{ fontSize: 11, fontWeight: 700 }}>Rejected</TableCell>
              <TableCell align="right" sx={{ fontSize: 11, fontWeight: 700 }}>Warnings</TableCell>
              <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>Uploaded</TableCell>
              <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>Kept for</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell sx={{ maxWidth: 280 }}>
                  <RunName run={r} onOpen={onOpen} />
                </TableCell>
                <TableCell>
                  <RunStatus run={r} />
                </TableCell>
                <TableCell>
                  <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                    {tabsLine(r.rows_per_tab) || "—"}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Num n={r.counts?.rows_rejected} />
                </TableCell>
                <TableCell align="right">
                  <Num n={r.warnings_count} />
                </TableCell>
                <TableCell>
                  <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                    <Timestamp value={r.created_at} />
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                    {timeLeft(r.expires_at)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  {r.files.workbook && (
                    <Tooltip title="Download the List Import Template" arrow>
                      <IconButton
                        size="small"
                        aria-label={`Download ${runTitle(r)}`}
                        onClick={() => void save(r)}
                        sx={{ color: "text.secondary", "&:hover": { color: "primary.main" } }}
                      >
                        <Download size={15} />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip
                    title={r.status === "processing" ? "Wait until it has finished converting" : "Delete"}
                    arrow
                  >
                    {/* A span, so the tooltip still shows on a disabled button. */}
                    <span>
                      <IconButton
                        size="small"
                        aria-label={`Delete ${runTitle(r)}`}
                        disabled={r.status === "processing"}
                        onClick={() => setDeleting(r)}
                        sx={{ color: "text.secondary", "&:hover": { color: "error.main" } }}
                      >
                        <Trash2 size={15} />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </>
  );
}

/** The name of a run. It opens the run, except while the file converts: there is nothing
 *  to open yet, and the email says when there is. */
function RunName({ run, onOpen }: { run: LeadImportRun; onOpen: (id: string) => void }) {
  if (run.status === "processing") {
    return (
      <Box>
        <Typography noWrap sx={{ fontSize: 13, fontWeight: 600 }}>
          {runTitle(run)}
        </Typography>
        <Typography noWrap sx={{ fontSize: 11, color: "text.secondary" }}>
          Converting. An email will be sent when it's ready.
        </Typography>
      </Box>
    );
  }
  return (
    <Box
      component="button"
      type="button"
      onClick={() => onOpen(run.id)}
      sx={{
        border: 0,
        p: 0,
        bgcolor: "transparent",
        textAlign: "left",
        cursor: "pointer",
        fontFamily: "inherit",
        maxWidth: "100%",
      }}
    >
      <Typography noWrap sx={{ fontSize: 13, fontWeight: 600 }}>
        {runTitle(run)}
      </Typography>
      {run.event_name && (
        <Typography noWrap sx={{ fontSize: 11, color: "text.secondary" }}>
          {run.source_name}
        </Typography>
      )}
    </Box>
  );
}

function Num({ n }: { n: number | null | undefined }) {
  return (
    <Typography sx={{ fontSize: 11.5, color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>
      {n ? n : "—"}
    </Typography>
  );
}

/** Where a run stands, in the words a person would use. */
export function RunStatus({ run }: { run: LeadImportRun }) {
  const [label, color] =
    run.status === "processing"
      ? ["Converting", "info.main"]
      : run.status === "failed"
        ? ["Failed", "error.main"]
        : run.finished_at
          ? ["Finished", "success.main"]
          : run.pending_count
            ? [`${run.pending_count} to confirm`, "warning.main"]
            : ["Ready", "success.main"];
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
      <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: color, flexShrink: 0 }} />
      <Typography component="span" sx={{ fontSize: 12, fontWeight: 600, color }}>
        {label}
      </Typography>
    </Box>
  );
}

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
import { Alert, Box, Button, CircularProgress, MenuItem, Select, Typography } from "@wso2/oxygen-ui";
import { FileSpreadsheet, Upload, X } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { useFieldDefs, useMemberStatuses } from "../../api/useEvents";
import type { FieldDef } from "../eventsTypes";
import { checkLeadFile, LeadFileError, MAX_FILE_BYTES, readLeadFile, type RawSheet } from "../lib/leadFile";
import { EventsLoading, Panel } from "./EventsUi";
import LeadMapping from "./LeadMapping";
import { fieldHint, fieldLabel, primaryBtn, quietBtn } from "./eventsStyles";

// Lead import: a raw event lead file in, a workbook with one member status's columns out.
//
// Two decisions up front, in the order they matter: which member status the leads are
// (it decides the columns), then the file. The file is read here, in the browser;
// nothing is uploaded. The mapping screen then shows which column went where, and the
// person downloads the workbook, edits it if needed, and uploads it to My Submissions.
//
// Leaving the page drops the work. Mapping a file again takes seconds.

const ACCEPT = ".xlsx,.xlsm,.csv";
const COLUMNS_SHOWN = 8;

const STEPS = [
  {
    title: "Map the columns",
    body: "Pick the lead type and the raw file. Matching headings are mapped, and Claude suggests the rest.",
  },
  { title: "Download and edit", body: "Check the mapping, download the workbook, and make any changes to the data." },
  { title: "Submit", body: "Upload the workbook in My Submissions, which checks every row before review." },
];

interface Opened {
  fileName: string;
  sheets: RawSheet[];
  status: string;
}

export default function LeadImport() {
  const statuses = useMemberStatuses();
  const fields = useFieldDefs();
  const [status, setStatus] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<Opened | null>(null);
  const input = useRef<HTMLInputElement>(null);

  if (opened && fields.data) {
    return (
      <LeadMapping
        fileName={opened.fileName}
        sheets={opened.sheets}
        status={opened.status}
        defs={fields.data[opened.status] ?? []}
        onStartOver={() => {
          setOpened(null);
          setFile(null);
        }}
      />
    );
  }

  // The checks that need no reading (type, size) run on pick, so a PDF is refused before
  // anyone presses a button.
  function pick(candidate: File | undefined) {
    setError(null);
    if (!candidate) return;
    try {
      checkLeadFile(candidate);
      setFile(candidate);
    } catch (e) {
      setFile(null);
      setError(e instanceof LeadFileError ? e.message : describeError(e));
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files?.[0]);
  }

  async function open() {
    if (!file || !status) return;
    setError(null);
    setReading(true);
    try {
      setOpened({ fileName: file.name, sheets: await readLeadFile(file), status });
    } catch (e) {
      setError(e instanceof LeadFileError ? e.message : `The file could not be read. ${describeError(e)}`);
    } finally {
      setReading(false);
    }
  }

  if (statuses.isError || fields.isError) {
    return (
      <Alert severity="error" sx={{ fontSize: 13 }}>
        Could not load the lead types and their columns. {describeError(statuses.error ?? fields.error)}
      </Alert>
    );
  }
  if (!statuses.data || !fields.data) {
    return <EventsLoading messages={["Loading the lead types…"]} />;
  }
  const live = statuses.data.filter((s) => s.enabled);
  const columns = status ? (fields.data[status] ?? []) : [];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Steps />

      <Panel sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 2.5 }}>
        {live.length === 0 && (
          <Alert severity="warning" sx={{ fontSize: 13 }}>
            No lead types are in use, so there are no columns to map to. An admin sets them under Marketing Admin →
            Events Statuses &amp; Columns.
          </Alert>
        )}

        <Box>
          <Typography sx={fieldLabel}>1 · Which leads are these?</Typography>
          <Select
            size="small"
            displayEmpty
            value={status}
            onChange={(e) => setStatus(e.target.value as string)}
            inputProps={{ "aria-label": "Lead type" }}
            sx={{ minWidth: 280, fontSize: 13 }}
          >
            <MenuItem value="" disabled sx={{ fontSize: 13 }}>
              Choose a lead type
            </MenuItem>
            {live.map((s) => (
              <MenuItem key={s.name} value={s.name} sx={{ fontSize: 13 }}>
                {s.name}
              </MenuItem>
            ))}
          </Select>
          {status ? (
            <ColumnsHint columns={columns} />
          ) : (
            <Typography sx={fieldHint}>It decides which template columns the file is mapped to.</Typography>
          )}
        </Box>

        <Box>
          <Typography sx={fieldLabel}>2 · The raw lead file</Typography>
          <Box
            role="button"
            tabIndex={0}
            aria-label="Choose a lead file"
            onClick={() => input.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                input.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            sx={{
              border: 1.5,
              borderStyle: file ? "solid" : "dashed",
              borderColor: dragging ? "primary.main" : "divider",
              bgcolor: dragging ? "action.hover" : "transparent",
              borderRadius: 1.25,
              py: file ? 2 : 4,
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
              accept={ACCEPT}
              onChange={(e) => {
                pick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {file ? (
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1.25 }}>
                <FileSpreadsheet size={20} />
                <Box sx={{ textAlign: "left" }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{file.name}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                    {(file.size / 1024).toFixed(0)} KB · click or drop to choose a different file
                  </Typography>
                </Box>
                <Button
                  aria-label="Remove the file"
                  sx={{ ...quietBtn, minWidth: 0, p: 0.5 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                >
                  <X size={16} />
                </Button>
              </Box>
            ) : (
              <>
                <Box sx={{ color: "text.secondary" }}>
                  <Upload size={22} />
                </Box>
                <Typography sx={{ fontSize: 14, fontWeight: 700, mt: 1 }}>
                  Drop the raw lead file here, or click to choose it
                </Typography>
                <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.5 }}>
                  Badge scans, booth captures, delegate lists, webinar reports, in any layout or language. .xlsx or
                  .csv, up to {MAX_FILE_BYTES / (1024 * 1024)} MB.
                </Typography>
              </>
            )}
          </Box>
          <Typography sx={fieldHint}>The file is read in your browser and isn't uploaded.</Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ fontSize: 13 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            variant="contained"
            sx={primaryBtn}
            disabled={!file || !status || reading}
            onClick={() => void open()}
            startIcon={reading ? <CircularProgress size={15} color="inherit" /> : undefined}
          >
            {reading ? "Reading the file…" : "Map columns"}
          </Button>
        </Box>
      </Panel>
    </Box>
  );
}

/** The three steps from raw file to submitted list, so the person knows this is step one. */
function Steps() {
  return (
    <Box component="ol" sx={{ display: "flex", gap: 2, flexWrap: "wrap", m: 0, p: 0, listStyle: "none" }}>
      {STEPS.map((step, i) => (
        <Box component="li" key={step.title} sx={{ flex: "1 1 220px", display: "flex", gap: 1.25, minWidth: 0 }}>
          <Box
            sx={{
              flexShrink: 0,
              width: 22,
              height: 22,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              border: 1,
              borderColor: i === 0 ? "primary.main" : "divider",
              color: i === 0 ? "primary.main" : "text.secondary",
            }}
          >
            {i + 1}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: i === 0 ? "text.primary" : "text.secondary" }}>
              {step.title}
            </Typography>
            <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{step.body}</Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

/** The template columns of the chosen lead type, so the person can see what they map to. */
function ColumnsHint({ columns }: { columns: FieldDef[] }) {
  const mappable = columns.filter((c) => !c.computed);
  if (!mappable.length) {
    return (
      <Typography sx={{ ...fieldHint, color: "warning.main" }}>
        This lead type has no columns yet. An admin adds them under Marketing Admin → Events Statuses &amp; Columns.
      </Typography>
    );
  }
  const required = mappable.filter((c) => c.mandatory).length;
  const names = mappable
    .slice(0, COLUMNS_SHOWN)
    .map((c) => c.field_name)
    .join(", ");
  const more = mappable.length > COLUMNS_SHOWN ? ` and ${mappable.length - COLUMNS_SHOWN} more` : "";
  return (
    <Typography sx={{ ...fieldHint, color: "text.secondary" }}>
      {mappable.length} columns{required ? `, ${required} required` : ""}: {names}
      {more}.
    </Typography>
  );
}

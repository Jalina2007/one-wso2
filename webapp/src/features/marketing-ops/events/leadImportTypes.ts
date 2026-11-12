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

// Lead import — the shapes /api/events/lead-import returns.
//
// `result` is the conversion result JSON, with server paths reduced to file names and
// a `files` map added. Only the fields this page reads are typed; the Marketing Ops
// backend owns the full shape.

export type LeadImportStatus = "processing" | "ready" | "failed";
export type LeadImportFileKind = "workbook" | "rejects" | "warnings" | "changes";
export type Confidence = "high" | "medium" | "low";

export interface LeadImportOptions {
  claude_configured: boolean;
  max_bytes: number;
  accepted: string[];
  /** How long a ready or failed run is kept. */
  retention_hours: number;
  /** How long a run is kept after Finish. */
  finished_retention_hours: number;
}


export interface LeadImportCounts {
  rows_read: number;
  leads_written: number;
  duplicates_merged: number;
  rows_rejected: number;
  rows_removed: number;
  reconciles: boolean;
}

/** One run as the list and the run page see it (its database row plus derived flags). */
export interface LeadImportRun {
  id: string;
  status: LeadImportStatus;
  source_name: string;
  event_name: string | null;
  created_at: string;
  ready_at: string | null;
  finished_at: string | null;
  /** Null while the file converts: the clock starts when it is ready or failed. */
  expires_at: string | null;
  counts: LeadImportCounts | null;
  rows_per_tab: Record<string, number> | null;
  pending_count: number | null;
  warnings_count: number | null;
  error: string | null;
  /** kind -> file name, or null when this run produced no such file. */
  files: Record<LeadImportFileKind, string | null>;
  /** Confirm/undo is possible: a Claude run, ready, not finished, upload still held. */
  can_edit: boolean;
}

export type ChangeStatus = "applied" | "pending" | "undone" | "dismissed";

export interface ChangeEdit {
  field: string;
  from: string | null;
  to: string | null;
}

export interface LeadChange {
  id: string;
  kind: string;
  sheet: string | null;
  row: number | null;
  section: string | null;
  edits: ChangeEdit[];
  reason: string | null;
  confidence: Confidence | null;
  evidence: { type: string | null; value: string | null } | null;
  critical: boolean;
  critical_why: string | null;
  pending_why: string | null;
  status: ChangeStatus;
}

export interface LeadImportSection {
  title: string;
  sheet: string | null;
  header_row: number | null;
  rows: number | null;
  tab: string;
  tab_confidence: Confidence | null;
  tab_reason?: string | null;
  fallback_tab?: string | null;
  mapping: { column: string; field: string | null; confidence?: Confidence | null }[];
}

export interface LeadImportResult {
  status: "ready";
  counts: LeadImportCounts;
  rows_per_tab: Record<string, number>;
  summary: { by_kind: Record<string, number>; text: string; applied: number; pending: number } | null;
  pending_count?: number;
  changes_by_status?: Partial<Record<ChangeStatus, number>>;
  rejected_count?: number;
  sections: LeadImportSection[];
  data_tab?: { values: Record<string, string>; evidence: Record<string, string | null> };
  warnings: string[];
  problems?: string[];
  fill?: {
    file_warnings?: string[];
    warnings_count?: number;
    reject_reasons?: Record<string, number>;
  };
  usage?: { wall_seconds?: number };
  /** kind -> file name, or null when this run produced no such file. */
  files: Record<LeadImportFileKind, string | null>;
}

/** A cell a person edited on the page. Undone/redone by id like a change. */
export interface UserEdit {
  id: string;
  tab: string;
  email: string;
  /** Template column key ("company", "hot_lead"…). */
  column: string;
  from: string;
  to: string;
  status: "applied" | "undone";
}

export interface LeadImportDetail {
  run: LeadImportRun;
  result: LeadImportResult | null;
  changes: LeadChange[];
  user_edits: UserEdit[];
}

// ---- the sheet: the converted workbook as GET /runs/{id}/sheet reads it back ----------

/** The change or user edit that made a cell what it is (or would, if pending). */
export interface SheetMark {
  id: string;
  status: ChangeStatus;
  /** A change kind, or "user_edit". */
  kind: string;
  reason: string | null;
}

export interface SheetColumn {
  key: string;
  label: string;
  /** The template's full header text. */
  header: string;
  editable: boolean;
  /** The template's dropdown, when the column has one. */
  options: string[] | null;
  /** The template formula, for a column Excel fills in. */
  formula: string | null;
}

export interface SheetRow {
  /** The row number in the workbook. */
  row: number;
  email: string;
  /** One value per column, in column order. */
  cells: string[];
  /** Column key -> mark, only for touched cells. */
  marks?: Record<string, SheetMark>;
}

export interface SheetTab {
  name: string;
  columns: SheetColumn[];
  rows: SheetRow[];
}

export interface DataTabValue {
  label: string;
  cell: string;
  value: string;
  /** What an empty cell shows instead, e.g. "Same as Event Name". */
  placeholder: string | null;
  options: string[] | null;
}

export interface LeadSheet {
  tabs: SheetTab[];
  data_tab: DataTabValue[];
}

export interface CellEdit {
  tab: string;
  email: string;
  column: string;
  value: string;
}

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

// Lead import: the words the page uses for change kinds and fields, and small pure helpers.

import type { ChangeStatus, LeadChange, LeadImportRun, UserEdit } from "../leadImportTypes";

/** A change kind, as the list names it. An unknown kind falls back to its id in words (see `kindLabel`). */
export const KIND_LABEL: Record<string, string> = {
  split_name: "Name re-split",
  swap_fields: "Fields swapped",
  clear_filler: "Filler cleared",
  set_country: "Country filled",
  fix_casing: "Re-cased",
  fix_email: "Email corrected",
  set_hot_lead: "Hot Lead",
  set_area_of_interest: "Area of interest",
  set_assigned_am: "Assigned AM",
  route_section: "Section routing",
  route_row: "Row routing",
  remove_row: "Lead removed",
  user_edit: "Edited by you",
};

export function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind.replace(/_/g, " ");
}

const FIELD_LABEL: Record<string, string> = {
  first_name: "First name",
  last_name: "Last name",
  full_name: "Full name",
  email: "Email",
  company: "Company",
  job_title: "Job title",
  country: "Country",
  state: "State",
  city: "City",
  phone: "Phone",
  mobile: "Mobile",
  company_phone: "Company phone",
  street: "Street",
  postal_code: "Postal code",
  industry: "Industry",
  sub_industry: "Sub-industry",
  notes: "Notes",
  optin_status: "Opt-in status",
  hot_lead: "Hot Lead",
  area_of_interest: "Area of interest",
  assigned_am: "Assigned AM",
  assigned_am_out: "Assigned AM",
  tab: "Tab",
  address: "Address",
};

export function fieldLabel(field: string): string {
  return FIELD_LABEL[field] ?? field.replace(/_/g, " ");
}

export const CHANGE_STATUS_LABEL: Record<ChangeStatus, string> = {
  applied: "Applied",
  pending: "Waiting for you",
  undone: "Undone",
  dismissed: "Dismissed",
};

/** What the user can do to a change in its current state, as one confirm/undo call. */
export function changeActions(status: ChangeStatus): { confirm?: string; undo?: string } {
  switch (status) {
    case "applied":
      return { undo: "Undo" };
    case "pending":
      return { confirm: "Apply", undo: "Dismiss" };
    case "undone":
      return { confirm: "Redo" };
    case "dismissed":
      return { confirm: "Apply" };
  }
}

/** "1 h 12 min left", "8 min left", "Expiring" — for the Recently converted list.
 *  "—" while the file converts: the clock starts when it is ready or failed. */
export function timeLeft(expiresAt: string | null, now: number = Date.now()): string {
  if (expiresAt === null) return "—";
  const ms = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 60 * 1000) return "Expiring";
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours} h ${minutes % 60} min left` : `${minutes} min left`;
}

/** The title for a run: the event name Claude found, else the file name. */
export function runTitle(run: Pick<LeadImportRun, "event_name" | "source_name">): string {
  return run.event_name?.trim() || run.source_name;
}

/** Where a change sits in the source file, for a person to find it. */
export function changeWhere(change: Pick<LeadChange, "sheet" | "row" | "section">): string {
  if (change.row != null) return `${change.sheet ? `${change.sheet}, ` : ""}row ${change.row}`;
  return change.section ?? change.sheet ?? "";
}

/** A person's cell edit in the shape of a change, so the change list can show and undo
 *  it like any other. */
export function userEditAsChange(edit: UserEdit): LeadChange {
  return {
    id: edit.id,
    kind: "user_edit",
    sheet: edit.tab,
    row: null,
    section: null,
    edits: [{ field: edit.column, from: edit.from, to: edit.to }],
    reason: edit.email,
    confidence: null,
    evidence: null,
    critical: false,
    critical_why: null,
    pending_why: null,
    status: edit.status,
  };
}

/** The kinds of lead sheet an event produces. A file is named "<Event name> - <suffix>",
 *  the suffix being the List Import Template tab its leads belong on. */
export const SHEET_TYPES = [
  { value: "booth", label: "Booth Scan", suffix: "Booth" },
  { value: "attendee", label: "Attendee", suffix: "Attendees" },
  { value: "session", label: "Session Attendee", suffix: "Session" },
  { value: "registrant", label: "Registrant", suffix: "Registrants" },
  { value: "content_syndication", label: "Content Syndication", suffix: "Content Syndication" },
] as const;

export type SheetType = (typeof SHEET_TYPES)[number]["value"];

const normalizeSuffix = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/** Why `fileName` doesn't follow "<Event name> - <suffix>" for `type`, or null when it
 *  does. Ignores the extension and a copy marker like " (1)". */
export function sheetNameWarning(fileName: string, type: SheetType): string | null {
  const expected = SHEET_TYPES.find((t) => t.value === type)!;
  const stem = fileName.replace(/\.[^.]+$/, "").replace(/\s*\(\d+\)$/, "");
  const cut = stem.lastIndexOf(" - ");
  const eventName = cut > 0 ? stem.slice(0, cut).trim() : "";
  const suffix = cut > 0 ? normalizeSuffix(stem.slice(cut + 3)) : "";
  if (suffix === normalizeSuffix(expected.suffix) && eventName) return null;

  const named = SHEET_TYPES.find((t) => normalizeSuffix(t.suffix) === suffix);
  if (named && eventName) {
    return `The file name says "${named.suffix}" (${named.label}), but you chose ${expected.label}. Check that this is the right file and sheet type.`;
  }
  return `The file name doesn't follow the naming convention "<Event name> - ${expected.suffix}". Check that this is a ${expected.label} sheet, or rename the file.`;
}

/** One line per tab, highest first: "Booth 40 · Attendees 12". */
export function tabsLine(rowsPerTab: Record<string, number> | null | undefined): string {
  return Object.entries(rowsPerTab ?? {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([tab, n]) => `${tab} ${n}`)
    .join(" · ");
}

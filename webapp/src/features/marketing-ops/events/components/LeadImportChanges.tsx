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
import { Box, Button, CircularProgress, Typography } from "@wso2/oxygen-ui";
import type { ChangeStatus, LeadChange } from "../leadImportTypes";
import { CHANGE_STATUS_LABEL, changeActions, changeWhere, fieldLabel, kindLabel } from "../lib/leadImport";
import { FilterPills, Panel } from "./EventsUi";
import { primaryBtn, quietBtn } from "./eventsStyles";

// The review lists under the sheet: what waits for a person, and every change with its
// own undo. A person's cell edits are listed here too (kind "user_edit"), so everything
// that differs from Claude's conversion can be found and taken back in one place.

const CHANGES_SHOWN = 150;

/** Confirm or undo one change or user edit, by id. */
export type ActOn = (id: string, which: "confirm" | "undo") => void;

function Section({ title, caption, children }: { title: string; caption?: string; children: ReactNode }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{title}</Typography>
      {caption && <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 1 }}>{caption}</Typography>}
      {children}
    </Box>
  );
}

/** The changes that wait for a person, each with Apply and Dismiss. Shows nothing when none wait. */
export function PendingChanges({
  changes,
  editable,
  busyId,
  onAct,
}: {
  changes: LeadChange[];
  editable: boolean;
  busyId: string | null;
  onAct: ActOn;
}) {
  const pending = changes.filter((c) => c.status === "pending");
  if (pending.length === 0) return null;
  return (
    <Section
      title={`Waiting for you (${pending.length})`}
      caption="Not applied until you say so — they're the amber cells in the sheet. The workbook downloads without them."
    >
      <Panel>
        {pending.map((c) => (
          <ChangeRow key={c.id} change={c} editable={editable} busy={busyId === c.id} onAct={onAct} showWhy />
        ))}
      </Panel>
    </Section>
  );
}

type StatusFilter = ChangeStatus | null;

/** Every change and user edit, filterable by status, each with the action its status allows. */
export function AllChanges({
  changes,
  editable,
  busyId,
  onAct,
}: {
  changes: LeadChange[];
  editable: boolean;
  busyId: string | null;
  onAct: ActOn;
}) {
  const [filter, setFilter] = useState<StatusFilter>("applied");
  const [limit, setLimit] = useState(CHANGES_SHOWN);

  const counts = useMemo(() => {
    const out: Record<ChangeStatus, number> = { applied: 0, pending: 0, undone: 0, dismissed: 0 };
    for (const c of changes) out[c.status] += 1;
    return out;
  }, [changes]);
  const shown = changes.filter((c) => filter === null || c.status === filter);

  const options: { key: StatusFilter; label: string; count: number }[] = [
    { key: "applied", label: "Applied", count: counts.applied },
    { key: "undone", label: "Undone", count: counts.undone },
    { key: "dismissed", label: "Dismissed", count: counts.dismissed },
    { key: null, label: "All", count: changes.length },
  ];

  return (
    <Section title="Every change" caption="Each one can be undone on its own; the workbook is rebuilt in a few seconds.">
      <FilterPills
        options={options.filter((o) => o.key === null || o.key === "applied" || o.count > 0)}
        value={filter}
        onChange={(v) => {
          setFilter(v);
          setLimit(CHANGES_SHOWN);
        }}
      />
      {shown.length === 0 ? (
        <Typography sx={{ fontSize: 12.5, color: "text.disabled" }}>None.</Typography>
      ) : (
        <Panel>
          {shown.slice(0, limit).map((c) => (
            <ChangeRow
              key={c.id}
              change={c}
              editable={editable}
              busy={busyId === c.id}
              onAct={onAct}
            />
          ))}
          {shown.length > limit && (
            <Box sx={{ p: 1, textAlign: "center" }}>
              <Button sx={quietBtn} onClick={() => setLimit((n) => n + CHANGES_SHOWN)}>
                Show more ({shown.length - limit} left)
              </Button>
            </Box>
          )}
        </Panel>
      )}
    </Section>
  );
}

function shown(value: string | null): string {
  return value === null || value === "" ? "(blank)" : value;
}

function ChangeRow({
  change,
  editable,
  busy,
  onAct,
  showWhy,
}: {
  change: LeadChange;
  editable: boolean;
  busy: boolean;
  onAct: ActOn;
  showWhy?: boolean;
}) {
  const actions = changeActions(change.status);
  const off = change.status === "undone" || change.status === "dismissed";
  return (
    <Box
      sx={{
        display: "flex",
        gap: 2,
        px: 2,
        py: 1.25,
        alignItems: "flex-start",
        "& + &": { borderTop: 1, borderColor: "divider" },
        opacity: off ? 0.6 : 1,
      }}
    >
      <Box sx={{ width: 150, flexShrink: 0 }}>
        <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{kindLabel(change.kind)}</Typography>
        <Typography sx={{ fontSize: 11, color: "text.secondary" }}>{changeWhere(change)}</Typography>
        {change.critical && (
          <Typography sx={{ fontSize: 10.5, color: "warning.main", fontWeight: 700 }}>Critical</Typography>
        )}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {change.kind === "remove_row" ? (
          <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>Leave this lead out of the import</Typography>
        ) : (
          change.edits.map((e, i) => (
            <Typography key={i} sx={{ fontSize: 12.5, wordBreak: "break-word" }}>
              <Box component="span" sx={{ color: "text.secondary" }}>
                {fieldLabel(e.field)}:{" "}
              </Box>
              <Box component="span" sx={{ textDecoration: "line-through", color: "text.disabled" }}>
                {shown(e.from)}
              </Box>
              {" → "}
              <Box component="span" sx={{ fontWeight: 600 }}>
                {shown(e.to)}
              </Box>
            </Typography>
          ))
        )}
        {change.reason && (
          <Typography sx={{ fontSize: 11.5, color: "text.secondary", mt: 0.25 }}>{change.reason}</Typography>
        )}
        {change.evidence?.value && (
          <Typography sx={{ fontSize: 11, color: "text.disabled" }}>
            Evidence ({(change.evidence.type ?? "").replace(/_/g, " ")}): {change.evidence.value}
          </Typography>
        )}
        {showWhy && (change.pending_why || change.critical_why) && (
          <Typography sx={{ fontSize: 11, color: "warning.main", mt: 0.25 }}>
            Needs you: {change.pending_why ?? change.critical_why}
          </Typography>
        )}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
        {!showWhy && (
          <Typography sx={{ fontSize: 11, color: "text.disabled", mr: 0.5 }}>
            {CHANGE_STATUS_LABEL[change.status]}
            {change.confidence ? ` · ${change.confidence}` : ""}
          </Typography>
        )}
        {busy ? (
          <CircularProgress size={15} />
        ) : (
          editable && (
            <>
              {actions.undo && (
                <Button size="small" sx={quietBtn} onClick={() => onAct(change.id, "undo")}>
                  {actions.undo}
                </Button>
              )}
              {actions.confirm && (
                <Button
                  size="small"
                  variant={change.status === "pending" ? "contained" : "text"}
                  sx={change.status === "pending" ? primaryBtn : quietBtn}
                  onClick={() => onAct(change.id, "confirm")}
                >
                  {actions.confirm}
                </Button>
              )}
            </>
          )
        )}
      </Box>
    </Box>
  );
}

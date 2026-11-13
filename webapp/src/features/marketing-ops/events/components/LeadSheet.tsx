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

import { useCallback, useMemo, useState } from "react";
import { Alert, Box, Button, CircularProgress, InputAdornment, TextField, Typography } from "@wso2/oxygen-ui";
import { Search } from "@wso2/oxygen-ui-icons-react";
import { leadImportError, useLeadImportRebuilding, useSaveLeadEdits } from "../../api/useLeadImport";
import type { LeadChange, SheetColumn, SheetMark, SheetRow, SheetTab, UserEdit } from "../leadImportTypes";
import { CHANGE_STATUS_LABEL, changeActions, fieldLabel, kindLabel } from "../lib/leadImport";
import { cellKey, filterCounts, filterRows, type SheetFilter } from "../lib/leadSheet";
import { Empty, FilterPills, Panel, TabRail } from "./EventsUi";
import type { ActOn } from "./LeadImportChanges";
import LeadSheetGrid from "./LeadSheetGrid";

// The converted List Import Template as an editable sheet — exactly what downloads.
//
// Every saved cell is a user edit on the server: the workbook is rebuilt with it, it is
// listed with the changes, and it can be undone. While a cell saves, its new value shows
// in italics; it settles once the rebuilt sheet is back.

const FILTERS: { key: SheetFilter; label: string; title: string }[] = [
  { key: "all", label: "All rows", title: "Every lead on this tab" },
  { key: "changed", label: "Changed", title: "Rows with a cell Claude or you changed" },
  { key: "pending", label: "Waiting for you", title: "Rows with a change that isn't applied yet" },
  { key: "edited", label: "Edited by you", title: "Rows with a cell you edited" },
];

/** The converted List Import Template for one run as an editable sheet: tabs, search,
 *  row filters, cell edits, and a tooltip on each marked cell to confirm or undo it. */
export default function LeadSheet({
  runId,
  tabs,
  changes,
  userEdits,
  editable,
  busyId,
  onAct,
}: {
  runId: string;
  tabs: SheetTab[];
  changes: LeadChange[];
  userEdits: UserEdit[];
  /** Before Finish: cells can be edited and changes confirmed or undone. */
  editable: boolean;
  busyId: string | null;
  onAct: ActOn;
}) {
  const { mutateAsync: save } = useSaveLeadEdits();
  // One rebuild at a time, shared with the change list: a new edit or action waits until
  // the workbook from the last one is back. Opening another action blurs an open cell
  // editor first, which commits it, so no typed value is lost.
  const rebuilding = useLeadImportRebuilding();
  const canChange = editable && !rebuilding;
  const [tabName, setTabName] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SheetFilter>("all");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savedOnce, setSavedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tab = tabs.find((t) => t.name === tabName) ?? tabs[0];
  const counts = useMemo(() => (tab ? filterCounts(tab.rows) : null), [tab]);
  // A filter whose last row went away (say, the last pending change was applied) shows
  // all rows instead of an empty grid with no pill selected.
  const activeFilter: SheetFilter = counts && counts[filter] > 0 ? filter : "all";
  const rows = useMemo(
    () => (tab ? filterRows(tab.rows, query, activeFilter) : []),
    [tab, query, activeFilter],
  );

  const editCell = useCallback(
    async (row: SheetRow, column: SheetColumn, value: string) => {
      if (!tab) return;
      const index = tab.columns.findIndex((c) => c.key === column.key);
      if (value.trim() === row.cells[index]) return;
      const key = cellKey(tab.name, row.email, column.key);
      setDrafts((d) => ({ ...d, [key]: value }));
      setError(null);
      try {
        await save({ id: runId, cells: [{ tab: tab.name, email: row.email, column: column.key, value }] });
        setSavedOnce(true);
      } catch (e) {
        setError(leadImportError(e));
      } finally {
        // Only clear our own draft: the same cell may have been edited again meanwhile.
        setDrafts((d) => {
          if (d[key] !== value) return d;
          const next = { ...d };
          delete next[key];
          return next;
        });
      }
    },
    [tab, runId, save],
  );
  const onEdit = useCallback(
    (row: SheetRow, column: SheetColumn, value: string) => void editCell(row, column, value),
    [editCell],
  );

  const changesById = useMemo(() => new Map(changes.map((c) => [c.id, c])), [changes]);
  const editsById = useMemo(() => new Map(userEdits.map((e) => [e.id, e])), [userEdits]);
  const describeMark = useCallback(
    (mark: SheetMark) => (
      <MarkDetails
        mark={mark}
        change={changesById.get(mark.id)}
        edit={editsById.get(mark.id)}
        editable={canChange && busyId === null}
        onAct={onAct}
      />
    ),
    [changesById, editsById, canChange, busyId, onAct],
  );

  if (!tab || !counts) return <Empty>No leads were written to the workbook.</Empty>;
  const saving = Object.keys(drafts).length;

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 0.5 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>List Import Template</Typography>
        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
          {editable
            ? "This is the workbook you'll download. Click a cell to fix it; each edit is saved and can be undone."
            : "This is the workbook as downloaded."}
        </Typography>
      </Box>
      <TabRail
        tabs={tabs.map((t) => ({ key: t.name, label: t.name, count: t.rows.length }))}
        value={tab.name}
        onChange={(name) => {
          setTabName(name);
          setFilter("all");
        }}
      />
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", py: 1.25 }}>
        <TextField
          size="small"
          placeholder="Search this tab"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          sx={{ width: 220, "& .MuiInputBase-input": { fontSize: 13 } }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={14} />
                </InputAdornment>
              ),
            },
          }}
        />
        <Box sx={{ "& > div": { mb: 0 } }}>
          <FilterPills
            options={FILTERS.filter((f) => f.key === "all" || counts[f.key] > 0).map((f) => ({
              ...f,
              count: counts[f.key],
            }))}
            value={activeFilter}
            onChange={setFilter}
          />
        </Box>
        <Box sx={{ flex: 1 }} />
        <SaveState saving={saving} savedOnce={savedOnce} />
      </Box>
      {error && (
        <Alert severity="error" sx={{ mb: 1, fontSize: 13 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <Panel>
        {rows.length === 0 ? (
          <Box sx={{ p: 3 }}>
            <Empty>No rows match.</Empty>
          </Box>
        ) : (
          <LeadSheetGrid
            key={`${tab.name}|${activeFilter}|${query}`}
            tab={tab.name}
            columns={tab.columns}
            rows={rows}
            drafts={drafts}
            editable={canChange}
            onEdit={onEdit}
            describeMark={describeMark}
          />
        )}
      </Panel>
      <Legend />
    </Box>
  );
}

function SaveState({ saving, savedOnce }: { saving: number; savedOnce: boolean }) {
  if (saving > 0) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, fontSize: 12, color: "text.secondary" }}>
        <CircularProgress size={12} />
        Saving {saving === 1 ? "your edit" : `${saving} edits`}…
      </Box>
    );
  }
  return savedOnce ? (
    <Typography sx={{ fontSize: 12, color: "success.main" }}>Saved — the download matches the sheet</Typography>
  ) : null;
}

function Legend() {
  const items: { label: string; color: string; dashed?: boolean }[] = [
    { label: "Changed by Claude", color: "success.main" },
    { label: "Waiting for you", color: "warning.main", dashed: true },
    { label: "Edited by you", color: "info.main" },
  ];
  return (
    <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mt: 1, fontSize: 11.5, color: "text.secondary" }}>
      {items.map((item) => (
        <Box key={item.label} sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
          <Box
            sx={{
              width: 12,
              height: 12,
              borderLeft: 3,
              borderColor: item.color,
              bgcolor: "action.hover",
              outline: item.dashed ? 1 : 0,
              outlineStyle: "dashed",
              outlineColor: item.color,
            }}
          />
          {item.label}
        </Box>
      ))}
      <Box component="span">Hover a coloured cell for why, and to apply or undo it. Blank formula cells are worked out by Excel.</Box>
    </Box>
  );
}

/** What a marked cell's tooltip says: who changed it, why, and the one action it allows. */
export function MarkDetails({
  mark,
  change,
  edit,
  editable,
  onAct,
}: {
  mark: SheetMark;
  change?: LeadChange;
  edit?: UserEdit;
  editable: boolean;
  onAct: ActOn;
}) {
  const actions = changeActions(mark.status);
  const blank = (value: string | null | undefined) => (value ? value : "(blank)");
  return (
    <Box sx={{ fontSize: 12, maxWidth: 320 }}>
      <Box sx={{ fontWeight: 700 }}>
        {kindLabel(mark.kind)} · {CHANGE_STATUS_LABEL[mark.status]}
      </Box>
      {edit && <Box>Was {blank(edit.from)}</Box>}
      {change?.edits.map((e, i) => (
        <Box key={i}>
          {fieldLabel(e.field)}: {blank(e.from)} → {blank(e.to)}
        </Box>
      ))}
      {mark.reason && <Box sx={{ opacity: 0.85, mt: 0.25 }}>{mark.reason}</Box>}
      {change?.pending_why && mark.status === "pending" && (
        <Box sx={{ opacity: 0.85 }}>Needs you: {change.pending_why}</Box>
      )}
      {editable && (
        <Box sx={{ display: "flex", gap: 0.5, mt: 0.75 }}>
          {actions.confirm && (
            <Button size="small" variant="contained" onClick={() => onAct(mark.id, "confirm")} sx={tipBtn}>
              {actions.confirm}
            </Button>
          )}
          {actions.undo && (
            <Button size="small" variant="outlined" color="inherit" onClick={() => onAct(mark.id, "undo")} sx={tipBtn}>
              {actions.undo}
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
}

const tipBtn = { textTransform: "none", fontSize: 11.5, py: 0, minWidth: 0 } as const;

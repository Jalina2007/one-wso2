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

import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { alpha, Box, InputBase, MenuItem, Select, Tooltip, useTheme } from "@wso2/oxygen-ui";
import type { SheetColumn, SheetMark, SheetRow } from "../leadImportTypes";
import { cellKey, columnWidth, markTone, renderedSlices, visibleRange, type MarkTone } from "../lib/leadSheet";

// One lead tab of the converted workbook, as an editable sheet.
//
// Deliberately not AttendeeGrid: that grid is built around EventsConfig, row issues and
// suggestions; this one shows the workbook's own columns and the change behind a cell.
//
// A plain table with WINDOWED rows: rows are a fixed height, so the slice in view is a
// division (visibleRange) and spacer rows stand in for the rest. A tab of 2,490 leads
// keeps about 50 rows in the DOM. One cell edits at a time: click it (or Enter on it),
// Enter or leaving the cell saves, Escape cancels. Saving is the parent's job.

const ROW_HEIGHT = 30;
const GUTTER = 52;
/** The tallest the scroll area gets; also the viewport the window is computed for. */
const VIEWPORT = 600;
const OVERSCAN = 12;

export interface LeadSheetGridProps {
  tab: string;
  columns: SheetColumn[];
  rows: SheetRow[];
  /** Values being saved, by cellKey: shown in place of the workbook's until saved. */
  drafts: Record<string, string>;
  editable: boolean;
  onEdit: (row: SheetRow, column: SheetColumn, value: string) => void;
  /** The tooltip for a marked cell: what changed it, and how to confirm or undo. */
  describeMark: (mark: SheetMark) => ReactNode;
}

interface Editing {
  email: string;
  column: string;
}

export default function LeadSheetGrid({
  tab,
  columns,
  rows,
  drafts,
  editable,
  onEdit,
  describeMark,
}: LeadSheetGridProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const [editing, setEditing] = useState<Editing | null>(null);
  // Set only when Enter or Escape ends an edit, so focus returns to that cell and a
  // keyboard user carries on from it. Leaving the cell (blur, Tab) keeps focus where it went.
  const refocus = useRef<Editing | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const toneSx = useToneSx();
  const { first, last } = visibleRange(scrollTop, VIEWPORT, ROW_HEIGHT, rows.length, OVERSCAN);
  const editingIndex = editing ? rows.findIndex((r) => r.email === editing.email) : -1;
  const width = GUTTER + columns.reduce((sum, c) => sum + columnWidth(c), 0);

  const commit = useCallback(
    (row: SheetRow, column: SheetColumn, value: string, byKey: boolean) => {
      if (byKey) refocus.current = { email: row.email, column: column.key };
      setEditing(null);
      onEdit(row, column, value);
    },
    [onEdit],
  );
  const cancel = useCallback((row: SheetRow, column: SheetColumn, byKey: boolean) => {
    if (byKey) refocus.current = { email: row.email, column: column.key };
    setEditing(null);
  }, []);

  useEffect(() => {
    const target = refocus.current;
    if (editing !== null || !target) return;
    refocus.current = null;
    tableRef.current
      ?.querySelector<HTMLElement>(`td[data-cell="${CSS.escape(`${target.email}|${target.column}`)}"]`)
      ?.focus();
  }, [editing]);

  // Each slice in order, with a spacer for the gap before it. Thus, an editor that scrolls
  // out of view stays mounted, and the scrollbar is still the full list's.
  const slices = renderedSlices(first, last, editingIndex);
  const rendered = slices[slices.length - 1][1];
  const body = slices.flatMap(([start, end], index) => {
    const gap = start - (index > 0 ? slices[index - 1][1] : 0);
    return [
      gap > 0 ? <Spacer key={`gap-${start}`} rows={gap} span={columns.length + 1} /> : null,
      ...rows.slice(start, end).map((row) => (
        <SheetRowView
          key={row.email}
          tab={tab}
          row={row}
          columns={columns}
          drafts={drafts}
          editable={editable}
          editingColumn={editing?.email === row.email ? editing.column : null}
          toneSx={toneSx}
          onStart={setEditing}
          onCommit={commit}
          onCancel={cancel}
          describeMark={describeMark}
        />
      )),
    ];
  });

  return (
    <Box
      data-testid="lead-sheet-scroll"
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      sx={{ maxHeight: VIEWPORT, overflow: "auto", bgcolor: "background.paper" }}
    >
      <Box
        component="table"
        ref={tableRef}
        sx={{ borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed", width, fontSize: 12 }}
      >
        <colgroup>
          <col style={{ width: GUTTER }} />
          {columns.map((c) => (
            <col key={c.key} style={{ width: columnWidth(c) }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <Box component="th" sx={{ ...headSx, left: 0, zIndex: 3 }}>
              Row
            </Box>
            {columns.map((c) => (
              <Tooltip key={c.key} title={headerHint(c)} placement="top" arrow>
                <Box component="th" sx={{ ...headSx, color: c.editable ? "text.primary" : "text.secondary" }}>
                  {c.label}
                </Box>
              </Tooltip>
            ))}
          </tr>
        </thead>
        <tbody>
          {body}
          {rendered < rows.length && <Spacer rows={rows.length - rendered} span={columns.length + 1} />}
        </tbody>
      </Box>
    </Box>
  );
}

/** Stands in for the rows outside the window, so the scrollbar is the full list's. */
function Spacer({ rows, span }: { rows: number; span: number }) {
  return (
    <tr aria-hidden>
      <td colSpan={span} style={{ height: rows * ROW_HEIGHT, padding: 0, border: 0 }} />
    </tr>
  );
}

function headerHint(column: SheetColumn): string {
  if (column.formula) return `${column.header} — a formula Excel fills in. Type a value to replace it in that cell.`;
  if (!column.editable) return `${column.header} — can't be edited here.`;
  return column.options ? `${column.header} — pick from the template's list.` : column.header;
}

/** Cell colours per mark tone, resolved from the theme once per render of the grid. */
function useToneSx(): Record<MarkTone, object> {
  const theme = useTheme();
  return useMemo(() => {
    const band = (color: string, fill: number) => ({
      bgcolor: alpha(color, fill),
      boxShadow: `inset 3px 0 0 ${color}`,
    });
    return {
      pending: { ...band(theme.palette.warning.main, 0.16), outline: `1px dashed ${theme.palette.warning.main}`, outlineOffset: -1 },
      claude: band(theme.palette.success.main, 0.1),
      edited: band(theme.palette.info.main, 0.14),
      off: { textDecoration: `underline dotted ${theme.palette.text.disabled}` },
    };
  }, [theme]);
}

interface RowProps {
  tab: string;
  row: SheetRow;
  columns: SheetColumn[];
  drafts: Record<string, string>;
  editable: boolean;
  editingColumn: string | null;
  toneSx: Record<MarkTone, object>;
  onStart: (editing: Editing) => void;
  onCommit: (row: SheetRow, column: SheetColumn, value: string, byKey: boolean) => void;
  onCancel: (row: SheetRow, column: SheetColumn, byKey: boolean) => void;
  describeMark: (mark: SheetMark) => ReactNode;
}

// Memoised: scrolling re-renders the grid, and the rows that stay in view need not.
const SheetRowView = memo(function SheetRowView({
  tab,
  row,
  columns,
  drafts,
  editable,
  editingColumn,
  toneSx,
  onStart,
  onCommit,
  onCancel,
  describeMark,
}: RowProps) {
  return (
    <tr data-row={row.row}>
      <Box component="td" sx={{ ...bodySx, ...gutterSx }}>
        {row.row}
      </Box>
      {columns.map((column, index) => {
        const draft = drafts[cellKey(tab, row.email, column.key)];
        const mark = row.marks?.[column.key];
        const canEdit = editable && column.editable && draft === undefined;
        if (editingColumn === column.key && canEdit) {
          return (
            <Box component="td" key={column.key} sx={{ ...bodySx, p: 0 }}>
              <CellEditor
                value={row.cells[index]}
                options={column.options}
                label={`${column.label}, row ${row.row}`}
                onCommit={(value, byKey) => onCommit(row, column, value, byKey)}
                onCancel={(byKey) => onCancel(row, column, byKey)}
              />
            </Box>
          );
        }
        const shown = draft ?? row.cells[index];
        const cell = (
          <Box
            component="td"
            key={column.key}
            data-cell={`${row.email}|${column.key}`}
            // -1: not a Tab stop, but focus can return here after Enter or Escape.
            tabIndex={canEdit ? 0 : -1}
            aria-label={canEdit ? `${column.label}, row ${row.row}: ${shown || "blank"}` : undefined}
            onClick={canEdit ? () => onStart({ email: row.email, column: column.key }) : undefined}
            onKeyDown={
              canEdit
                ? (e) => {
                    if (e.key === "Enter" || e.key === "F2") onStart({ email: row.email, column: column.key });
                  }
                : undefined
            }
            sx={{
              ...bodySx,
              cursor: canEdit ? "text" : "default",
              color: column.editable ? "text.primary" : "text.secondary",
              ...(mark ? toneSx[markTone(mark)] : {}),
              ...(draft !== undefined ? { fontStyle: "italic", color: "text.secondary" } : {}),
              "&:focus-visible": { outline: 2, outlineColor: "primary.main", outlineOffset: -2 },
            }}
          >
            {shown}
          </Box>
        );
        return mark ? (
          <Tooltip key={column.key} title={describeMark(mark)} placement="top" arrow enterDelay={300}>
            {cell}
          </Tooltip>
        ) : (
          cell
        );
      })}
    </tr>
  );
});

/** Free text, or the template's dropdown. Settles once: Enter, a pick or leaving saves.
 *  `byKey` tells the grid that a key (not a blur) ended the edit. */
function CellEditor({
  value,
  options,
  label,
  onCommit,
  onCancel,
}: {
  value: string;
  options: string[] | null;
  label: string;
  onCommit: (value: string, byKey: boolean) => void;
  onCancel: (byKey: boolean) => void;
}) {
  const settled = useRef(false);
  const settle = (action: () => void) => {
    if (settled.current) return;
    settled.current = true;
    action();
  };

  if (options) {
    return (
      <Select
        size="small"
        defaultOpen
        fullWidth
        value={value}
        inputProps={{ "aria-label": label }}
        onChange={(e) => settle(() => onCommit(String(e.target.value), true))}
        onClose={(e) => settle(() => onCancel(e.type === "keydown"))}
        sx={{ fontSize: 12, height: ROW_HEIGHT - 1, borderRadius: 0 }}
      >
        {["", ...options].map((option) => (
          <MenuItem key={option || "(blank)"} value={option} sx={{ fontSize: 12.5 }}>
            {option || "(blank)"}
          </MenuItem>
        ))}
      </Select>
    );
  }
  return (
    <InputBase
      autoFocus
      fullWidth
      defaultValue={value}
      inputProps={{ "aria-label": label }}
      onBlur={(e) => settle(() => onCommit(e.target.value, false))}
      onKeyDown={(e) => {
        // An Enter that confirms an IME composition (CJK names, say) is not a commit.
        if (e.nativeEvent.isComposing) return;
        if (e.key === "Enter") settle(() => onCommit((e.target as HTMLInputElement).value, true));
        if (e.key === "Escape") settle(() => onCancel(true));
      }}
      sx={{ fontSize: 12, px: 1, height: ROW_HEIGHT - 1, boxShadow: (t) => `inset 0 0 0 2px ${t.palette.primary.main}` }}
    />
  );
}

const headSx = {
  position: "sticky",
  top: 0,
  zIndex: 2,
  height: ROW_HEIGHT + 2,
  px: 1,
  textAlign: "left",
  fontSize: 11.5,
  fontWeight: 700,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  bgcolor: "background.default",
  borderBottom: 1,
  borderRight: 1,
  borderColor: "divider",
} as const;

const bodySx = {
  height: ROW_HEIGHT,
  px: 1,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  borderBottom: 1,
  borderRight: 1,
  borderColor: "divider",
} as const;

const gutterSx = {
  position: "sticky",
  left: 0,
  zIndex: 1,
  bgcolor: "background.default",
  color: "text.disabled",
  fontVariantNumeric: "tabular-nums",
  textAlign: "right",
} as const;

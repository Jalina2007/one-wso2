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

import { useState, type ReactNode } from "react";
import {
  Box,
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
import { Check, Pencil, Sparkles, TriangleAlert } from "@wso2/oxygen-ui-icons-react";
import type { FieldDef } from "../eventsTypes";
import type { MappingEntry, SourceColumn, Split } from "../leadImportTypes";
import { columnLetter } from "../lib/leadFile";
import {
  attentionOf,
  decodeChoice,
  encodeChoice,
  sourceLabel,
  splitFullName,
  type Attention,
} from "../lib/leadMapping";
import { COMPUTED_LABEL } from "../rules/schema";
import { FilterPills, Panel } from "./EventsUi";

// One row per template column: where its values come from, what they look like, and how
// the source was chosen, with the reason written out rather than hidden in a tooltip.
// Rows that want a second look (a required column with no source, a source Claude was
// unsure of) carry the warning tone and can be filtered to on their own.

type Filter = "all" | "attention" | "unmapped";

const HEAD_CELL = { fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" } as const;

const SPLIT_LABEL: Record<Split, string> = { first: "first-name part", last: "last-name part" };

export default function LeadMappingTable({
  defs,
  mapping,
  sources,
  pair,
  loading,
  onChoose,
}: {
  /** Every column of the status, in template order. */
  defs: FieldDef[];
  mapping: MappingEntry[] | null;
  sources: SourceColumn[];
  pair: { first: string; last: string } | null;
  /** True while the suggestion is on its way: the selects wait for it. */
  loading: boolean;
  onChoose: (field: string, value: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const byField = new Map((mapping ?? []).map((entry) => [entry.field_name, entry]));
  const targets = defs.filter((d) => !d.computed);
  const computed = defs.filter((d) => d.computed);

  // Which template column each source already feeds, for the hint in the dropdown.
  const usedBy = new Map<number, string>();
  for (const entry of mapping ?? []) {
    if (entry.source_index !== null && !usedBy.has(entry.source_index)) {
      usedBy.set(entry.source_index, entry.field_name);
    }
  }

  const attention = (def: FieldDef) => attentionOf(def, byField.get(def.field_name));
  const unmapped = (def: FieldDef) => byField.get(def.field_name)?.source_index == null;
  const counts = {
    all: targets.length,
    attention: targets.filter((d) => attention(d)).length,
    unmapped: targets.filter(unmapped).length,
  };
  // A filter whose last row went away (the last required column got a source) shows
  // everything again rather than an empty table.
  const active: Filter = loading || counts[filter] > 0 ? filter : "all";
  const shown = targets.filter((d) =>
    active === "attention" ? attention(d) : active === "unmapped" ? unmapped(d) : true,
  );

  return (
    <Box>
      {!loading && (
        <FilterPills<Filter>
          value={active}
          onChange={setFilter}
          options={[
            { key: "all", label: "All columns", count: counts.all },
            {
              key: "attention",
              label: "Needs a look",
              count: counts.attention,
              color: counts.attention ? "warning.main" : undefined,
            },
            { key: "unmapped", label: "Not mapped", count: counts.unmapped },
          ]}
        />
      )}
      <Panel sx={{ overflowX: "auto" }}>
        <Table size="small" aria-label="Column mapping">
          <TableHead>
            <TableRow>
              <TableCell sx={HEAD_CELL}>Template column</TableCell>
              <TableCell sx={HEAD_CELL}>Takes values from</TableCell>
              <TableCell sx={HEAD_CELL}>Sample values</TableCell>
              <TableCell sx={HEAD_CELL}>How it was chosen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {shown.map((def) => (
              <MappingRow
                key={def.field_name}
                def={def}
                entry={byField.get(def.field_name)}
                attention={loading ? null : attention(def)}
                sources={sources}
                usedBy={usedBy}
                splitHalf={pair?.first === def.field_name ? "first" : pair?.last === def.field_name ? "last" : null}
                loading={loading}
                onChange={(value) => onChoose(def.field_name, value)}
              />
            ))}
          </TableBody>
        </Table>
        {computed.length > 0 && (
          <Typography
            sx={{ fontSize: 12, color: "text.secondary", px: 2, py: 1.25, borderTop: 1, borderColor: "divider" }}
          >
            MOP fills {listOf(computed.map((d) => COMPUTED_LABEL[d.field_name] ?? d.header_label.trim()))} when the list
            is submitted. Their headings are in the workbook, with the cells left empty.
          </Typography>
        )}
      </Panel>
    </Box>
  );
}

function listOf(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function MappingRow({
  def,
  entry,
  attention,
  sources,
  usedBy,
  splitHalf,
  loading,
  onChange,
}: {
  def: FieldDef;
  entry: MappingEntry | undefined;
  attention: Attention;
  sources: SourceColumn[];
  usedBy: Map<number, string>;
  splitHalf: Split | null;
  loading: boolean;
  onChange: (value: string) => void;
}) {
  const heading = def.header_label.trim();
  const source = entry?.source_index != null ? sources.find((s) => s.index === entry.source_index) : undefined;
  const samples = (source?.samples ?? []).map((value) => (entry?.split ? splitFullName(value)[entry.split] : value));

  return (
    <TableRow
      sx={{
        verticalAlign: "top",
        // The warning edge marks the rows the filter calls "needs a look".
        "& > td:first-of-type": { boxShadow: attention ? (t) => `inset 3px 0 0 ${t.palette.warning.main}` : "none" },
      }}
    >
      <TableCell sx={{ minWidth: 180 }}>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, flexWrap: "wrap" }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{def.field_name}</Typography>
          {def.mandatory && (
            <Typography
              component="span"
              sx={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: "text.secondary",
              }}
            >
              Required
            </Typography>
          )}
        </Box>
        {heading !== def.field_name && (
          <Typography sx={{ fontSize: 11, color: "text.secondary" }}>Heading: {heading}</Typography>
        )}
      </TableCell>

      <TableCell sx={{ minWidth: 240 }}>
        <Select
          size="small"
          displayEmpty
          fullWidth
          disabled={loading}
          value={encodeChoice(entry)}
          onChange={(e) => onChange(e.target.value as string)}
          inputProps={{ "aria-label": `Source for ${def.field_name}` }}
          renderValue={(value) => {
            const choice = decodeChoice(value as string);
            if (!choice)
              return (
                <Box component="span" sx={{ color: "text.disabled" }}>
                  Not mapped
                </Box>
              );
            const picked = sources.find((s) => s.index === choice.source);
            const label = picked ? sourceLabel(picked) : columnLetter(choice.source);
            return choice.split ? `${label} (${SPLIT_LABEL[choice.split]})` : label;
          }}
          sx={{ fontSize: 13, maxWidth: 320 }}
          MenuProps={{ slotProps: { paper: { sx: { maxHeight: 420 } } } }}
        >
          <MenuItem value="" sx={{ fontSize: 13, color: "text.secondary" }}>
            Not mapped
          </MenuItem>
          {sources.map((s) => (
            <MenuItem key={s.index} value={String(s.index)} sx={{ fontSize: 13 }}>
              <SourceOption source={s} usedBy={usedBy.get(s.index)} self={def.field_name} />
            </MenuItem>
          ))}
          {splitHalf && <SplitHeader />}
          {splitHalf &&
            sources.map((s) => (
              <MenuItem key={`${s.index}:${splitHalf}`} value={`${s.index}:${splitHalf}`} sx={{ fontSize: 13 }}>
                {sourceLabel(s)} ({SPLIT_LABEL[splitHalf]})
              </MenuItem>
            ))}
        </Select>
        {attention === "required_unmapped" && (
          <Typography sx={{ fontSize: 11.5, color: "warning.main", mt: 0.5 }}>
            Required. My Submissions will flag every row until it's filled.
          </Typography>
        )}
      </TableCell>

      <TableCell sx={{ fontSize: 12, color: "text.secondary", maxWidth: 260 }}>
        {samples.length ? (
          <Tooltip title={<SampleList samples={samples} />} placement="top-start" arrow>
            <Box sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", pt: 0.75 }}>
              {samples.map((v) => v || "—").join("  ·  ")}
            </Box>
          </Tooltip>
        ) : (
          <Box sx={{ pt: 0.75, color: "text.disabled" }}>—</Box>
        )}
      </TableCell>

      <TableCell sx={{ minWidth: 200, maxWidth: 320 }}>
        {loading ? (
          <Typography sx={{ fontSize: 12, color: "text.disabled", pt: 0.75 }}>Waiting for the suggestion…</Typography>
        ) : (
          <HowItWasChosen entry={entry} attention={attention} />
        )}
      </TableCell>
    </TableRow>
  );
}

function SourceOption({ source, usedBy, self }: { source: SourceColumn; usedBy?: string; self: string }) {
  const hint = usedBy && usedBy !== self ? `Used for ${usedBy}` : source.samples[0];
  return (
    <Box sx={{ display: "flex", alignItems: "baseline", gap: 2, width: "100%", minWidth: 0 }}>
      <Box component="span" sx={{ flexShrink: 0 }}>
        {sourceLabel(source)}
      </Box>
      {hint && (
        <Box
          component="span"
          sx={{
            ml: "auto",
            fontSize: 11.5,
            color: "text.secondary",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 180,
          }}
        >
          {hint}
        </Box>
      )}
    </Box>
  );
}

function SplitHeader() {
  return (
    <Typography
      component="li"
      sx={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: "text.secondary",
        px: 2,
        pt: 1.5,
        pb: 0.5,
        borderTop: 1,
        borderColor: "divider",
        listStyle: "none",
      }}
    >
      Split a full-name column
    </Typography>
  );
}

function SampleList({ samples }: { samples: string[] }) {
  return (
    <Box component="ul" sx={{ m: 0, pl: 2, fontSize: 12 }}>
      {samples.map((v, i) => (
        <li key={i}>{v || "(empty)"}</li>
      ))}
    </Box>
  );
}

/** How the source was chosen, and why, written out in the cell. */
function HowItWasChosen({ entry, attention }: { entry: MappingEntry | undefined; attention: Attention }) {
  const how = entry?.how ?? "none";
  let tag: { icon?: ReactNode; label: string; color: string };
  if (how === "exact") tag = { icon: <Check size={13} />, label: "Exact match", color: "success.main" };
  else if (how === "claude") {
    tag = {
      icon: attention === "low_confidence" ? <TriangleAlert size={13} /> : <Sparkles size={13} />,
      label: `Claude · ${entry?.confidence ?? ""} confidence`,
      color: attention === "low_confidence" ? "warning.main" : "text.secondary",
    };
  } else if (how === "you") tag = { icon: <Pencil size={13} />, label: "Chosen by you", color: "text.primary" };
  else tag = { label: "Not mapped", color: "text.disabled" };

  const notes = [entry?.split ? "Splits a full name" : null, entry?.reason].filter(Boolean).join(". ");
  return (
    <Box sx={{ pt: 0.5 }}>
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: tag.color }}>
        {tag.icon}
        <Typography component="span" sx={{ fontSize: 12, fontWeight: 700, color: "inherit" }}>
          {tag.label}
        </Typography>
      </Box>
      {notes && (
        <Typography
          title={notes}
          sx={{
            fontSize: 11.5,
            color: "text.secondary",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {notes}
        </Typography>
      )}
    </Box>
  );
}

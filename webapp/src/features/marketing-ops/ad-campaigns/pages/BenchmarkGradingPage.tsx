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

// Ad Campaigns → Benchmark Grading.
//
// Structure matches the HTML pacing dashboard's `benchView()` function exactly:
//   • 6 summary cards (Spend graded, At benchmark, % of spend, % of campaigns, CTR, CPC)
//   • Stacked spend bar with inline segment labels
//   • Platform toggle: Both platforms / LinkedIn only / Google only
//   • Cohort filter: All ad sets / Launched in period / Carried over / No launch date
//   • `.tgl` bar: grade letter toggles (A/B/C/D/F + Ungraded) + search input
//   • By budget line cross-table (clickable rows filter the campaign table)
//   • 17-column campaign table: Campaign, Pf, Owner, Spend, Impr, Clicks, CTR, CPC,
//     Judged on, Actual, Bench, Cost on, Actual, Bench, Index, Result, Why
//
// Grading thresholds (HTML dashboard spec 2026.10):
//   index = √(conversionRatio × costRatio), each ratio capped 0.1×–4×
//   At benchmark ≥ 1.05 · Optimize ≥ 1.05 (but cost lags) · Close ≥ 0.80 · Below < 0.80
//   Letter grades: A ≥ 1.30 · B ≥ 1.05 · C ≥ 0.80 · D ≥ 0.50 · F < 0.50

import { useMemo, useState } from "react";
import { BenchmarkEditorPanel } from "../benchmark-grading/BenchmarkEditorPanel";
import { useBenchmarkTables } from "../benchmark-grading/useBenchmarkTables";
import {
  alpha,
  Alert,
  Box,
  CircularProgress,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { RefreshCw } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { MARKETING_OPS_EYEBROW } from "@constants/marketingOpsApps";
import MarketingOpsShell from "../../components/MarketingOpsShell";
import { ToggleChip } from "../analytics/components/AnalyticsPrimitives";
import DateRangePicker from "../analytics/components/DateRangePicker";
import { useBenchmarkGrading } from "../../api/useAdAnalytics";
import {
  gradeAllWith,
  buildBoardRows,
  summarize,
  fmtMoney,
  fmtPct,
  fmtIndex,
  GRADE_HEX,
} from "../benchmark-grading/benchmarkGradingLogic";
import type {
  DateWindow,
  GradedCampaignLine,
  BenchmarkBoardRow,
  BenchmarkGrade,
  LetterGrade,
} from "../benchmark-grading/benchmarkGradingTypes";

// ─── Color helpers ────────────────────────────────────────────────────────────

const LETTER_COLOR: Record<LetterGrade, string> = {
  A: GRADE_HEX["At benchmark"],
  B: GRADE_HEX["At benchmark"],
  C: GRADE_HEX["Close"],
  D: GRADE_HEX["Below"],
  F: GRADE_HEX["Below"],
  "": GRADE_HEX["Too little data"],
};

// ─── Summary cards (.fig style from HTML) ────────────────────────────────────

function FigCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <Box
      sx={{
        px: "14px",
        py: "12px",
        pb: "13px",
        bgcolor: "background.paper",
        minWidth: 140,
      }}
    >
      <Box sx={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.11em", textTransform: "uppercase", color: "text.secondary", mb: 0.4, fontFamily: "inherit" }}>
        {label}
      </Box>
      <Box
        sx={{
          fontSize: 23,
          fontWeight: 500,
          letterSpacing: "-0.03em",
          lineHeight: 1,
          color: color ?? "text.primary",
          fontVariantNumeric: "tabular-nums",
          fontFamily: "monospace",
        }}
      >
        {value}
      </Box>
      {sub && (
        <Box sx={{ fontSize: 10.5, color: "text.disabled", mt: 0.4, fontFamily: "inherit" }}>{sub}</Box>
      )}
    </Box>
  );
}

// ─── Stacked spend bar (matches HTML `seg()` helper) ─────────────────────────

function StackedSpendBar({ graded }: { graded: GradedCampaignLine[] }) {
  const s = summarize(graded);
  if (s.spendTotal <= 0) return null;

  const seg = (spend: number, grade: BenchmarkGrade) => {
    if (spend <= 0) return null;
    const frac = spend / s.spendTotal;
    const widthPct = frac * 100;
    const label = grade === "At benchmark" ? "At benchmark" : grade === "Optimize" ? "Optimize" : grade === "Close" ? "Close" : grade === "Below" ? "Below" : "Too little data";
    const inner =
      frac > 0.13
        ? `${(frac * 100).toFixed(0)}% · ${fmtMoney(spend)}`
        : frac > 0.055
        ? `${(frac * 100).toFixed(0)}%`
        : "";
    return (
      <Tooltip key={grade} title={`${label}: ${fmtMoney(spend)}`}>
        <Box
          sx={{
            width: `${widthPct}%`,
            height: "100%",
            bgcolor: GRADE_HEX[grade],
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            px: 0.5,
            overflow: "hidden",
          }}
        >
          {inner && (
            <Box
              sx={{
                fontSize: "0.68rem",
                fontWeight: 600,
                color: "rgba(255,255,255,0.9)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                fontFamily: "inherit",
              }}
            >
              {inner}
            </Box>
          )}
        </Box>
      </Tooltip>
    );
  };

  const TONES: { grade: BenchmarkGrade; spend: number; label: string }[] = [
    { grade: "At benchmark", spend: s.spendGood, label: "At benchmark" },
    { grade: "Optimize", spend: s.spendOpt, label: "Optimize" },
    { grade: "Close", spend: s.spendClose, label: "Close" },
    { grade: "Below", spend: s.spendBelow, label: "Below" },
    { grade: "Too little data", spend: s.spendNone, label: "Too little data" },
  ];

  return (
    <Box sx={{ mt: 2 }}>
      <Box
        sx={{
          display: "flex",
          height: 38,
          border: "1px solid",
          borderColor: "divider",
          overflow: "hidden",
          borderRadius: "4px",
        }}
      >
        {TONES.map((t) => seg(t.spend, t.grade))}
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: "10px 16px", mt: 0.75 }}>
        {TONES.map((t) => (
          <Box key={t.grade} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box
              sx={{
                width: 11,
                height: 11,
                borderRadius: "2px",
                bgcolor: GRADE_HEX[t.grade],
                flexShrink: 0,
              }}
            />
            <Box sx={{ fontSize: "0.7rem", color: "text.secondary", fontFamily: "inherit" }}>
              {t.label}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ─── Grade letter toggles (.tgl bar) ─────────────────────────────────────────

const ALL_LETTERS: LetterGrade[] = ["A", "B", "C", "D", "F"];

function LetterToggle({
  letterOrUngraded,
  active,
  count,
  onClick,
}: {
  letterOrUngraded: LetterGrade | "ungraded";
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  const color =
    letterOrUngraded === "ungraded"
      ? GRADE_HEX["Too little data"]
      : LETTER_COLOR[letterOrUngraded as LetterGrade];
  const label = letterOrUngraded === "ungraded" ? "Ungraded" : letterOrUngraded;

  return (
    <Box
      component="button"
      type="button"
      aria-pressed={active}
      onClick={onClick}
      sx={{
        px: 1,
        py: 0.4,
        border: "1.5px solid",
        borderColor: active ? color : "divider",
        borderRadius: 1,
        fontFamily: "inherit",
        fontSize: 12,
        fontWeight: 700,
        bgcolor: active ? color : "transparent",
        cursor: "pointer",
        color: active ? "#fff" : color,
        opacity: active ? 1 : 0.45,
        textDecoration: active ? "none" : "line-through",
        transition: "opacity 0.1s",
        "&:hover": { opacity: 1 },
      }}
    >
      {label}
      <Box component="span" sx={{ fontWeight: 400, fontSize: 11, ml: 0.4, opacity: active ? 0.75 : 1 }}>({count})</Box>
    </Box>
  );
}

// ─── Platform + cohort filter types (used in state only) ─────────────────────

type PlatformFilter = "both" | "linkedin" | "google";
type CohortFilter = "all" | "launched" | "carriedover" | "nodate";

// ─── Grade chip — matches HTML `.tag` class: tinted bg + combined grade·letter ──

function GradeChip({ grade, letter }: { grade: BenchmarkGrade; letter: LetterGrade }) {
  const label = letter ? `${grade} · ${letter}` : grade;
  return (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        px: 0.75,
        py: 0.2,
        borderRadius: "4px",
        fontSize: 11,
        fontWeight: 700,
        bgcolor: alpha(GRADE_HEX[grade], 0.12),
        color: GRADE_HEX[grade],
        whiteSpace: "nowrap",
        fontFamily: "inherit",
      }}
    >
      {label}
    </Box>
  );
}

// ─── Summary board (by budget line, matches HTML bmboard) ─────────────────────

function BoardView({
  rows,
  onSelectOwner,
  selectedOwner,
}: {
  rows: BenchmarkBoardRow[];
  onSelectOwner: (owner: string | null) => void;
  selectedOwner: string | null;
}) {
  if (rows.length === 0) {
    return (
      <Typography sx={{ fontSize: "0.78rem", color: "text.secondary", py: 2 }}>
        No campaigns to show for this period.
      </Typography>
    );
  }

  return (
    <TableContainer sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
      <Table size="small" sx={{ tableLayout: "fixed" }}>
        <TableHead>
          <TableRow sx={{ bgcolor: "background.default" }}>
            <TableCell sx={{ fontSize: 11.5, fontWeight: 700, width: "28%" }}>Budget line</TableCell>
            <TableCell align="right" sx={{ fontSize: 11.5, fontWeight: 700, width: 90 }}>Spend</TableCell>
            <TableCell align="right" sx={{ fontSize: 11.5, fontWeight: 700, width: 76, color: GRADE_HEX["At benchmark"] }}>At benchmark</TableCell>
            <TableCell align="right" sx={{ fontSize: 11.5, fontWeight: 700, width: 55, color: GRADE_HEX["Close"] }}>Close</TableCell>
            <TableCell align="right" sx={{ fontSize: 11.5, fontWeight: 700, width: 55, color: GRADE_HEX["Below"] }}>Below</TableCell>
            <TableCell align="right" sx={{ fontSize: 11.5, fontWeight: 700, width: 72 }}>% of spend</TableCell>
            <TableCell align="right" sx={{ fontSize: 11.5, fontWeight: 700, width: 90 }}>% of campaigns</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const isSelected = selectedOwner === row.label;
            return (
              <TableRow
                key={row.label}
                hover
                selected={isSelected}
                onClick={() => onSelectOwner(isSelected ? null : row.label)}
                sx={{ cursor: "pointer", "&.Mui-selected": { bgcolor: "action.selected" } }}
              >
                <TableCell sx={{ fontSize: 12, fontWeight: isSelected ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.label}
                  <Box component="span" sx={{ ml: 1, fontSize: 10, color: "text.disabled" }}>
                    {row.n}
                  </Box>
                </TableCell>
                <TableCell align="right" sx={{ fontSize: 12, fontFamily: "monospace" }}>{fmtMoney(row.spend)}</TableCell>
                <TableCell align="right" sx={{ fontSize: 12, fontFamily: "monospace", color: row.n_at_benchmark > 0 ? GRADE_HEX["At benchmark"] : "text.disabled" }}>
                  {row.n_at_benchmark}
                </TableCell>
                <TableCell align="right" sx={{ fontSize: 12, fontFamily: "monospace", color: row.n_close > 0 ? GRADE_HEX["Close"] : "text.disabled" }}>
                  {row.n_close}
                </TableCell>
                <TableCell align="right" sx={{ fontSize: 12, fontFamily: "monospace", color: row.n_below > 0 ? GRADE_HEX["Below"] : "text.disabled" }}>
                  {row.n_below}
                </TableCell>
                <TableCell align="right" sx={{ fontSize: 12, fontFamily: "monospace" }}>
                  {row.pct_spend !== null ? fmtPct(row.pct_spend) : "—"}
                </TableCell>
                <TableCell align="right" sx={{ fontSize: 12, fontFamily: "monospace" }}>
                  {row.pct_camp !== null ? fmtPct(row.pct_camp) : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ─── Campaigns table (17 columns matching HTML benchtbl) ──────────────────────

type SortKey = "name" | "spend" | "index" | "grade" | "impressions" | "ctr" | "cpc";

const GRADE_ORDER: Record<BenchmarkGrade, number> = {
  "At benchmark": 0,
  Optimize: 1,
  Close: 2,
  Below: 3,
  "Too little data": 4,
};

function SortHeader({
  k,
  label,
  align = "left",
  sortKey,
  sortDir,
  onSort,
}: {
  k: SortKey;
  label: string;
  align?: "left" | "right";
  sortKey: SortKey;
  sortDir: 1 | -1;
  onSort: (k: SortKey) => void;
}) {
  const active = sortKey === k;
  return (
    <TableCell
      align={align}
      onClick={() => onSort(k)}
      sx={{
        cursor: "pointer",
        fontSize: 11.5,
        fontWeight: 700,
        userSelect: "none",
        color: active ? "primary.main" : "text.primary",
        whiteSpace: "nowrap",
        "&:hover": { color: "primary.main" },
      }}
    >
      {label}{active ? (sortDir > 0 ? " ▲" : " ▼") : ""}
    </TableCell>
  );
}

function CampaignsView({
  rows,
  ownerFilter,
  letterFilter,
  setLetterFilter,
  query,
  setQuery,
}: {
  rows: GradedCampaignLine[];
  ownerFilter: string | null;
  letterFilter: Set<LetterGrade | "ungraded">;
  setLetterFilter: (s: Set<LetterGrade | "ungraded">) => void;
  query: string;
  setQuery: (v: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("grade");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(key); setSortDir(1); }
  }

  // Letter counts over all rows (not just filtered) for toggle display
  const letterCounts = useMemo(() => {
    const c: Record<LetterGrade | "ungraded", number> = { A: 0, B: 0, C: 0, D: 0, F: 0, "": 0, ungraded: 0 };
    for (const r of rows) {
      const k: LetterGrade | "ungraded" = r.letter || "ungraded";
      if (k in c) c[k as keyof typeof c]++;
    }
    return c;
  }, [rows]);

  function toggleLetter(key: LetterGrade | "ungraded") {
    const next = new Set(letterFilter);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setLetterFilter(next);
  }

  const filtered = useMemo(() => {
    let r = rows;
    if (ownerFilter) r = r.filter((l) => (l.owner ?? "Unknown") === ownerFilter);
    if (query) r = r.filter((l) => l.name.toLowerCase().includes(query.toLowerCase()));
    r = r.filter((l) => letterFilter.has(l.letter || "ungraded"));
    return [...r].sort((a, b) => {
      let x: number | string;
      let y: number | string;
      if (sortKey === "grade") { x = GRADE_ORDER[a.grade]; y = GRADE_ORDER[b.grade]; }
      else if (sortKey === "ctr") { x = a.impressions > 0 ? a.clicks / a.impressions : -1; y = b.impressions > 0 ? b.clicks / b.impressions : -1; }
      else if (sortKey === "cpc") { x = a.clicks > 0 ? a.spend / a.clicks : 1e9; y = b.clicks > 0 ? b.spend / b.clicks : 1e9; }
      else if (sortKey === "index") { x = a.index ?? -1; y = b.index ?? -1; }
      else if (sortKey === "spend") { x = a.spend; y = b.spend; }
      else if (sortKey === "impressions") { x = a.impressions; y = b.impressions; }
      else { x = a.name; y = b.name; }
      if (typeof x === "string") return x.localeCompare(y as string) * sortDir;
      return ((x as number) - (y as number)) * sortDir;
    });
  }, [rows, ownerFilter, query, letterFilter, sortKey, sortDir]);

  const totalSpend = filtered.reduce((a, l) => a + l.spend, 0);
  const sortProps = { sortKey, sortDir, onSort: toggleSort };

  return (
    <Box>
      {/* .tgl bar: grade letter toggles + search, all in one row — matches HTML .tgl */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, flexWrap: "wrap", bgcolor: "action.hover", borderBottom: "1px solid", borderColor: "divider", px: "15px", py: "10px" }}>
        {ALL_LETTERS.map((l) => (
          <LetterToggle
            key={l}
            letterOrUngraded={l}
            active={letterFilter.has(l)}
            count={letterCounts[l]}
            onClick={() => toggleLetter(l)}
          />
        ))}
        <LetterToggle
          letterOrUngraded="ungraded"
          active={letterFilter.has("ungraded")}
          count={letterCounts.ungraded}
          onClick={() => toggleLetter("ungraded")}
        />
        <Box
          component="button"
          type="button"
          onClick={() => setLetterFilter(new Set<LetterGrade | "ungraded">([...ALL_LETTERS, "ungraded"]))}
          sx={{ px: 1, py: 0.3, border: "1px solid", borderColor: "divider", borderRadius: 1, fontFamily: "inherit", fontSize: 11, color: "text.secondary", cursor: "pointer", bgcolor: "transparent", "&:hover": { borderColor: "text.secondary" } }}
        >
          All
        </Box>
        <Box
          component="button"
          type="button"
          onClick={() => setLetterFilter(new Set())}
          sx={{ px: 1, py: 0.3, border: "1px solid", borderColor: "divider", borderRadius: 1, fontFamily: "inherit", fontSize: 11, color: "text.secondary", cursor: "pointer", bgcolor: "transparent", "&:hover": { borderColor: "text.secondary" } }}
        >
          None
        </Box>
        <Box
          component="input"
          type="text"
          placeholder="find a campaign…"
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          sx={{
            px: 1.25,
            py: 0.55,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            fontSize: 12,
            fontFamily: "inherit",
            bgcolor: "background.default",
            color: "text.primary",
            outline: "none",
            "&:focus": { borderColor: "primary.main" },
            minWidth: 180,
            ml: 0.5,
          }}
        />
        <Box sx={{ ml: "auto", fontSize: 11, fontFamily: "monospace", color: "text.disabled" }}>
          {filtered.length} shown · {fmtMoney(totalSpend)}
        </Box>
      </Box>

      {filtered.length === 0 ? (
        <Typography sx={{ fontSize: "0.78rem", color: "text.secondary", py: 2 }}>
          No campaigns match the current filters.
        </Typography>
      ) : (
        <TableContainer sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, maxHeight: 560, overflow: "auto" }}>
          <Table size="small" stickyHeader sx={{ tableLayout: "fixed", minWidth: 1200 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: "background.default" }}>
                <SortHeader k="name" label="Campaign" {...sortProps} />
                <TableCell sx={{ fontSize: 11.5, fontWeight: 700, width: 44 }}>Pf</TableCell>
                <TableCell sx={{ fontSize: 11.5, fontWeight: 700, width: 88 }}>Owner</TableCell>
                <SortHeader k="spend" label="Spend" align="right" {...sortProps} />
                <SortHeader k="impressions" label="Impr" align="right" {...sortProps} />
                <TableCell align="right" sx={{ fontSize: 11.5, fontWeight: 700, width: 60 }}>Clicks</TableCell>
                <SortHeader k="ctr" label="CTR" align="right" {...sortProps} />
                <SortHeader k="cpc" label="CPC" align="right" {...sortProps} />
                <TableCell sx={{ fontSize: 11.5, fontWeight: 700, width: 90 }}>Judged on</TableCell>
                <TableCell align="right" sx={{ fontSize: 11.5, fontWeight: 700, width: 68 }}>Actual</TableCell>
                <TableCell align="right" sx={{ fontSize: 11.5, fontWeight: 700, width: 68 }}>Bench</TableCell>
                <TableCell sx={{ fontSize: 11.5, fontWeight: 700, width: 72 }}>Cost on</TableCell>
                <TableCell align="right" sx={{ fontSize: 11.5, fontWeight: 700, width: 68 }}>Actual</TableCell>
                <TableCell align="right" sx={{ fontSize: 11.5, fontWeight: 700, width: 68 }}>Bench</TableCell>
                <SortHeader k="index" label="Index" align="right" {...sortProps} />
                <SortHeader k="grade" label="Result" {...sortProps} />
                <TableCell sx={{ fontSize: 11.5, fontWeight: 700, width: "16%" }}>Why</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((l) => {
                const ctr = l.impressions > 0 ? l.clicks / l.impressions : null;
                const cpc = l.clicks > 0 ? l.spend / l.clicks : null;

                const fmtConv = (v: number | null) => {
                  if (v === null) return "—";
                  if (l.conversion_metric_name === "CTR") return fmtPct(v, 2);
                  return fmtPct(v, 1);
                };
                const fmtConvBench = (v: number | null) =>
                  v !== null ? fmtPct(v, l.conversion_metric_name === "CTR" ? 2 : 1) : "—";
                const fmtCostVal = (v: number | null) =>
                  v === null ? "—" : l.cost_metric_name === "CPL" ? fmtMoney(v) : `$${v.toFixed(2)}`;

                let actualConv: number | null = null;
                if (l.conversion_metric_name === "CTR") actualConv = ctr;
                else if (l.conversion_metric_name === "Form completion") {
                  const fo = l.form_opens ?? 0;
                  actualConv = fo > 0 ? (l.leads ?? 0) / fo : null;
                } else if (l.conversion_metric_name === "Open rate") {
                  const snd = l.sends ?? 0;
                  actualConv = snd > 0 ? (l.message_opens ?? 0) / snd : null;
                }

                let actualCost: number | null = null;
                if (l.cost_metric_name === "CPC") actualCost = cpc;
                else if (l.cost_metric_name === "CPL") actualCost = (l.leads ?? 0) > 0 ? l.spend / l.leads! : null;
                else if (l.cost_metric_name === "CPM") actualCost = l.impressions > 0 ? (l.spend / l.impressions) * 1000 : null;
                else if (l.cost_metric_name === "Cost per click") actualCost = (l.message_clicks ?? 0) > 0 ? l.spend / l.message_clicks! : null;

                const gradeHex = GRADE_HEX[l.grade];

                return (
                  <TableRow key={l.id} hover>
                    <TableCell sx={{ fontSize: 12 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                        <Box
                          component="span"
                          sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: l.is_live ? GRADE_HEX["At benchmark"] : "divider", flexShrink: 0 }}
                        />
                        <Tooltip title={l.name}>
                          <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200, display: "block" }}>
                            {l.name}
                          </Box>
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box
                        component="span"
                        sx={{
                          fontSize: 10,
                          fontWeight: 700,
                          px: 0.6,
                          py: 0.2,
                          borderRadius: "3px",
                          bgcolor: l.platform === "google" ? "action.selected" : alpha("#185FA5", 0.12),
                          color: l.platform === "google" ? "text.secondary" : "#185FA5",
                          display: "inline-block",
                        }}
                      >
                        {l.platform === "google" ? "Ggl" : "LI"}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontSize: 11.5, color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {l.owner ?? "—"}
                    </TableCell>
                    <TableCell align="right" sx={{ fontSize: 12, fontFamily: "monospace" }}>{fmtMoney(l.spend)}</TableCell>
                    <TableCell align="right" sx={{ fontSize: 12, fontFamily: "monospace" }}>{l.impressions.toLocaleString()}</TableCell>
                    <TableCell align="right" sx={{ fontSize: 12, fontFamily: "monospace" }}>{l.clicks.toLocaleString()}</TableCell>
                    <TableCell align="right" sx={{ fontSize: 12, fontFamily: "monospace" }}>{ctr !== null ? fmtPct(ctr, 2) : "—"}</TableCell>
                    <TableCell align="right" sx={{ fontSize: 12, fontFamily: "monospace" }}>{cpc !== null ? `$${cpc.toFixed(2)}` : "—"}</TableCell>
                    <TableCell sx={{ fontSize: 11.5, color: "text.secondary", whiteSpace: "nowrap" }}>{l.conversion_metric_name || "—"}</TableCell>
                    <TableCell align="right" sx={{ fontSize: 12, fontFamily: "monospace" }}>{fmtConv(actualConv)}</TableCell>
                    <TableCell align="right" sx={{ fontSize: 12, fontFamily: "monospace", color: "text.secondary" }}>{fmtConvBench(l.conversion_benchmark)}</TableCell>
                    <TableCell sx={{ fontSize: 11.5, color: "text.secondary", whiteSpace: "nowrap" }}>{l.cost_metric_name || "—"}</TableCell>
                    <TableCell align="right" sx={{ fontSize: 12, fontFamily: "monospace" }}>{fmtCostVal(actualCost)}</TableCell>
                    <TableCell align="right" sx={{ fontSize: 12, fontFamily: "monospace", color: "text.secondary" }}>{fmtCostVal(l.cost_benchmark)}</TableCell>
                    <TableCell align="right" sx={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: gradeHex }}>
                      {fmtIndex(l.index)}
                    </TableCell>
                    <TableCell>
                      <GradeChip grade={l.grade} letter={l.letter} />
                    </TableCell>
                    <TableCell sx={{ fontSize: 11, color: "text.secondary", lineHeight: 1.45 }}>{l.why}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

// ─── Panel wrapper — matches HTML .panel + .ph ────────────────────────────────

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Box sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider", mb: "18px" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px", flexWrap: "wrap", px: "15px", py: "11px", borderBottom: "1px solid", borderColor: "divider" }}>
        <Box sx={{ fontFamily: "inherit", fontSize: 13, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "text.primary" }}>
          {title}
        </Box>
        {hint && <Box sx={{ fontFamily: "monospace", fontSize: 10.5, color: "text.disabled" }}>{hint}</Box>}
      </Box>
      {children}
    </Box>
  );
}

// Generic tgl button — pressed = ink (text.primary), matches HTML .tgl button[aria-pressed=true]
function TglBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Box
      component="button"
      type="button"
      aria-pressed={active}
      onClick={onClick}
      sx={{
        fontFamily: "monospace",
        fontSize: 11,
        px: "9px",
        py: "4px",
        border: "1px solid",
        borderColor: active ? "text.primary" : "divider",
        borderRadius: "2px",
        bgcolor: active ? "text.primary" : "background.paper",
        color: active ? "background.paper" : "text.secondary",
        cursor: "pointer",
        "&:hover": { borderColor: "text.primary", color: "text.primary" },
      }}
    >
      {children}
    </Box>
  );
}

// ─── How grading works content ────────────────────────────────────────────────

function GradingExplainer() {
  return (
    <Box sx={{ p: "12px 15px", fontSize: "12.8px", lineHeight: 1.65, color: "text.secondary" }}>
      <Box sx={{ fontWeight: 700, color: "text.primary", mb: 0.75 }}>Every campaign is scored on one conversion metric and one cost metric.</Box>
      <Box component="ul" sx={{ pl: 2.5, m: 0, mb: 1.5 }}>
        <li><strong>LinkedIn lead generation</strong> — form completion rate against CPL (DemandSense 2026).</li>
        <li><strong>LinkedIn website visits, engagement, brand awareness</strong> — CTR against CPC (brand awareness uses CPM).</li>
        <li><strong>LinkedIn Sponsored Messaging</strong> — open rate against cost per click. Needs ≥ 200 sends.</li>
        <li><strong>Google</strong> — CTR + CPC against WSO2's region-specific benchmarks, derived from the campaign name prefix.</li>
      </Box>
      <Box>
        Index = √(actual ÷ benchmark for conversion × benchmark ÷ actual for cost), each ratio capped 0.1×–4×.{" "}
        <strong>At benchmark ≥ 1.05 · Close ≥ 0.80 · Below &lt; 0.80.</strong>{" "}
        <strong>Optimize</strong> = index ≥ 1.05 on conversion but cost above the benchmark — counts as At benchmark in all totals.{" "}
        Letter grades: A ≥ 1.30 · B ≥ 1.05 · C ≥ 0.80 · D ≥ 0.50 · F &lt; 0.50. No E.{" "}
        Below 1,000 impressions (or 200 sends for Sponsored Messaging) a campaign is not graded.
      </Box>
    </Box>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const DEFAULT_WINDOW: DateWindow = { mode: "preset", preset: "1m" };

export default function BenchmarkGradingPage() {
  const [window, setWindow] = useState<DateWindow>(DEFAULT_WINDOW);
  const [selectedOwner, setSelectedOwner] = useState<string | null>(null);
  const [liveOnly, setLiveOnly] = useState(true);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("both");
  const [cohortFilter, setCohortFilter] = useState<CohortFilter>("all");
  const [letterFilter, setLetterFilter] = useState<Set<LetterGrade | "ungraded">>(
    new Set<LetterGrade | "ungraded">([...ALL_LETTERS, "ungraded"])
  );
  const [campQuery, setCampQuery] = useState("");
  const [showBmEditor, setShowBmEditor] = useState(false);

  const bm = useBenchmarkTables();
  const queryResult = useBenchmarkGrading(window);

  const allGraded = useMemo<GradedCampaignLine[]>(
    () => gradeAllWith(queryResult.data?.campaigns ?? [], bm.tables),
    [queryResult.data, bm.tables],
  );

  // Apply live/paused filter
  const liveFiltered = useMemo(
    () => (liveOnly ? allGraded.filter((l) => l.is_live) : allGraded),
    [allGraded, liveOnly],
  );

  // Window date bounds for cohort filter
  const windowStart = queryResult.data?.window_start ?? null;

  // Cohort counts (over liveFiltered)
  const cohortCounts = useMemo<Record<CohortFilter, number>>(() => {
    let launched = 0, carriedover = 0, nodate = 0;
    for (const l of liveFiltered) {
      if (!l.started_at) nodate++;
      else if (windowStart && l.started_at >= windowStart) launched++;
      else carriedover++;
    }
    return { all: liveFiltered.length, launched, carriedover, nodate };
  }, [liveFiltered, windowStart]);

  // Apply platform + cohort filters
  const graded = useMemo(() => {
    return liveFiltered.filter((l) => {
      if (platformFilter === "linkedin" && l.platform !== "linkedin") return false;
      if (platformFilter === "google" && l.platform !== "google") return false;
      if (cohortFilter === "launched") {
        if (!l.started_at || (windowStart && l.started_at < windowStart)) return false;
      } else if (cohortFilter === "carriedover") {
        if (!l.started_at || (windowStart && l.started_at >= windowStart)) return false;
      } else if (cohortFilter === "nodate") {
        if (l.started_at) return false;
      }
      return true;
    });
  }, [liveFiltered, platformFilter, cohortFilter, windowStart]);

  const summary = useMemo(() => summarize(graded), [graded]);
  const boardRows = useMemo(() => buildBoardRows(graded), [graded]);

  const error = queryResult.error ? describeError(queryResult.error) : null;

  const spendShareColor =
    summary.spendShare !== null
      ? summary.spendShare >= 0.8
        ? GRADE_HEX["At benchmark"]
        : GRADE_HEX["Below"]
      : undefined;
  const campShareColor =
    summary.campShare !== null
      ? summary.campShare >= 0.8
        ? GRADE_HEX["At benchmark"]
        : GRADE_HEX["Below"]
      : undefined;

  return (
    <MarketingOpsShell
      eyebrow={MARKETING_OPS_EYEBROW.adCampaigns}
      title="Benchmark Grading"
      subtitle="Every campaign scored on conversion and cost against WSO2's internal benchmarks."
    >
      {/* Controls */}
      <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, p: 2.5, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "flex-end", gap: 3, flexWrap: "wrap" }}>
          <DateRangePicker window={window} onChange={setWindow} />
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            <Box sx={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "text.secondary", fontFamily: "inherit" }}>
              Basis
            </Box>
            <Box sx={{ display: "flex", gap: 0.5 }}>
              <ToggleChip label="Live only" active={liveOnly} onClick={() => setLiveOnly(true)} />
              <ToggleChip label="All campaigns" active={!liveOnly} onClick={() => setLiveOnly(false)} />
            </Box>
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            <Box sx={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "text.secondary", fontFamily: "inherit" }}>
              Benchmarks
            </Box>
            <Box
              component="button"
              type="button"
              onClick={() => setShowBmEditor((v) => !v)}
              sx={{
                px: "12px",
                py: "6px",
                border: "1.5px solid",
                borderColor: showBmEditor ? "primary.main" : "divider",
                borderRadius: "6px",
                fontSize: 12.5,
                fontFamily: "inherit",
                cursor: "pointer",
                bgcolor: showBmEditor ? "primary.main" : "background.paper",
                color: showBmEditor ? "#fff" : "text.primary",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "6px",
                "&:hover": { borderColor: "primary.main", bgcolor: showBmEditor ? "primary.dark" : "action.hover" },
              }}
            >
              Edit benchmarks
              {bm.isModified && (
                <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: showBmEditor ? "rgba(255,255,255,0.8)" : "warning.main", display: "inline-block", flexShrink: 0 }} />
              )}
            </Box>
          </Box>
          <Box sx={{ flex: 1, display: "flex", justifyContent: "flex-end", alignItems: "flex-end", gap: 1 }}>
            {queryResult.isFetching && <CircularProgress size={16} />}
            <Tooltip title="Refresh — fetch the latest data">
              <span>
                <IconButton
                  onClick={() => void queryResult.refetch()}
                  disabled={queryResult.isFetching}
                  size="small"
                  sx={{ color: "primary.main", border: 1, borderColor: "divider", borderRadius: 1, "&:hover": { borderColor: "primary.main" } }}
                >
                  <Box
                    component="span"
                    sx={{
                      display: "inline-flex",
                      ...(queryResult.isFetching && {
                        animation: "benchmarkGradingSpin 0.8s linear infinite",
                        "@keyframes benchmarkGradingSpin": { to: { transform: "rotate(360deg)" } },
                      }),
                    }}
                  >
                    <RefreshCw size={16} />
                  </Box>
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2, fontSize: "0.76rem" }}>
          Couldn't load benchmark data: {error}
        </Alert>
      )}

      {queryResult.isFetching && graded.length === 0 && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 3 }}>
          <CircularProgress size={16} />
          <Typography sx={{ fontSize: "0.78rem", color: "text.secondary" }}>Loading…</Typography>
        </Box>
      )}

      {queryResult.data && queryResult.data.warnings?.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2, fontSize: "0.76rem" }}>
          Some data is missing from this view:
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {queryResult.data.warnings.map((w) => <li key={w}>{w}</li>)}
          </Box>
        </Alert>
      )}

      {queryResult.data && !queryResult.isFetching && graded.length === 0 && (
        <Typography sx={{ fontSize: "0.78rem", color: "text.secondary", py: 3, textAlign: "center" }}>
          No campaigns for this period{liveOnly ? " — try “All campaigns” to include paused ones" : ""}.
        </Typography>
      )}

      {graded.length > 0 && (
        <>
          {/* .figs — 6 stat cards, grid with 1px gaps (HTML .figs pattern) */}
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1px", bgcolor: "divider", mb: "18px" }}>
            <FigCard label="Spend graded" value={fmtMoney(summary.spendTotal - summary.spendNone)} sub={`${summary.nGradeable} of ${summary.total} campaigns`} />
            <FigCard label="At benchmark" value={fmtMoney(summary.spendMet)} sub={`${summary.nMet} campaigns`} color={GRADE_HEX["At benchmark"]} />
            <FigCard label="% of spend" value={summary.spendShare !== null ? fmtPct(summary.spendShare) : "—"} sub="target is 80%" color={spendShareColor} />
            <FigCard label="% of campaigns" value={summary.campShare !== null ? fmtPct(summary.campShare) : "—"} sub="target is 80%" color={campShareColor} />
            <FigCard label="CTR" value={summary.ctr !== null ? fmtPct(summary.ctr, 2) : "—"} />
            <FigCard label="CPC" value={summary.cpc !== null ? `$${summary.cpc.toFixed(2)}` : "—"} />
          </Box>

          {/* Panel: Spend against benchmark — platform+cohort tgl bar + 38px stacked bar */}
          <Panel title="Spend against benchmark" hint="every dollar in this view">
            {/* .tgl bar: platform | separator | cohort | count */}
            <Box sx={{ display: "flex", gap: "7px", alignItems: "center", flexWrap: "wrap", px: "15px", py: "10px", borderBottom: "1px solid", borderColor: "divider", bgcolor: "action.hover" }}>
              <TglBtn active={platformFilter === "both"} onClick={() => setPlatformFilter("both")}>Both platforms</TglBtn>
              <TglBtn active={platformFilter === "linkedin"} onClick={() => setPlatformFilter("linkedin")}>LinkedIn only</TglBtn>
              <TglBtn active={platformFilter === "google"} onClick={() => setPlatformFilter("google")}>Google only</TglBtn>
              <Box sx={{ width: "1px", height: "18px", bgcolor: "divider", mx: "4px" }} />
              <TglBtn active={cohortFilter === "all"} onClick={() => setCohortFilter("all")}>All ad sets ({cohortCounts.all})</TglBtn>
              <TglBtn active={cohortFilter === "launched"} onClick={() => setCohortFilter("launched")}>Launched in period ({cohortCounts.launched})</TglBtn>
              <TglBtn active={cohortFilter === "carriedover"} onClick={() => setCohortFilter("carriedover")}>Carried over ({cohortCounts.carriedover})</TglBtn>
              <TglBtn active={cohortFilter === "nodate"} onClick={() => setCohortFilter("nodate")}>No launch date ({cohortCounts.nodate})</TglBtn>
              <Box sx={{ ml: "auto", fontFamily: "monospace", fontSize: 11, color: "text.disabled" }}>
                {summary.total} campaigns · {fmtMoney(summary.spendTotal)}
              </Box>
            </Box>
            <Box sx={{ p: "14px 15px 16px" }}>
              <StackedSpendBar graded={graded} />
            </Box>
          </Panel>

          {/* Panel: By budget line */}
          <Panel title="By budget line" hint="click a row to filter the campaigns table">
            <BoardView
              rows={boardRows}
              onSelectOwner={(owner) => setSelectedOwner((prev) => prev === owner ? null : owner)}
              selectedOwner={selectedOwner}
            />
          </Panel>

          {/* Panel: Campaigns */}
          <Panel
            title="Campaigns"
            hint={`${graded.length} campaign${graded.length !== 1 ? "s" : ""} · click a header to sort`}
          >
            <CampaignsView
              rows={graded}
              ownerFilter={selectedOwner}
              letterFilter={letterFilter}
              setLetterFilter={setLetterFilter}
              query={campQuery}
              setQuery={setCampQuery}
            />
          </Panel>

          {/* Panel: How grading works */}
          <Panel title="How grading works">
            <GradingExplainer />
          </Panel>

          {/* Panel: Edit benchmarks (shown when toggled) */}
          {showBmEditor && (
            <Panel
              title="Benchmark values"
              hint={bm.isModified ? "modified — reset to restore defaults" : "defaults from DemandSense 2026"}
            >
              <BenchmarkEditorPanel bm={bm} />
            </Panel>
          )}
        </>
      )}

      <Typography sx={{ fontSize: 11, color: "text.disabled", mt: 2 }}>
        Benchmarks: LinkedIn — DemandSense 2026 regional figures by objective. Google — WSO2 internal benchmarks by region. Grading is computed client-side; data refreshes with the period selector.
      </Typography>
    </MarketingOpsShell>
  );
}

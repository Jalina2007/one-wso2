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

// Benchmark Grading sheet — the main UI for the second Ad Campaigns screen.
// Receives already-graded lines (from the page, which owns the CSV import
// and grading pass), then provides filtering, sorting, summary cards, the
// spend stacked bar, and the campaign line table.

import { useState } from "react";
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TextField,
  Tooltip,
} from "@wso2/oxygen-ui";
import type { GradedLine, BenchmarkGrade, BenchmarkLetter, GradeSortKey, BenchmarkSummary } from "../benchmarkGradingTypes";
import { GRADE_LETTERS } from "../benchmarkGradingTypes";
import { summarize, sortLines, fmtMoney, fmtPct } from "../benchmarkGradingLogic";
import { NUMERIC, TintChip } from "./campaignTrackerPrimitives";
import { FilterLabel } from "./FilterControls";

// ─── Grade color helpers ──────────────────────────────────────────────────────

type GradeTone = "good" | "opt" | "watch" | "poor" | "none";

function gradeToTone(g: BenchmarkGrade): GradeTone {
  if (g === "At benchmark") return "good";
  if (g === "Optimize") return "opt";
  if (g === "Close") return "watch";
  if (g === "Below") return "poor";
  return "none";
}

// Fixed palette so grade colors are stable regardless of oxygen-ui theme.
const GRADE_HEX: Record<GradeTone, string> = {
  good: "#0E7C6B",
  opt: "#5B4BC4",
  watch: "#B26A00",
  poor: "#C0392B",
  none: "#9AA5B1",
};

function gradeColor(g: BenchmarkGrade): string {
  return GRADE_HEX[gradeToTone(g)];
}

// ─── Stacked bar ─────────────────────────────────────────────────────────────

function StackedSpendBar({ summary }: { summary: BenchmarkSummary }) {
  const total = summary.spendTotal;
  if (total <= 0) return null;
  const seg = (spend: number, tone: GradeTone, label: string) => {
    const pct = (spend / total) * 100;
    if (pct < 0.3) return null;
    return (
      <Tooltip key={tone} title={`${label}: ${fmtMoney(spend)} (${pct.toFixed(1)}%)`}>
        <Box sx={{ height: "100%", width: `${pct}%`, bgcolor: GRADE_HEX[tone], flexShrink: 0 }} />
      </Tooltip>
    );
  };
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, mt: 2 }}>
      <FilterLabel>Spend against benchmark</FilterLabel>
      <Box sx={{ display: "flex", height: 18, borderRadius: 1, overflow: "hidden", border: 1, borderColor: "divider" }}>
        {seg(summary.spendGood, "good", "At benchmark")}
        {seg(summary.spendOpt, "opt", "Optimize")}
        {seg(summary.spendWatch, "watch", "Close")}
        {seg(summary.spendPoor, "poor", "Below")}
        {seg(summary.spendNone, "none", "Too little data")}
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
        {(["good", "opt", "watch", "poor", "none"] as GradeTone[]).map((tone) => {
          const labels: Record<GradeTone, string> = {
            good: "At benchmark",
            opt: "Optimize",
            watch: "Close",
            poor: "Below",
            none: "Too little data",
          };
          const spend: Record<GradeTone, number> = {
            good: summary.spendGood,
            opt: summary.spendOpt,
            watch: summary.spendWatch,
            poor: summary.spendPoor,
            none: summary.spendNone,
          };
          const count: Record<GradeTone, number> = {
            good: summary.nGood,
            opt: summary.nOpt,
            watch: summary.nWatch,
            poor: summary.nPoor,
            none: summary.nNone,
          };
          return (
            <Box key={tone} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: GRADE_HEX[tone], flexShrink: 0 }} />
              <Typography sx={{ fontSize: "0.7rem", color: "text.secondary" }}>
                {labels[tone]} {fmtMoney(spend[tone])} · {count[tone]}
              </Typography>
            </Box>
          );
        })}
      </Box>
      <Typography sx={{ fontSize: "0.74rem", color: "text.secondary" }}>
        <Box component="b" sx={{ fontFamily: "monospace", fontSize: "0.88rem", color: summary.spendShare !== null && summary.spendShare >= 0.8 ? GRADE_HEX.good : GRADE_HEX.poor }}>
          {summary.spendShare !== null ? fmtPct(summary.spendShare) : "—"} of spend
        </Box>
        {" "}and{" "}
        <Box component="b" sx={{ fontFamily: "monospace", fontSize: "0.88rem", color: summary.campShare !== null && summary.campShare >= 0.8 ? GRADE_HEX.good : GRADE_HEX.poor }}>
          {summary.campShare !== null ? fmtPct(summary.campShare) : "—"} of campaigns
        </Box>
        {" "}meet the benchmark.{" "}
        <Box component="span" sx={{ color: "text.disabled" }}>
          "Optimize" clears the bar on conversion but costs more than benchmark.
        </Box>
      </Typography>
    </Box>
  );
}

// ─── Summary stat cells ───────────────────────────────────────────────────────

function SumCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <Box sx={{ px: 1.75, py: 1.25, borderLeft: 1, borderColor: "divider", "&:first-of-type": { borderLeft: 0 }, minWidth: 110 }}>
      <Typography sx={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: "text.secondary", mb: 0.5 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 19, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1, color: color ?? "text.primary", ...NUMERIC }}>
        {value}
      </Typography>
      {sub && <Typography sx={{ fontSize: 10, color: "text.disabled", mt: 0.25 }}>{sub}</Typography>}
    </Box>
  );
}

// ─── Grade letter filter toggle ───────────────────────────────────────────────

function LetterToggle({
  letter,
  active,
  count,
  onClick,
}: {
  letter: BenchmarkLetter | "ungraded";
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  const color = letter === "ungraded" ? GRADE_HEX.none : letter === "A" || letter === "B" ? GRADE_HEX.good : letter === "C" ? GRADE_HEX.watch : GRADE_HEX.poor;
  return (
    <Box
      component="button"
      type="button"
      disabled={count === 0}
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        px: 1,
        py: 0.5,
        border: "1px solid",
        borderRadius: 0.5,
        cursor: count > 0 ? "pointer" : "default",
        font: "inherit",
        bgcolor: active ? color : "transparent",
        borderColor: active ? color : "divider",
        transition: "all 0.1s",
        "&:hover:not(:disabled)": { borderColor: color },
      }}
    >
      <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: active ? "#fff" : count === 0 ? "text.disabled" : color }}>
        {letter === "ungraded" ? "Ungraded" : letter}
      </Typography>
      <Typography sx={{ fontSize: "0.68rem", color: active ? "rgba(255,255,255,0.75)" : "text.disabled" }}>({count})</Typography>
    </Box>
  );
}

// ─── Line table ───────────────────────────────────────────────────────────────

type SortCol = [GradeSortKey, string, "asc" | "desc", "right" | undefined];
const COLUMNS: SortCol[] = [
  ["name", "Campaign", "asc", undefined],
  ["grade", "Result", "asc", undefined],
  ["spend", "Spend", "desc", "right"],
  ["impressions", "Impr.", "desc", "right"],
  ["clicks", "Clicks", "desc", "right"],
  ["ctr", "CTR", "desc", "right"],
  ["cpc", "CPC", "desc", "right"],
  ["idx", "Index", "desc", "right"],
];

function ctrOf(l: GradedLine): number | null {
  return l.impressions > 0 ? l.clicks / l.impressions : null;
}
function cpcOf(l: GradedLine): number | null {
  return l.clicks > 0 ? l.spend / l.clicks : null;
}

// ─── Main sheet component ─────────────────────────────────────────────────────

export function BenchmarkGradingSheet({ lines }: { lines: GradedLine[] }) {
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<"all" | "Google Ads" | "LinkedIn">("all");
  const [letterFilter, setLetterFilter] = useState<Set<BenchmarkLetter | "ungraded">>(new Set());
  const [showPaused, setShowPaused] = useState(false);
  const [sortKey, setSortKey] = useState<GradeSortKey>("idx");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleLetter(l: BenchmarkLetter | "ungraded") {
    setLetterFilter((prev) => {
      const next = new Set(prev);
      if (next.has(l)) next.delete(l);
      else next.add(l);
      return next;
    });
  }

  function toggleSort(key: GradeSortKey, defaultDir: "asc" | "desc") {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(defaultDir); }
  }
  const arrow = (key: GradeSortKey) => (sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "");

  // Count by letter for toggle bar
  const letterCounts = { A: 0, B: 0, C: 0, D: 0, F: 0, ungraded: 0 };
  for (const l of lines) {
    if (!l.letter) letterCounts.ungraded++;
    else letterCounts[l.letter as keyof typeof letterCounts]++;
  }

  const filtered = sortLines(
    lines.filter((l) => {
      if (!showPaused && !l.live) return false;
      if (platformFilter !== "all" && l.platform !== platformFilter) return false;
      if (search && !l.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (letterFilter.size > 0) {
        const lk: BenchmarkLetter | "ungraded" = l.letter || "ungraded";
        if (!letterFilter.has(lk)) return false;
      }
      return true;
    }),
    sortKey,
    sortDir,
  );

  const summary = summarize(filtered);

  return (
    <Box>
      {/* Summary strip */}
      <Box sx={{ display: "inline-flex", flexWrap: "wrap", border: 1, borderColor: "divider", borderRadius: 1.5, overflow: "hidden", mb: 2 }}>
        <SumCard
          label="Spend graded"
          value={fmtMoney(summary.spendGradeable)}
          sub={`${summary.nGradeable} of ${summary.total} campaigns`}
        />
        <SumCard
          label="At benchmark"
          value={fmtMoney(summary.spendMet)}
          sub={`${summary.nGood + summary.nOpt} campaigns`}
          color={GRADE_HEX.good}
        />
        <SumCard
          label="% of spend"
          value={summary.spendShare !== null ? fmtPct(summary.spendShare) : "—"}
          sub="target is 80%"
          color={summary.spendShare !== null ? (summary.spendShare >= 0.8 ? GRADE_HEX.good : GRADE_HEX.poor) : undefined}
        />
        <SumCard
          label="% of campaigns"
          value={summary.campShare !== null ? fmtPct(summary.campShare) : "—"}
          sub="target is 80%"
          color={summary.campShare !== null ? (summary.campShare >= 0.8 ? GRADE_HEX.good : GRADE_HEX.poor) : undefined}
        />
        <SumCard
          label="CTR"
          value={summary.ctr !== null ? fmtPct(summary.ctr, 2) : "—"}
        />
        <SumCard
          label="CPC"
          value={summary.cpc !== null ? `$${summary.cpc.toFixed(2)}` : "—"}
        />
      </Box>

      <StackedSpendBar summary={summary} />

      {/* Filter controls */}
      <Box sx={{ mt: 2.5, display: "flex", alignItems: "flex-end", gap: 2, flexWrap: "wrap" }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
          <FilterLabel>Search</FilterLabel>
          <TextField
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Campaign name…"
            sx={{ width: 240, "& .MuiInputBase-input": { fontSize: "0.76rem" } }}
          />
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
          <FilterLabel>Platform</FilterLabel>
          <Box sx={{ display: "flex", gap: 0.5 }}>
            {(["all", "Google Ads", "LinkedIn"] as const).map((p) => (
              <Box
                key={p}
                component="button"
                type="button"
                onClick={() => setPlatformFilter(p)}
                sx={{
                  px: 1.25, py: 0.5, border: "1px solid",
                  borderRadius: 0.5, cursor: "pointer", font: "inherit",
                  bgcolor: platformFilter === p ? "#1B2A49" : "transparent",
                  borderColor: platformFilter === p ? "#1B2A49" : "divider",
                  "&:hover": { borderColor: "text.primary" },
                }}
              >
                <Typography sx={{ fontSize: "0.72rem", fontWeight: platformFilter === p ? 700 : 500, color: platformFilter === p ? "#fff" : "text.primary" }}>
                  {p === "all" ? "All" : p}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
          <FilterLabel>Grade</FilterLabel>
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
            {GRADE_LETTERS.map((l) => (
              <LetterToggle
                key={l}
                letter={l}
                active={letterFilter.has(l)}
                count={letterCounts[l]}
                onClick={() => toggleLetter(l)}
              />
            ))}
            <LetterToggle
              letter="ungraded"
              active={letterFilter.has("ungraded")}
              count={letterCounts.ungraded}
              onClick={() => toggleLetter("ungraded")}
            />
          </Box>
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
          <FilterLabel>Paused campaigns</FilterLabel>
          <Box
            component="button"
            type="button"
            onClick={() => setShowPaused((v) => !v)}
            sx={{
              px: 1.25, py: 0.5, border: "1px solid", borderRadius: 0.5, cursor: "pointer", font: "inherit",
              bgcolor: showPaused ? "action.selected" : "transparent",
              borderColor: "divider",
            }}
          >
            <Typography sx={{ fontSize: "0.72rem", fontWeight: showPaused ? 700 : 500, color: "text.primary" }}>
              {showPaused ? "Included" : "Hidden"}
            </Typography>
          </Box>
        </Box>
        <Typography sx={{ ml: "auto", fontSize: "0.72rem", color: "text.disabled", alignSelf: "flex-end", pb: 0.5 }}>
          {filtered.length} of {lines.length} campaigns
        </Typography>
      </Box>

      {/* Line table */}
      <Box sx={{ mt: 1.5, border: 1, borderColor: "divider", borderRadius: "10px", overflow: "hidden" }}>
        <Box sx={{ overflow: "auto", maxHeight: 560 }}>
          <Table size="small" stickyHeader sx={{ minWidth: 920 }}>
            <TableHead>
              <TableRow>
                {COLUMNS.map(([key, label, defaultDir, align]) => (
                  <TableCell
                    key={key}
                    align={align}
                    onClick={() => toggleSort(key, defaultDir)}
                    sx={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap", "&:hover": { color: "primary.main" } }}
                  >
                    {label}{arrow(key)}
                  </TableCell>
                ))}
                <TableCell>Judged on</TableCell>
                <TableCell sx={{ minWidth: 320 }}>Why</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length + 2} align="center">
                    <Typography sx={{ fontSize: "0.78rem", color: "text.disabled", py: 2 }}>No campaigns match the current filters.</Typography>
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((l, i) => {
                const ctr = ctrOf(l);
                const cpc = cpcOf(l);
                const color = gradeColor(l.grade);
                return (
                  <TableRow key={i} sx={{ "&:hover": { bgcolor: "action.hover" } }}>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, maxWidth: 320 }}>
                        <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: l.live ? GRADE_HEX.good : "divider", flexShrink: 0 }} />
                        <Typography sx={{ fontSize: "0.74rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={l.name}>
                          {l.name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <TintChip label={l.grade} color={color} />
                        {l.letter && (
                          <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color, ...NUMERIC }}>{l.letter}</Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography sx={{ fontSize: "0.74rem", ...NUMERIC }}>{fmtMoney(l.spend)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography sx={{ fontSize: "0.74rem", ...NUMERIC }}>{l.impressions > 0 ? l.impressions.toLocaleString() : "—"}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography sx={{ fontSize: "0.74rem", ...NUMERIC }}>{l.clicks > 0 ? l.clicks.toLocaleString() : "—"}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography sx={{ fontSize: "0.74rem", ...NUMERIC }}>{ctr !== null ? fmtPct(ctr, 2) : "—"}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography sx={{ fontSize: "0.74rem", ...NUMERIC }}>{cpc !== null ? `$${cpc.toFixed(2)}` : "—"}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: l.idx !== null ? color : "text.disabled", ...NUMERIC }}>
                        {l.idx !== null ? l.idx.toFixed(2) : "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: "0.7rem", color: "text.secondary", whiteSpace: "nowrap" }}>
                        {l.judgingMetricLabel || "—"}
                        {l.benchmarkMainValue !== null && (
                          <Box component="span" sx={{ color: "text.disabled" }}>
                            {" vs "}{l.benchmarkMainValue < 1 ? fmtPct(l.benchmarkMainValue, l.benchmarkMainValue < 0.01 ? 2 : 1) : l.benchmarkMainValue.toFixed(2)}
                          </Box>
                        )}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: "0.68rem", color: "text.secondary", maxWidth: 320, lineHeight: 1.4 }}>
                        {l.why}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      </Box>

      {/* Legend */}
      <Box sx={{ mt: 2, p: 1.5, border: 1, borderColor: "divider", borderRadius: 1, bgcolor: "action.hover" }}>
        <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "text.secondary", mb: 0.75 }}>
          Grading methodology
        </Typography>
        <Box component="ul" sx={{ m: 0, pl: 2, fontSize: "0.7rem", color: "text.secondary", lineHeight: 1.7 }}>
          <li><b>Index</b> = geometric mean of (actual ÷ benchmark) for the main metric and (benchmark ÷ actual) for cost, capped [0.1–4.0]. A ≥1.30, B ≥1.05, C ≥0.80, D ≥0.50, F &lt;0.50.</li>
          <li><b>LinkedIn lead gen</b> — form completion rate against CPL (DemandSense 2026, by region).</li>
          <li><b>LinkedIn other</b> — CTR vs benchmark; Brand Awareness costs on CPM rather than CPC.</li>
          <li><b>LinkedIn Sponsored Messaging</b> — open rate against cost per click (DemandSense 2026).</li>
          <li><b>Google Ads</b> — CTR + CPC against WSO2's region-specific benchmarks (derived from campaign name prefix).</li>
          <li><b>Optimize</b> — conversion metric clears the benchmark but cost is above it; worth optimising, not cutting.</li>
        </Box>
      </Box>
    </Box>
  );
}

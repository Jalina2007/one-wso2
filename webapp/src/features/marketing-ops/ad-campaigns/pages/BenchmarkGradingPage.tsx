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
// Every campaign scored on one conversion metric and one cost metric against
// WSO2's benchmarks (rules in benchmarkGradingLogic.ts). The page:
//   • Controls — period, basis (live/all), platform, cohort, benchmark editor
//   • Summary — spend graded, spend at benchmark, % of spend / campaigns, CTR, CPC
//   • Spend against benchmark — spend by grade
//   • By budget line — click a row to filter the campaigns table
//   • Campaigns — grade-letter filter + search over the graded campaigns
//
// Built from the same pieces as Analytics and Campaign Tracker (FieldLabel,
// ToggleChip, StatCard, SectionTitle, TintChip) so the three screens match.

import { useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Box,
  IconButton,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { RefreshCw, SearchIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { MARKETING_OPS_EYEBROW } from "@constants/marketingOpsApps";
import MarketingOpsShell from "../../components/MarketingOpsShell";
import { FieldLabel, ReportLoading, SectionTitle, StatCard, ToggleChip } from "../analytics/components/AnalyticsPrimitives";
import DateRangePicker from "../analytics/components/DateRangePicker";
import { NUMERIC, TintChip } from "../campaign-tracker/components/campaignTrackerPrimitives";
import { RowCount } from "../campaign-tracker/components/FilterControls";
import { useTonePalette } from "../campaign-tracker/useBudgetSyncColors";
import { BenchmarkEditorPanel } from "../benchmark-grading/BenchmarkEditorPanel";
import { useBenchmarkTables } from "../benchmark-grading/useBenchmarkTables";
import { useBenchmarkGrading } from "../../api/useAdAnalytics";
import {
  buildBoardRows,
  fmtIndex,
  fmtMoney,
  fmtPct,
  gradeAllWith,
  summarize,
} from "../benchmark-grading/benchmarkGradingLogic";
import type {
  BenchmarkBoardRow,
  BenchmarkGrade,
  DateWindow,
  GradedCampaignLine,
  LetterGrade,
} from "../benchmark-grading/benchmarkGradingTypes";

// ─── Types and constants ─────────────────────────────────────────────────────

type PlatformFilter = "both" | "linkedin" | "google";
type CohortFilter = "all" | "launched" | "carriedover" | "nodate";
type LetterKey = LetterGrade | "ungraded";
type SortKey = "name" | "spend" | "index" | "grade" | "impressions" | "ctr" | "cpc";
type GradeColors = Record<BenchmarkGrade, string>;

const DEFAULT_WINDOW: DateWindow = { mode: "preset", preset: "1m" };
const ALL_LETTERS: LetterGrade[] = ["A", "B", "C", "D"];
const ALL_LETTER_KEYS: LetterKey[] = [...ALL_LETTERS, "ungraded"];
const GRADES: BenchmarkGrade[] = ["At benchmark", "Optimize", "Below", "Too little data"];
const GRADE_ORDER: Record<BenchmarkGrade, number> = { "At benchmark": 0, Optimize: 1, Below: 2, "Too little data": 3 };
const LOADING_MESSAGES = ["Loading campaigns…"] as const;
const TARGET_SHARE = 0.8;

// Grade colours from the active theme, so they hold in light and dark mode.
function useGradeColors(): GradeColors {
  const tones = useTonePalette();
  return useMemo(
    () => ({ "At benchmark": tones.green, Optimize: tones.purple, Below: tones.red, "Too little data": tones.slate }),
    [tones],
  );
}

// Which letter toggle a campaign sits under. "Ungraded" is exactly the "Too little
// data" band. A lead-gen campaign with zero form opens is Below with no index (spec
// §6), so it has no letter; it files under D, the bottom of the Below band, so the
// filter agrees with the totals that count it as Below.
function letterKey(l: GradedCampaignLine): LetterKey {
  if (l.grade === "Too little data") return "ungraded";
  return l.letter || "D";
}

// ─── Layout pieces ───────────────────────────────────────────────────────────

function ControlGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <FieldLabel>{label}</FieldLabel>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>{children}</Box>
    </Box>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Box component="section">
      <SectionTitle>{title}</SectionTitle>
      {hint && <Typography sx={{ fontSize: 12.5, color: "text.secondary", mt: -1, mb: 1.5 }}>{hint}</Typography>}
      {children}
    </Box>
  );
}

const BORDERED = { border: 1, borderColor: "divider", borderRadius: 1.5, overflow: "hidden" } as const;

function RefreshButton({ onClick, refreshing }: { onClick: () => void; refreshing: boolean }) {
  return (
    <Tooltip title="Refresh — fetch the latest data">
      <span>
        <IconButton
          onClick={onClick}
          disabled={refreshing}
          size="small"
          aria-label="Refresh"
          sx={{ color: "primary.main", border: 1, borderColor: "divider", borderRadius: 1, "&:hover": { borderColor: "primary.main" } }}
        >
          <Box
            component="span"
            sx={{
              display: "inline-flex",
              ...(refreshing && { animation: "benchmarkGradingSpin 0.8s linear infinite", "@keyframes benchmarkGradingSpin": { to: { transform: "rotate(360deg)" } } }),
            }}
          >
            <RefreshCw size={17} />
          </Box>
        </IconButton>
      </span>
    </Tooltip>
  );
}

// ─── Spend against benchmark ─────────────────────────────────────────────────

function SpendBar({ graded, colors }: { graded: GradedCampaignLine[]; colors: GradeColors }) {
  const s = summarize(graded);
  if (s.spendTotal <= 0) {
    return <Typography sx={{ fontSize: 13, color: "text.disabled", p: 2 }}>No spend in this view.</Typography>;
  }
  const spendBy: Record<BenchmarkGrade, number> = {
    "At benchmark": s.spendGood,
    Optimize: s.spendOpt,
    Below: s.spendBelow,
    "Too little data": s.spendNone,
  };

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: "flex", height: 28, borderRadius: 1, overflow: "hidden", bgcolor: "action.hover" }}>
        {GRADES.filter((g) => spendBy[g] > 0).map((g) => {
          const frac = spendBy[g] / s.spendTotal;
          return (
            <Tooltip key={g} title={`${g}: ${fmtMoney(spendBy[g])} (${fmtPct(frac, 0)})`}>
              <Box sx={{ width: `${frac * 100}%`, bgcolor: colors[g], display: "flex", alignItems: "center", px: 1, overflow: "hidden" }}>
                {frac > 0.08 && (
                  <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: "common.white", whiteSpace: "nowrap", ...NUMERIC }}>
                    {fmtPct(frac, 0)}
                  </Typography>
                )}
              </Box>
            </Tooltip>
          );
        })}
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: "8px 20px", mt: 1.5 }}>
        {GRADES.map((g) => (
          <Box key={g} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: colors[g] }} />
            <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>
              {g} <Box component="span" sx={{ color: "text.primary", fontWeight: 600, ...NUMERIC }}>{fmtMoney(spendBy[g])}</Box>
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ─── By budget line ──────────────────────────────────────────────────────────

function BoardTable({
  rows,
  selectedOwner,
  onSelectOwner,
  colors,
}: {
  rows: BenchmarkBoardRow[];
  selectedOwner: string | null;
  onSelectOwner: (owner: string) => void;
  colors: GradeColors;
}) {
  if (rows.length === 0) {
    return (
      <Typography sx={{ fontSize: 13, color: "text.disabled", textAlign: "center", py: 3 }}>
        No campaigns match these filters — change the platform, cohort or basis above.
      </Typography>
    );
  }
  const shareColor = (v: number | null) => (v === null ? "text.disabled" : v >= TARGET_SHARE ? colors["At benchmark"] : colors.Below);

  return (
    <Box sx={{ ...BORDERED, overflowX: "auto" }}>
      <Table size="small" sx={{ minWidth: 640 }}>
        <TableHead>
          <TableRow>
            <TableCell>Budget line</TableCell>
            <TableCell align="right">Campaigns</TableCell>
            <TableCell align="right">Spend</TableCell>
            <TableCell align="right">At benchmark</TableCell>
            <TableCell align="right">Below</TableCell>
            <TableCell align="right">% of spend</TableCell>
            <TableCell align="right">% of campaigns</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const selected = selectedOwner === row.label;
            return (
              <TableRow
                key={row.label}
                hover
                selected={selected}
                tabIndex={0}
                onClick={() => onSelectOwner(row.label)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectOwner(row.label);
                  }
                }}
                sx={{ cursor: "pointer", "&:last-child td": { border: 0 } }}
              >
                <TableCell sx={{ fontWeight: selected ? 700 : 500 }}>{row.label}</TableCell>
                <TableCell align="right" sx={NUMERIC}>{row.n}</TableCell>
                <TableCell align="right" sx={NUMERIC}>{fmtMoney(row.spend)}</TableCell>
                <TableCell align="right" sx={{ ...NUMERIC, color: row.n_at_benchmark > 0 ? colors["At benchmark"] : "text.disabled", fontWeight: 600 }}>
                  {row.n_at_benchmark}
                </TableCell>
                <TableCell align="right" sx={{ ...NUMERIC, color: row.n_below > 0 ? colors.Below : "text.disabled", fontWeight: 600 }}>
                  {row.n_below}
                </TableCell>
                <TableCell align="right" sx={{ ...NUMERIC, color: shareColor(row.pct_spend), fontWeight: 600 }}>
                  {row.pct_spend !== null ? fmtPct(row.pct_spend) : "—"}
                </TableCell>
                <TableCell align="right" sx={{ ...NUMERIC, color: shareColor(row.pct_camp), fontWeight: 600 }}>
                  {row.pct_camp !== null ? fmtPct(row.pct_camp) : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}

// ─── Campaigns ───────────────────────────────────────────────────────────────

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
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
}) {
  const active = sortKey === k;
  return (
    <TableCell align={align} sortDirection={active ? sortDir : false} sx={{ whiteSpace: "nowrap" }}>
      <TableSortLabel active={active} direction={active ? sortDir : "asc"} onClick={() => onSort(k)}>
        {label}
      </TableSortLabel>
    </TableCell>
  );
}

// The actual conversion and cost values a campaign was judged on, derived from
// the raw line using the metric names the grading picked.
function actuals(l: GradedCampaignLine): { conv: number | null; cost: number | null } {
  const ctr = l.impressions > 0 ? l.clicks / l.impressions : null;
  let conv: number | null = null;
  if (l.conversion_metric_name === "CTR") conv = ctr;
  else if (l.conversion_metric_name === "Form completion") conv = (l.form_opens ?? 0) > 0 ? (l.leads ?? 0) / l.form_opens! : null;
  else if (l.conversion_metric_name === "Open rate") conv = (l.sends ?? 0) > 0 ? (l.message_opens ?? 0) / l.sends! : null;

  let cost: number | null = null;
  if (l.cost_metric_name === "CPC") cost = l.clicks > 0 ? l.spend / l.clicks : null;
  else if (l.cost_metric_name === "CPL") cost = (l.leads ?? 0) > 0 ? l.spend / l.leads! : null;
  else if (l.cost_metric_name === "CPM") cost = l.impressions > 0 ? (l.spend / l.impressions) * 1000 : null;
  else if (l.cost_metric_name === "Cost per click") cost = (l.message_clicks ?? 0) > 0 ? l.spend / l.message_clicks! : null;
  return { conv, cost };
}

function CampaignsTable({
  rows,
  ownerFilter,
  onClearOwner,
  letterFilter,
  setLetterFilter,
  query,
  setQuery,
  colors,
}: {
  rows: GradedCampaignLine[];
  ownerFilter: string | null;
  onClearOwner: () => void;
  letterFilter: Set<LetterKey>;
  setLetterFilter: (s: Set<LetterKey>) => void;
  query: string;
  setQuery: (v: string) => void;
  colors: GradeColors;
}) {
  const tones = useTonePalette();
  const [sortKey, setSortKey] = useState<SortKey>("grade");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const onSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const letterCounts = useMemo(() => {
    const c: Record<LetterKey, number> = { A: 0, B: 0, C: 0, D: 0, "": 0, ungraded: 0 };
    for (const r of rows) c[letterKey(r)]++;
    return c;
  }, [rows]);

  const toggleLetter = (k: LetterKey) => {
    const next = new Set(letterFilter);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setLetterFilter(next);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const r = rows.filter(
      (l) =>
        (!ownerFilter || (l.owner ?? "Unknown") === ownerFilter) &&
        (!q || l.name.toLowerCase().includes(q)) &&
        letterFilter.has(letterKey(l)),
    );
    const dir = sortDir === "asc" ? 1 : -1;
    const val = (l: GradedCampaignLine): number | string => {
      switch (sortKey) {
        case "grade": return GRADE_ORDER[l.grade];
        case "ctr": return l.impressions > 0 ? l.clicks / l.impressions : -1;
        case "cpc": return l.clicks > 0 ? l.spend / l.clicks : Infinity;
        case "index": return l.index ?? -1;
        case "spend": return l.spend;
        case "impressions": return l.impressions;
        default: return l.name;
      }
    };
    return [...r].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      if (typeof x === "string") return x.localeCompare(y as string) * dir;
      return (x - (y as number)) * dir;
    });
  }, [rows, ownerFilter, query, letterFilter, sortKey, sortDir]);

  const sortProps = { sortKey, sortDir, onSort };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "flex-end", gap: 3, rowGap: 2, flexWrap: "wrap", mb: 2 }}>
        <ControlGroup label="Grade">
          {ALL_LETTER_KEYS.map((k) => (
            <ToggleChip
              key={k}
              label={`${k === "ungraded" ? "Ungraded" : k} (${letterCounts[k]})`}
              active={letterFilter.has(k)}
              onClick={() => toggleLetter(k)}
            />
          ))}
          <ToggleChip
            label={letterFilter.size === ALL_LETTER_KEYS.length ? "None" : "All"}
            active={false}
            onClick={() => setLetterFilter(letterFilter.size === ALL_LETTER_KEYS.length ? new Set() : new Set(ALL_LETTER_KEYS))}
          />
        </ControlGroup>
        {ownerFilter && (
          <ControlGroup label="Budget line">
            <ToggleChip label={`${ownerFilter} ✕`} active onClick={onClearOwner} />
          </ControlGroup>
        )}
        <TextField
          size="small"
          placeholder="Find a campaign"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          sx={{ minWidth: 240 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon size={16} />
                </InputAdornment>
              ),
            },
            htmlInput: { "aria-label": "Find a campaign" },
          }}
        />
        <Box sx={{ ml: "auto" }}>
          <RowCount shown={filtered.length} total={rows.length} singular="campaign" />
        </Box>
      </Box>

      {filtered.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: "text.disabled", textAlign: "center", py: 3 }}>No campaigns match these filters</Typography>
      ) : (
        <Box sx={BORDERED}>
          <Box sx={{ overflow: "auto", maxHeight: 640 }}>
            <Table size="small" stickyHeader sx={{ minWidth: 1500 }}>
              <TableHead>
                <TableRow>
                  <SortHeader k="name" label="Campaign" {...sortProps} />
                  <TableCell>Platform</TableCell>
                  <TableCell>Owner</TableCell>
                  <SortHeader k="spend" label="Spend" align="right" {...sortProps} />
                  <SortHeader k="impressions" label="Impressions" align="right" {...sortProps} />
                  <TableCell align="right">Clicks</TableCell>
                  <SortHeader k="ctr" label="CTR" align="right" {...sortProps} />
                  <SortHeader k="cpc" label="CPC" align="right" {...sortProps} />
                  <TableCell sx={{ whiteSpace: "nowrap" }}>Judged on</TableCell>
                  <TableCell align="right">Actual</TableCell>
                  <TableCell align="right">Benchmark</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>Cost on</TableCell>
                  <TableCell align="right">Actual</TableCell>
                  <TableCell align="right">Benchmark</TableCell>
                  <SortHeader k="index" label="Index" align="right" {...sortProps} />
                  <SortHeader k="grade" label="Result" {...sortProps} />
                  <TableCell sx={{ minWidth: 300 }}>Why</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((l) => {
                  const ctr = l.impressions > 0 ? l.clicks / l.impressions : null;
                  const cpc = l.clicks > 0 ? l.spend / l.clicks : null;
                  const { conv, cost } = actuals(l);
                  const convDp = l.conversion_metric_name === "CTR" ? 2 : 1;
                  const fmtConv = (v: number | null) => (v === null ? "—" : fmtPct(v, convDp));
                  const fmtCost = (v: number | null) => (v === null ? "—" : l.cost_metric_name === "CPL" ? fmtMoney(v) : `$${v.toFixed(2)}`);
                  const isGoogle = l.platform === "google";
                  return (
                    <TableRow key={l.id} hover>
                      <TableCell sx={{ minWidth: 220 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Tooltip title={l.is_live ? "Live" : "Paused or ended"}>
                            <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, bgcolor: l.is_live ? colors["At benchmark"] : "divider" }} />
                          </Tooltip>
                          <Tooltip title={l.name}>
                            <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260, display: "block", fontWeight: 500 }}>
                              {l.name}
                            </Box>
                          </Tooltip>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <TintChip label={isGoogle ? "Google" : "LinkedIn"} color={isGoogle ? tones.slate : tones.purple} />
                      </TableCell>
                      <TableCell sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>{l.owner ?? "—"}</TableCell>
                      <TableCell align="right" sx={NUMERIC}>{fmtMoney(l.spend)}</TableCell>
                      <TableCell align="right" sx={NUMERIC}>{l.impressions.toLocaleString()}</TableCell>
                      <TableCell align="right" sx={NUMERIC}>{l.clicks.toLocaleString()}</TableCell>
                      <TableCell align="right" sx={NUMERIC}>{ctr !== null ? fmtPct(ctr, 2) : "—"}</TableCell>
                      <TableCell align="right" sx={NUMERIC}>{cpc !== null ? `$${cpc.toFixed(2)}` : "—"}</TableCell>
                      <TableCell sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>{l.conversion_metric_name || "—"}</TableCell>
                      <TableCell align="right" sx={NUMERIC}>{fmtConv(conv)}</TableCell>
                      <TableCell align="right" sx={{ ...NUMERIC, color: "text.secondary" }}>{fmtConv(l.conversion_benchmark)}</TableCell>
                      <TableCell sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>{l.cost_metric_name || "—"}</TableCell>
                      <TableCell align="right" sx={NUMERIC}>{fmtCost(cost)}</TableCell>
                      <TableCell align="right" sx={{ ...NUMERIC, color: "text.secondary" }}>{fmtCost(l.cost_benchmark)}</TableCell>
                      <TableCell align="right" sx={{ ...NUMERIC, fontWeight: 700, color: colors[l.grade] }}>{fmtIndex(l.index)}</TableCell>
                      <TableCell>
                        <TintChip label={l.letter ? `${l.grade} · ${l.letter}` : l.grade} color={colors[l.grade]} />
                      </TableCell>
                      <TableCell sx={{ fontSize: 12.5, color: "text.secondary", lineHeight: 1.45 }}>{l.why}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        </Box>
      )}
    </Box>
  );
}

// ─── How grading works ───────────────────────────────────────────────────────

function GradingExplainer({ minSends }: { minSends: number }) {
  return (
    <Box sx={{ ...BORDERED, p: 2, fontSize: 13, lineHeight: 1.65, color: "text.secondary" }}>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: "text.primary", mb: 0.75 }}>
        Every campaign is scored on one conversion metric and one cost metric.
      </Typography>
      <Box component="ul" sx={{ pl: 2.5, m: 0, mb: 1.5 }}>
        <li><strong>LinkedIn lead generation</strong> — form completion rate against CPL.</li>
        <li><strong>LinkedIn website visits, engagement, brand awareness</strong> — CTR against CPC (brand awareness uses CPM).</li>
        <li><strong>LinkedIn Sponsored Messaging</strong> — open rate against cost per click. Needs at least {minSends.toLocaleString()} sends.</li>
        <li><strong>Google</strong> — CTR against CPC, using WSO2's regional benchmarks from the campaign name prefix.</li>
      </Box>
      <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
        Index = √(actual ÷ benchmark for conversion × benchmark ÷ actual for cost), each ratio capped at 0.1×–4×.{" "}
        <strong>At benchmark</strong> is an index of 0.80 or more; <strong>Optimize</strong> is the same but with cost above
        the benchmark, and counts as at benchmark in every total. Letters: A ≥ 1.30 · B ≥ 0.80 · C ≥ 0.50 · D below.
        Campaigns under 1,000 impressions (or {minSends.toLocaleString()} sends) aren't graded, and are left out of both shares.
      </Typography>
    </Box>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function BenchmarkGradingPage() {
  const colors = useGradeColors();
  const [window, setWindow] = useState<DateWindow>(DEFAULT_WINDOW);
  const [selectedOwner, setSelectedOwner] = useState<string | null>(null);
  const [liveOnly, setLiveOnly] = useState(true);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("both");
  const [cohortFilter, setCohortFilter] = useState<CohortFilter>("all");
  const [letterFilter, setLetterFilter] = useState<Set<LetterKey>>(() => new Set(ALL_LETTER_KEYS));
  const [campQuery, setCampQuery] = useState("");
  const [showBmEditor, setShowBmEditor] = useState(false);

  const bm = useBenchmarkTables();
  const queryResult = useBenchmarkGrading(window);

  const allGraded = useMemo<GradedCampaignLine[]>(
    () => gradeAllWith(queryResult.data?.campaigns ?? [], bm.tables),
    [queryResult.data, bm.tables],
  );

  const liveFiltered = useMemo(() => (liveOnly ? allGraded.filter((l) => l.is_live) : allGraded), [allGraded, liveOnly]);

  const windowStart = queryResult.data?.window_start ?? null;

  // Cohort counts are over the live-filtered set, before the platform/cohort filter.
  const cohortCounts = useMemo<Record<CohortFilter, number>>(() => {
    let launched = 0, carriedover = 0, nodate = 0;
    for (const l of liveFiltered) {
      if (!l.started_at) nodate++;
      else if (windowStart && l.started_at >= windowStart) launched++;
      else carriedover++;
    }
    return { all: liveFiltered.length, launched, carriedover, nodate };
  }, [liveFiltered, windowStart]);

  const graded = useMemo(
    () =>
      liveFiltered.filter((l) => {
        if (platformFilter !== "both" && l.platform !== platformFilter) return false;
        if (cohortFilter === "launched") return !!l.started_at && !(windowStart && l.started_at < windowStart);
        if (cohortFilter === "carriedover") return !!l.started_at && !(windowStart && l.started_at >= windowStart);
        if (cohortFilter === "nodate") return !l.started_at;
        return true;
      }),
    [liveFiltered, platformFilter, cohortFilter, windowStart],
  );

  const summary = useMemo(() => summarize(graded), [graded]);
  const boardRows = useMemo(() => buildBoardRows(graded), [graded]);
  // A selection whose row has gone (another filter removed it) no longer applies.
  const activeOwner = selectedOwner !== null && boardRows.some((r) => r.label === selectedOwner) ? selectedOwner : null;

  const error = queryResult.error ? describeError(queryResult.error) : null;
  const shareAccent = (v: number | null) => (v === null ? undefined : v >= TARGET_SHARE ? colors["At benchmark"] : colors.Below);

  return (
    <MarketingOpsShell
      eyebrow={MARKETING_OPS_EYEBROW.adCampaigns}
      title="Benchmark Grading"
      subtitle="Every campaign scored on conversion and cost against WSO2's internal benchmarks."
    >
      <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, p: 2.5, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "flex-end", gap: 3, rowGap: 2, flexWrap: "wrap" }}>
          <DateRangePicker window={window} onChange={setWindow} />
          <ControlGroup label="Basis">
            <ToggleChip label="Live only" active={liveOnly} onClick={() => setLiveOnly(true)} />
            <ToggleChip label="All campaigns" active={!liveOnly} onClick={() => setLiveOnly(false)} />
          </ControlGroup>
          <ControlGroup label="Platform">
            <ToggleChip label="Both" active={platformFilter === "both"} onClick={() => setPlatformFilter("both")} />
            <ToggleChip label="LinkedIn" active={platformFilter === "linkedin"} onClick={() => setPlatformFilter("linkedin")} />
            <ToggleChip label="Google" active={platformFilter === "google"} onClick={() => setPlatformFilter("google")} />
          </ControlGroup>
          <ControlGroup label="Launched">
            <ToggleChip label={`Any (${cohortCounts.all})`} active={cohortFilter === "all"} onClick={() => setCohortFilter("all")} />
            <ToggleChip label={`In period (${cohortCounts.launched})`} active={cohortFilter === "launched"} onClick={() => setCohortFilter("launched")} />
            <ToggleChip label={`Carried over (${cohortCounts.carriedover})`} active={cohortFilter === "carriedover"} onClick={() => setCohortFilter("carriedover")} />
            <ToggleChip label={`No date (${cohortCounts.nodate})`} active={cohortFilter === "nodate"} onClick={() => setCohortFilter("nodate")} />
          </ControlGroup>
          <ControlGroup label="Benchmarks">
            <ToggleChip
              label={bm.isModified ? "Edit benchmarks (edited)" : "Edit benchmarks"}
              active={showBmEditor}
              onClick={() => setShowBmEditor((v) => !v)}
            />
          </ControlGroup>
          <Box sx={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
            <RefreshButton onClick={() => void queryResult.refetch()} refreshing={queryResult.isFetching} />
          </Box>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Couldn't load benchmark data: {error}
        </Alert>
      )}

      {queryResult.data && queryResult.data.warnings?.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Some data is missing from this view:
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {queryResult.data.warnings.map((w) => <li key={w}>{w}</li>)}
          </Box>
        </Alert>
      )}

      {queryResult.isFetching && !queryResult.data && <ReportLoading messages={LOADING_MESSAGES} />}

      {showBmEditor && (
        <Section title="Benchmark values" hint={bm.isModified ? "Edited — reset to restore the defaults." : "Defaults: LinkedIn regional figures by objective, WSO2 Google Search benchmarks, DemandSense 2026 for Sponsored Messaging."}>
          <Box sx={BORDERED}>
            <BenchmarkEditorPanel bm={bm} />
          </Box>
        </Section>
      )}

      {queryResult.data && (
        <>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 1.5 }}>
            <StatCard label="Spend graded" value={fmtMoney(summary.spendGradeable)} />
            <StatCard label="Spend at benchmark" value={fmtMoney(summary.spendMet)} accent={colors["At benchmark"]} />
            <StatCard label="% of spend" value={summary.spendShare !== null ? fmtPct(summary.spendShare) : "—"} accent={shareAccent(summary.spendShare)} />
            <StatCard label="% of campaigns" value={summary.campShare !== null ? fmtPct(summary.campShare) : "—"} accent={shareAccent(summary.campShare)} />
            <StatCard label="CTR" value={summary.ctr !== null ? fmtPct(summary.ctr, 2) : "—"} />
            <StatCard label="CPC" value={summary.cpc !== null ? `$${summary.cpc.toFixed(2)}` : "—"} />
          </Box>
          <Typography sx={{ fontSize: 12.5, color: "text.secondary", mt: 1 }}>
            {summary.nGradeable} of {summary.total} campaigns had enough data to grade · target is 80% of spend and of campaigns at benchmark.
          </Typography>

          <Section title="Spend against benchmark">
            <Box sx={BORDERED}>
              <SpendBar graded={graded} colors={colors} />
            </Box>
          </Section>

          <Section title="By budget line" hint="Click a row to filter the campaigns below.">
            <BoardTable
              rows={boardRows}
              selectedOwner={activeOwner}
              onSelectOwner={(owner) => setSelectedOwner((prev) => (prev === owner ? null : owner))}
              colors={colors}
            />
          </Section>

          <Section title="Campaigns">
            <CampaignsTable
              rows={graded}
              ownerFilter={activeOwner}
              onClearOwner={() => setSelectedOwner(null)}
              letterFilter={letterFilter}
              setLetterFilter={setLetterFilter}
              query={campQuery}
              setQuery={setCampQuery}
              colors={colors}
            />
          </Section>

          <Section title="How grading works">
            <GradingExplainer minSends={bm.tables.sm.minSends} />
          </Section>
        </>
      )}
    </MarketingOpsShell>
  );
}

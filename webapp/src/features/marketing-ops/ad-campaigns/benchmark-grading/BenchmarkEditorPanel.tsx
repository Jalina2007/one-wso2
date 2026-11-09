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

// Inline editor for benchmark tables (LBM, GBM, SM).
// Values are persisted to localStorage via useBenchmarkTables.
// Changes take effect immediately — the grading reruns on the next render.

import { Box, Tooltip } from "@wso2/oxygen-ui";
import type { UseBenchmarkTablesResult } from "./useBenchmarkTables";

// ─── Shared primitives ────────────────────────────────────────────────────────

function BmInput({
  value,
  onChange,
  step = 0.01,
  min = 0,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
}) {
  return (
    <Box
      component="input"
      type="number"
      value={value}
      step={step}
      min={min}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v) && v >= min) onChange(v);
      }}
      sx={{
        width: "100%",
        px: "5px",
        py: "3px",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "2px",
        fontSize: 11,
        fontFamily: "monospace",
        bgcolor: "background.default",
        color: "text.primary",
        textAlign: "right",
        outline: "none",
        "&:focus": { borderColor: "primary.main" },
        // Hide spin buttons
        "MozAppearance": "textfield",
        "&::-webkit-outer-spin-button, &::-webkit-inner-spin-button": { WebkitAppearance: "none", m: 0 },
      }}
    />
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "text.secondary", mt: 2.5, mb: 1 }}>
      {children}
    </Box>
  );
}

function ColHeader({ children, hint }: { children: React.ReactNode; hint?: string }) {
  const inner = (
    <Box sx={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "text.secondary", textAlign: "right", whiteSpace: "nowrap" }}>
      {children}
    </Box>
  );
  return hint ? <Tooltip title={hint}>{inner}</Tooltip> : inner;
}

// ─── LinkedIn benchmark table (LBM) ──────────────────────────────────────────

const LBM_OBJECTIVES = ["Lead Generation", "Website Visits", "Engagement", "Brand Awareness"] as const;
const LBM_REGIONS = ["NAMER", "EU", "MEA", "SEA", "India"] as const;
const LBM_COST_UNIT: Record<typeof LBM_OBJECTIVES[number], string> = {
  "Lead Generation": "CPL ($)",
  "Website Visits": "CPC ($)",
  "Engagement": "CPC ($)",
  "Brand Awareness": "CPM ($)",
};

function LbmTable({ bm }: Pick<UseBenchmarkTablesResult, "setLbmCell"> & { bm: UseBenchmarkTablesResult }) {
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Box
        component="table"
        sx={{ borderCollapse: "collapse", fontSize: 11, width: "100%", minWidth: 680 }}
      >
        <Box component="thead">
          <Box component="tr">
            <Box component="th" sx={{ fontSize: 10, fontWeight: 700, textAlign: "left", py: "4px", pr: "10px", color: "text.secondary", whiteSpace: "nowrap", width: 140 }}>
              Objective
            </Box>
            {LBM_REGIONS.map((r) => (
              <Box component="th" colSpan={2} key={r} sx={{ fontSize: 10, fontWeight: 700, textAlign: "center", color: "text.secondary", py: "4px", px: "4px", borderBottom: "1px solid", borderColor: "divider" }}>
                {r}
              </Box>
            ))}
          </Box>
          <Box component="tr">
            <Box component="th" />
            {LBM_REGIONS.map((r) => (
              [
                <Box key={r + "_m"} component="th" sx={{ width: 56 }}>
                  <ColHeader hint="Conversion metric (CTR % or form completion %)">Conv %</ColHeader>
                </Box>,
                <Box key={r + "_c"} component="th" sx={{ width: 56 }}>
                  <ColHeader hint="Cost metric (CPC, CPL or CPM in USD)">Cost $</ColHeader>
                </Box>,
              ]
            ))}
          </Box>
        </Box>
        <Box component="tbody">
          {LBM_OBJECTIVES.map((obj) => (
            <Box component="tr" key={obj} sx={{ "&:hover td, &:hover th": { bgcolor: "action.hover" } }}>
              <Box component="th" sx={{ fontSize: 11, fontWeight: 600, textAlign: "left", py: "4px", pr: "10px", color: "text.primary", whiteSpace: "nowrap", verticalAlign: "middle" }}>
                <Tooltip title={LBM_COST_UNIT[obj]}>
                  <span>{obj}</span>
                </Tooltip>
              </Box>
              {LBM_REGIONS.map((region) => {
                const entry = bm.tables.lbm[obj]?.[region] ?? { m: 0, c: 0 };
                return [
                  <Box key={region + "_m"} component="td" sx={{ px: "3px", py: "3px", verticalAlign: "middle" }}>
                    <BmInput
                      value={entry.m}
                      step={0.01}
                      onChange={(v) => bm.setLbmCell(obj, region, "m", v)}
                    />
                  </Box>,
                  <Box key={region + "_c"} component="td" sx={{ px: "3px", py: "3px", verticalAlign: "middle" }}>
                    <BmInput
                      value={entry.c}
                      step={0.01}
                      onChange={(v) => bm.setLbmCell(obj, region, "c", v)}
                    />
                  </Box>,
                ];
              })}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

// ─── Google benchmark table (GBM) ────────────────────────────────────────────

const GBM_REGIONS = ["US", "EU", "UK", "ANZ", "India", "APAC ex-India / SEA", "Middle East", "Africa", "LATAM"] as const;

function GbmTable({ bm }: { bm: UseBenchmarkTablesResult }) {
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Box component="table" sx={{ borderCollapse: "collapse", fontSize: 11, width: "100%", maxWidth: 480 }}>
        <Box component="thead">
          <Box component="tr">
            <Box component="th" sx={{ fontSize: 10, fontWeight: 700, textAlign: "left", py: "4px", pr: "10px", color: "text.secondary", width: 180 }}>Region</Box>
            <Box component="th" sx={{ width: 80 }}><ColHeader hint="Click-through rate (%)">CTR %</ColHeader></Box>
            <Box component="th" sx={{ width: 80 }}><ColHeader hint="Cost per click (USD)">CPC $</ColHeader></Box>
          </Box>
        </Box>
        <Box component="tbody">
          {GBM_REGIONS.map((region) => {
            const row = bm.tables.gbm[region] ?? [0, 0];
            return (
              <Box component="tr" key={region} sx={{ "&:hover td, &:hover th": { bgcolor: "action.hover" } }}>
                <Box component="th" sx={{ fontSize: 11, fontWeight: 600, textAlign: "left", py: "3px", pr: "10px", color: "text.primary", whiteSpace: "nowrap", verticalAlign: "middle" }}>
                  {region}
                </Box>
                <Box component="td" sx={{ px: "3px", py: "3px", verticalAlign: "middle" }}>
                  <BmInput value={row[0]} step={0.001} onChange={(v) => bm.setGbmCell(region, 0, v)} />
                </Box>
                <Box component="td" sx={{ px: "3px", py: "3px", verticalAlign: "middle" }}>
                  <BmInput value={row[1]} step={0.01} onChange={(v) => bm.setGbmCell(region, 1, v)} />
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

// ─── Sponsored Messaging row ─────────────────────────────────────────────────

function SmRow({ bm }: { bm: UseBenchmarkTablesResult }) {
  return (
    <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", alignItems: "flex-end" }}>
      {(
        [
          { key: "openRate" as const, label: "Open rate", hint: "Fraction (0–1), e.g. 0.25 = 25%", step: 0.01 },
          { key: "cpc" as const, label: "Cost per click ($)", hint: "USD cost per click in Sponsored Messages", step: 0.5 },
          { key: "minSends" as const, label: "Min sends", hint: "Minimum sends before grading applies", step: 10 },
        ] as const
      ).map(({ key, label, hint, step }) => (
        <Box key={key} sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Tooltip title={hint}>
            <Box sx={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "text.secondary" }}>{label}</Box>
          </Tooltip>
          <Box sx={{ width: 100 }}>
            <BmInput value={bm.tables.sm[key]} step={step} onChange={(v) => bm.setSmField(key, v)} />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

// ─── Main exported panel ─────────────────────────────────────────────────────

export function BenchmarkEditorPanel({ bm }: { bm: UseBenchmarkTablesResult }) {
  return (
    <Box sx={{ p: "14px 15px 20px" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
        <Box sx={{ fontSize: 12, color: "text.secondary", lineHeight: 1.5 }}>
          Edit any cell to override the default benchmark for grading. Changes are saved locally in your browser and take effect immediately.
          {bm.isModified && (
            <Box component="span" sx={{ ml: 1, color: "warning.main", fontWeight: 600 }}>
              (modified)
            </Box>
          )}
        </Box>
        {bm.isModified && (
          <Box
            component="button"
            type="button"
            onClick={bm.reset}
            sx={{
              ml: 2,
              flexShrink: 0,
              px: "10px",
              py: "5px",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: "3px",
              fontSize: 11,
              fontFamily: "inherit",
              cursor: "pointer",
              bgcolor: "transparent",
              color: "text.secondary",
              "&:hover": { borderColor: "text.primary", color: "text.primary" },
            }}
          >
            Reset to defaults
          </Box>
        )}
      </Box>

      <SectionLabel>LinkedIn — by objective and region</SectionLabel>
      <LbmTable bm={bm} />

      <SectionLabel>Google Search — by region</SectionLabel>
      <GbmTable bm={bm} />

      <SectionLabel>LinkedIn Sponsored Messaging</SectionLabel>
      <SmRow bm={bm} />
    </Box>
  );
}

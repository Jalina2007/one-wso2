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

// In-browser edits to the benchmark tables.
//
// Only the cells a user actually edits are stored, keyed by their path, and they
// are applied over the current DEFAULT_TABLES on every load. So a benchmark that
// changes in a later release reaches everyone, except for a cell the user has
// overridden themselves. Stored values are validated on read: anything that
// isn't a known cell with a positive number is ignored, so bad or stale storage
// can never break grading.

import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_TABLES, type BenchmarkTables } from "./benchmarkGradingLogic";

const LS_KEY = "wso2.bmOverrides.v2";
// The first version stored a full snapshot of the tables on first load, whether
// or not anything was edited, which pinned every visitor to the defaults of that
// day. It is discarded rather than migrated: it can't tell edits from defaults.
const LEGACY_LS_KEY = "wso2.bmOverrides";

type SmField = keyof BenchmarkTables["sm"];
// "lbm|<section>|<region>|m|c" · "gbm|<region>|0|1" · "sm|<field>"
type Overrides = Record<string, number>;

const lbmKey = (section: string, region: string, field: "m" | "c") => `lbm|${section}|${region}|${field}`;
const gbmKey = (region: string, index: 0 | 1) => `gbm|${region}|${index}`;
const smKey = (field: SmField) => `sm|${field}`;

function isKnownKey(key: string): boolean {
  const [table, a, b, c] = key.split("|");
  if (table === "lbm") return !!DEFAULT_TABLES.lbm[a]?.[b] && (c === "m" || c === "c");
  if (table === "gbm") return !!DEFAULT_TABLES.gbm[a] && (b === "0" || b === "1");
  if (table === "sm") return a in DEFAULT_TABLES.sm;
  return false;
}

// Every benchmark must be positive: a zero conversion benchmark would divide by
// zero in the grade. (Minimum sends is a count, so 1 is its floor.)
function isValidValue(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

export function applyOverrides(overrides: Overrides): BenchmarkTables {
  const lbm = Object.fromEntries(
    Object.entries(DEFAULT_TABLES.lbm).map(([section, regions]) => [
      section,
      Object.fromEntries(
        Object.entries(regions).map(([region, e]) => [
          region,
          { m: overrides[lbmKey(section, region, "m")] ?? e.m, c: overrides[lbmKey(section, region, "c")] ?? e.c },
        ]),
      ),
    ]),
  );
  const gbm = Object.fromEntries(
    Object.entries(DEFAULT_TABLES.gbm).map(([region, [ctr, cpc]]) => [
      region,
      [overrides[gbmKey(region, 0)] ?? ctr, overrides[gbmKey(region, 1)] ?? cpc] as [number, number],
    ]),
  );
  const sm = { ...DEFAULT_TABLES.sm };
  for (const field of Object.keys(sm) as SmField[]) sm[field] = overrides[smKey(field)] ?? sm[field];
  return { lbm, gbm, sm };
}

export function readOverrides(raw: string | null): Overrides {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(([k, v]) => isKnownKey(k) && isValidValue(v)),
    ) as Overrides;
  } catch {
    return {};
  }
}

function loadOverrides(): Overrides {
  try {
    localStorage.removeItem(LEGACY_LS_KEY);
    return readOverrides(localStorage.getItem(LS_KEY));
  } catch {
    return {};
  }
}

function saveOverrides(overrides: Overrides): void {
  try {
    if (Object.keys(overrides).length === 0) localStorage.removeItem(LS_KEY);
    else localStorage.setItem(LS_KEY, JSON.stringify(overrides));
  } catch {
    // quota exceeded or private mode — the edits still apply for this session
  }
}

export interface UseBenchmarkTablesResult {
  tables: BenchmarkTables;
  isModified: boolean;
  setLbmCell: (objective: string, region: string, field: "m" | "c", value: number) => void;
  setGbmCell: (region: string, index: 0 | 1, value: number) => void;
  setSmField: (field: SmField, value: number) => void;
  reset: () => void;
}

export function useBenchmarkTables(): UseBenchmarkTablesResult {
  const [overrides, setOverrides] = useState<Overrides>(loadOverrides);

  useEffect(() => {
    saveOverrides(overrides);
  }, [overrides]);

  const tables = useMemo(() => applyOverrides(overrides), [overrides]);

  // Setting a cell back to its default removes the override rather than storing it.
  const setCell = useCallback((key: string, value: number, defaultValue: number) => {
    if (!isKnownKey(key) || !isValidValue(value)) return;
    setOverrides((prev) => {
      const next = { ...prev };
      if (value === defaultValue) delete next[key];
      else next[key] = value;
      return next;
    });
  }, []);

  const setLbmCell = useCallback(
    (objective: string, region: string, field: "m" | "c", value: number) =>
      setCell(lbmKey(objective, region, field), value, DEFAULT_TABLES.lbm[objective]?.[region]?.[field] ?? NaN),
    [setCell],
  );
  const setGbmCell = useCallback(
    (region: string, index: 0 | 1, value: number) =>
      setCell(gbmKey(region, index), value, DEFAULT_TABLES.gbm[region]?.[index] ?? NaN),
    [setCell],
  );
  const setSmField = useCallback(
    (field: SmField, value: number) => setCell(smKey(field), value, DEFAULT_TABLES.sm[field]),
    [setCell],
  );

  const reset = useCallback(() => setOverrides({}), []);

  return { tables, isModified: Object.keys(overrides).length > 0, setLbmCell, setGbmCell, setSmField, reset };
}

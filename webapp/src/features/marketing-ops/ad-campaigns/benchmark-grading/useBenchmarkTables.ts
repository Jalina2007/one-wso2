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

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_TABLES, type BenchmarkTables, type BmTableEntry } from "./benchmarkGradingLogic";

const LS_KEY = "wso2.bmOverrides";

function readFromStorage(): BenchmarkTables | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BenchmarkTables;
  } catch {
    return null;
  }
}

function writeToStorage(tables: BenchmarkTables): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(tables));
  } catch {
    // quota exceeded or private mode — silently ignore
  }
}

export interface UseBenchmarkTablesResult {
  tables: BenchmarkTables;
  isModified: boolean;
  setLbmCell: (objective: string, region: string, field: "m" | "c", value: number) => void;
  setGbmCell: (region: string, index: 0 | 1, value: number) => void;
  setSmField: (field: keyof BenchmarkTables["sm"], value: number) => void;
  reset: () => void;
}

export function useBenchmarkTables(): UseBenchmarkTablesResult {
  const [tables, setTables] = useState<BenchmarkTables>(() => readFromStorage() ?? DEFAULT_TABLES);

  // Sync to localStorage on every change
  useEffect(() => {
    writeToStorage(tables);
  }, [tables]);

  const isModified = JSON.stringify(tables) !== JSON.stringify(DEFAULT_TABLES);

  const setLbmCell = useCallback((objective: string, region: string, field: "m" | "c", value: number) => {
    setTables((prev) => {
      const lbm = { ...prev.lbm };
      const section = { ...(lbm[objective] ?? {}) };
      const entry: BmTableEntry = { ...(section[region] ?? { m: 0, c: 0 }) };
      entry[field] = value;
      section[region] = entry;
      lbm[objective] = section;
      return { ...prev, lbm };
    });
  }, []);

  const setGbmCell = useCallback((region: string, index: 0 | 1, value: number) => {
    setTables((prev) => {
      const gbm = { ...prev.gbm };
      const row = [...(gbm[region] ?? [0, 0])] as [number, number];
      row[index] = value;
      gbm[region] = row;
      return { ...prev, gbm };
    });
  }, []);

  const setSmField = useCallback((field: keyof BenchmarkTables["sm"], value: number) => {
    setTables((prev) => ({ ...prev, sm: { ...prev.sm, [field]: value } }));
  }, []);

  const reset = useCallback(() => {
    setTables(DEFAULT_TABLES);
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { tables, isModified, setLbmCell, setGbmCell, setSmField, reset };
}

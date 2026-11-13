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

// A volume discount table's tiers (D169). The Admin enters only where each
// tier starts; the range it covers follows:
//
//   from 10    → covers 10 – 100
//   from 101   → covers 101 – 200
//   from 1001  → covers 1,001 and above
//
// Below the first tier there is no volume discount ("Below 10").

const count = (n: number) => n.toLocaleString("en-US");

/** A whole number of at least 1 as typed, or null. */
export function startOf(raw: string): number | null {
  const t = raw.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 ? n : null;
}

/**
 * The range each tier covers, in order: "10 – 100", "5" (a single quantity),
 * "1,001 and above"; "–" where a start isn't a whole number or doesn't go up
 * from the one before.
 */
export function covers(starts: readonly (number | null)[]): string[] {
  return starts.map((s, i) => {
    if (s === null || (i > 0 && (starts[i - 1] === null || s <= (starts[i - 1] as number)))) return "–";
    const next = starts[i + 1];
    if (next === undefined) return `${count(s)} and above`;
    if (next === null || next <= s) return "–";
    return next - 1 === s ? count(s) : `${count(s)} – ${count(next - 1)}`;
  });
}

/** "Below 10", when the first tier starts above 1; null otherwise. */
export function below(firstStart: number | null): string | null {
  return firstStart !== null && firstStart > 1 ? `Below ${count(firstStart)}` : null;
}

/** A ceiling as typed: 0–100 with at most 2 decimals. */
export function ceilingOK(raw: string): boolean {
  const t = raw.trim();
  return /^\d{1,3}(\.\d{1,2})?$/.test(t) && Number(t) <= 100;
}

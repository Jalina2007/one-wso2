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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import type { UmtPlatformStatsRow, UmtPlatformStatsWire } from "./umtStatisticsTypes";

// The API returns one of three shapes depending on the selected breakdown.
// Normalize those shapes before caching so every chart only handles rows:
// `{ month, dynamicSeriesName: count }`.
export function normalizeUmtPlatformStats(data: UmtPlatformStatsWire): UmtPlatformStatsRow[] {
  return Object.entries(data)
    .sort(([firstMonth], [secondMonth]) => firstMonth.localeCompare(secondMonth))
    .map(([month, values]) => {
      if (typeof values === "number") return { month, value: values };

      if (Array.isArray(values)) {
        return values.reduce<UmtPlatformStatsRow>(
          (row, { product, version, count }) => {
            const series = `${product} ${version}`;
            return { ...row, [series]: ((row[series] as number | undefined) ?? 0) + count };
          },
          { month },
        );
      }

      return { month, ...values };
    });
}

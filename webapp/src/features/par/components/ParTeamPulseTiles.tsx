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

import { Box, LinearProgress, Stack, Typography } from "@wso2/oxygen-ui";

export interface ParPulseTileDef {
  label: string;
  completed: number;
  total: number;
  color: "success" | "primary" | "warning";
}

// Direct Reports' own completion pulse — one row of number tiles, used at
// both the team-list level (ParLeadDirectReportsTab.tsx) and the single-team
// roster level (ParLeadTeamRoster.tsx) so the two stay visually consistent.
export default function ParTeamPulseTiles({ tiles }: { tiles: ParPulseTileDef[] }) {
  return (
    <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
      {tiles.map((tile) => {
        const pct = tile.total <= 0 ? 0 : Math.min((tile.completed * 100) / tile.total, 100);
        return (
          <Box
            key={tile.label}
            sx={{
              flex: "1 1 180px",
              minWidth: 180,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1.5,
              p: 1.75,
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}
            >
              {tile.label}
            </Typography>
            <Stack direction="row" alignItems="baseline" spacing={0.75} sx={{ mt: 0.5, mb: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                {tile.completed}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                / {tile.total}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={pct}
              color={tile.color}
              aria-label={`${tile.label}: ${tile.completed} of ${tile.total}`}
              sx={{ height: 5, borderRadius: 3 }}
            />
          </Box>
        );
      })}
    </Stack>
  );
}

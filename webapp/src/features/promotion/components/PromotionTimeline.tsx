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

// Ports promotion-app's own PromotionTimeline (component/promotion/timeline.tsx)
// almost verbatim: source is @mui/lab's `Timeline position="alternate"` — a
// two-column layout where each row's "opposite content" (the cycle name / join
// date) sits on whichever side the row's content ISN'T, alternating every row.
//
// @mui/lab has no stable release for this app's MUI major version (checked:
// the npm registry's newest @mui/lab compatible with material v7 is still a
// beta), so this hand-rolls the same alternating grid + dot/connector spine
// with plain Box/Grid rather than pulling in a pre-release dependency. Visual
// result — column split, dot colours, connector, alternating sides — matches
// source; only the implementation is different.
import type { ReactNode } from "react";
import { Box, Chip, Typography } from "@wso2/oxygen-ui";
import { AwardIcon, BadgeIcon, type LucideIcon } from "@wso2/oxygen-ui-icons-react";
import type { PromotionEmployeeInfoWithLead, PromotionHistoryEntry } from "../api/types";
import { formatDate, sortPromotionsByBand } from "../util/promotionHistory";

interface Row {
  key: string | number;
  tone: "primary" | "warning" | "inherit";
  Icon: LucideIcon;
  opposite: string;
  content: ReactNode;
}

export default function PromotionTimeline({
  employeeInfo,
  requests,
}: {
  employeeInfo: PromotionEmployeeInfoWithLead;
  requests: PromotionHistoryEntry[];
}) {
  const sorted = sortPromotionsByBand(requests);

  const promotionRows: Row[] = sorted.map((entry) => ({
    key: entry.id,
    // "secondary" would match source's TimelineDot color literally, but this
    // app's theme leaves secondary too pale to read against the card
    // background — warning is the same distinguishing role the My-page
    // history dialog already uses for a SPECIAL chip (PromotionHistoryDialog's
    // own TypeChip), so this reuses that instead of inventing a new mapping.
    tone: entry.promotionType === "SPECIAL" ? "warning" : "primary",
    Icon: AwardIcon,
    opposite: entry.promotionCycle,
    content: (
      <>
        {entry.promotionType === "SPECIAL" && (
          <Chip label="Special" size="small" color="warning" variant="outlined" sx={{ mb: 0.5 }} />
        )}
        <Typography variant="h6" component="div">
          Promoted to JB: {entry.nextJobBand}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="div">
          BU: {entry.businessUnit}
          <br />
          Dept: {entry.department}
          <br />
          Team: {entry.team}
        </Typography>
      </>
    ),
  }));

  // The "Joined" node's band is the one held before any promotion on
  // record — source's own fallback (timeline.tsx:147-151): the oldest
  // approved request's currentJobBand when there's history, else
  // employee-info's own (current) jobBand for someone never promoted.
  const joinedBand = sorted.length > 0 ? sorted[sorted.length - 1].currentJobBand : employeeInfo.jobBand;
  const joinedRow: Row = {
    key: "joined",
    tone: "inherit",
    Icon: BadgeIcon,
    opposite: formatDate(employeeInfo.startDate),
    content: (
      <>
        <Typography variant="h6" component="div">
          Joined in JB: {joinedBand ?? "-"}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="div">
          BU: {employeeInfo.joinedBusinessUnit || "-"}
          <br />
          Dept: {employeeInfo.joinedDepartment || "-"}
          <br />
          Team: {employeeInfo.joinedTeam || "-"}
        </Typography>
      </>
    ),
  };

  // Promotions (already sorted newest-band-first, see sortPromotionsByBand),
  // then the initial/joined node last — matching timeline.tsx's own row
  // order exactly (the DOM order is what determines which node renders at
  // the top vs. the bottom, regardless of layout).
  const rows = [...promotionRows, joinedRow];

  return (
    <Box>
      {rows.map((row, i) => (
        <TimelineRow key={row.key} row={row} last={i === rows.length - 1} alternateLeft={i % 2 === 0} />
      ))}
    </Box>
  );
}

// One row of the alternating grid: opposite-content column, dot+connector
// spine, main-content column — swapping which side holds which every other
// row, same as @mui/lab's `position="alternate"`.
function TimelineRow({ row, last, alternateLeft }: { row: Row; last: boolean; alternateLeft: boolean }) {
  const oppositeCell = (
    <Box sx={{ textAlign: alternateLeft ? "right" : "left", py: "12px", px: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {row.opposite}
      </Typography>
    </Box>
  );
  const contentCell = (
    <Box sx={{ textAlign: alternateLeft ? "left" : "right", py: "12px", px: 2 }}>{row.content}</Box>
  );

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr", alignItems: "stretch" }}>
      {alternateLeft ? oppositeCell : contentCell}
      <Spine tone={row.tone} Icon={row.Icon} last={last} />
      {alternateLeft ? contentCell : oppositeCell}
    </Box>
  );
}

// The dot + connector column — a filled circle in the row's colour, with a
// line running through it connecting to the row above and below (source's
// TimelineSeparator/TimelineConnector/TimelineDot). The first row has nothing
// above to connect to and the last nothing below, but both still render a
// connector to keep every dot the same visual weight source's own timeline
// has (source always renders both TimelineConnectors regardless of position).
function Spine({ tone, Icon, last }: { tone: Row["tone"]; Icon: LucideIcon; last: boolean }) {
  const color = tone === "inherit" ? "text.secondary" : `${tone}.main`;
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Box sx={{ width: 2, flex: 1, minHeight: 12, bgcolor: "divider" }} />
      <Box
        sx={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: color,
          boxShadow: 2,
          flexShrink: 0,
          my: 0.5,
        }}
      >
        <Icon size={17} color="#fff" />
      </Box>
      {!last && <Box sx={{ width: 2, flex: 1, minHeight: 12, bgcolor: "divider" }} />}
    </Box>
  );
}

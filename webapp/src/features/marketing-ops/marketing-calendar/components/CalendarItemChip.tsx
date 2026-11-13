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

import { alpha, Box, ButtonBase, Tooltip, useTheme } from "@wso2/oxygen-ui";
import { categoryMainColor, categoryStyle } from "../calendarCategories";
import { itemDateText } from "../calendarSpans";
import type { CalendarItem } from "../marketingCalendarTypes";

// One item in the month grid, drawn as a calendar entry rather than a Chip: a bar
// in the category colour on the left, a faint tint of it behind, and up to two
// lines of title in the body text colour. The tooltip has the full title and the
// date, or the first to the last day for an event over several days.
//
// An event over several days is one wide strip. Where it carries on from the
// week before or into the next, that end is square and has no bar, so the strip
// reads as cut by the week's edge rather than starting or ending there.
export default function CalendarItemChip({
  item,
  onOpen,
  continuesBefore = false,
  continuesAfter = false,
}: {
  item: CalendarItem;
  onOpen: (item: CalendarItem) => void;
  continuesBefore?: boolean;
  continuesAfter?: boolean;
}) {
  const style = categoryStyle(item.category);
  const colour = categoryMainColor(style, useTheme().palette);
  const dateText = itemDateText(item);
  return (
    <Tooltip
      title={
        <>
          {style.label}: {item.title}
          <br />
          {style.dateLabel}: {dateText}
        </>
      }
      placement="top"
      disableInteractive
    >
      <ButtonBase
        onClick={() => onOpen(item)}
        aria-label={item.endDate ? `${item.title}, ${dateText}` : undefined}
        sx={{
          width: "100%",
          height: "100%",
          alignItems: "flex-start",
          justifyContent: "flex-start",
          textAlign: "left",
          typography: "caption",
          lineHeight: 1.35,
          color: "text.primary",
          px: 0.75,
          py: 0.375,
          borderLeft: continuesBefore ? 0 : `3px solid ${colour}`,
          borderTopLeftRadius: continuesBefore ? 0 : "4px",
          borderBottomLeftRadius: continuesBefore ? 0 : "4px",
          borderTopRightRadius: continuesAfter ? 0 : "4px",
          borderBottomRightRadius: continuesAfter ? 0 : "4px",
          bgcolor: alpha(colour, 0.12),
          opacity: item.state === "closed" ? 0.6 : 1,
          "&:hover": { bgcolor: alpha(colour, 0.22) },
          "&.Mui-focusVisible": { outline: `2px solid ${colour}`, outlineOffset: 1 },
        }}
      >
        <Box
          component="span"
          sx={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            overflowWrap: "anywhere",
            minWidth: 0,
          }}
        >
          {item.title}
        </Box>
      </ButtonBase>
    </Tooltip>
  );
}

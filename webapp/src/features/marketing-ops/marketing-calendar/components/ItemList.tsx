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

import { alpha, Box, ButtonBase, Stack, Typography, useTheme } from "@wso2/oxygen-ui";
import { categoryMainColor, categoryStyle } from "../calendarCategories";
import { longDate } from "../calendarDates";
import { itemDateText } from "../calendarSpans";
import type { CalendarItem } from "../marketingCalendarTypes";

// The List view's body: the items under a heading per day, earliest first, with
// days that have nothing left out. Each row is drawn like the grid's entry (the
// category's bar and tint) but with room for the whole title and a line of
// category, Status and BU, which the grid only shows in the drawer. An event over
// several days is listed once, under its first day, with its dates in that line.
export default function ItemList({
  items,
  onOpenItem,
}: {
  items: CalendarItem[];
  onOpenItem: (item: CalendarItem) => void;
}) {
  return (
    <Box component="section" aria-label="Items by date">
      {groupByDate(items).map(([date, sameDay]) => (
        <Box key={date} sx={{ mb: 2 }}>
          <Typography variant="subtitle2" component="h2" sx={{ mb: 0.75 }}>
            {longDate(date)}
          </Typography>
          <Stack spacing={0.75}>
            {sameDay.map((item) => (
              <ItemRow key={item.id} item={item} onOpen={onOpenItem} />
            ))}
          </Stack>
        </Box>
      ))}
    </Box>
  );
}

function ItemRow({ item, onOpen }: { item: CalendarItem; onOpen: (item: CalendarItem) => void }) {
  const style = categoryStyle(item.category);
  const colour = categoryMainColor(style, useTheme().palette);
  const summary = [style.label, item.endDate && itemDateText(item), item.status, item.bu.join(", ")]
    .filter(Boolean)
    .join(" · ");
  return (
    <ButtonBase
      onClick={() => onOpen(item)}
      sx={{
        width: "100%",
        flexDirection: "column",
        alignItems: "flex-start",
        textAlign: "left",
        color: "text.primary",
        px: 1.25,
        py: 0.75,
        borderLeft: `3px solid ${colour}`,
        borderRadius: "4px",
        bgcolor: alpha(colour, 0.12),
        opacity: item.state === "closed" ? 0.6 : 1,
        "&:hover": { bgcolor: alpha(colour, 0.22) },
        "&.Mui-focusVisible": { outline: `2px solid ${colour}`, outlineOffset: 1 },
      }}
    >
      <Typography variant="body2" component="span" sx={{ overflowWrap: "anywhere" }}>
        {item.title}
      </Typography>
      <Typography variant="caption" component="span" color="text.secondary">
        {summary}
      </Typography>
    </ButtonBase>
  );
}

// Days in date order (YYYY-MM-DD sorts as text), each with its items in the order given.
function groupByDate(items: CalendarItem[]): [string, CalendarItem[]][] {
  const itemsByDate = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const sameDay = itemsByDate.get(item.date);
    if (sameDay) sameDay.push(item);
    else itemsByDate.set(item.date, [item]);
  }
  return [...itemsByDate].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

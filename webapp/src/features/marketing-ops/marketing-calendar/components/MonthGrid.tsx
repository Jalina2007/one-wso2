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

import { useState } from "react";
import { Box, Button, Popover, Stack, Typography } from "@wso2/oxygen-ui";
import { localIsoDate } from "@utils/localDate";
import { isoDate, longDate, type CalendarMonth, type CivilDate } from "../calendarDates";
import { layoutWeek, type WeekLayout } from "../calendarSpans";
import type { CalendarItem } from "../marketingCalendarTypes";
import CalendarItemChip from "./CalendarItemChip";

// The hand-built month grid: a header row of weekdays, then one row per week,
// Monday first. Days from the neighbouring months are drawn faded so each row is full.
//
// Each week is its own seven-column CSS grid, in layers: the day cells fill every
// row of it (borders, shading, the day number), and the items sit on top, one
// grid row per lane, so an event over several days is one strip across its
// columns (calendarSpans lays the lanes out). Under the lanes, a day with hidden
// items says "+N more", which lists everything on that day.

// A busy day shows this many lanes of items, then "+N more".
const LANES_PER_WEEK = 3;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const COLUMNS = "repeat(7, minmax(0, 1fr))";
// The day cell's padding, which a strip keeps at an end it doesn't continue past.
const CELL_PADDING = 0.75;

export default function MonthGrid({
  month,
  weeks,
  items,
  onOpenItem,
}: {
  month: CalendarMonth;
  weeks: CivilDate[][];
  items: CalendarItem[];
  onOpenItem: (item: CalendarItem) => void;
}) {
  const today = localIsoDate();

  return (
    // Seven columns stop being readable on a phone, so the grid keeps a minimum
    // width and scrolls sideways inside its own box rather than squeezing.
    <Box sx={{ overflowX: "auto" }}>
      <Box
        role="grid"
        aria-label="Month"
        sx={{ minWidth: 720, border: 1, borderColor: "divider", borderRadius: 1, overflow: "hidden" }}
      >
        <Box role="row" sx={{ display: "grid", gridTemplateColumns: COLUMNS }}>
          {WEEKDAYS.map((weekday) => (
            <Typography
              key={weekday}
              role="columnheader"
              variant="caption"
              color="text.secondary"
              sx={{ px: 1, py: 0.75, fontWeight: 600, borderBottom: 1, borderColor: "divider" }}
            >
              {weekday}
            </Typography>
          ))}
        </Box>
        {weeks.map((week) => (
          <WeekRow
            key={isoDate(week[0])}
            week={week}
            month={month}
            today={today}
            layout={layoutWeek(week.map(isoDate), items, LANES_PER_WEEK)}
            onOpenItem={onOpenItem}
          />
        ))}
      </Box>
    </Box>
  );
}

function WeekRow({
  week,
  month,
  today,
  layout,
  onOpenItem,
}: {
  week: CivilDate[];
  month: CalendarMonth;
  today: string;
  layout: WeekLayout;
  onOpenItem: (item: CalendarItem) => void;
}) {
  const hasHidden = layout.hiddenByColumn.some((count) => count > 0);
  // The day numbers, a row per lane in use, the "+N more" row when needed, then
  // whatever height is left (the week is at least as tall as a day cell), which
  // with the row gap above it keeps the last lane off the cell's bottom border.
  const rows = [
    "auto",
    ...Array<string>(layout.laneCount).fill("auto"),
    ...(hasHidden ? ["auto"] : []),
    "minmax(2px, 1fr)",
  ];
  const moreRow = layout.laneCount + 2;

  return (
    <Box
      role="row"
      sx={{
        display: "grid",
        gridTemplateColumns: COLUMNS,
        gridTemplateRows: rows.join(" "),
        rowGap: 0.5,
        minHeight: 112,
        borderBottom: 1,
        borderColor: "divider",
        "&:last-of-type": { borderBottom: 0 },
      }}
    >
      {week.map((day, column) => {
        const date = isoDate(day);
        return (
          <DayCell
            key={date}
            date={date}
            column={column}
            dayNumber={day.day}
            inMonth={day.month === month.month}
            isToday={date === today}
          />
        );
      })}

      {layout.strips.map((strip) => (
        <Box
          key={strip.item.id}
          sx={{
            gridColumn: `${strip.startColumn + 1} / span ${strip.span}`,
            gridRow: strip.lane + 2,
            pl: strip.continuesBefore ? 0 : CELL_PADDING,
            pr: strip.continuesAfter ? 0 : CELL_PADDING,
            minWidth: 0,
            zIndex: 1,
          }}
        >
          <CalendarItemChip
            item={strip.item}
            onOpen={onOpenItem}
            continuesBefore={strip.continuesBefore}
            continuesAfter={strip.continuesAfter}
          />
        </Box>
      ))}

      {layout.hiddenByColumn.map((hiddenCount, column) =>
        hiddenCount > 0 ? (
          <MoreButton
            key={column}
            column={column}
            row={moreRow}
            date={isoDate(week[column])}
            hiddenCount={hiddenCount}
            items={layout.itemsByColumn[column]}
            onOpenItem={onOpenItem}
          />
        ) : null,
      )}
    </Box>
  );
}

function DayCell({
  date,
  column,
  dayNumber,
  inMonth,
  isToday,
}: {
  date: string;
  column: number;
  dayNumber: number;
  inMonth: boolean;
  isToday: boolean;
}) {
  return (
    <>
      {/* The day's column, under every row of the week: its border and shading. */}
      <Box
        aria-hidden
        sx={{
          gridColumn: column + 1,
          gridRow: "1 / -1",
          borderRight: column === 6 ? 0 : 1,
          borderColor: "divider",
          bgcolor: inMonth ? "background.paper" : "action.hover",
        }}
      />
      <Box
        role="gridcell"
        aria-label={longDate(date)}
        sx={{ gridColumn: column + 1, gridRow: 1, px: CELL_PADDING, pt: CELL_PADDING, minWidth: 0, zIndex: 1 }}
      >
        <Typography
          variant="caption"
          sx={{
            display: "inline-grid",
            placeItems: "center",
            width: 22,
            height: 22,
            borderRadius: "50%",
            fontWeight: isToday ? 700 : 500,
            color: isToday ? "primary.contrastText" : inMonth ? "text.primary" : "text.disabled",
            bgcolor: isToday ? "primary.main" : "transparent",
          }}
        >
          {dayNumber}
        </Typography>
      </Box>
    </>
  );
}

function MoreButton({
  column,
  row,
  date,
  hiddenCount,
  items,
  onOpenItem,
}: {
  column: number;
  row: number;
  date: string;
  hiddenCount: number;
  items: CalendarItem[];
  onOpenItem: (item: CalendarItem) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  // Opening an item from the "+N more" list closes the list first, so the drawer
  // isn't stacked over a popover.
  const openFromList = (item: CalendarItem) => {
    setAnchor(null);
    onOpenItem(item);
  };

  return (
    <Box sx={{ gridColumn: column + 1, gridRow: row, px: CELL_PADDING, minWidth: 0, zIndex: 1 }}>
      <Button
        size="small"
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{ justifyContent: "flex-start", minWidth: 0, px: 0.75, py: 0, fontSize: 12 }}
      >
        +{hiddenCount} more
      </Button>
      <Popover
        open={anchor !== null}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{ paper: { sx: { p: 1.5, width: 280 } } }}
      >
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {longDate(date)}
        </Typography>
        <Stack spacing={0.5}>
          {items.map((item) => (
            <CalendarItemChip key={item.id} item={item} onOpen={openFromList} />
          ))}
        </Stack>
      </Popover>
    </Box>
  );
}

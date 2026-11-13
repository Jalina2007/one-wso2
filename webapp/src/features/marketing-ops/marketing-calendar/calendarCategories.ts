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

import { alpha, type ChipProps } from "@wso2/oxygen-ui";
import type { CalendarCategory } from "./marketingCalendarTypes";

// The five calendar categories in the order the tabs and the legend offer them,
// each with the colour its chips use. Theme palette keys where the palette has a
// fitting hue, so those chips follow the theme and light and dark mode with the
// rest of the app.

// Email's violet, a hex because no palette key fits. `secondary` is a light cyan
// in the default WSO2 theme (1.75:1 on white, and close to Content's blue) and
// near-white or grey in others; `warning` is a second orange beside Events; and
// `error` reads as a fault and sits between Events' orange and, for red-green
// colour blindness, Social's green. This is the app's own violet, the CSM hue in
// config/perspectiveHues.ts: 4.17:1 on white, 4.28:1 on the dark theme's
// #0f172a, and 4.17:1 for white text on it, so one value clears 3:1 in both
// modes. `dark` is the hover fill; white on it is 6.02:1.
const EMAIL_VIOLET: CustomHue = { main: "#9B5DE0", dark: "#7C4AB3" };

// Release's rose, a hex for the same reasons. It is the app's Marketing hue in
// config/perspectiveHues.ts, 60 degrees from Email's violet: 3.79:1 on white,
// 4.71:1 on #0f172a, and 3.79:1 for white text on it. White on `dark` is 5.55:1.
const RELEASE_ROSE: CustomHue = { main: "#E04A8F", dark: "#B33B72" };

export interface CustomHue {
  main: string;
  dark: string;
}

export interface CategoryStyle {
  key: CalendarCategory;
  // The category's tab, under the calendar's path.
  segment: string;
  // The tab's and the legend's label for the whole category.
  pluralLabel: string;
  // The label on one item.
  label: string;
  // What the empty state calls this category's items: "No content planned for …".
  noun: string;
  // What the item's calendar date means, in the chip's tooltip and (except for
  // events) the details panel. An event's calendar date is its Due Date, which
  // can differ from its own Event Start Date, so it is just "Date"; the panel
  // shows the event's start and end dates under their own names instead.
  dateLabel: string;
  color: "primary" | "info" | "success" | CustomHue;
}

export const CALENDAR_CATEGORIES: readonly CategoryStyle[] = [
  {
    key: "event",
    segment: "events",
    pluralLabel: "Events",
    label: "Event",
    noun: "events",
    dateLabel: "Date",
    color: "primary",
  },
  {
    key: "content",
    segment: "content",
    pluralLabel: "Content",
    label: "Content",
    noun: "content",
    dateLabel: "Publish Date",
    color: "info",
  },
  {
    key: "social",
    segment: "social",
    pluralLabel: "Social",
    label: "Social",
    noun: "social posts",
    dateLabel: "Post Date",
    color: "success",
  },
  {
    key: "email",
    segment: "email",
    pluralLabel: "Email",
    label: "Email",
    noun: "emails",
    dateLabel: "Send Date",
    color: EMAIL_VIOLET,
  },
  {
    key: "release",
    segment: "releases",
    pluralLabel: "Releases",
    label: "Release",
    noun: "releases",
    dateLabel: "Marketing Launch Date",
    color: RELEASE_ROSE,
  },
];

/**
 * The Chip props that paint a chip in the category's colour: the palette key
 * when it has one, otherwise sx that draws a custom hue the way MUI draws a
 * palette colour (the same border alpha, hover and focus fills). Spread `sx`
 * into the chip's own.
 */
/**
 * The category's colour as a CSS value, for drawing with it directly (the grid
 * chip's accent bar and tint) rather than through a Chip's `color` prop.
 */
export function categoryMainColor(
  style: CategoryStyle,
  palette: Record<"primary" | "info" | "success", { main: string }>,
): string {
  const { color } = style;
  return typeof color === "string" ? palette[color].main : color.main;
}

export function categoryChipColor(
  style: CategoryStyle,
  variant: "filled" | "outlined",
): { color: ChipProps["color"]; sx: Record<string, string | Record<string, string>> } {
  const { color } = style;
  if (typeof color === "string") return { color, sx: {} };
  // MUI's own clickable-chip rules carry two classes, so these must too to win.
  if (variant === "filled") {
    return {
      color: "default",
      sx: {
        bgcolor: color.main,
        color: "#ffffff",
        "&.MuiChip-clickable:hover, &.Mui-focusVisible": { bgcolor: color.dark },
      },
    };
  }
  return {
    color: "default",
    sx: {
      color: color.main,
      borderColor: alpha(color.main, 0.7),
      "&.MuiChip-clickable:hover": { bgcolor: alpha(color.main, 0.04) },
      "&.Mui-focusVisible": { bgcolor: alpha(color.main, 0.12) },
    },
  };
}

export function categoryStyle(category: CalendarCategory): CategoryStyle {
  return CALENDAR_CATEGORIES.find((style) => style.key === category) ?? CALENDAR_CATEGORIES[0];
}

/** A category key (`event`, as the retired `?category=` carried it) as a category, or null. */
export function parseCategory(value: string | null): CalendarCategory | null {
  return CALENDAR_CATEGORIES.find((style) => style.key === value)?.key ?? null;
}

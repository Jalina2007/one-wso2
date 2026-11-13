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

// `getRowHeight: () => "auto"` leaves DataGrid cells as `display: block`, so
// cell text sits flush against the top border while the row's slack collects
// underneath it. Wrapping each cell's content in a flex box that fills the
// cell restores symmetric vertical padding and keeps every UMT table aligned
// the same way.
export const gridCellContentSx = {
  alignItems: "center",
  display: "flex",
  minHeight: "100%",
  py: 0.75,
  width: "100%",
} as const;

// Removes the backdrop blur the theme gives every Paper, for a card that holds
// a grid with a frosted header. A backdrop blur on an ancestor stops the
// header's blur from covering the rows beneath it: the rows stay sharp under
// the header with only a faint halo. Spread it into a card's own layout.
export const UMT_GRID_PAPER_BLUR_RESET_SX = {
  backdropFilter: "none",
  WebkitBackdropFilter: "none",
} as const;

// A card that holds a grid with a frosted header and fills the space left to
// it, so the grid scrolls inside the card.
export const UMT_GRID_PAPER_SX = {
  ...UMT_GRID_PAPER_BLUR_RESET_SX,
  display: "flex",
  flex: 1,
  flexDirection: "column",
  minHeight: 0,
  minWidth: 0,
  overflow: "hidden",
  position: "relative",
} as const;

const HEADER_BLUR = "blur(10px)";

// The frosted header for any UMT grid: rows that scroll under the sticky
// header show through a translucent paper tint and a blur. The blur is set
// here for every theme, because only some of the themes put one on the
// header. The header cells, filler and scrollbar filler are cleared to
// transparent, because the grid paints them with its solid header colour,
// which hides the blur. The grid's card must also drop its own backdrop blur
// (see UMT_GRID_PAPER_BLUR_RESET_SX), or this blur has no effect.
export const UMT_FROSTED_HEADER_SX = {
  "& .MuiDataGrid-columnHeaders": {
    backgroundColor: "color-mix(in srgb, var(--oxygen-palette-background-paper) 70%, transparent)",
    // The header shade, laid over the tint across the header's full width.
    backgroundImage:
      "linear-gradient(var(--oxygen-palette-action-hover), var(--oxygen-palette-action-hover))",
    backdropFilter: HEADER_BLUR,
    WebkitBackdropFilter: HEADER_BLUR,
  },
  "& .MuiDataGrid-columnHeader": {
    backgroundColor: "transparent",
  },
  "& .MuiDataGrid-columnHeaders .MuiDataGrid-filler, & .MuiDataGrid-columnHeaders .MuiDataGrid-scrollbarFiller":
    {
      backgroundColor: "transparent",
    },
} as const;

// The MIT DataGrid always pages its rows, 100 to a page by default, and a grid
// with a hidden footer has no pager to reach page 2. These props put every row
// on one page instead: a page size of -1 means "all rows", and it has to be
// listed in `pageSizeOptions` as well. Spread them into any UMT grid that shows
// a whole list with no pager.
export const UMT_ALL_ROWS_GRID_PROPS = {
  initialState: { pagination: { paginationModel: { page: 0, pageSize: -1 } } },
  pageSizeOptions: [-1],
};

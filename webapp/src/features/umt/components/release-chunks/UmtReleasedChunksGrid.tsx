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

import { Box, DataGrid, LinearProgress, Paper, Stack, Typography } from "@wso2/oxygen-ui";
import { InboxIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import type { UmtReleasedChunk } from "../../api/umtReleaseChunks";
import { useUmtReleasedChunks } from "../../api/useUmtReleaseChunks";
import { ChunkCell, ChunkLine } from "./umtReleaseChunkGridPrimitives";
import { UMT_CHUNK_GRID_SX } from "./umtReleaseChunkGridSx";

const { DataGrid: DataGridComponent } = DataGrid;
const PAGE_SIZE_OPTIONS = [20, 30, 50];

// Purely informational: a released chunk is finished, so there is nothing to
// act on here even for an administrator.
export default function UmtReleasedChunksGrid() {
  const releasedChunks = useUmtReleasedChunks();
  const rows = [...(releasedChunks.data ?? [])].sort((a, b) => b.id - a.id);

  const columns: DataGrid.GridColDef<UmtReleasedChunk>[] = [
    {
      field: "id",
      headerName: "ID",
      width: 80,
      sortable: false,
      renderCell: (params) => (
        <ChunkCell>
          <ChunkLine>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {params.row.id}
            </Typography>
          </ChunkLine>
        </ChunkCell>
      ),
    },
    {
      field: "updateIds",
      headerName: "Update IDs",
      width: 110,
      sortable: false,
      renderCell: (params) => (
        <ChunkCell>
          {params.row.updateIds.map((id) => (
            <ChunkLine key={id}>
              <Typography variant="body2">{id}</Typography>
            </ChunkLine>
          ))}
        </ChunkCell>
      ),
    },
    {
      field: "updateLevels",
      headerName: "Update Level",
      flex: 3,
      minWidth: 260,
      sortable: false,
      renderCell: (params) => (
        <ChunkCell divided>
          {params.row.updateLevels.map((level, index) => (
            <ChunkLine key={index} gap={1}>
              {/* The trailing update level is what identifies which release
                  of the product this row is about; without it two releases of
                  the same product read identically. */}
              <Typography variant="body2">
                {level.productName ?? "N/A"} {level.productVersion ?? "N/A"}
                {level.updateLevel === null || level.updateLevel === undefined
                  ? ""
                  : `.${level.updateLevel}`}
              </Typography>
              <Box
                sx={{
                  bgcolor: level.buildStatus === "SUCCESS" ? "success.main" : "error.main",
                  borderRadius: "50%",
                  flexShrink: 0,
                  height: 8,
                  width: 8,
                }}
              />
              <Typography variant="body2" sx={{ textTransform: "capitalize" }}>
                {(level.buildStatus ?? "unknown").toLowerCase()}
              </Typography>
            </ChunkLine>
          ))}
        </ChunkCell>
      ),
    },
    {
      field: "releaseMessage",
      headerName: "Release Message",
      flex: 2,
      minWidth: 200,
      sortable: false,
      renderCell: (params) => (
        <ChunkCell>
          <ChunkLine>
            <Typography variant="body2">{params.row.releaseMessage ?? "N/A"}</Typography>
          </ChunkLine>
        </ChunkCell>
      ),
    },
    {
      field: "releasedOn",
      headerName: "Released On",
      width: 170,
      sortable: false,
      renderCell: (params) => (
        <ChunkCell>
          <ChunkLine>
            <Typography variant="body2">{params.row.releasedOn ?? "N/A"}</Typography>
          </ChunkLine>
        </ChunkCell>
      ),
    },
  ];

  return (
    <Stack spacing={2} sx={{ flex: 1, minHeight: 0 }}>
      {releasedChunks.isError && (
        <ErrorNotice
          error={releasedChunks.error}
          onRetry={() => void releasedChunks.refetch()}
          retrying={releasedChunks.isFetching}
        >
          Couldn&apos;t load released chunks.
        </ErrorNotice>
      )}

      <Paper
        variant="outlined"
        sx={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          minHeight: 0,
          minWidth: 0,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {releasedChunks.isFetching && !releasedChunks.isPending && (
          <LinearProgress sx={{ left: 0, position: "absolute", right: 0, top: 0, zIndex: 4 }} />
        )}
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <DataGridComponent
            columnHeaderHeight={40}
            columns={columns}
            disableColumnMenu
            disableRowSelectionOnClick
            getRowHeight={() => "auto"}
            initialState={{ pagination: { paginationModel: { pageSize: PAGE_SIZE_OPTIONS[0], page: 0 } } }}
            loading={releasedChunks.isPending}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            rows={rows}
            slots={{ noRowsOverlay: ReleasedChunksEmptyState }}
            sx={UMT_CHUNK_GRID_SX}
          />
        </Box>
      </Paper>
    </Stack>
  );
}

function ReleasedChunksEmptyState() {
  return (
    <Stack sx={{ alignItems: "center", color: "text.disabled", height: "100%", justifyContent: "center" }} spacing={1}>
      <InboxIcon size={36} />
      <Typography variant="body2">No released chunks yet</Typography>
    </Stack>
  );
}

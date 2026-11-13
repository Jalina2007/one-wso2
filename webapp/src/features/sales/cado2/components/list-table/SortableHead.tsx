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

import type { JSX } from "react";
import { TableCell, TableHead, TableRow, TableSortLabel } from "@wso2/oxygen-ui";
import { LIST_CELL, type ListColumn, type ListSort } from "@features/sales/cado2/components/list-table/listTable";

/**
 * Headers that sort: click once for ascending, again for descending; a
 * column without a sort key is a plain header. An extra empty header can
 * follow, for a row's actions.
 */
export default function SortableHead<K extends string>({
  columns,
  sort,
  onSort,
  actionsColumn = false,
}: {
  readonly columns: readonly ListColumn<K>[];
  readonly sort: ListSort<K>;
  readonly onSort: (s: ListSort<K>) => void;
  readonly actionsColumn?: boolean;
}): JSX.Element {
  return (
    <TableHead>
      <TableRow
        sx={{
          "& th": {
            ...LIST_CELL,
            color: "text.secondary",
            fontWeight: 600,
            fontSize: 12,
            whiteSpace: "nowrap",
          },
        }}
      >
        {columns.map(({ label, sort: key, align }) =>
          key === undefined ? (
            <TableCell key={label} align={align}>
              {label}
            </TableCell>
          ) : (
            <TableCell key={key} align={align} sortDirection={sort.key === key ? sort.dir : false}>
              <TableSortLabel
                active={sort.key === key}
                direction={sort.key === key ? sort.dir : "asc"}
                onClick={() => onSort({ key, dir: sort.key === key && sort.dir === "asc" ? "desc" : "asc" })}
              >
                {label}
              </TableSortLabel>
            </TableCell>
          ),
        )}
        {actionsColumn ? <TableCell aria-label="Actions" /> : null}
      </TableRow>
    </TableHead>
  );
}

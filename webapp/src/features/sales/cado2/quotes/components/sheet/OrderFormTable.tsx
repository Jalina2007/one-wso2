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

import { Fragment, type JSX, type ReactNode } from "react";
import { Box, Chip, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@wso2/oxygen-ui";
import { orderForm, type SheetLine } from "@features/sales/cado2/quotes/sheet/sheetModel";
import { formatMoney } from "@features/sales/cado2/utils/money";

const num = { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" } as const;

interface OrderFormTableProps {
  readonly lines: readonly SheetLine[];
  readonly currency: string;
  /** Buttons for a line (the wizard's edit / remove), by its position in `lines`. */
  readonly actions?: (index: number) => ReactNode;
  /** A row under a line, e.g. its problems, by its position in `lines`. */
  readonly below?: (index: number) => ReactNode;
  /** A partner-led quote's commission %, e.g. "15": adds the commission and net rows. */
  readonly commissionPercent?: string | null;
}

/**
 * The products as an order form (misc/WSO2_Order_Form_Sample.docx): grouped
 * into Subscription, Support and Professional Services, each with its own
 * subtotal, then the total order value. Each amount is the line's cost over
 * the whole term. On a partner-led quote, the partner's commission and the
 * net order value follow:
 *
 *   Total order value              88,700.00
 *   Partner commission (15%)     − 13,305.00
 *   Net order value                75,395.00
 */
export default function OrderFormTable({ lines, currency, actions, below, commissionPercent = null }: OrderFormTableProps): JSX.Element {
  const form = orderForm(lines, commissionPercent);
  const cols = actions ? 7 : 6;
  const cur = currency ? ` (${currency})` : "";
  const money = (v: string | null) => (v ? formatMoney(v) : "—");

  const totalRow = (label: string, value: string | null, strong = false, prefix = "") => (
    <TableRow sx={strong ? { bgcolor: "action.hover" } : undefined}>
      <TableCell colSpan={5} align="right" sx={{ fontWeight: strong ? 800 : 600, borderBottom: strong ? 0 : undefined }}>
        {label}
        {cur}
      </TableCell>
      <TableCell align="right" sx={{ ...num, fontWeight: strong ? 800 : 600, fontSize: strong ? "1rem" : undefined, borderBottom: strong ? 0 : undefined }}>
        {value ? `${prefix}${money(value)}` : money(value)}
      </TableCell>
      {actions ? <TableCell sx={{ borderBottom: strong ? 0 : undefined }} /> : null}
    </TableRow>
  );

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5 }}>
      <Table size="small" aria-label="Products">
        <TableHead>
          <TableRow>
            <TableCell>Product or service</TableCell>
            <TableCell>Unit of measure</TableCell>
            <TableCell align="right">Unit list</TableCell>
            <TableCell align="right">Qty</TableCell>
            <TableCell align="right">Disc.</TableCell>
            <TableCell align="right">Amount{cur}</TableCell>
            {actions ? (
              <TableCell align="right">
                <Box component="span" sx={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}>
                  Actions
                </Box>
              </TableCell>
            ) : null}
          </TableRow>
        </TableHead>
        <TableBody>
          {form.groups.map((g) => (
            <Fragment key={g.category}>
              <TableRow>
                <TableCell colSpan={cols} sx={{ bgcolor: "action.hover", py: 0.75 }}>
                  <Typography variant="overline" sx={{ fontWeight: 700, lineHeight: 1.6 }}>
                    {g.title}
                  </Typography>
                </TableCell>
              </TableRow>
              {g.lines.map((l) => {
                const index = lines.indexOf(l);
                return (
                  <Fragment key={l.number}>
                    <TableRow hover>
                      <TableCell sx={{ minWidth: 200 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {l.productName}
                        </Typography>
                        {l.productDescription ? (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, lineHeight: 1.4 }}>
                            {l.productDescription}
                          </Typography>
                        ) : null}
                        {/* Every line is from the quote's price book, shown once in the Deal section. */}
                        {l.productCode ? (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {l.productCode}
                          </Typography>
                        ) : null}
                        {l.categoryByRep ? (
                          <Chip
                            size="small"
                            color="warning"
                            variant="outlined"
                            label="Category chosen by rep"
                            title="This product has no category set up by an Admin, so the rep chose it. Deal Desk checks it."
                            sx={{ mt: 0.5 }}
                          />
                        ) : null}
                      </TableCell>
                      <TableCell>{l.unitOfMeasure ?? "–"}</TableCell>
                      <TableCell align="right" sx={num}>
                        {formatMoney(l.unitPrice)}
                      </TableCell>
                      <TableCell align="right" sx={num}>
                        {l.quantity}
                      </TableCell>
                      <TableCell align="right" sx={num}>
                        {Number(l.discountPercent) ? `${l.discountPercent}%` : "–"}
                      </TableCell>
                      <TableCell align="right" sx={{ ...num, fontWeight: 600 }}>
                        {money(l.tcv)}
                      </TableCell>
                      {actions ? (
                        <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                          {actions(index)}
                        </TableCell>
                      ) : null}
                    </TableRow>
                    {below?.(index)}
                  </Fragment>
                );
              })}
              {totalRow(`${g.title} subtotal`, g.subtotal)}
            </Fragment>
          ))}
          {form.commission !== null ? (
            <>
              {totalRow("Total order value", form.total)}
              {totalRow(`Partner commission (${commissionPercent}%)`, form.commission, false, "− ")}
              {totalRow("Net order value", form.netOrderValue, true)}
            </>
          ) : (
            totalRow("Total order value", form.total, true)
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

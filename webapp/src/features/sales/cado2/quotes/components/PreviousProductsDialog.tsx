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

import { useState, type JSX, type ReactNode } from "react";
import {
  Box,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { ChevronRightIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { usePreviousOpportunityLines } from "@features/sales/cado2/quotes/api/useQuoteApi";
import type { OpportunityLineView } from "@features/sales/cado2/quotes/api/quoteTypes";
import { formatDate } from "@features/sales/cado2/quotes/form/draftForm";
import {
  groupByProduct,
  shortOpportunityName,
  type PreviousOpportunity,
} from "@features/sales/cado2/quotes/form/previousProducts";
import { formatMoney } from "@features/sales/cado2/utils/money";

interface PreviousProductsDialogProps {
  readonly open: boolean;
  /** The opportunities this renewal replaces, as ticked in Overview (saved or not). */
  readonly opportunityIds: readonly string[];
  /** The quote's account, whose name the opportunities' names drop in the product view. */
  readonly accountName: string;
  readonly onClose: () => void;
}

type View = "opportunity" | "product";

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

/** A percentage from Salesforce, "25" → "25%"; a dash when it has none. */
function percent(value: string | null): string {
  return value && Number(value) !== 0 ? `${value}%` : "—";
}

function dates(start: string | null, end: string | null): string {
  return start || end ? `${formatDate(start)} – ${formatDate(end)}` : "—";
}

/** A chevron that turns when its section is open. */
function Chevron({ open }: { open: boolean }): JSX.Element {
  return (
    <Box aria-hidden sx={{ display: "grid", color: "text.secondary", transition: "transform .15s", transform: open ? "rotate(90deg)" : "none" }}>
      <ChevronRightIcon size={16} />
    </Box>
  );
}

/** A header that opens and closes its section, by click or keyboard. */
function Toggle({ open, label, onToggle, children }: { open: boolean; label: string; onToggle: () => void; children: ReactNode }): JSX.Element {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      role="button"
      tabIndex={0}
      aria-expanded={open}
      aria-label={label}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      sx={{ cursor: "pointer", flexWrap: "wrap", rowGap: 0.5 }}
    >
      <Chevron open={open} />
      {children}
    </Stack>
  );
}

/** The figures of a line, after its first cell. */
function LineCells({ line }: { line: OpportunityLineView }): JSX.Element {
  return (
    <>
      <TableCell align="right">{formatMoney(line.quantity)}</TableCell>
      <TableCell align="right">{formatMoney(line.salesPrice)}</TableCell>
      <TableCell align="right">{percent(line.discount)}</TableCell>
      <TableCell align="right">{formatMoney(line.totalPrice)}</TableCell>
      <TableCell sx={{ whiteSpace: "nowrap" }}>{dates(line.serviceStartDate, line.serviceEndDate)}</TableCell>
    </>
  );
}

function FigureHeads({ first }: { first: string }): JSX.Element {
  return (
    <TableHead>
      <TableRow>
        <TableCell>{first}</TableCell>
        <TableCell align="right">Qty</TableCell>
        <TableCell align="right">Sales price</TableCell>
        <TableCell align="right">Discount</TableCell>
        <TableCell align="right">Total price</TableCell>
        <TableCell>Service dates</TableCell>
      </TableRow>
    </TableHead>
  );
}

function ProductName({ name, code }: { name: string | null; code: string | null }): JSX.Element {
  return (
    <>
      {name ?? "—"}
      {code ? (
        <Typography variant="caption" color="text.secondary" component="div">
          {code}
        </Typography>
      ) : null}
    </>
  );
}

/** One section per opportunity, each opening and closing. */
function ByOpportunity({ opportunities, closed, toggle }: { opportunities: readonly PreviousOpportunity[]; closed: ReadonlySet<string>; toggle: (key: string) => void }): JSX.Element {
  return (
    <Stack spacing={1.5}>
      {opportunities.map((o) => {
        const open = !closed.has(o.id);
        const facts = [
          o.data.subsStartDate || o.data.subsEndDate ? `Subscription ${dates(o.data.subsStartDate, o.data.subsEndDate)}` : null,
          o.data.currency,
          plural(o.data.lines.length, "product", "products"),
        ].filter(Boolean);
        return (
          <Stack key={o.id} spacing={1}>
            <Paper variant="outlined" sx={{ px: 1.5, py: 1, bgcolor: "action.hover" }}>
              <Toggle open={open} label={`${o.name}, ${open ? "collapse" : "expand"}`} onToggle={() => toggle(o.id)}>
                <Typography variant="subtitle2" component="h3" sx={{ fontWeight: 700 }}>
                  {o.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ ml: "auto !important" }}>
                  {facts.join(" · ")}
                </Typography>
              </Toggle>
            </Paper>
            <Collapse in={open} unmountOnExit>
              {o.data.lines.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
                  No products on this opportunity in Salesforce.
                </Typography>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small" sx={{ minWidth: 760 }} aria-label={`Products on ${o.name}`}>
                    <FigureHeads first="Product" />
                    <TableBody>
                      {o.data.lines.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell>
                            <ProductName name={l.productName} code={l.productCode} />
                          </TableCell>
                          <LineCells line={l} />
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Collapse>
          </Stack>
        );
      })}
    </Stack>
  );
}

/** One group per distinct product, a line under it for each opportunity it is on. */
function ByProduct({ opportunities, closed, toggle }: { opportunities: readonly PreviousOpportunity[]; closed: ReadonlySet<string>; toggle: (key: string) => void }): JSX.Element {
  const groups = groupByProduct(opportunities);
  // Each line says its currency only when the opportunities differ.
  const mixed = new Set(opportunities.map((o) => o.data.currency)).size > 1;
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small" sx={{ minWidth: 760 }} aria-label="Products by product">
        <FigureHeads first="Product / opportunity" />
        <TableBody>
          {groups.flatMap((g) => {
            const open = !closed.has(g.key);
            return [
              <TableRow key={g.key} sx={{ bgcolor: "action.hover" }}>
                <TableCell colSpan={6}>
                  <Toggle open={open} label={`${g.name}, ${open ? "collapse" : "expand"}`} onToggle={() => toggle(g.key)}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {g.name}
                    </Typography>
                    {g.code ? (
                      <Typography variant="caption" color="text.secondary">
                        {g.code}
                      </Typography>
                    ) : null}
                    <Typography variant="caption" color="text.secondary">
                      on {plural(g.opportunityCount, "opportunity", "opportunities")}
                    </Typography>
                  </Toggle>
                </TableCell>
              </TableRow>,
              ...(open
                ? g.lines.map(({ opportunity: o, line }) => (
                    <TableRow key={`${g.key}-${line.id}`}>
                      <TableCell sx={{ pl: 5, color: "text.secondary" }}>
                        <Tooltip title={o.name === o.shortName ? "" : o.name}>
                          <span>{o.shortName}</span>
                        </Tooltip>
                        {mixed && o.data.currency ? ` · ${o.data.currency}` : ""}
                      </TableCell>
                      <LineCells line={line} />
                    </TableRow>
                  ))
                : []),
            ];
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/** The dialog's body, mounted while it is open, so each opening starts with everything open. */
function PreviousProducts({ opportunityIds, accountName }: { opportunityIds: readonly string[]; accountName: string }): JSX.Element {
  const queries = usePreviousOpportunityLines(opportunityIds, true);
  const [view, setView] = useState<View>("opportunity");
  const [closed, setClosed] = useState<{ opportunity: Set<string>; product: Set<string> }>({ opportunity: new Set(), product: new Set() });

  const opportunities: PreviousOpportunity[] = opportunityIds.flatMap((id, i) => {
    const data = queries[i]?.data;
    if (!data) return [];
    const name = data.opportunityName ?? id;
    return [{ id, name, shortName: shortOpportunityName(name, accountName), data }];
  });
  const failed = queries.filter((q) => q.error);
  const pending = queries.some((q) => q.isPending && !q.error);
  const keys = view === "opportunity" ? opportunities.map((o) => o.id) : groupByProduct(opportunities).map((g) => g.key);
  const anyOpen = keys.some((k) => !closed[view].has(k));
  const toggle = (key: string) =>
    setClosed((c) => {
      const next = new Set(c[view]);
      if (!next.delete(key)) next.add(key);
      return { ...c, [view]: next };
    });

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap spacing={1}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={view}
          onChange={(_, v: View | null) => {
            if (v !== null) setView(v);
          }}
          aria-label="Show"
          sx={{ "& .MuiToggleButton-root": { px: 1.5, fontWeight: 600, textTransform: "none" } }}
        >
          <ToggleButton value="opportunity">By opportunity</ToggleButton>
          <ToggleButton value="product">By product</ToggleButton>
        </ToggleButtonGroup>
        {keys.length > 0 ? (
          <Button size="small" onClick={() => setClosed((c) => ({ ...c, [view]: anyOpen ? new Set(keys) : new Set() }))}>
            {anyOpen ? "Collapse all" : "Expand all"}
          </Button>
        ) : null}
      </Stack>
      {failed.length > 0 ? (
        <ErrorNotice
          error={failed[0].error}
          onRetry={() => failed.forEach((q) => void q.refetch())}
          retrying={failed.some((q) => q.isFetching)}
        >
          Couldn&apos;t read {failed.length === opportunityIds.length ? "the opportunities" : plural(failed.length, "of the opportunities", "of the opportunities")} from
          Salesforce.
        </ErrorNotice>
      ) : null}
      {pending ? (
        <Typography variant="body2" color="text.secondary">
          Reading the opportunities in Salesforce…
        </Typography>
      ) : opportunities.length === 0 ? null : view === "opportunity" ? (
        <ByOpportunity opportunities={opportunities} closed={closed.opportunity} toggle={toggle} />
      ) : groupByProduct(opportunities).length === 0 ? (
        <Paper variant="outlined" sx={{ p: 2, textAlign: "center", borderStyle: "dashed" }}>
          <Typography variant="body2" color="text.secondary">
            No products on these opportunities in Salesforce.
          </Typography>
        </Paper>
      ) : (
        <ByProduct opportunities={opportunities} closed={closed.product} toggle={toggle} />
      )}
      {!pending && opportunities.length > 0 ? (
        <Typography variant="caption" color="text.secondary">
          {plural(opportunities.length, "opportunity", "opportunities")} ·{" "}
          {plural(groupByProduct(opportunities).length, "distinct product", "distinct products")}
        </Typography>
      ) : null}
    </Stack>
  );
}

/**
 * "Previous year's products" on a renewal (D159): the products on the
 * opportunities it replaces, as ticked in Overview, read fresh from
 * Salesforce, by opportunity or by product. Read only: the AM adds the
 * products one by one with Add product.
 */
export default function PreviousProductsDialog({ open, opportunityIds, accountName, onClose }: PreviousProductsDialogProps): JSX.Element {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        Previous year&apos;s products
        <Typography variant="body2" color="text.secondary" component="span" sx={{ display: "block" }}>
          On the {plural(opportunityIds.length, "opportunity", "opportunities")} this renewal replaces, from Salesforce as they are now. To use
          one, add it with Add product.
        </Typography>
      </DialogTitle>
      <DialogContent>{open ? <PreviousProducts opportunityIds={opportunityIds} accountName={accountName} /> : null}</DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

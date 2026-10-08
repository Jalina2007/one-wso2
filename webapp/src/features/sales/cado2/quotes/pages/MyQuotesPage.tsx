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

import { useState, type JSX, type ReactNode } from "react";
import { Link as RouterLink } from "react-router";
import {
  Avatar,
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  StatCard,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { CircleCheckIcon, EllipsisIcon, FilePenIcon, FileTextIcon, HourglassIcon, PlusIcon, SearchIcon, SendIcon, Undo2Icon, XCircleIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import EmptyState from "@features/sales/cado2/components/empty-state/EmptyState";
import PageHeader from "@features/sales/cado2/components/page-header/PageHeader";
import { useDocumentTitle } from "@hooks/useDocumentTitle";
import { useQuoteList, useQuoteVersion } from "@features/sales/cado2/quotes/api/useQuoteApi";
import DeleteDraftDialog from "@features/sales/cado2/quotes/components/detail/DeleteDraftDialog";
import type { QuoteListItem } from "@features/sales/cado2/quotes/api/quoteTypes";
import { STATUS_COLOR, quoteLabel, quoteStatusLabel } from "@features/sales/cado2/quotes/lifecycle/lifecycle";
import { expiryState } from "@features/sales/cado2/quotes/sheet/sheetModel";
import { changedAgo, countQuotes, filterQuotes, type QuoteFilter } from "@features/sales/cado2/quotes/list/quoteListModel";
import { initialsOfName } from "@features/sales/cado2/utils/initials";
import { formatMoney } from "@features/sales/cado2/utils/money";
import { cado2Paths } from "@features/sales/cado2/cado2Paths";

/** What each filter is called when it is on. */
const FILTER_LABEL: Record<Exclude<QuoteFilter, "">, string> = {
  DRAFT: "Drafts",
  SUBMITTED: "In approval",
  APPROVED: "Approved",
  TO_REVISE: "To revise",
  EXPIRING: "Expiring within 7 days",
  RECALLED: "Recalled",
  REJECTED: "Rejected",
  CHANGES_REQUESTED: "Changes requested",
  CLOSED: "Closed",
};
const EXPIRY_COLOR = { ok: "success", soon: "warning", expired: "error" } as const;

/** A KPI card that doubles as a filter. */
function KpiFilter(props: {
  label: string;
  value: number;
  icon: ReactNode;
  color: "primary" | "info" | "warning" | "secondary" | "error" | "success";
  active: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <ButtonBase
      onClick={props.onClick}
      aria-pressed={props.active}
      aria-label={`${props.label}: ${props.value}`}
      sx={{
        display: "block",
        width: "100%",
        textAlign: "left",
        borderRadius: 2,
        outline: props.active ? 2 : 0,
        outlineStyle: "solid",
        outlineColor: "primary.main",
        outlineOffset: 2,
      }}
    >
      <StatCard value={props.value} label={props.label} icon={props.icon} iconColor={props.color} variant="outlined" />
    </ButtonBase>
  );
}

/**
 * A row's actions, behind "⋯" so a destructive one isn't a click away from
 * opening the quote. Today: Delete draft.
 */
function RowMenu({ q }: { q: QuoteListItem }): JSX.Element {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [deleting, setDeleting] = useState(false);
  return (
    <>
      <IconButton
        aria-label={`Actions for ${quoteLabel(q.quoteNumber, q.accountName, q.opportunityName)}`}
        aria-haspopup="menu"
        aria-expanded={anchorEl !== null}
        size="small"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{ position: "absolute", right: { xs: 12, sm: 16 }, top: "50%", transform: "translateY(-50%)" }}
      >
        <EllipsisIcon size={18} />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={anchorEl !== null}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem
          sx={{ color: "error.main" }}
          onClick={() => {
            setAnchorEl(null);
            setDeleting(true);
          }}
        >
          Delete draft
        </MenuItem>
      </Menu>
      {deleting ? <DeleteFromList q={q} onClose={() => setDeleting(false)} /> : null}
    </>
  );
}

/**
 * The list doesn't carry what the confirmation needs (the draft's exact save
 * time, the version before it), so the draft is loaded first.
 */
function DeleteFromList({ q, onClose }: { q: QuoteListItem; onClose: () => void }): JSX.Element {
  const version = useQuoteVersion(q.id, q.versionNumber);
  if (version.data) {
    return (
      <DeleteDraftDialog
        quote={version.data.quote}
        name={quoteLabel(version.data.quote.quoteNumber, version.data.version.accountName, version.data.version.opportunityName)}
        versionNumber={version.data.version.versionNumber}
        updatedAt={version.data.version.updatedAt}
        onClose={onClose}
        onDeleted={onClose}
      />
    );
  }
  return (
    <Dialog open onClose={onClose} aria-label="Loading the draft">
      <DialogContent>
        {version.error ? (
          <ErrorNotice error={version.error} onRetry={() => void version.refetch()} retrying={version.isFetching}>
            Couldn&apos;t load the draft.
          </ErrorNotice>
        ) : (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CircularProgress size={18} />
            <Typography variant="body2">Loading the draft…</Typography>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

function QuoteRow({ q, now }: { q: QuoteListItem; now: Date }): JSX.Element {
  // The expiry runs once the order form is issued.
  const expiry = q.status === "APPROVED" && q.expiryDate ? expiryState(q.expiryDate, now) : null;
  return (
    <Box
      component={RouterLink}
      to={cado2Paths.quote(q.id)}
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "44px minmax(0,1fr)", md: "44px minmax(0,2fr) minmax(0,1.6fr) 150px 130px 110px" },
        gap: { xs: 1.5, md: 2 },
        alignItems: "center",
        px: { xs: 2, sm: 2.5 },
        // Room for the row menu beside the link.
        pr: { xs: 7, sm: 7.5 },
        py: 1.75,
        color: "inherit",
        textDecoration: "none",
        borderTop: 1,
        borderColor: "divider",
        transition: "background-color .15s",
        "&:hover": { bgcolor: "action.hover" },
        "&:focus-visible": { outline: 2, outlineStyle: "solid", outlineColor: "primary.main", outlineOffset: -2 },
      }}
    >
      <Avatar sx={{ width: 40, height: 40, bgcolor: "primary.main", color: "primary.contrastText", fontSize: 15, fontWeight: 600 }}>
        {initialsOfName(q.accountName ?? "?")}
      </Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
          {q.accountName ?? "No account"}
        </Typography>
        <Typography variant="body2" color="text.secondary" noWrap>
          {q.opportunityName ?? "No opportunity"}
        </Typography>
      </Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ gridColumn: { xs: "2", md: "auto" }, flexWrap: "wrap", rowGap: 0.5 }}>
        {q.quoteNumber ? (
          <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: "monospace" }}>
            {q.quoteNumber}
          </Typography>
        ) : (
          // Numbered at the first submit; the customer and deal are on the left.
          <Typography variant="body2" color="text.secondary">
            Not submitted
          </Typography>
        )}
        <Chip size="small" color={STATUS_COLOR[q.status]} label={quoteStatusLabel(q.status, q.versionNumber)} />
        <Typography variant="caption" color="text.secondary">
          v{q.versionNumber}
        </Typography>
      </Stack>
      <Typography
        variant="subtitle2"
        sx={{ gridColumn: { xs: "2", md: "auto" }, textAlign: { md: "right" }, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
      >
        {q.currencyIsoCode ? `${q.currencyIsoCode} ${formatMoney(q.tcv)}` : formatMoney(q.tcv)}
      </Typography>
      <Box sx={{ gridColumn: { xs: "2", md: "auto" } }}>
        {expiry ? (
          <Chip size="small" variant="outlined" color={EXPIRY_COLOR[expiry.tone]} icon={<HourglassIcon size={12} />} label={expiry.label} />
        ) : (
          <Typography variant="caption" color="text.disabled">
            —
          </Typography>
        )}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ gridColumn: { xs: "2", md: "auto" }, textAlign: { md: "right" } }}>
        {changedAgo(q.updatedAt, now)}
      </Typography>
    </Box>
  );
}

/**
 * My Quotes, the landing page (2026-09-25): KPI cards that are also the
 * filters (click again to show all), search, and one rich row per quote that
 * opens its quote page. The
 * quote's status is its latest version's. Loaded once and filtered in the
 * browser.
 */
export default function MyQuotesPage(): JSX.Element {
  useDocumentTitle("My Quotes");
  const [filter, setFilter] = useState<QuoteFilter>("");
  const [search, setSearch] = useState("");
  const { data, error, isPending, isFetching, refetch } = useQuoteList("");
  const now = new Date();

  const items = data?.items ?? [];
  const counts = countQuotes(items, now);
  const shown = filterQuotes(items, filter, search, now);
  const toggle = (f: QuoteFilter) => setFilter((cur) => (cur === f ? "" : f));

  return (
    <Stack spacing={3} sx={{ maxWidth: 1400 }}>
      <PageHeader
        title="My Quotes"
        actions={
          <Button variant="contained" size="large" component={RouterLink} to={cado2Paths.newQuote} startIcon={<PlusIcon size={18} />}>
            Create Quote
          </Button>
        }
      />

      <Box
        role="group"
        aria-label="Quote counts"
        sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", md: "repeat(3, minmax(0,1fr))", lg: "repeat(6, minmax(0,1fr))" }, gap: 2 }}
      >
        <KpiFilter label="Drafts" value={counts.drafts} icon={<FilePenIcon size={22} />} color="secondary" active={filter === "DRAFT"} onClick={() => toggle("DRAFT")} />
        <KpiFilter label="In approval" value={counts.submitted} icon={<SendIcon size={22} />} color="primary" active={filter === "SUBMITTED"} onClick={() => toggle("SUBMITTED")} />
        <KpiFilter label="Approved" value={counts.approved} icon={<CircleCheckIcon size={22} />} color="success" active={filter === "APPROVED"} onClick={() => toggle("APPROVED")} />
        {/* Recalled, rejected or sent back: the owner revises or closes. */}
        <KpiFilter label="To revise" value={counts.toRevise} icon={<Undo2Icon size={22} />} color="info" active={filter === "TO_REVISE"} onClick={() => toggle("TO_REVISE")} />
        <KpiFilter label="Expiring within 7 days" value={counts.expiringSoon} icon={<HourglassIcon size={22} />} color="warning" active={filter === "EXPIRING"} onClick={() => toggle("EXPIRING")} />
        <KpiFilter label="Closed" value={counts.closed} icon={<XCircleIcon size={22} />} color="error" active={filter === "CLOSED"} onClick={() => toggle("CLOSED")} />
      </Box>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
        <Typography variant="body2" color="text.secondary" aria-live="polite" sx={{ minHeight: 24, display: "flex", alignItems: "center", gap: 1 }}>
          {filter ? (
            <>
              Showing {shown.length} of {counts.all} · {FILTER_LABEL[filter]}
              <Button size="small" onClick={() => setFilter("")}>
                Show all
              </Button>
            </>
          ) : search.trim() ? (
            `Showing ${shown.length} of ${counts.all}`
          ) : null}
        </Typography>
        <TextField
          size="small"
          placeholder="Search quote, account or opportunity"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flexGrow: 1, maxWidth: { md: 420 }, ml: { md: "auto" } }}
          slotProps={{
            htmlInput: { "aria-label": "Search quotes" },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon size={16} />
                </InputAdornment>
              ),
            },
          }}
        />
      </Stack>

      {error ? (
        <ErrorNotice error={error} onRetry={() => void refetch()} retrying={isFetching}>
          Couldn&apos;t load the quotes.
        </ErrorNotice>
      ) : isPending ? (
        <Paper variant="outlined" sx={{ borderRadius: 2, p: 2 }} aria-label="Loading the quotes">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={52} sx={{ my: 1 }} />
          ))}
        </Paper>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FileTextIcon size={28} />}
          title="No quotes yet"
          body="Start from a Salesforce opportunity: CadO2 prices it from the price book and keeps every version."
          action={
            <Button variant="contained" component={RouterLink} to={cado2Paths.newQuote} startIcon={<PlusIcon size={16} />}>
              Create your first quote
            </Button>
          }
        />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={<SearchIcon size={28} />}
          title="No quotes match"
          body="Try another status or search term."
          action={
            <Button
              onClick={() => {
                setFilter("");
                setSearch("");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
          <Box
            aria-hidden
            sx={{
              display: { xs: "none", md: "grid" },
              gridTemplateColumns: "44px minmax(0,2fr) minmax(0,1.6fr) 150px 130px 110px",
              gap: 2,
              px: 2.5,
              pr: 7.5,
              py: 1,
              bgcolor: "action.hover",
            }}
          >
            {["", "Customer", "Quote", "Contract total", "Expiry", "Changed"].map((h, i) => (
              <Typography key={h || i} variant="overline" color="text.secondary" sx={{ textAlign: i === 3 || i === 5 ? "right" : "left" }}>
                {h}
              </Typography>
            ))}
          </Box>
          <Box component="ul" aria-label="Quotes" sx={{ listStyle: "none", m: 0, p: 0, "& > li:first-of-type > a": { borderTop: { xs: 0, md: 1 }, borderColor: "divider" } }}>
            {shown.map((q) => (
              <Box component="li" key={q.id} sx={{ position: "relative" }}>
                <QuoteRow q={q} now={now} />
                {/* Beside the row's link, not inside it. A draft of the rep's own. */}
                {q.status === "DRAFT" ? <RowMenu q={q} /> : null}
              </Box>
            ))}
          </Box>
        </Paper>
      )}
    </Stack>
  );
}

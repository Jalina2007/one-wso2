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
import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  MenuItem,
  Pagination,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { PlusIcon, SearchIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import { useNavigate } from "react-router";
import ConfirmationDialog, { type ConfirmationContent } from "@components/confirmation-dialog/ConfirmationDialog";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { isTilBackendConfigured, useTilSubmissions, useTilUserInfo } from "../api/useTilData";
import { useDeleteTilSubmission } from "../api/useTilMutations";
import { describeError } from "../util/tilError";
import { tilPlainText } from "../util/tilRichText";
import SubmissionCard from "../components/SubmissionCard";
import SubmitEntryDialog from "../components/SubmitEntryDialog";
import TilShell from "../components/TilShell";

// Local calendar day (not UTC) so it lines up with what the "Submitted on"
// date input shows and with how SubmissionCard's own timestamp is rendered
// (toLocaleString, also local time) — matching either by UTC date would
// drift by a day right around midnight for a lot of this company's offices.
function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const SEARCH_SCOPES = [
  { value: "who", label: "Submitted by (name)" },
  { value: "email", label: "Submitted by (email)" },
  { value: "whereDetail", label: "Customer / Partner" },
  { value: "what", label: "What was learned" },
] as const;
type SearchScope = (typeof SEARCH_SCOPES)[number]["value"];

const ENTRIES_PER_PAGE = 10;

// Today I Learned: a company-wide feed of learnings from customers, partners,
// and internal sources, plus the form to add one. A Google Chat App's "+"
// Dialog is a second way to post an entry, calling the same
// ONE_WSO2_TIL_BACKEND_URL this page's "New entry" button does.
export default function TilHomePage() {
  const navigate = useNavigate();
  const configured = isTilBackendConfigured();
  const userInfo = useTilUserInfo();
  const submissions = useTilSubmissions();
  const deleteSubmission = useDeleteTilSubmission();
  const { showError, showSuccess } = useNotifications();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmContent, setConfirmContent] = useState<ConfirmationContent | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchScope, setSearchScope] = useState<SearchScope>("who");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const canModerate = userInfo.data?.canModerate ?? false;
  const myEmail = userInfo.data?.email;

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return (submissions.data?.items ?? []).filter((s) => {
      const day = localDateString(s.createdAt);
      if (dateFrom && day < dateFrom) return false;
      if (dateTo && day > dateTo) return false;
      if (!query) return true;
      // A plain substring match, not a regex: "not exact" is the whole
      // point, and nobody searching a feed like this wants to write a
      // pattern. Exactly one field, whichever the dropdown names — no
      // "search everywhere" option, so a search can't silently match on a
      // field the person didn't mean to search.
      switch (searchScope) {
        case "who":
          return s.who.toLowerCase().includes(query);
        case "email":
          return s.submittedByEmail.toLowerCase().includes(query);
        case "whereDetail":
          return s.whereDetail?.toLowerCase().includes(query) ?? false;
        case "what":
          return tilPlainText(s.what).toLowerCase().includes(query);
      }
    });
  }, [submissions.data, searchQuery, searchScope, dateFrom, dateTo]);
  const isFiltering = Boolean(searchQuery.trim() || dateFrom || dateTo);

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / ENTRIES_PER_PAGE));
  // Clamped, not reset via an effect: if a filter change leaves `page`
  // pointing past the new last page, this corrects it on the same render
  // instead of flashing an empty page first and fixing it one render later.
  const safePage = Math.min(page, pageCount);
  const rangeStart = filteredItems.length === 0 ? 0 : (safePage - 1) * ENTRIES_PER_PAGE + 1;
  const rangeEnd = Math.min(safePage * ENTRIES_PER_PAGE, filteredItems.length);
  const pagedItems = filteredItems.slice((safePage - 1) * ENTRIES_PER_PAGE, safePage * ENTRIES_PER_PAGE);

  const runDelete = (id: string) => {
    setDeletingId(id);
    deleteSubmission.mutate(id, {
      onSuccess: () => showSuccess("Entry deleted"),
      onError: (err) => showError(describeError(err)),
      onSettled: () => setDeletingId(null),
    });
  };

  const confirmDelete = (id: string) => {
    setConfirmContent({
      title: "Delete this entry?",
      text: "This can't be undone — the entry will be removed from the feed for everyone.",
      confirmLabel: "Delete",
      confirmColor: "primary",
      confirmAction: () => runDelete(id),
    });
  };

  return (
    <TilShell
      title="Today I Learned"
      subtitle="A shared feed of what we're learning from customers, partners, and each other."
      configured={configured}
      configKey="ONE_WSO2_TIL_BACKEND_URL"
      action={
        <Button variant="contained" startIcon={<PlusIcon size={16} />} onClick={() => setDialogOpen(true)}>
          New entry
        </Button>
      }
    >
      {submissions.data && submissions.data.items.length > 0 && (
        <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: "wrap", rowGap: 1.5 }}>
          <TextField
            select
            size="small"
            label="Search in"
            value={searchScope}
            onChange={(e) => setSearchScope(e.target.value as SearchScope)}
            sx={{ width: 190 }}
          >
            {SEARCH_SCOPES.map((scope) => (
              <MenuItem key={scope.value} value={scope.value}>
                {scope.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            type="search"
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            sx={{ flex: 1, minWidth: 200 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon size={16} />
                  </InputAdornment>
                ),
                endAdornment: searchQuery && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchQuery("")} aria-label="Clear search">
                      <XIcon size={16} />
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            size="small"
            type="date"
            label="Submitted from"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: dateTo || undefined } }}
            sx={{ width: 170 }}
          />
          <TextField
            size="small"
            type="date"
            label="Submitted to"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: dateFrom || undefined } }}
            sx={{ width: 170 }}
          />
        </Stack>
      )}

      {submissions.isLoading ? (
        <Stack spacing={1.5}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rectangular" height={96} sx={{ borderRadius: 1.5 }} />
          ))}
        </Stack>
      ) : submissions.isError ? (
        <Alert severity="error">Couldn&apos;t load entries. {describeError(submissions.error)}</Alert>
      ) : filteredItems.length > 0 ? (
        <>
          <Stack spacing={1.5}>
            {pagedItems.map((s) => (
              <SubmissionCard
                key={s.id}
                submission={s}
                canDelete={canModerate || (Boolean(myEmail) && s.submittedByEmail === myEmail)}
                deleting={deletingId === s.id}
                onDelete={() => confirmDelete(s.id)}
                onOpen={() => navigate(`/knowledge-base/${s.id}`)}
              />
            ))}
          </Stack>
          <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 2, mt: 2 }}>
            {pageCount > 1 && (
              <Pagination count={pageCount} page={safePage} onChange={(_, p) => setPage(p)} color="primary" />
            )}
            <Typography variant="caption" color="text.secondary">
              {rangeStart}–{rangeEnd} of {filteredItems.length}
            </Typography>
          </Box>
        </>
      ) : (
        <Box sx={{ py: 4, textAlign: "center" }}>
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
            {isFiltering
              ? "No entries match your search."
              : "No entries yet. Be the first to share something you learned."}
          </Typography>
        </Box>
      )}

      <SubmitEntryDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      <ConfirmationDialog content={confirmContent} onClose={() => setConfirmContent(null)} />
    </TilShell>
  );
}

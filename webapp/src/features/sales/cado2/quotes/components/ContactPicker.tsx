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

import { useState, type JSX } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Alert, Avatar, Box, Button, ButtonBase, Chip, InputAdornment, Paper, Skeleton, Stack, TextField, Typography } from "@wso2/oxygen-ui";
import { MailIcon, PencilIcon, SearchIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import SalesforceLink from "@features/sales/cado2/components/salesforce-link/SalesforceLink";
import type { Contact } from "@features/sales/cado2/quotes/api/quoteTypes";
import { emptyContact, type DraftFormValues } from "@features/sales/cado2/quotes/form/draftForm";
import { initialsOfName } from "@features/sales/cado2/utils/initials";
import { useFieldIssue } from "./fieldIssues";

type ContactField = "billingContact" | "securityContact" | "legalContact";

interface ContactPickerProps {
  readonly name: ContactField;
  /** Backend field prefix for issues, e.g. "contacts.billing". */
  readonly issueField: string;
  readonly label: string;
  /** The quote's opportunity, for "Open the opportunity in Salesforce". */
  readonly opportunityId: string;
  /** The contacts on the opportunity in Salesforce (D124). */
  readonly contacts: readonly Contact[];
  readonly loading: boolean;
  /** The contacts couldn't be loaded: shown as an error, not "no contacts" (2026-10-13). */
  readonly loadError?: unknown;
  readonly onRetry?: () => void;
  readonly helperText?: string;
  /**
   * D165: the contact may also be entered here, when it isn't on the
   * opportunity (the legal contact); others come from Salesforce only.
   */
  readonly allowTyped?: boolean;
}

/** What each picker chooses, for "No billing contact chosen yet" and "Choose the billing contact". */
const ROLE: Record<ContactField, string> = {
  billingContact: "billing contact",
  securityContact: "security contact",
  legalContact: "legal contact",
};

/**
 * Pick one of the opportunity's contacts in Salesforce (D124: not the
 * account's, and never typed in). Nothing chosen yet: a card offering
 * "Choose from the opportunity" (2026-10-09: an open list on arrival read as
 * a directory, not a choice). Choosing shows a searchable list headed "Choose
 * the billing contact", each with its roles on the opportunity; a click on a
 * name picks it (F5 feedback, 2026-09-25). With none on the opportunity, the
 * AM is sent to Salesforce to add one, then refreshes. A chosen contact shows
 * as a card with Change. Only Salesforce Ids are sent; the backend snapshots
 * the contact's details. A contact typed in before D124 is shown with a
 * request to choose again.
 */
export default function ContactPicker({
  name,
  issueField,
  label,
  opportunityId,
  contacts,
  loading,
  loadError,
  onRetry,
  helperText,
  allowTyped = false,
}: ContactPickerProps): JSX.Element {
  const { control, setValue } = useFormContext<DraftFormValues>();
  const value = useWatch({ control, name });
  const idIssue = useFieldIssue(`${issueField}.sfContactId`);
  const emailIssue = useFieldIssue(`${issueField}.email`);
  const [changing, setChanging] = useState(false);
  const [search, setSearch] = useState("");

  const pick = (c: Contact) => {
    setValue(name, { mode: "salesforce", sfContactId: c.id, name: c.name ?? "", title: c.title ?? "", email: c.email ?? "" }, { shouldDirty: true });
    setChanging(false);
    setSearch("");
  };
  const clear = () => setValue(name, { ...emptyContact }, { shouldDirty: true });
  // D165: entered here instead, when it isn't on the opportunity.
  const enter = () => {
    setValue(name, { mode: "manual", sfContactId: "", name: "", title: "", email: "" }, { shouldDirty: true });
    setChanging(false);
    setSearch("");
  };
  const enterButton = allowTyped ? (
    <Button size="small" startIcon={<PencilIcon size={14} />} onClick={enter}>
      Enter an email
    </Button>
  ) : null;

  const heading = (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      {helperText ? (
        <Typography variant="caption" color="text.secondary">
          {helperText}
        </Typography>
      ) : null}
    </Box>
  );

  const issue = idIssue ? (
    <Typography variant="caption" color="error">
      {idIssue}
    </Typography>
  ) : null;

  // Nothing chosen yet: say so, and offer to choose.
  if (value.mode === "none" && !changing) {
    return (
      <Stack spacing={1}>
        {heading}
        <Paper variant="outlined" aria-label={`${label}: none chosen`} sx={{ p: 1.75, borderRadius: 2 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "flex-start", sm: "center" }}>
            <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
              No {ROLE[name]} chosen yet
            </Typography>
            <Button size="small" variant="outlined" startIcon={<SearchIcon size={14} />} onClick={() => setChanging(true)}>
              Choose from the opportunity
            </Button>
            {enterButton}
          </Stack>
        </Paper>
        {issue}
      </Stack>
    );
  }

  // D165: entered here, for a contact that isn't on the opportunity. Only
  // its email matters: it is where legal notices go.
  if (value.mode === "manual" && allowTyped && !changing) {
    return (
      <Stack spacing={1}>
        {heading}
        <Paper variant="outlined" aria-label={`${label}: entered here`} sx={{ p: 1.75, borderRadius: 2 }}>
          <Stack spacing={1.5}>
            <Controller
              name={`${name}.email`}
              control={control}
              render={({ field: f }) => (
                <TextField
                  {...f}
                  size="small"
                  type="email"
                  label="Email"
                  placeholder="legal@example.com"
                  error={Boolean(emailIssue)}
                  helperText={emailIssue}
                  fullWidth
                />
              )}
            />
            <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ flexWrap: "wrap", rowGap: 1 }}>
              <Button size="small" startIcon={<SearchIcon size={14} />} onClick={() => setChanging(true)}>
                Choose from the opportunity instead
              </Button>
              <Button size="small" color="inherit" onClick={clear}>
                Remove
              </Button>
            </Stack>
          </Stack>
        </Paper>
        {issue}
      </Stack>
    );
  }

  // Typed in before D124: kept until replaced, but it can't be submitted.
  if (value.mode === "manual" && !changing) {
    return (
      <Stack spacing={1}>
        {heading}
        <Alert
          severity="warning"
          aria-label={`${label}: typed in`}
          action={
            <Button size="small" color="inherit" onClick={() => setChanging(true)}>
              Choose from the opportunity
            </Button>
          }
        >
          {[value.name, value.email].filter((s) => s.trim()).join(" · ") || "A typed-in contact"} was typed in. The {ROLE[name]}{" "}
          now comes from the opportunity&apos;s contacts in Salesforce: choose it again.
        </Alert>
        {issue}
      </Stack>
    );
  }

  // Chosen from Salesforce: a card.
  if (value.mode === "salesforce" && value.sfContactId && !changing) {
    return (
      <Stack spacing={1}>
        {heading}
        <Paper variant="outlined" aria-label={`${label}: ${value.name}`} sx={{ p: 1.75, borderRadius: 2 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar sx={{ width: 40, height: 40, bgcolor: "primary.main", color: "primary.contrastText", fontSize: 15 }}>
              {initialsOfName(value.name || "?")}
            </Avatar>
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                {value.name || value.sfContactId}
              </Typography>
              <Typography variant="caption" color="text.secondary" component="div" noWrap>
                {[value.title, value.email].filter(Boolean).join(" · ") || "Salesforce contact"}
              </Typography>
            </Box>
            <Chip size="small" variant="outlined" label="Salesforce" sx={{ display: { xs: "none", sm: "flex" } }} />
            <Button size="small" onClick={() => setChanging(true)} aria-label={`Change ${label.toLowerCase()}`}>
              Change
            </Button>
          </Stack>
        </Paper>
        {issue}
      </Stack>
    );
  }

  // Choosing: a searchable list of the opportunity's contacts.
  const term = search.trim().toLowerCase();
  const shown = contacts.filter((c) => !term || [c.name, c.title, c.email, ...c.roles].some((f) => f?.toLowerCase().includes(term)));
  const hadValue = value.mode !== "none";
  return (
    <Stack spacing={1}>
      {heading}
      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
        <Stack spacing={1.25}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Choose the {ROLE[name]}
          </Typography>
          <TextField
            size="small"
            placeholder="Search by name, role, title or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              htmlInput: { "aria-label": `Search ${label.toLowerCase()}` },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon size={16} />
                  </InputAdornment>
                ),
              },
            }}
          />
          {loadError ? (
            <ErrorNotice error={loadError} onRetry={onRetry} retrying={loading}>
              Couldn&apos;t load the opportunity&apos;s contacts from Salesforce.
            </ErrorNotice>
          ) : loading ? (
            <Stack spacing={1} aria-label="Loading contacts">
              {[0, 1].map((i) => (
                <Skeleton key={i} variant="rounded" height={48} />
              ))}
            </Stack>
          ) : contacts.length === 0 ? (
            <Stack spacing={1} sx={{ px: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                This opportunity has no contacts in Salesforce. Add the {ROLE[name]} to the opportunity&apos;s contact
                roles there, then refresh.
              </Typography>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <SalesforceLink object="Opportunity" id={opportunityId}>
                  Open the opportunity in Salesforce
                </SalesforceLink>
                {onRetry ? (
                  <Button size="small" onClick={onRetry}>
                    Refresh
                  </Button>
                ) : null}
              </Stack>
            </Stack>
          ) : shown.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
              No contacts match “{search}”.
            </Typography>
          ) : (
            <Box role="radiogroup" aria-label={label} sx={{ display: "flex", flexDirection: "column", gap: 0.75, maxHeight: 260, overflowY: "auto" }}>
              {shown.map((c) => (
                <ButtonBase
                  key={c.id}
                  role="radio"
                  aria-checked={value.mode === "salesforce" && value.sfContactId === c.id}
                  aria-label={c.name ?? c.id}
                  onClick={() => pick(c)}
                  sx={{
                    display: "flex",
                    justifyContent: "flex-start",
                    gap: 1.5,
                    p: 1,
                    borderRadius: 1.5,
                    textAlign: "left",
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <Avatar sx={{ width: 32, height: 32, fontSize: 13, bgcolor: "primary.main", color: "primary.contrastText" }}>
                    {initialsOfName(c.name ?? "?")}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                      {c.name ?? c.id}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" component="div" noWrap>
                      {c.roles.length ? `${c.roles.join(", ")}${c.title || c.email ? " · " : ""}` : ""}
                      {c.title ?? ""}
                      {c.title && c.email ? " · " : ""}
                      {c.email ? (
                        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                          <MailIcon size={11} /> {c.email}
                        </Box>
                      ) : null}
                    </Typography>
                  </Box>
                </ButtonBase>
              ))}
            </Box>
          )}
          <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ flexWrap: "wrap", rowGap: 1 }}>
            {allowTyped ? (
              <Button size="small" startIcon={<PencilIcon size={14} />} onClick={enter} sx={{ mr: "auto" }}>
                Not on the opportunity? Enter an email
              </Button>
            ) : null}
            {changing || hadValue ? (
              <Stack direction="row" spacing={1}>
                {hadValue ? (
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() => {
                      clear();
                      setChanging(false);
                    }}
                  >
                    Remove
                  </Button>
                ) : null}
                {changing ? (
                  <Button size="small" onClick={() => setChanging(false)}>
                    Cancel
                  </Button>
                ) : null}
              </Stack>
            ) : null}
          </Stack>
        </Stack>
      </Paper>
      {issue}
    </Stack>
  );
}

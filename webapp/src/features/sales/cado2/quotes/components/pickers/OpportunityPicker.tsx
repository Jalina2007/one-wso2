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
import { Avatar, Box, Button, ButtonBase, Chip, IconButton, InputAdornment, Paper, Skeleton, Stack, TextField, Tooltip, Typography } from "@wso2/oxygen-ui";
import { BriefcaseIcon, PlusIcon, SearchIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import type { Opportunity } from "@features/sales/cado2/quotes/api/quoteTypes";
import { formatDate } from "@features/sales/cado2/quotes/form/draftForm";

interface OpportunityPickerProps {
  /** The list's accessible name, e.g. "Opportunity". */
  readonly label: string;
  /** Newest-created first, as SES returns them. */
  readonly opportunities: readonly Opportunity[];
  readonly loading: boolean;
  /** Several choices (previous opportunities for a renewal). */
  readonly multiple?: boolean;
  readonly selected: readonly string[];
  readonly onChange: (ids: string[]) => void;
  /** Fixed after the first save: no Change. */
  readonly locked?: boolean;
  readonly error?: string;
}

const dates = (o: Opportunity) =>
  [o.createdDate ? `Created ${formatDate(o.createdDate)}` : null, o.closeDate ? `${o.isClosed ? "Closed" : "Closes"} ${formatDate(o.closeDate)}` : null]
    .filter(Boolean)
    .join(" · ");

function OpportunityIcon(): JSX.Element {
  return (
    <Avatar sx={{ width: 36, height: 36, bgcolor: "action.selected", color: "primary.main" }}>
      <BriefcaseIcon size={16} />
    </Avatar>
  );
}

/** A chosen opportunity, compact: icon, name, dates, stage and deal type. */
function Chosen({ o, action }: { o: Opportunity; action: JSX.Element | null }): JSX.Element {
  return (
    <Paper variant="outlined" aria-label={`Chosen: ${o.name ?? o.id}`} sx={{ px: 1.5, py: 1.25, borderRadius: 2 }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <OpportunityIcon />
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
            {o.name ?? o.id}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div" noWrap>
            {dates(o) || "Salesforce opportunity"}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.75} sx={{ display: { xs: "none", sm: "flex" } }}>
          {o.stageName ? <Chip size="small" variant="outlined" label={o.stageName} /> : null}
          {o.dealType ? <Chip size="small" label={o.dealType === "PARTNER" ? "Partner" : "Direct"} /> : null}
        </Stack>
        {action}
      </Stack>
    </Paper>
  );
}

/**
 * Opportunities, picked the way contacts are (F5 review, 2026-09-25): a slim
 * searchable list that closes once a choice is made, leaving a compact card
 * with Change. With `multiple`, each pick closes the list and adds a row with
 * a remove button; "Add another" opens the list again.
 */
export default function OpportunityPicker({
  label,
  opportunities,
  loading,
  multiple = false,
  selected,
  onChange,
  locked = false,
  error,
}: OpportunityPickerProps): JSX.Element {
  const [open, setOpen] = useState(selected.length === 0);
  const [search, setSearch] = useState("");
  const byId = (id: string) => opportunities.find((o) => o.id === id);

  const pick = (id: string) => {
    onChange(multiple ? [...selected, id] : [id]);
    setOpen(false);
    setSearch("");
  };

  const chosen = selected.map((id) => byId(id) ?? ({ id, name: id } as Opportunity));
  const term = search.trim().toLowerCase();
  const candidates = opportunities.filter(
    (o) => !(multiple && selected.includes(o.id)) && (!term || [o.name, o.stageName].some((f) => f?.toLowerCase().includes(term))),
  );

  const list = (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
      <Stack spacing={1.25}>
        <TextField
          size="small"
          placeholder="Search by name or stage"
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
        {loading ? (
          <Stack spacing={1} aria-label={`Loading ${label.toLowerCase()}`}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} variant="rounded" height={44} />
            ))}
          </Stack>
        ) : candidates.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
            {opportunities.length === 0 ? "This account has no opportunities in Salesforce." : term ? `No opportunities match “${search}”.` : "Nothing more to add."}
          </Typography>
        ) : (
          <Box role="listbox" aria-label={label} sx={{ display: "flex", flexDirection: "column", gap: 0.5, maxHeight: 260, overflowY: "auto" }}>
            {candidates.map((o) => (
              <ButtonBase
                key={o.id}
                role="option"
                aria-selected={selected.includes(o.id)}
                aria-label={o.name ?? o.id}
                onClick={() => pick(o.id)}
                sx={{ display: "flex", justifyContent: "flex-start", gap: 1.5, p: 1, borderRadius: 1.5, textAlign: "left", "&:hover": { bgcolor: "action.hover" } }}
              >
                <OpportunityIcon />
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                    {o.name ?? o.id}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div" noWrap>
                    {[o.stageName, dates(o)].filter(Boolean).join(" · ")}
                  </Typography>
                </Box>
              </ButtonBase>
            ))}
          </Box>
        )}
        {selected.length > 0 ? (
          <Stack direction="row" justifyContent="flex-end">
            <Button size="small" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );

  return (
    <Stack spacing={1}>
      {error ? (
        <Typography variant="caption" color="error">
          {error}
        </Typography>
      ) : null}
      {multiple ? (
        <>
          {chosen.map((o) => (
            <Chosen
              key={o.id}
              o={o}
              action={
                <Tooltip title="Remove">
                  <IconButton size="small" aria-label={`Remove ${o.name ?? o.id}`} onClick={() => onChange(selected.filter((x) => x !== o.id))}>
                    <XIcon size={16} />
                  </IconButton>
                </Tooltip>
              }
            />
          ))}
          {open ? (
            list
          ) : (
            <Button size="small" startIcon={<PlusIcon size={14} />} onClick={() => setOpen(true)} sx={{ alignSelf: "flex-start" }}>
              {selected.length ? "Add another" : `Add ${label.toLowerCase()}`}
            </Button>
          )}
        </>
      ) : chosen[0] && !open ? (
        <Chosen
          o={chosen[0]}
          action={
            locked ? null : (
              <Button size="small" onClick={() => setOpen(true)} aria-label={`Change ${label.toLowerCase()}`}>
                Change
              </Button>
            )
          }
        />
      ) : (
        list
      )}
    </Stack>
  );
}

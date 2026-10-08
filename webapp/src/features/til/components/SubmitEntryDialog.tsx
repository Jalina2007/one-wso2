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
import { useState, type FocusEvent } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import type { PaperProps } from "@wso2/oxygen-ui";
import { dialogPaperSx } from "@components/confirmation-dialog/dialogPaperSx";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useCustomerSearch, useTilUserInfo } from "../api/useTilData";
import { useCreateTilSubmission } from "../api/useTilMutations";
import { TIL_WHAT_MAX_LENGTH, TIL_WHERE_OPTIONS, type TilWhere } from "../api/tilTypes";
import { describeError } from "../util/tilError";
import { isEmptyTilHtml, tilPlainTextLength } from "../util/tilRichText";
import TilRichTextField from "./TilRichTextField";

// Where options whose feed entry needs a bit more detail -- which customer,
// which partner, or what "Other" actually means here. Internal is the one
// option that's already self-explanatory on its own.
const WHERE_OPTIONS_NEEDING_DETAIL: readonly TilWhere[] = ["Customer", "Partner", "Other"];

// MUI's Autocomplete unconditionally skips `noOptionsText` when `freeSolo`
// is set (see Autocomplete.js: `groupedOptions.length === 0 && !freeSolo`)
// -- freeSolo is required here (a not-yet-onboarded customer must still be
// a valid submission), so with zero matches the Popper mounted an entirely
// EMPTY Paper: visually indistinguishable from the dropdown never opening
// at all, which is what every prior bug report actually showed. This paper
// slot renders our own fallback text instead of relying on that
// internally-gated branch, confirmed against a standalone repro using the
// same MUI/oxygen-ui build before being applied here.
//
// Defined at module scope (not inside SubmitEntryDialog) and taking
// loading/empty as props rather than closing over component state -- a
// function component defined inside another component's render body is a
// NEW component type on every render, which made MUI unmount/remount the
// Popper's own Paper (losing scroll position, flickering the list) on
// every keystroke.
function CustomerAutocompletePaper({
  children,
  loading,
  empty,
  ...paperProps
}: PaperProps & { loading?: boolean; empty?: boolean }) {
  return (
    <Paper {...paperProps}>
      {loading ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1.5 }}>
          Searching customers…
        </Typography>
      ) : empty ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1.5 }}>
          No matching customer — you can still use this name
        </Typography>
      ) : (
        children
      )}
    </Paper>
  );
}

function whereDetailCopy(where: TilWhere): { label: string; placeholder: string; helper: string } {
  switch (where) {
    case "Customer":
      return { label: "Customer name", placeholder: "e.g. Acme Corp", helper: "Which customer" };
    case "Partner":
      return { label: "Partner name", placeholder: "e.g. Acme Reseller", helper: "Which partner" };
    default:
      return {
        label: "Please explain",
        placeholder: "e.g. a conference, a vendor demo, an internal hackathon",
        helper: "What \"Other\" means here",
      };
  }
}

// The "+ New entry" form. Mirrors the field set the Chat App's own Dialog
// presents (Who / Where / What) so the two entry points feel like the same
// product — see the backend's openapi.yaml for the shared contract.
export default function SubmitEntryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const userInfo = useTilUserInfo();
  const [where, setWhere] = useState<TilWhere | "">("");
  const [whereDetail, setWhereDetail] = useState("");
  const [what, setWhat] = useState("");
  const [touched, setTouched] = useState(false);
  const create = useCreateTilSubmission();
  // Only searches real customer records -- Partner/Other keep plain
  // free-text entry (no equivalent searchable list exists for them). null
  // (not "") when where !== "Customer" so useCustomerSearch knows the field
  // isn't in play at all, vs. "" meaning "in play, nothing typed yet" (see
  // its own doc comment for why that distinction matters -- it's what lets
  // focusing the field with nothing typed still browse real customers).
  // whereDetail doubles as the search query here: whatever's currently
  // typed is both the field's value AND the in-flight search term, the
  // same combined role MUI's own Autocomplete freeSolo pattern expects.
  const customerSearch = useCustomerSearch(where === "Customer" ? whereDetail : null);
  const customerOptions = customerSearch.data?.map((c) => c.name) ?? [];
  // Open is a direct, fully-derived boolean (just "focused") rather than
  // round-tripping through MUI's own onOpen/onClose -- that round-trip
  // turned out not to reliably fire for this freeSolo + controlled-
  // inputValue combination, which is what silently kept the panel closed
  // even once there was a real answer (match, "no match", or "still
  // searching") to show.
  const [customerFieldFocused, setCustomerFieldFocused] = useState(false);
  const customerFieldOpen = customerFieldFocused;
  const { showSuccess, showError } = useNotifications();

  // The byline is the signed-in user's own name — never typed, so it can't
  // be used to credit (or blame) someone else. submittedByEmail is this same
  // identity on the backend side, independently; this is just how it reads.
  const who = userInfo.data ? `${userInfo.data.displayName} (${userInfo.data.email})` : "";
  const whoInvalid = !userInfo.data;
  const whereInvalid = where === "";
  const needsWhereDetail = where !== "" && WHERE_OPTIONS_NEEDING_DETAIL.includes(where);
  const whereDetailInvalid = needsWhereDetail && whereDetail.trim().length === 0;
  const whatLength = tilPlainTextLength(what);
  const whatInvalid = isEmptyTilHtml(what) || whatLength > TIL_WHAT_MAX_LENGTH;
  const invalid = whoInvalid || whereInvalid || whereDetailInvalid || whatInvalid;

  const reset = () => {
    setWhere("");
    setWhereDetail("");
    setWhat("");
    setTouched(false);
    create.reset();
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = () => {
    setTouched(true);
    if (invalid) return;
    create.mutate(
      {
        who,
        where: where as TilWhere,
        what,
        ...(needsWhereDetail ? { whereDetail: whereDetail.trim() } : {}),
      },
      {
        onSuccess: () => {
          showSuccess("Thanks for sharing what you learned!");
          close();
        },
        onError: (err) => showError(describeError(err)),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onClose={create.isPending ? undefined : close}
      maxWidth="lg"
      fullWidth
      slotProps={{
        paper: { sx: dialogPaperSx },
        backdrop: { sx: { bgcolor: "rgba(10,10,11,.4)", backdropFilter: "blur(3px)" } },
      }}
    >
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Today I Learned</DialogTitle>
      <DialogContent dividers sx={{ display: "flex", gap: 3, minHeight: 420 }}>
        {/* Left quarter: who's submitting it and where it came from.
            Every field here is labeled with a plain Typography above it,
            not MUI's floating notched label — a short label ("Who") and a
            longer one ("Customer name") produce different-width gaps in
            the border otherwise, which reads as misaligned even though
            each one is individually correct. Same pattern "What did you
            learn?" already uses on the right. */}
        <Stack spacing={2} sx={{ width: "25%", minWidth: 220 }}>
          <Typography variant="body2" color="text.secondary">
            Your name is recorded along with your entry.
          </Typography>
          <Stack spacing={0.5}>
            <Typography variant="subtitle2">Who</Typography>
            <TextField
              value={userInfo.isLoading ? "Loading your name…" : who || "Couldn't load your name"}
              error={touched && whoInvalid}
              helperText="Your name, shown on this entry"
              fullWidth
              disabled
            />
          </Stack>
          <Stack spacing={0.5}>
            <Typography variant="subtitle2" color={touched && whereInvalid ? "error" : "text.primary"}>
              Where
            </Typography>
            <TextField
              select
              value={where}
              onChange={(e) => {
                setWhere(e.target.value as TilWhere);
                setWhereDetail("");
              }}
              error={touched && whereInvalid}
              helperText={touched && whereInvalid ? "Required" : "Who this learning came from"}
              fullWidth
              autoFocus
            >
              {TIL_WHERE_OPTIONS.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          {needsWhereDetail && where === "Customer" && (
            <Stack spacing={0.5}>
              <Typography variant="subtitle2" color={touched && whereDetailInvalid ? "error" : "text.primary"}>
                {whereDetailCopy(where).label}
              </Typography>
              <Autocomplete
                freeSolo
                // Real matches first, but typing something not in the list
                // (a new/not-yet-onboarded customer, or just a name entity-
                // service doesn't have) is still a valid submission --
                // freeSolo + this filter (not the default "only show exact
                // substring matches") is what lets the typed value itself
                // stand in as its own option rather than being rejected.
                filterOptions={(options) => options}
                options={customerOptions}
                loading={customerSearch.isLoading}
                slots={{ paper: CustomerAutocompletePaper }}
                open={customerFieldOpen}
                inputValue={whereDetail}
                onInputChange={(_event, next) => setWhereDetail(next)}
                onChange={(_event, next) => setWhereDetail(next ?? "")}
                // The Popper has no z-index of its own by default, and this
                // field lives inside a Dialog (z-index: theme.zIndex.modal,
                // 1300) -- without this it portals to document.body but can
                // still end up stacked BEHIND the dialog's own paper, which
                // is the other half of why the panel looked like it never
                // opened at all. 1301 is deliberately just one above modal,
                // not an arbitrarily large number, so it still sits below
                // anything that's genuinely meant to cover a dialog (a
                // confirmation dialog stacked on top of this one, etc.).
                // placement + the disabled "flip" modifier pin the panel
                // below the field always -- Popper's default behaviour flips
                // it above when it judges there isn't enough room below
                // (true here, since this field sits low in a short left
                // column), which covered the Who/Where fields above it
                // instead of the content below. listbox's maxHeight keeps
                // a long result list from growing tall enough to do the same
                // thing by itself.
                slotProps={{
                  // `loading`/`empty` are CustomerAutocompletePaper's own
                  // extra props (see its definition above), not part of
                  // MUI's own PaperProps -- this environment's resolved
                  // @mui/material type declarations don't infer them back
                  // from `slots.paper`'s own component type the way some
                  // other dependency-resolution outcomes do, so the cast is
                  // bridging a type-only gap, not a real runtime one: MUI
                  // still passes these straight through to our component.
                  paper: { loading: customerSearch.isLoading, empty: customerOptions.length === 0 } as PaperProps,
                  popper: { style: { zIndex: 1301 }, placement: "bottom-start", modifiers: [{ name: "flip", enabled: false }] },
                  listbox: { sx: { maxHeight: 240 } },
                }}
                renderInput={(params) => {
                  // Same story as the cast above: `onFocus`/`onBlur` ARE
                  // present on the real params object at runtime (MUI's own
                  // anchor/positioning bookkeeping depends on them existing
                  // -- confirmed by hand before this fix even existed), this
                  // environment's resolved type for AutocompleteRenderInputParams
                  // just doesn't declare them.
                  const inputProps = params as typeof params & {
                    onFocus?: (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
                    onBlur?: (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
                  };
                  return (
                    <TextField
                      {...params}
                      placeholder={whereDetailCopy(where).placeholder}
                      error={touched && whereDetailInvalid}
                      helperText={touched && whereDetailInvalid ? "Required" : whereDetailCopy(where).helper}
                      // Chained, not replaced: these are MUI's OWN internal
                      // handlers (anchor/positioning bookkeeping the Popper
                      // needs to render at all) -- overwriting them outright,
                      // which an earlier version of this did, silently broke
                      // the dropdown's own positioning even once `open` was
                      // correctly true.
                      onFocus={(e) => {
                        inputProps.onFocus?.(e);
                        setCustomerFieldFocused(true);
                      }}
                      onBlur={(e) => {
                        inputProps.onBlur?.(e);
                        setCustomerFieldFocused(false);
                      }}
                    />
                  );
                }}
                fullWidth
              />
            </Stack>
          )}
          {needsWhereDetail && where !== "Customer" && (
            <Stack spacing={0.5}>
              <Typography variant="subtitle2" color={touched && whereDetailInvalid ? "error" : "text.primary"}>
                {whereDetailCopy(where).label}
              </Typography>
              <TextField
                placeholder={whereDetailCopy(where).placeholder}
                value={whereDetail}
                onChange={(e) => setWhereDetail(e.target.value)}
                error={touched && whereDetailInvalid}
                helperText={touched && whereDetailInvalid ? "Required" : whereDetailCopy(where).helper}
                fullWidth
              />
            </Stack>
          )}
        </Stack>

        {/* Right three-quarters: the actual learning. */}
        <Box sx={{ width: "75%", display: "flex", flexDirection: "column", gap: 1 }}>
          <Typography variant="subtitle2" color={touched && whatInvalid ? "error" : "text.primary"}>
            What did you learn?
          </Typography>
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <TilRichTextField
              value={what}
              onChange={setWhat}
              placeholder="What did you learn? Explain it so others can learn from it too."
            />
          </Box>
          <Typography variant="caption" color={touched && whatInvalid ? "error" : "text.secondary"}>
            {whatLength}/{TIL_WHAT_MAX_LENGTH}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={create.isPending}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={create.isPending}>
          {create.isPending ? "Sharing…" : "Share"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

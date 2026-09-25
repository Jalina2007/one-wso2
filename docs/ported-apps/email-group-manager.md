# Email Groups & Email Signature — functional specification

**Status:** written ahead of the port, from the source implementation rather than from any prior
document. This is the reference for verifying the port and for writing test cases against it.

**Source of truth for behaviour:** `digiops-infra/apps/email-group-manager` — `webapp/src` for the UI
rules, `backend/service.bal` for the server contract.

**In One WSO2:** two separate menu items under Me — the source app's two tabs, each its own screen
here rather than a tab, since they share no data and no backend:

| Route | Screen | Backend |
|---|---|---|
| `/me/email-groups` | Google Groups mailing-list subscriptions | `ONE_WSO2_EMAIL_GROUPS_BACKEND_URL` — the existing service, reused unchanged |
| `/me/email-signature` | Email signature builder | None. Pure client-side HTML generation. |

---

## 1. Purpose and users

WSO2's Google Groups mailing lists, self-service, plus a signature builder. Every signed-in employee
sees the same screens — there is no admin mode for either. (The source backend's `/user-info` returns
an `isAdmin` flag; nothing in the source app's own UI ever branched on it, so it has no equivalent
here — see §4.)

## 2. Email Groups

Two sections on one page, both derived client-side from the same three `string[]` endpoints. Naming
matches the source app's own vocabulary (its `publicGroups` variable, its `PrivateGroupsList`
component) rather than the backend's endpoint names.

### 2.1 My Groups

Everything the caller is **already subscribed to**, filtered by where it came from — a segmented
control offering **All / Default / Public / Private**:

- **Default** rows — every employee's automatic memberships. Read-only: the source backend has no
  endpoint to leave one.
- **Private** rows — groups the caller is subscribed to that are neither default nor in the public
  directory (typically added directly by an admin, outside self-service). Also read-only here: there
  is no self-service path to leave a private group either, so no action is offered.
- **Public** rows — catalog groups the caller has opted into. The one place on the page with an
  **Unsubscribe** action, since the directory below never shows an already-subscribed group.

Under "All", each row also carries a small chip naming its origin (Default/Public/Private); under any
single-category filter the tag is dropped, since every row is already that one thing.

Has its own search box, filtered independently of the directory below.

### 2.2 Subscribe to Public Groups

The full catalog (`all-google-groups`), narrowed to groups the caller has **not** joined — the source
backend's whole directory minus whatever the caller already subscribes to. A checkbox per row for bulk
selection, a **Subscribe** action per row and as a batch, and its own independent search box. There is
no unsubscribe path here, by construction: an already-subscribed group is never listed, so there is
nothing to leave from this section — see §2.1 for that.

Both sections lay out into two columns side by side from tablet width up (one column, stacked, on a
phone) rather than paging — the whole filtered list is always visible at once.

Every subscribe and every unsubscribe — one row's own chip, or a bulk selection — goes through the
same confirmation dialog, naming the group(s) about to change.

### API contract

All calls carry the Asgardeo access token as `Bearer`; the gateway rewrites it into `x-jwt-assertion`
for the service's `JwtInterceptor`.

| Endpoint | Purpose |
|---|---|
| `GET /default-google-groups` | The caller's automatic memberships. |
| `GET /all-google-groups` | The public directory. |
| `GET /user-google-groups` | The caller's current memberships (defaults + public opt-ins + anything else). |
| `PATCH /google-group/subscribe` | Body `{groupName, userEmail}`. |
| `PATCH /google-group/unsubscribe` | Body `{groupName, userEmail}`. |

Unlike every other backend this webapp talks to, the subject of a write is a **field in the body**,
not a path segment — so `subscribe`/`unsubscribe` are the same URL regardless of who they're for. That
is harmless here because the only caller this screen ever acts for is the signed-in employee
themself; there is no admin-on-behalf-of flow to keep separate.

`GET /user-info` (name, thumbnail, `isAdmin`) is deliberately **not called**. This webapp already asks
people-app's own `/user-info` for the signed-in caller's identity on every page; a second identity
call to a second backend for the same answer would be a wasted round trip. The one field that call
supplied and this port needs — the caller's work email, for the `userEmail` payload field — comes from
that existing call instead (falling back to the id_token's `email` claim if people-app isn't
configured).

### Rules

- A group in **both** the default list and the public directory is treated as default only — it is not
  a real choice, so it's excluded from the public list rather than shown as an always-subscribed row.
- Bulk selection in "Subscribe to Public Groups" carries no separate "how many are queued" state of
  its own beyond the checkbox set itself — every joinable row is, by construction, something the caller
  can only subscribe to, so there is no split accounting the way a mixed subscribed/unsubscribed list
  would need.
- Every write is fired **one group at a time** — the source backend has no batch endpoint. A batch
  confirmation therefore loops sequentially; one group's failure is collected and reported, and does
  not abort the rest of the batch.
- Confirming an action only clears the groups THAT confirmation covered from the pending selection —
  never the whole selection Set. A single row's own chip can fire while an unrelated bulk selection is
  still pending elsewhere in the directory, and that selection must survive it.

### Authorization

None beyond being signed in. Every endpoint is open to any authenticated caller; the backend has no
group-membership gate of its own to mirror (contrast Subscriptions' `commuteAdminGroup` /
`lunchAdminGroup`, or Menu's per-endpoint 403). If that changes, the failure will surface as a plain
error on whichever of the three list queries 403s — there is currently no dedicated "you don't have
access" state because the source backend never produces one.

## 3. Email Signature

A single screen: a form of personal fields on the left, a live preview on the right. No backend call
of any kind — everything runs in the browser.

- **Fields:** full name (required), designation, work phone, mobile phone, LinkedIn URL, Medium URL, a
  custom URL and its label. Name and designation are prefilled **once**, the first time the people-app
  profile this webapp already fetches (`@api/useUserInfo`) arrives; a manual edit afterwards is never
  overwritten by a later background refetch of that same query (e.g. one triggered by saving an edit
  elsewhere on the Me profile page) — the prefill is gated on a plain "have we ever done this" flag,
  not on the response object's identity, since react-query hands back a new object on any refetch where
  even an unrelated field changed.
- **Preview:** renders the generated signature inside a mock browser-style frame, live as the fields
  change. Empty until the name or designation is filled in.
- **Copy for email:** writes both `text/html` and `text/plain` representations to the clipboard via the
  `ClipboardItem` API, so pasting into Gmail's rich-text signature box keeps the formatting, while a
  plain-text target still gets something readable. Falls back to a visible "couldn't copy" state (not
  a silent failure) where `ClipboardItem` isn't available.
- **Show HTML source:** an optional collapsible panel with the raw markup, for anyone who wants to
  paste it somewhere the clipboard copy doesn't reach.

### Markup rules

The generated HTML is a `<table>` with every style inline — no `<style>` block, no flex/grid. This is
deliberate and unchanged from the source: Gmail (and most other mail clients) strip a `<style>` block
and much of a pasted document's CSS, so a signature that has to survive that has no choice but to carry
its formatting inline, on table markup rather than modern layout primitives. This is the one place in
the app that trades the shared design system for raw HTML, for exactly that reason.

- The designation row is **omitted entirely** when blank, rather than rendered empty.
- Work phone and mobile phone are combined onto one line (`Work: … | Mobile: …`) when both are filled
  in, and shown alone when only one is.
- LinkedIn, Medium, and the custom link are **only** written into the markup when their URL matches
  `^https?://` (`isSafeUrl`, shared between the generator and the form's own live validation) — a
  `javascript:`/`data:` URL (or plain garbage) is silently dropped rather than rejected with an error,
  since there's no backend round trip to reject it during. The custom link additionally requires both
  the URL **and** its label; either alone produces nothing.
- Every user-supplied value is HTML-escaped before it reaches the markup.

## 4. Deviations from the source

| # | Source behaviour | Here | Why |
|---|---|---|---|
| 1 | Two tabs, `My Groups` and `Email Signature`, inside one app. | Two separate menu items under Me, each its own route. | They share no data and no backend — a route each is linkable and refreshable on its own, and neither screen has to know the other exists. |
| 2 | One `My Groups` tab (defaults + everything subscribed, mixed) and the public directory shown together, every public row toggling Subscribe/Unsubscribe in place. | Two sections: "My Groups" (already-subscribed, filterable by origin) and "Subscribe to Public Groups" (joinable directory only, Subscribe-only). | Splitting "what am I in" from "what can I join" removes the toggle-in-place ambiguity — a row's single action always matches the section it's in, rather than flipping meaning based on its own current state. |
| 3 | `GET /user-info` fetched for name/thumbnail/`isAdmin`, on Email Groups. | Not called. Work email comes from the existing people-app `/user-info` call this webapp already makes; the signature screen's prefill uses the same call. | `isAdmin` was dead code even in the source (nothing branched on it); the rest duplicated an identity call this app already has. |
| 4 | Checkbox selection + a toolbar, separately, for "custom" (public) groups only; default/private groups got their own bespoke list components. | One row component, two lists, one confirmation dialog for every subscribe/unsubscribe regardless of which list it came from. | Same underlying action (PATCH one group), so one dialog and one visual language reads as one feature instead of several. |
| 5 | A single list per group category, full width. | Up to two columns side by side (one on a phone) for both sections, whole list shown at once rather than paged. | Reads better for a directory that can run to dozens of groups without needing pagination controls. |
| 6 | Material UI v4 (`@material-ui/core`), hand-rolled theme. | Oxygen UI design-system components throughout. | House convention for every port in this app. |

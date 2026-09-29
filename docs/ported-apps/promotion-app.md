# Promotion — functional specification

**Status:** complete. Every screen `route.ts` defines has an equivalent in One WSO2: the
employee-facing "Self Promotion History" screen under Me (§2); the My-page profile card's "Last
promotion" summary + history dialog (§3, predates this port, its own deliberately different
design); and, under People Ops, the **Lead Portal** (Pending Requests + History tabs, §6), **Team
Promotion History** (Direct/Indirect Reportings tabs, §7), the **Functional Lead Portal** (four
tabs, §8), the **Promotion Board Portal** (four tabs, §9), the **Admin Portal** (five tabs, §10),
and **Promotion Cycle History** (two tabs, §11).

**Source of truth for behaviour:** `digiops-hr/apps/promotion/webapp/src` — `route.ts` for the
role → screen map; `view/promotion/promotion.tsx` + `panels/promotionHistory.tsx` +
`component/promotion/timeline.tsx` for the employee screen (§2); `view/lead/lead.tsx` +
`panels/recommendationList.tsx` + `panels/recommendationHistory.tsx` +
`component/recommendation/*.tsx` + `component/forms/recommendationForm.tsx` for the Lead Portal
(§6); `view/leadEmployeeHistory/leadEmployeeHistory.tsx` + `panels/employeesHistory.tsx` +
`panels/indirectReports.tsx` for Team Promotion History (§7); `view/functionalLead/functionalLead.tsx`
+ its four panels + `component/tables/customTable.tsx`/`row.tsx` for the Functional Lead Portal
(§8); `view/promotionBoard/promotionBoard.tsx` + its four panels for the Promotion Board Portal
(§9); `view/administration/administration.tsx` + its five panels for the Admin Portal (§10); and
`view/promotionCycleHistory/promotionCycleHistory.tsx` + its two panels for Promotion Cycle History
(§11) — plus `digiops-hr/apps/promotion/backend` (`service.bal` for the endpoint surface, `types.bal`/
`modules/db/types.bal`/`modules/employee/types.bal` for request/response shapes,
`modules/authorization` for the role model).

**In One WSO2:** the employee half lives under **Me**, the same split PAR and claim-approval
already apply (`docs/ported-apps/par-app.md`, `docs/ported-apps/claim-approval.md`) — viewing your
own promotion history is something every employee does for themself. Everything else in the source
app (Lead, Functional Lead, Promotion Board, Admin) is reviewing or deciding on *other people's*
promotions, which is People-Ops-team work and lives under **People Ops**.

`/me/promotion` (`features/promotion/pages/PromotionHistoryPage.tsx`) — one page, no tabs (§2.1).
`/people-ops/promotion/lead` (`features/promotion/pages/LeadPortalPage.tsx`) — two tabs, `pending`
and `history` (§6). `/people-ops/promotion/team-history`
(`features/promotion/pages/TeamPromotionHistoryPage.tsx`) — two tabs, `direct-reports` and
`indirect-reports` (§7), a *separate* screen from the Lead Portal, matching source's own two
distinct routes; both gated on `Role.LEAD` via `PromotionRequiresLeadRoute`.
`/people-ops/promotion/functional-lead` (`features/promotion/pages/FunctionalLeadPortalPage.tsx`) —
four tabs, `active`/`approved`/`rejected`/`time-based` (§8), gated on `Role.FUNCTIONAL_LEAD` via
`PromotionRequiresFunctionalLeadRoute`. `/people-ops/promotion/board`
(`features/promotion/pages/PromotionBoardPortalPage.tsx`) — four tabs, `active`/`approved`/
`rejected`/`fl-rejected` (§9), gated on `Role.PROMOTION_BOARD_MEMBER` via
`PromotionRequiresPromotionBoardRoute`. `/people-ops/promotion/admin`
(`features/promotion/pages/PromotionAdminPortalPage.tsx`) — five tabs, `cycle`/`time-based`/
`individual-contributor`/`withdrawal-requests`/`users` (§10), gated on `Role.HR_ADMIN` via
`PromotionRequiresHrAdminRoute`. `/people-ops/promotion/cycle-history`
(`features/promotion/pages/PromotionCycleHistoryPage.tsx`) — two tabs, `by-cycle`/
`people-hr-archive` (§11), gated on `Role.HR_ADMIN` **or** `Role.FUNCTIONAL_LEAD` via
`PromotionRequiresCycleHistoryRoute`. Backend is promotion-app's own Ballerina service, configured
as `ONE_WSO2_PROMOTION_BACKEND_URL`, shared with the My-page card (§3). Requests carry
`x-user-timezone-offset` (`@features/my/util/digiopsHeaders`, the same header par-app's own backend
requires — see that file's comment for the exact header contract both services share).

---

## 1. Purpose and users

Every employee can look up their own promotion record: what job band they joined at, and every
promotion cycle they've since been approved for. Source (`route.ts`) calls this "Self Promotion
History" and gates it on `Role.EMPLOYEE` — i.e. everyone. The same route also defines a "Promotion
Status" tab and an "Applications History" tab, both **commented out** in source's own tab bar and
routing (`promotion.tsx:116-135`) — dead code, not merely hidden, so this port reproduces only the
one live tab rather than resurrecting the disabled ones (§5, deviation 1).

## 2. Screens and features

### 2.1 Promotion History (`PromotionHistoryPage.tsx`, ports `promotionHistory.tsx` + `timeline.tsx`)

A single vertical history list, newest promotion first, ending in a "Joined" entry:

- One entry per **APPROVED** promotion request: the band it promoted to, the promotion cycle name,
  a "Special" chip for `promotionType === SPECIAL`, and the business unit/department/team at the
  time.
- A final entry for when the employee joined: the job band held before any promotion on record
  (the oldest approved request's `currentJobBand`, or `employee-info`'s own `jobBand` if there is
  no history at all — matching source's exact fallback, `timeline.tsx:147-151`), plus the join
  date and the business unit/department/team joined into.

Ordering is by `nextJobBand` descending (`sortPromotionsByBand` — see that function's own comment
for why band, not a timestamp, orders promotion history), not source's raw backend order — a
deterministic improvement, not a behavioural change source's own users could tell apart, since the
backend never documented an order guarantee.

**Visual shape matches source closely, including the card/header/tab-strip chrome** — the outlined
card, the icon + "Promotion History" header, and the tab strip below it are all reproduced (with a
single tab, §5 deviation 1), and the timeline itself is a two-column alternating layout: each row's
"opposite content" (the cycle name / join date) sits on whichever side that row's main content
ISN'T, swapping every row, exactly like source's `@mui/lab` `Timeline position="alternate"`.

`@mui/lab` itself is not used — checked against the npm registry, there is no stable release
compatible with this app's MUI v7 (only pre-release betas) — so the alternating grid, the
dot-and-connector spine, and the per-type dot colour are hand-rolled with plain `Box`/CSS grid
instead of adding a beta dependency for one screen. One colour deviates from source: the `SPECIAL`
dot/chip uses `warning` (amber) rather than source's `secondary`, because this app's theme leaves
`secondary` too pale to read against the card background — `warning` is the same role the My-page
history dialog's own `TypeChip` already uses for `SPECIAL` (§3), so this reuses that mapping rather
than inventing a new one.

## 3. Relationship to the My-page profile card

`features/my/components/ConnectedServices.tsx` already shows a "Last promotion" line (cycle + band
jump) and a "View promotion history" button opening `PromotionHistoryDialog.tsx` — a compact modal
list of the same approved requests, built before this page existed as its own summary widget for
the profile page, not a port of source's own screen. It stays as designed; this page is the fuller,
dedicated equivalent of promotion-app's own "Self Promotion History" screen, reachable from the Me
rail instead of a dialog. Both read the same two endpoints and share the same canonical types/hooks
(`features/promotion/api/`) and derive helpers (`features/promotion/util/promotionHistory.ts`) —
there is one query cache entry per endpoint, not two independently-fetched copies.

## 4. API contract

| Endpoint | Purpose |
|---|---|
| `GET /employee-info?employeeWorkEmail=<email>` | The caller's `EmployeeInfoWithLead` — join date, job band, joined BU/department/team, reporting lead. Non-lead/non-admin callers can only query their own email (backend also allows a caller who is the target's manager, is in their reporting chain, has an active recommendation for them, or is a functional lead in scope — none of which this page's own self-lookup needs, since `requestedBy === employeeWorkEmail` short-circuits that whole check). |
| `GET /promotion/requests?statusArray=APPROVED&employeeEmail=<email>` | Every APPROVED promotion request for that employee. Same authorization as above. |

## 5. Deviations from the source app

| # | Change | Why |
|---|---|---|
| 1 | Only the "Promotion History" tab exists — no "Promotion Status" or "Applications History" tab. | Both are commented out in source's own render and routing (`promotion.tsx`), i.e. dead in the running app, not merely feature-flagged off. Reproducing dead tabs would be inventing behaviour source's own users never see. |
| 2 | The alternating timeline is hand-rolled (`Box`/CSS grid) instead of using `@mui/lab`'s `Timeline`. | No stable `@mui/lab` release exists for this app's MUI v7 (registry check: newest compatible version is still a beta) — visual result matches source, only the implementation differs. |
| 3 | `SPECIAL` promotions use `warning` (amber) for the dot/chip instead of source's `secondary`. | This app's theme leaves MUI `secondary` too pale to read against the card background; `warning` is the same role the My-page history dialog's own `TypeChip` already uses for `SPECIAL`. |
| 4 | Entries sorted by `nextJobBand` descending, not raw backend response order. | Deterministic and matches the "newest first" convention the My-page history dialog already uses (`sortPromotionsByBand`); source never documented an order guarantee on this endpoint. |
| 5 | The Lead Portal's rich-text (recommendation statement/comment/decline reason) is sanitized with DOMPurify on **both** write and read. | Source's own `RichTextContent.tsx` renders decoded HTML with `dangerouslySetInnerHTML` and no sanitization at all on the read side (only the editor sanitizes on write) — a real XSS gap for a field one person writes and a different person (the employee, an admin, a promotion board member) later reads. Not reproduced. |
| 6 | `recommendationAdditionalComment` is passed through unchanged (already base64, or null) on save/submit, instead of being re-encoded. | Source's own thunks run the stored value through `Buffer.from(value).toString("base64")` again, double-encoding an already-base64 string — only harmless today because no UI in this screen ever sets that field, so it stays empty. Passing it through avoids corrupting it if that ever stops being true. |
| 7 | The rich-text editor is `react-quill-new`, not source's `react-draft-wysiwyg`/`draft-js`. | Same substitution PAR's own `ParRichTextField` already makes — `draft-js` has no React 19 support. Toolbar is a subset of source's own (bold/italic/underline, ordered/unordered list, indent/outdent); link and undo/redo are dropped, matching PAR's own simplification rather than inventing a different toolbar shape for this app. |
| 8 | Tabs are real routes (`/people-ops/promotion/lead/pending`, `.../history`), not a `?tab=` query param. | Consistent with every other multi-tab screen in this app (PAR's `RoutedTabs`) — a tab is linkable, survives a refresh, and works with the back button. The tab strip's own look (icon + label, divider beneath) still matches source's visual, just URL-driven instead of state-driven. |
| 9 | Team Promotion History's Direct/Indirect Reportings tabs share one component (`PromotionTeamRoster.tsx`) instead of two near-identical files. | Source's `employeesHistory.tsx` and `indirectReports.tsx` are the same markup end to end, differing only in which query param they pass to the same `/employees` resource — kept as one component parameterized by `kind` rather than duplicating ~200 lines. |
| 10 | The Functional Lead Portal's grids are MUI X DataGrid, not source's own hand-rolled `CustomTable` (`component/tables/customTable.tsx`). | `CustomTable` reimplements sorting, per-column-type filter editors, column visibility, pagination, and CSV export from scratch (~880 lines) — DataGrid ships all of it, the same substitution PAR's own admin grids already make (`ParAssignQuota.tsx`). Visual/functional result matches; sort/filter UI is DataGrid's own rather than a pixel copy of source's custom icons. |
| 11 | A row's expanded detail (`PromotionRequestDetailPanel`) opens in a Dialog, not inline below the row. | MUI X DataGrid Community has no row detail-panel feature (`getDetailPanelContent` is Pro-only — checked against the installed package, not available here); a dialog on the same expand action is the closest equivalent without adding a paid tier. |
| 12 | Location, Joined date, and Last promoted Date columns are omitted from every Functional Lead grid. | None of the three exist on the backend's own `FullPromotionRequest` record (checked against `modules/db/types.bal`), despite source's own frontend `PromotionRequest` interface declaring them — the columns render blank in the real running app too; omitting them shows the same information, just without dead column headers. |
| 13 | CSV export uses DataGrid's own built-in export (visible grid columns as-is) instead of source's own enriched export (decoded recommendation statements/comments per lead, flattened into extra columns). | A secondary feature relative to the core approve/reject/review workflow; reproducing the exact enriched shape would mean hand-building export again rather than using DataGrid's own, which is the reason for deviation 10 in the first place. |
| 14 | The Admin Portal's User Management "Access Levels" viewer dialog isn't reproduced. | Source itself has the button that opens it commented out ("Temporary Hide for not functioning" — `userLine.tsx`) — unreachable in the real running app, the same principle as deviation 1. |
| 15 | `CloseStat` (a "Stats" tile group on the Promotion Cycle tab) isn't reproduced. | Source imports it in `promotionCycle.tsx` but never renders it — confirmed dead code (only `EndStat` is actually mounted). |
| 16 | The Promotion Cycle tab's Home/Notification Hub split uses local component state, not a `subView` query param (source) or a linkable route (this app's own usual tab convention, deviation 8). | It's a two-pane drill-down within one tab, not one of the portal's five real tabs — the same shape as opening a detail Dialog from a grid row elsewhere in this app, not something that needs its own URL. |
| 17 | The Functional Lead ACL selector (User Management's "which BU/Department/Team can this lead act on" picker) is a single expandable tree, not source's own three parallel columns that narrow as you click across. | Same tri-state selection semantics (checking a parent selects every descendant; a partially-selected parent shows indeterminate) with a simpler, safer-to-get-right shape for a picker this deep — not a capability gap. |
| 18 | Time Based Promotions' bootstrap "PAR App" import option is visible and selectable, but confirming it is a no-op. | Matches source exactly — its own `// TODO: PAR app process` has no backend behind it either. Hiding the option would silently drop something a real admin can currently click in the source app; making it actually work is out of scope for a port. |
| 19 | The Notification Hub's "Effective Date" field is a real date input, not source's own `textarea`. | Same payload either way (a date string); a plain text input for a date is very likely a source oversight, not an intentional design, and this is a low-risk, purely cosmetic fix. |

## 6. Lead Portal — Time Based Promotions

**Source of truth:** `view/lead/lead.tsx` (tab shell), `panels/recommendationList.tsx` (Pending
Requests), `panels/recommendationHistory.tsx` (History), `component/recommendation/recommendationLine.tsx`
/ `historyLine.tsx` / `recommendation.tsx` / `header.tsx`, `component/forms/recommendationForm.tsx`,
and `slices/leadSlice/index.ts` + `slices/leadSlice/recommendationHistory.ts` for the exact API
sequencing this port's hooks (`features/promotion/api/useLeadRecommendations.ts`) reproduce.

A lead here is *recommending* a direct report for a time-based promotion — there is no employee
"apply" step anywhere in this flow; a recommendation already exists (`REQUESTED`) by the time it
reaches this screen, created elsewhere (`POST /promotion/recommendations`, out of scope — see §7).

### 6.1 Pending Requests (`LeadPendingRequestsTab.tsx`)

Every `REQUESTED` recommendation for the caller, scoped to the one `OPEN` promotion cycle
(`GET /promotion/recommendations?leadEmail=&statusArray=REQUESTED&promotionCycleId=`). Three states
gate the whole tab, checked in order: no `OPEN` cycle at all ("We are not accepting promotion
requests right now"), the cycle's `leadDeadline` already past end-of-day in the browser's own
timezone ("The Lead deadline has passed" — the backend re-checks the same deadline on every mutating
endpoint below, so a stale client clock can only hide an action early, never let one through the
server wouldn't accept anyway), or neither — an amber banner names the deadline and the list renders.

Each pending row (`RecommendationCard.tsx`, ports `recommendationLine.tsx`): employee name + email +
cycle, a "Time Based" chip, and **Start** / **Decline**. **Decline** opens a popover for a required
reason (250 chars, matching source's `maxLength`) and calls `GET .../recommendations/{id}/decline?comment=`
immediately — no separate confirmation dialog, matching source. **Start** replaces the list with
`RecommendationEditForm.tsx` (ports `recommendation.tsx` + `recommendationForm.tsx`): read-only
applicant info (recommended job band, joined date, last-promoted date, photo — `GET /employee-info`,
reusing the same hook §2 uses) plus a single rich-text field labelled "Additional comments" that
actually writes `recommendationStatement` — source's own field/label mismatch (§5, deviation 5
notes the sanitization change; the mismatch itself isn't "fixed", since it's what source's own
running app shows). **Save As Draft** (`PATCH /promotion/recommendations`) and **Approve**
(the same `PATCH`, then `GET .../submit`) are both confirmation-gated, with source's exact dialog
copy ("Do you want to save/submit the application?"). Approving a `TIME_BASED` recommendation also
moves the underlying promotion *request* to `SUBMITTED` (or straight to `APPROVED` if the caller
also holds `Role.FUNCTIONAL_LEAD`) as a server-side side effect — transparent to this screen, no
frontend branching needed for it.

### 6.2 History (`LeadHistoryTab.tsx`)

Every `SUBMITTED`/`DECLINED`/`EXPIRED` recommendation the caller has ever made, across every cycle —
not scoped to the open one (`GET /promotion/recommendations?leadEmail=&statusArray=SUBMITTED,DECLINED,EXPIRED`,
no `promotionCycleId`, matching source's own `getRecommendationsHistory`) — narrowed client-side to
`promotionType === "TIME_BASED"` (source's own `RecommendationHistorySlice` filters the same way;
the shared `/promotion/recommendations` resource can carry other promotion types too). Each row
(`RecommendationHistoryCard.tsx`, ports `historyLine.tsx`): a `recommendationStatus` chip
(`SUBMITTED` reads "APPROVED" — the lead's own act of submitting *is* their approval) and a
`promotionRequestStatus` chip that reads `IN_PROGRESS` instead of its raw value while its cycle is
still the open one (`promotionRequestStatusLabel`) — otherwise a request that can still move further
(e.g. `FL_APPROVED` still needs the Promotion Board) would misleadingly look final. Expanding a
`SUBMITTED` row shows the recommendation statement, additional comment, and — for a rejected
request — the rejection reason; a `DECLINED` row shows the decline reason instead; an `EXPIRED` row
has nothing further to show and stays collapsed, matching source exactly.

### 6.3 API contract (Lead Portal)

| Endpoint | Purpose |
|---|---|
| `GET /employee-privileges` | The caller's numeric privilege codes, mapped to a role gate (`usePromotionRoles.ts`) — presentation only, see that file's own comment. |
| `GET /promotion/cycles?statusArray=OPEN` | The one open cycle, if any — `promotionCycles[0]`, matching source's own assumption that at most one is ever open. |
| `GET /promotion/recommendations?leadEmail=&statusArray=&promotionCycleId=` | Shared by both tabs — Pending Requests passes `REQUESTED` + the open cycle's id; History passes `SUBMITTED,DECLINED,EXPIRED` with no cycle. |
| `PATCH /promotion/recommendations` | Saves a draft `statement`/`comment` (base64) without changing status. 403s past the lead deadline (unless the caller is `HR_ADMIN`), and only while the recommendation is still `REQUESTED`. |
| `GET /promotion/recommendations/{id}/submit` | Approves the recommendation (→ `SUBMITTED`); for `TIME_BASED`, also flips the underlying request as described in §6.1. |
| `GET /promotion/recommendations/{id}/decline?comment=` | Declines with a required reason; two-step server side (`SUBMITTED` then `DECLINED`, per `service.bal`'s own handler). |

## 7. Team Promotion History

**Source of truth:** `view/leadEmployeeHistory/leadEmployeeHistory.tsx` (tab shell),
`panels/employeesHistory.tsx` (Direct Reportings), `panels/indirectReports.tsx` (Indirect
Reportings), and `slices/leadEmployeeHistorySlices/employeesHistory.ts` +
`indirectReportings.ts` for the two API calls this port's `usePromotionTeam.ts` reproduces. A
*separate* Lead-role screen from the Lead Portal (§6) — source's own `/lead-employee-history`
route, distinct from `/time-based-promotions` — kept separate here too rather than folded into it
as a third tab, matching source's own information architecture.

### 7.1 Direct/Indirect Reportings (`TeamDirectReportsTab.tsx` / `TeamIndirectReportsTab.tsx`)

Both tabs render the identical roster (`PromotionTeamRoster.tsx`, §5 deviation 9): a search box
(work email only, matching source's own narrower `filteredEmployees` scope — not name), a refresh
button, and one card per employee (`PromotionEmployeeCard.tsx`) — avatar, full name, work email,
current job band, current job role, start date, and an eye icon. Direct Reportings queries
`GET /employees?managerEmail=<caller>` (the caller's own direct reports); Indirect Reportings
queries `GET /employees?additionalManagerEmail=<caller>` (employees who list the caller as a
dotted-line/secondary manager — a different relationship than a PAR "additional report", specific
to promotion-app's own employee model).

The eye icon opens `PromotionEmployeeHistoryDialog.tsx` — the **same** `PromotionTimeline`
component §2's `/me/promotion` page renders, fed by the same two endpoints/hooks
(`usePromotionEmployeeInfo` + `usePromotionHistory`) for the selected report's email instead of the
caller's own. A lead viewing a report's promotion history sees literally the same timeline that
report sees of their own record. Authorization for `/employee-info` on someone else's email is
satisfied here by the reporting-chain check already described in §4's own row (the target's
`managerEmail`/`reportsToEmail` includes the caller) — no separate grant needed for this screen.

### 7.2 API contract (Team Promotion History)

| Endpoint | Purpose |
|---|---|
| `GET /employees?managerEmail=<email>` | The caller's own direct reports. |
| `GET /employees?additionalManagerEmail=<email>` | Employees who list the caller as an additional (dotted-line) manager. |
| `GET /employee-info?employeeWorkEmail=<email>` | Reused from §4 — the selected report's join/band/last-promoted info, for the history dialog. |
| `GET /promotion/requests?statusArray=APPROVED&employeeEmail=<email>` | Reused from §4 — the selected report's approved promotion history. |

## 8. Functional Lead Portal

**Source of truth:** `view/functionalLead/functionalLead.tsx` (tab shell),
`panels/submittedRequests.tsx` (Active Promotion Requests), `panels/approvedList.tsx` (Approved
Requests), `panels/rejectedList.tsx` (Rejected Requests), `panels/timeBased.tsx` (Time Based
Promotions), and `component/tables/customTable.tsx` + `row.tsx` for the grid/expand behaviour §5
deviations 10–11 reimplement with MUI X DataGrid. `slices/functionalLeadSlices/{activeRequest,
approvedList,rejectedList,timebased}.ts` for the exact API sequencing this port's
`usePromotionRequests.ts`/`usePromotionCycle.ts` reproduce.

A functional lead reviews `SUBMITTED` promotion **requests** (not recommendations — those are the
Lead Portal's own concern, §6) within their own `functionalLeadAccessLevels` scope (business
unit/department/team/sub-team, `enableBuFilter=true` on every request here). Approving moves a
request to `FL_APPROVED` (or straight to `APPROVED` for a `TIME_BASED` request — the Functional
Lead is effectively the final approver for that type, it never reaches the Promotion Board);
rejecting moves it to `FL_REJECTED`, terminal.

### 8.1 Active Promotion Requests (`FLActiveRequestsTab.tsx`)

Every `SUBMITTED` request in scope, in a DataGrid with checkbox selection: per-row **Edit job
band** (opens `EditJobBandDialog.tsx`, source's own "Update Application Job Band" dialog — picks
any band above the request's current one, confirmation-gated, matching source's exact copy),
**Approve** and **Reject** (both per-row and bulk via the header's own Approve/Reject buttons —
source has no real bulk endpoint either; both fan out `Promise.all` over the same single-request
endpoints), and **View details** (opens `PromotionRequestDetailDialog.tsx` — §5 deviation 11). The
Functional Lead deadline gates the whole tab the same way the Lead Portal's own deadline does
(§6.1): no `OPEN` cycle, past deadline, or the live grid, in that order.

### 8.2 Approved Requests (`FLApprovedListTab.tsx`)

Every request this functional lead has already approved (`FL_APPROVED`/`APPROVED`/`REJECTED` — the
latter two are the Promotion Board's own subsequent decision, which this tab tracks rather than
re-litigates), read-only, with three running counts (All / Board Approved / Board Rejected) and a
"Promotion Board Approval Status" column (`boardStatusLabel` — `TIME_BASED` always reads "N/A"
here, since it never reaches the board at all). Rows are tinted green (board-approved) or red
(board-rejected), matching source's own `setRowColor`.

### 8.3 Rejected Requests (`FLRejectedListTab.tsx`)

Every request this functional lead has rejected (`FL_REJECTED`), read-only, alternating row stripe
(source's own `getIndexBasedRowColor`) instead of status colouring — there's only one status here.

### 8.4 Time Based Promotions (`FLTimeBasedTab.tsx`)

Informational only — source's own copy says so explicitly ("No action is required"). Every
`TIME_BASED` request in scope for the open cycle, as a plain card list (not a DataGrid — source
itself didn't build this one on `CustomTable`): each recommending lead's own status
(Pending/Submitted, chip-coloured), the lead's email, the employee's team, and the band jump.

### 8.5 API contract (Functional Lead Portal)

| Endpoint | Purpose |
|---|---|
| `GET /promotion/requests?statusArray=&enableBuFilter=true&type=&cycleId=` | Every grid/list here — statusArray/type/cycleId vary per tab (§8.1–8.4); `enableBuFilter=true` scopes to the caller's own `functionalLeadAccessLevels`, 403ing if they hold none. |
| `GET /promotion/requests/{id}/approve?from=functional_lead` | Approves one request (→ `FL_APPROVED`, or `APPROVED` for `TIME_BASED`). Shared with the not-yet-ported Promotion Board portal via `from=promotion_board`. |
| `GET /promotion/requests/{id}/reject?from=functional_lead&reason=` | Rejects one request (→ `FL_REJECTED`), reason required. Same `from` sharing as approve. |
| `PATCH /promotion/requests` | Edits `promotingJobBand` (Active tab's edit dialog only) — `FUNCTIONAL_LEAD`/`PROMOTION_BOARD_MEMBER` only, server-side. |
| `GET /promotion/cycles?statusArray=OPEN` | Reused from §6 — the open cycle, for deadlines (Active tab) and `cycleId` scoping (Time Based tab). |

## 9. Promotion Board Portal

**Source of truth:** `view/promotionBoard/promotionBoard.tsx` (tab shell),
`panels/promotionRequests.tsx` (Active Promotion Requests), `panels/approvedRequests.tsx` (Approved
Requests), `panels/rejectedRequests.tsx` (Rejected Requests),
`panels/functionalLeadRejectedList.tsx` (Functional Lead Rejected Requests), and
`slices/promotionBoardSlice/{activeRequest,approvedRequests,rejectedRequests,fl_rejectedList}.ts`
for the exact API calls this port's `usePromotionRequests.ts` reuses unchanged — the whole portal is
built on the same hooks/components the Functional Lead Portal (§8) already introduced, differing
only in `statusArray`, the absence of `enableBuFilter` (org-wide, not BU-scoped), and
`from=promotion_board` on approve/reject.

A promotion board member reviews `FL_APPROVED` requests **org-wide** — every business unit, not just
one functional lead's scope. Approving moves a request to `APPROVED`, final; rejecting moves it to
`REJECTED`, also final. The other three tabs are read-only visibility into requests at every other
stage this portal cares about, again org-wide.

### 9.1 Active Promotion Requests (`PBActiveRequestsTab.tsx`)

Structurally identical to the Functional Lead Portal's own Active tab (§8.1): every `FL_APPROVED`
request, checkbox-selectable DataGrid, per-row **Edit job band** (same `EditJobBandDialog.tsx`),
**Approve**/**Reject** (per-row and bulk, `from=promotion_board`), and **View details** (same
`PromotionRequestDetailDialog.tsx`). Gated the same way by a deadline — the *Promotion Board*
deadline (`promotionBoardDeadline`), not the Functional Lead one: no `OPEN` cycle, past deadline, or
the live grid, in that order (source's own `isPromotionBoardDeadlinePast`).

### 9.2 Approved Requests (`PBApprovedListTab.tsx`)

Every request the board itself approved (`APPROVED`), read-only. Unlike the Functional Lead
Portal's own Approved tab (§8.2), there is nothing further downstream to track here — the board's
decision is final — so source's own panel carries no counts and no row colouring, just the list.

### 9.3 Rejected Requests (`PBRejectedListTab.tsx`)

Every request the board itself rejected (`REJECTED`), read-only, structurally identical to 9.2.

### 9.4 Functional Lead Rejected Requests (`PBFLRejectedListTab.tsx`)

Every request a functional lead rejected (`FL_REJECTED`) **org-wide** — gives the board visibility
into requests that never reached them at all. Read-only, structurally identical to 9.2/9.3. Distinct
from the Functional Lead Portal's own Rejected tab (§8.3), which is BU-scoped to the calling lead
rather than org-wide.

### 9.5 API contract (Promotion Board Portal)

| Endpoint | Purpose |
|---|---|
| `GET /promotion/requests?statusArray=` | Every grid here — `FL_APPROVED`/`APPROVED`/`REJECTED`/`FL_REJECTED` per tab (§9.1–9.4); no `enableBuFilter`, org-wide. |
| `GET /promotion/requests/{id}/approve?from=promotion_board` | Approves one request (→ `APPROVED`, final). Shared endpoint with the Functional Lead Portal (§8.5) via `from`. |
| `GET /promotion/requests/{id}/reject?from=promotion_board&reason=` | Rejects one request (→ `REJECTED`, final), reason required. |
| `PATCH /promotion/requests` | Edits `promotingJobBand` (Active tab's edit dialog only) — same endpoint §8.5 documents. |
| `GET /promotion/cycles?statusArray=OPEN` | Reused from §6 — the open cycle, for the Promotion Board deadline. |

## 10. Admin Portal

**Source of truth:** `view/administration/administration.tsx` (tab shell),
`panels/promotionCycle.tsx` + `panels/notificationHub.tsx` (Promotion Cycle),
`panels/timeBasedPromotion.tsx` (Time Based Promotions),
`panels/individualContributorPromotions.tsx` (Individual Contributor Promotion),
`panels/withdrawalRequest.tsx` + `component/promotion/withdrawalRequestLine.tsx` (Withdrawal
Requests), `panels/userManagement.tsx` + its own form/selector components (User Management), and
`component/statistics/promotionCycle/endStat.tsx` + `component/forms/promotionCycleForm.tsx`.
`view/administration/panels/tree.tsx`/`timeline.tsx` are confirmed dead code (no importer anywhere
in source outside each other) and are not ported.

Gated on `Role.HR_ADMIN` via `PromotionRequiresHrAdminRoute`, the same presentation-only pattern
every other portal's own guard uses. Five tabs, matching source's own tab bar order exactly.

### 10.1 Promotion Cycle (`AdminPromotionCycleTab.tsx`)

No active cycle: a "Create" form (`PromotionCycleCreateForm.tsx`, ports `promotionCycleForm.tsx`'s
own `NewCycleForm`) — year + half-year Select (built client-side into `name` as `"{year}-{half}"`,
e.g. `"2026-H1"`), a start/end date range, and three deadlines nested inside it
(lead/functional-lead/promotion-board), confirmation-gated with source's exact copy. An active
cycle: its own name/status/date-range/deadlines, an **End Promotion Cycle** button (`OPEN` only,
confirmation-gated), and (`OPEN` only) `PromotionCycleStatsPanel.tsx` — three status breakdowns of
every request in the cycle (Promotion Board / Functional Lead / overall, ports `endStat.tsx`;
`closeStat.tsx` is confirmed dead code — §5 deviation 15) plus a **Notification Hub** button.

Notification Hub (`NotificationHubPanel.tsx`) is a drill-in, not a sixth tab (§5 deviation 16):
three sub-views over the same cycle's request list — **Approved Applications** and **Rejected
Applications** (both: requests whose outcome email hasn't gone out yet, per-row and bulk **Send
Notification**, `GET .../requests/{id}/send-email-notification?effectiveDate=`; only the Approved
view asks for an effective date) and **Sent Notifications** (read-only, adds a "Notified
Timestamp" column). Source's own gating text is contradictory about which cycle status enables
this screen — the literal comparison is what's ported, not the copy.

### 10.2 Time Based Promotions (`AdminTimeBasedPromotionsTab.tsx`)

Empty for the open cycle: a "PAR App" vs "Google Sheet" bootstrap picker (§5 deviation 18 — PAR App
is visible but a no-op, matching source's own unimplemented path exactly); choosing Google Sheet
opens a URL dialog and calls `POST /promotion/requests/time-based` (`{type:"SHEET", sheet}`).
Populated: the same DataGrid/column conventions as every other admin/lead/board grid here (base
columns + a per-recommendation "Lead Status" chip + a declined-reason edit dialog), a "Sync from
sheet" re-import action available at any time (not just at bootstrap), and a sync-in-progress
banner (`usePromotionSyncState("TIME_BASED_PROMOTION_STATE")`) that auto-refetches once the import
settles to `SUCCESS`.

### 10.3 Individual Contributor Promotion (`AdminIndividualContributorTab.tsx`)

Read-mostly audit list, scoped to the open cycle only — no approve/reject/bulk action at all
(matching source, which built no such action into this screen), the only mutation is editing a
declined request's own `reasonForRejection` after the fact (`PATCH /promotion/requests`, same
endpoint the job-band edit dialog uses — §8.5).

### 10.4 Withdrawal Requests (`AdminWithdrawalRequestsTab.tsx`)

Every `WITHDRAW` (pending) and `REMOVED` (already decided) request, org-wide, as a card list
(`WithdrawalRequestCard.tsx`) rather than a DataGrid — source itself built this on its own line
component, not `CustomTable`. Per-card **Approve** (`GET .../requests/{id}/remove`) / **Reject**
(`GET .../requests/{id}/submit`) on `WITHDRAW` rows only — both endpoints are named for their
backend side effect, not the UI verb (source's own naming, kept as-is) — and an expand showing the
request statement and every recommendation's own statement/status.

### 10.5 User Management (`AdminUserManagementTab.tsx`)

Lists promotion-app's own **system users** (an account + `Role[]` + optional Functional Lead
BU/Department/Team scope) — not the employee directory. Add/edit (`UserFormDialog.tsx`; roles via
a multi-select, `EMPLOYEE` excluded from what's grantable, matching source's own `RoleSelector`),
activate/deactivate and delete (both confirmation-gated), Transfer Access (`TransferAccessDialog.tsx`
— moves an existing user's roles/ACL onto a different employee's email, scoped to leads only in the
picker), and a Google Sheet bulk sync (`usePromotionSyncState("SYNC_STATE")`, independent of Time
Based's own sync flag). The Functional Lead ACL selector (`FunctionalLeadAclSelector.tsx`) is a
single expandable tri-state tree over the backend's own BU→Department→Team shape, not source's
three parallel columns (§5 deviation 17); the "Access Levels" read-only viewer dialog isn't
reproduced at all (§5 deviation 14 — unreachable in source's own running app).

### 10.6 API contract (Admin Portal)

| Endpoint | Purpose |
|---|---|
| `POST /promotion/cycles` | Creates a new cycle. |
| `GET /promotion/cycles/{id}/end` | Ends the currently `OPEN` cycle. |
| `GET /promotion/requests?cycleId=` | Every request in a cycle, no status/type filter — feeds the stats panel and Notification Hub. |
| `GET /promotion/requests/{id}/send-email-notification?effectiveDate=` | Manually sends the outcome email for a request whose automatic one hasn't gone out yet. |
| `POST /promotion/requests/time-based` | Bulk-imports `TIME_BASED` requests for the open cycle from a Google Sheet (`{type:"SHEET", sheet}`). |
| `GET /promotion/requests/{id}/remove` \| `/submit` | Withdrawal approve/reject respectively — see §10.4. |
| `GET /users`, `POST /users`, `PATCH /users`, `DELETE /users/{id}` | System-user CRUD. |
| `GET /business-units` | The BU→Department→Team tree behind the Functional Lead ACL selector — promotion-app's own resource, distinct from people-app's. |
| `GET /business-units/sync?googleSheet=` | Bulk user-list import/refresh. |
| `GET /app-configs?key=SYNC_STATE\|TIME_BASED_PROMOTION_STATE` | Two independent sync-progress flags, polled every 2s while `IN_PROGRESS`. |
| `GET /employees?filterLeads=true\|false` | The employee-picker behind Add User / Transfer Access. |

## 11. Promotion Cycle History

**Source of truth:** `view/promotionCycleHistory/promotionCycleHistory.tsx` (tab shell),
`panels/cycleHistory.tsx` (By Promotion Cycle), `panels/peopleHrArchive.tsx` (People HR Archive),
and `slices/cycleHistorySlice/cycleHistory.ts` for the exact API calls this port's own hooks
reproduce.

Gated on `Role.HR_ADMIN` **OR** `Role.FUNCTIONAL_LEAD` via `PromotionRequiresCycleHistoryRoute` —
the only screen in this app two different role gates both reach directly. Two tabs, matching
source's own tab bar order exactly.

### 11.1 By Promotion Cycle (`CycleHistoryTab.tsx`)

A picker over every closed cycle (`GET /promotion/cycles?statusArray=END`,
`useInactivePromotionCycles`). Selecting one shows its own name/dates/three deadlines, then every
request it produced — scoped differently per role, exactly matching source's own branch
(`getAllPromotionRequests` vs `getAllFLPromotionApplications`, both reproduced here as the same
`usePromotionRequests({ cycleId })` call, with `enableBuFilter: true` added only for a caller who
is `FUNCTIONAL_LEAD` and **not also** `HR_ADMIN` — source's own `if (HR_ADMIN) ... else if
(FUNCTIONAL_LEAD)` priority, preserved). An `APPROVED` row is tinted green, matching source's own
`setRowColor`.

### 11.2 People HR Archive (`PeopleHrArchiveTab.tsx`)

Read-only view of promotions migrated out of the pre-HRIS People HR system — a **separate**
source from every `PromotionRequestFull` the rest of this app reads; the same person can
legitimately appear in both, so this is deliberately not merged with `PromotionTimeline`. A
name/email filter plus an effective-date range narrows the grid (`GET /promotion/history`, debounced
350ms on the name field, matching source); clicking a name opens that person's **full** archived
history in a dialog (same endpoint, `employeeEmail` only — deliberately ignoring the grid's own
filters, since the question there is "what has this person been promoted to", not "what did the
filter match"), rendered as a single-column dot timeline.

### 11.3 API contract (Promotion Cycle History)

| Endpoint | Purpose |
|---|---|
| `GET /promotion/cycles?statusArray=END` | Every closed cycle — the By Promotion Cycle tab's own picker. |
| `GET /promotion/requests?cycleId=[&enableBuFilter=true]` | Reused from §8.5/§9.5 — every request in the selected cycle, BU-scoped only for a Functional-Lead-not-also-Admin caller. |
| `GET /promotion/history?search=&startDate=&endDate=&employeeEmail=` | The People HR Archive grid (search/date-range) and person drill-down (`employeeEmail` alone). |

## 12. Deviations specific to Promotion Cycle History

| # | Change | Why |
|---|---|---|
| 20 | Both grids (By Promotion Cycle, People HR Archive) use MUI X DataGrid instead of source's own `CustomTable`/plain `Table`+`TablePagination`. | Same substitution as deviation 10 — consistent with every other grid in this app rather than a third table implementation. |
| 21 | The People HR Archive person drill-down renders a plain single-column dot timeline, not `@mui/lab`'s `Timeline`. | Same reasoning as deviation 2 — no stable `@mui/lab` release for this app's MUI v7. |

One open question, not yet confirmed against source: whether an employee "apply for promotion"
flow exists at all (`checkPromotionRequests`/eligibility/apply-style endpoints appear in
`config.ts` but no screen in `route.ts` exposes an "Apply" action) — every request this port has
seen originates from a lead's recommendation, not employee self-service (§6's own opening note).
If such a flow turns out to exist, it would live under Me, not People Ops, since it's the employee
acting for themself.

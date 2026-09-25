# Session renewal — what we found, what we changed, what is parked

Written after chasing a "your session has expired" dialog that appeared while
the session was demonstrably fine. The dialog was a symptom; the notes below are
the disease, and most of it is still there.

## 1. The finding that explains the rest

**This app uses the Asgardeo SDK for sign-in and token storage, and never for
requests.** `@api/http`'s `fetchWithReauth` attaches the Bearer token and calls
the browser's `fetch` directly. The SDK ships an HTTP client —
`useAsgardeo().http.request` / `requestAll` — and it is used **nowhere**.

That one decision is why this app has session-renewal machinery at all. The
Asgardeo guidance is explicit that the SDK renews tokens itself and that
applications should not need refresh-on-401 logic — but that only holds if
requests go through the SDK's client. Ours do not, so the SDK never sees a 401
and never reacts to one. Everything in `@api/authBridge` is a hand-rolled
replacement for the thing we opted out of.

## 2. The constraints this deployment actually has

| | |
|---|---|
| Refresh-token grant | **not enabled** |
| Access token lifetime | 1 hour |
| ID token lifetime | 1 hour (both were 15 minutes previously) |
| Renewal mechanism | `signInSilently()` — `prompt=none` in a hidden iframe |

Three consequences worth holding together:

- `tokenLifecycle.refreshToken.autoRefresh` **cannot help us.** It drives the
  refresh-token grant, which is off. Enabling the config would change nothing.
- Renewal therefore depends entirely on the iframe reading the IdP session
  cookie in a third-party context. Chrome's third-party-cookie restrictions and
  Safari's ITP are exactly what make it fail unpredictably.
- Both tokens expire **together**, so at the hour mark everything fails at once:
  the ID-token decode fails *and* every request 401s, and all of it funnels into
  one iframe attempt. If that attempt fails, so does the whole page.

**A redirect roughly every hour is unavoidable in this configuration.** It is
not a failure to recover from; it is the design.

## 3. Why the dialog was wrong, not just annoying

`signInSilently()` **never rejects** — it resolves `false` and discards the
reason. A blocked iframe, a ten-second timeout, an SDK still settling its own
callback, and a genuinely dead session all arrive as the same falsy value.

The old design treated one such value as proof, raised an app-wide modal with no
dismiss, and made the flag one-way for the page's lifetime. Two separate paths
could trip it, and **one of them involves no HTTP request at all**:

- `@api/http` — any 401 from any backend
- `@hooks/useAsgardeoSub` — a failed `getDecodedIdToken()`

The second is how a healthy session came to be declared dead with nothing in the
Network tab to show for it.

## 4. What shipped

Two changes, both narrow, both about **attribution** rather than recovery:

Naming the changes rather than their commit hashes, deliberately: these have
been rebased twice already, and a hash that no longer resolves is worse than no
hash at all.

| Change | What it does |
|---|---|
| **401 attribution** (`api/http.ts`) | A 401 is attributed before reacting. If the access token's own `exp` is still in the future, the 401 belongs to that backend — return it to the caller, attempt no renewal. Two distinct origins refusing within 60s re-opens the doubt, which covers a token revoked before it expires. |
| **Decode attribution** (`hooks/useAsgardeoSub.ts`) | Same rule for the decode path. A `getDecodedIdToken()` failure on a live ID token retries the decode instead of reaching for the session. |

`api/tokenExpiry.ts` holds both primitives. Anything unreadable — an opaque
token, a malformed one — classifies as "unknown" and falls back to the previous
behaviour, so these checks can only ever narrow when a renewal is attempted,
never widen it.

**The practical effect:** one faulty backend can no longer take down the whole
app. Before, a backend 401ing for its own reasons provoked a renewal whose
failure locked every screen, including screens that backend has nothing to do
with.

## 5. What is parked, and why

Branch **`parked/auth-redirect-model`** holds the work. It removed the verdict
layer entirely — the dialog, the failure counter, the one-way flag — and
replaced it with the SDK's own redirecting `signIn()` on a failed renewal.

It is coherent and it passed, but it is parked because **it changes auth
behaviour for every perspective and the redirect path cannot be proven in
tests** — `signIn()` is mocked throughout, so that it fires at the right moment,
that AuthGuard's return-path stash survives it, and that a user lands back where
they were are all reasoned rather than demonstrated. That wants a stage soak,
not a merge.

Two things to know before reviving it:

**It depends on both attribution changes above.** Without the `exp` checks, a wrong
verdict no longer shows a modal — it *navigates the user away*. A faulty backend
would then produce a redirect loop, which is a worse failure than the dialog it
replaces. If either of those is ever reverted, this must stay parked.

**Keep the backoff.** `cooldownFor` and the consecutive-failure counter guard
against a documented incident: a HAR taken while silent re-auth was broken
recorded 19 authorize attempts in 3m04s, 17 authorization codes minted at
Asgardeo, and zero token exchanges. Every attempt got a code and abandoned it.
With no failure threshold, the backoff is the only thing bounding that if a
redirect cannot start.

## 6. The evaluation to do next

**Enable the refresh-token grant on the Asgardeo application.** Most of this
document exists because it is off. With it:

- the SDK can renew in the background without an iframe or a redirect
- `tokenLifecycle.refreshToken.autoRefresh` becomes applicable
- renewal stops depending on third-party cookies, which is the single most
  fragile thing in the current chain
- the hourly cliff largely disappears

Open questions to settle first: is it disabled by policy or merely unset, and
what refresh-token lifetime and rotation policy would apply. This needs testing
rather than a config flip — a dead refresh token has its own failure mode, and
the app currently has no handling for one.

## 7. Known gaps still open

- **Renewal is reactive, not proactive.** `exp` is only read *after* something
  has already failed. Acting on it a minute early would turn the hourly cliff
  into a brief, predictable redirect. `classifyToken` already exists, so this is
  now a small change — it needs a caller on a timer.
- **The SDK-settling race is unhandled.** A decode immediately after the OAuth
  callback can fail because the SDK has not finished its own exchange. We
  recover incidentally (retry the decode); recognising it deliberately would be
  better. The SDK surfaces a specific error code for this.
- **`useAsgardeoUser` and `useAsgardeoGroups` decode the same token** and fail
  quietly, so they never reach the session machinery. Fine today, but they are
  one edit away from the same bug the decode attribution fixed.
- **Nothing tests that the seam holds.** The rule "check `exp` before asking for
  a renewal" lives in comments at two call sites. Nothing enforces it.

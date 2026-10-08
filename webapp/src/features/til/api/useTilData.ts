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

// Reads from til-backend.
//
// Every key is scoped to the signed-in subject, same as menu/leave — a tab
// switching accounts must not serve the previous user's canModerate answer
// from cache.

import { useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { useDebouncedValue } from "@hooks/useDebouncedValue";
import { isTilBackendConfigured, tilServiceUrls } from "@config/apiConfig";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { tilRetry } from "../util/tilError";
import { normalizeSubmission } from "./tilTypes";
import type {
  TilCustomerOption,
  TilSubmission,
  TilSubmissionsPageWire,
  TilSubmissionWire,
  TilUserInfoWire,
} from "./tilTypes";

export { isTilBackendConfigured };

function useTilQueryBasis() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const ready = isSignedIn && isTilBackendConfigured() && Boolean(userSub);
  return { getAccessToken, subState, retryIdentity, userSub, ready };
}

/** The caller's identity + whether they may delete other people's entries. */
export function useTilUserInfo() {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useTilQueryBasis();
  const query = useQuery<TilUserInfoWire>({
    queryKey: ["til-user-info", userSub],
    enabled: ready,
    queryFn: async () => authedGet<TilUserInfoWire>(tilServiceUrls.userInfo, await getAccessToken()),
    staleTime: 5 * 60 * 1000,
    retry: tilRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

// The most recent page is what the history view shows. The backend's own
// cursor is still returned (TilSubmissionsPageWire.nextCursor) so a "load
// older entries" affordance is a small, additive follow-up rather than a
// backend change — v1 keeps the client side to a single plain `useQuery`
// (matching foldIdentityError's shape) instead of `useInfiniteQuery`, since
// the feed's expected volume doesn't need it yet.
const PAGE_SIZE = 100;

/** The most recent submissions, newest first. */
export function useTilSubmissions() {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useTilQueryBasis();
  const query = useQuery<{ items: TilSubmission[]; nextCursor: string | null }>({
    queryKey: ["til-submissions", userSub],
    enabled: ready,
    queryFn: async () => {
      const page = await authedGet<TilSubmissionsPageWire>(
        `${tilServiceUrls.submissions}?limit=${PAGE_SIZE}`,
        await getAccessToken(),
      );
      return { ...page, items: page.items.map(normalizeSubmission) };
    },
    staleTime: 30 * 1000,
    refetchOnMount: true,
    retry: tilRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/** Customer-name suggestions for the "Where: Customer" autocomplete, debounced
 * so this fires at most once per pause in typing. `rawQuery` is `null` when
 * the field isn't in play at all (where !== "Customer") -- distinct from ""
 * (the field IS in play, nothing typed yet), which still fires: focusing the
 * field with nothing typed browses the first page of real customers rather
 * than waiting for the first keystroke, same "browse or type to filter"
 * pattern as a normal combobox. Returns [] (not an error state) whenever
 * til-backend's own ENTITY_SERVICE_* isn't configured — callers fall back to
 * plain free-text entry in that case, same as before this feature existed;
 * see tilServiceUrls.customersSearch's own comment. */
export function useCustomerSearch(rawQuery: string | null) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useTilQueryBasis();
  const query = useDebouncedValue(rawQuery?.trim() ?? "", 300);
  const query_enabled = ready && rawQuery !== null;
  const result = useQuery<TilCustomerOption[]>({
    queryKey: ["til-customer-search", userSub, query],
    enabled: query_enabled,
    queryFn: async () => authedGet<TilCustomerOption[]>(tilServiceUrls.customersSearch(query), await getAccessToken()),
    staleTime: 60 * 1000,
    retry: tilRetry,
  });
  return foldIdentityError(result, subState, retryIdentity);
}

/** One entry by id — the detail page a Chat "View entry" link or a feed
 * card's own link lands on. 404 surfaces as a plain query error; the page
 * reads `error.status` (see HttpError) to tell "not found" apart from any
 * other failure. */
export function useTilSubmission(id: string | undefined) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useTilQueryBasis();
  const query = useQuery<TilSubmission>({
    queryKey: ["til-submission", userSub, id],
    enabled: ready && Boolean(id),
    queryFn: async () =>
      normalizeSubmission(
        await authedGet<TilSubmissionWire>(tilServiceUrls.submission(id as string), await getAccessToken()),
      ),
    retry: tilRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

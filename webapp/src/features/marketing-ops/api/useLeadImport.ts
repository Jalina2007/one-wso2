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

// Lead import data layer: one call, the column-mapping suggestion.
//
// The raw file is read and converted in the browser; the server only sees each column's
// heading and a few sample values. Gated by the same `events` capability as My Submissions
// (the backend mounts the route under the Events guard). The member statuses and their
// columns come from useEvents (useMemberStatuses, useFieldDefs), the same configuration My
// Submissions reads the uploaded workbook with.

import { useMutation } from "@tanstack/react-query";
import { authedPost, HttpError } from "@api/http";
import { describeError } from "@api/errors";
import { useAccessToken } from "@hooks/useAccessToken";
import { marketingOpsServiceUrls as urls } from "@config/apiConfig";
import type { SuggestRequest, SuggestResponse } from "../events/leadImportTypes";

/** The backend's message for a refusal ("There is no member status called …"). FastAPI
 *  nests it under `detail`, which describeError does not read; the raw body is still
 *  never shown. */
export function leadImportError(err: unknown): string {
  if (err instanceof HttpError && err.responseBody) {
    try {
      const parsed = JSON.parse(err.responseBody) as { detail?: { message?: unknown } };
      const message = parsed?.detail?.message;
      if (typeof message === "string" && message.trim()) return message;
    } catch {
      // not JSON — fall through
    }
  }
  return describeError(err);
}

/** Ask for a mapping of the file's columns onto one member status's columns: exact
 *  heading matches first, then Claude for the rest. */
export function useSuggestLeadMapping() {
  const getAccessToken = useAccessToken();
  return useMutation({
    mutationFn: async (request: SuggestRequest) =>
      authedPost<SuggestResponse>(urls.eventsLeadImportSuggest, await getAccessToken(), request),
  });
}

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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import type { JSX } from "react";
import { Alert } from "@wso2/oxygen-ui";
import { useOpportunityState } from "@features/sales/cado2/quotes/api/useQuoteApi";

/**
 * D164: says so when the quote's opportunity was closed in Salesforce after it
 * was picked, before submitting, syncing or issuing stops. Nothing when it's
 * open, or while it can't be read (those actions check again anyway).
 */
export default function OpportunityClosedNotice({
  opportunityId,
  blocked,
}: {
  readonly opportunityId: string | null;
  /** What the AM can't do while it's closed, e.g. "submitted or synced to Salesforce"; null shows nothing. */
  readonly blocked: string | null;
}): JSX.Element | null {
  const state = useOpportunityState(opportunityId, blocked !== null);
  const s = state.data;
  if (!blocked || !s || (s.found && s.open)) return null;
  return (
    <Alert severity="warning" aria-label="Opportunity closed">
      {s.found ? (
        <>
          <b>This opportunity is {s.state} in Salesforce.</b> This quote can&apos;t be {blocked} while it is. Close the quote, or
          reopen the opportunity in Salesforce.
        </>
      ) : (
        <>
          <b>This opportunity is no longer in Salesforce.</b> This quote can&apos;t be {blocked}. Close the quote.
        </>
      )}
    </Alert>
  );
}

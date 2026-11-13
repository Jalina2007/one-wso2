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

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { authedGet } from "@api/http";
import { httpRetry } from "@api/errors";
import { cado2ServiceUrls } from "@config/apiConfig";
import { useCado2Basis } from "@features/sales/cado2/api/cado2Basis";
import { cado2Send } from "@features/sales/cado2/api/cado2Http";
import type { SupportPlans } from "@features/sales/cado2/quotes/api/quoteTypes";

const DOMAIN = "support-plans";

/** Admin → Support Plans (D155). */
export function useSupportPlans(): UseQueryResult<SupportPlans, Error> {
  const { getToken, ready, key } = useCado2Basis();
  return useQuery<SupportPlans, Error>({
    queryKey: key(DOMAIN),
    queryFn: async () => authedGet<SupportPlans>(cado2ServiceUrls.adminSupportPlans, await getToken()),
    enabled: ready,
    retry: httpRetry,
  });
}

/** The whole configuration, as PUT /admin/support-plans takes it. */
export interface SupportPlansInput {
  readonly enterpriseProductId: string | null;
  readonly standardProductId: string | null;
  readonly premiumProductIds: readonly string[];
}

/** Saves the whole configuration; the wizard's quote settings follow. */
export function useSaveSupportPlans() {
  const { getToken, key } = useCado2Basis();
  const queryClient = useQueryClient();
  return useMutation<SupportPlans, Error, SupportPlansInput>({
    mutationFn: async (body) => cado2Send<SupportPlans>("PUT", cado2ServiceUrls.adminSupportPlans, await getToken(), body),
    onSuccess: (saved) => {
      queryClient.setQueryData(key(DOMAIN), saved);
      void queryClient.invalidateQueries({ queryKey: key("quote-settings") });
    },
  });
}

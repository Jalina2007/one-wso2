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
import type { ProductClassificationInput, ProductClassificationItem, ProductClassifications } from "./productClassificationTypes";

const DOMAIN = "product-classifications";

/** Every classification Salesforce's active products use, and every one set up (Admin). */
export function useProductClassifications(): UseQueryResult<ProductClassifications, Error> {
  const { getToken, ready, key } = useCado2Basis();
  return useQuery<ProductClassifications, Error>({
    queryKey: key(DOMAIN),
    queryFn: async () => authedGet<ProductClassifications>(cado2ServiceUrls.productClassifications, await getToken()),
    enabled: ready,
    retry: httpRetry,
  });
}

/** Sets one classification's category and type, both at once. */
export function useSetProductClassification() {
  const { getToken, key } = useCado2Basis();
  const queryClient = useQueryClient();
  return useMutation<ProductClassificationItem, Error, ProductClassificationInput>({
    mutationFn: async ({ classification, category, recurring, deployment }) =>
      cado2Send<ProductClassificationItem>("PUT", cado2ServiceUrls.productClassification(classification), await getToken(), {
        category,
        recurring,
        deployment: deployment ?? "",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(DOMAIN) }),
  });
}

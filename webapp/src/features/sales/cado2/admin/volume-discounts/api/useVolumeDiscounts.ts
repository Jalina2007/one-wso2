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
import { authedDelete, authedGet } from "@api/http";
import { httpRetry } from "@api/errors";
import { cado2ServiceUrls } from "@config/apiConfig";
import { useCado2Basis } from "@features/sales/cado2/api/cado2Basis";
import { cado2Send } from "@features/sales/cado2/api/cado2Http";

const DOMAIN = "volume-discounts";

/** A product in a table; its name and id are Salesforce's, null when it couldn't be read. */
export interface VolumeDiscountProduct {
  readonly productCode: string;
  readonly productId: string | null;
  readonly productName: string | null;
}

/** From this quantity, this ceiling, e.g. {fromQuantity: 10, ceilingPercent: "6.44"}. */
export interface VolumeDiscountTier {
  readonly fromQuantity: number;
  readonly ceilingPercent: string;
}

/** One table of Admin → Volume Discounts (D169). */
export interface VolumeDiscountTable {
  readonly id: number;
  readonly name: string;
  readonly products: readonly VolumeDiscountProduct[];
  /** By start: a tier covers its start up to one below the next's; the last has no limit. */
  readonly tiers: readonly VolumeDiscountTier[];
  readonly updatedByEmail: string;
  readonly updatedAt: string;
}

export interface VolumeDiscounts {
  readonly tables: readonly VolumeDiscountTable[];
  /** False when Salesforce couldn't be read: products are listed by code only. */
  readonly salesforceAvailable: boolean;
}

/** A table as POST and PUT take it. */
export interface VolumeDiscountInput {
  readonly name: string;
  readonly productCodes: readonly string[];
  readonly tiers: readonly { readonly fromQuantity: number; readonly ceilingPercent: string }[];
}

/** Admin → Volume Discounts (D169). */
export function useVolumeDiscounts(): UseQueryResult<VolumeDiscounts, Error> {
  const { getToken, ready, key } = useCado2Basis();
  return useQuery<VolumeDiscounts, Error>({
    queryKey: key(DOMAIN),
    queryFn: async () => authedGet<VolumeDiscounts>(cado2ServiceUrls.adminVolumeDiscounts, await getToken()),
    enabled: ready,
    retry: httpRetry,
  });
}

/** Adds a table (id null) or replaces one. */
export function useSaveVolumeDiscount() {
  const { getToken, key } = useCado2Basis();
  const queryClient = useQueryClient();
  return useMutation<VolumeDiscountTable, Error, { id: number | null; body: VolumeDiscountInput }>({
    mutationFn: async ({ id, body }) =>
      id === null
        ? cado2Send<VolumeDiscountTable>("POST", cado2ServiceUrls.adminVolumeDiscounts, await getToken(), body)
        : cado2Send<VolumeDiscountTable>("PUT", cado2ServiceUrls.adminVolumeDiscount(id), await getToken(), body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key(DOMAIN) }),
  });
}

export function useDeleteVolumeDiscount() {
  const { getToken, key } = useCado2Basis();
  const queryClient = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: async (id) => authedDelete(cado2ServiceUrls.adminVolumeDiscount(id), await getToken()),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key(DOMAIN) }),
  });
}

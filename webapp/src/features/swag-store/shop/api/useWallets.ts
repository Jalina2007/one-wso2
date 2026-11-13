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

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { authedGet } from "@api/http";
import { swagStoreServiceUrls } from "@config/apiConfig";
import { foldIdentityError } from "@hooks/useAsgardeoSub";
import { useSwagStoreBasis } from "../../api/swagStoreBasis";
import type { SwagStoreWallet } from "../../api/swagStoreTypes";
import { swagStoreRetry } from "../../util/swagStoreError";

/**
 * The caller's coin wallets, default first (GET /wallets). Balances are money,
 * so they are never served from cache: every mount asks again.
 */
export function useWallets(): UseQueryResult<readonly SwagStoreWallet[], Error> {
  const { getToken, ready, key, subState, retryIdentity } = useSwagStoreBasis();
  const query = useQuery<readonly SwagStoreWallet[], Error>({
    queryKey: key("wallets"),
    queryFn: async () => authedGet<SwagStoreWallet[]>(swagStoreServiceUrls.wallets, await getToken()),
    enabled: ready,
    staleTime: 0,
    refetchOnMount: "always",
    retry: swagStoreRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/** The wallet payments use by default: the one marked default, else the first. */
export function defaultWalletOf(wallets: readonly SwagStoreWallet[] | undefined): SwagStoreWallet | undefined {
  return wallets?.find((w) => w.defaultWallet) ?? wallets?.[0];
}

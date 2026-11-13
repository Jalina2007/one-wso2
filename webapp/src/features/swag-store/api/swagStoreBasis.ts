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

import { useCallback } from "react";
import { useAsgardeo } from "@asgardeo/react";
import { isSwagStoreBackendConfigured } from "@config/apiConfig";
import { isPreviewEnabled } from "@config/previewFeatures";
import { useAccessToken } from "@hooks/useAccessToken";
import { useAsgardeoSub } from "@hooks/useAsgardeoSub";

/** A Swag Store cache key: always `["swag-store", <subject>, …parts]`. */
export type SwagStoreKey = readonly unknown[];

/**
 * What every Swag Store query needs: the access token, whether the backend may
 * be asked yet, and cache keys scoped to the signed-in subject, so switching
 * accounts in one tab never shows the previous person's cart or wallet.
 */
export function useSwagStoreBasis() {
  const { isSignedIn } = useAsgardeo();
  const getToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const sub = subState.status === "ready" ? subState.sub : undefined;
  // The preview flag as well as the URL: with the flag off nothing of the
  // store exists, and nothing may call its backend.
  const ready = isSignedIn && isPreviewEnabled("swagStore") && isSwagStoreBackendConfigured() && Boolean(sub);
  const key = useCallback((...parts: readonly unknown[]): SwagStoreKey => ["swag-store", sub, ...parts], [sub]);
  return { getToken, sub, subState, retryIdentity, ready, key };
}

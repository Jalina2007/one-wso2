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

// Wire types of the ONE_WSO2_SWAG_STORE_BACKEND_URL backend, as its OpenAPI
// document describes them. Coin amounts are whole O2C, except wallet balances,
// which arrive as decimal strings so no precision is lost.

/** A store role. A shopper holds none. */
export type SwagStoreRole = "catalog_manager" | "fulfilment_ops";

/** GET /users/me. */
export interface SwagStoreMe {
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly roles: readonly SwagStoreRole[];
  /** The HR employee status, or null when HR could not be asked. */
  readonly employeeStatus: string | null;
}

/** One coin wallet of the caller, from GET /wallets. */
export interface SwagStoreWallet {
  readonly walletAddress: string;
  /** A decimal string such as "202.50". */
  readonly balance: string;
  /** The wallet payments use unless the shopper picks another. Listed first. */
  readonly defaultWallet: boolean;
}

/** GET /cart/summary. */
export interface SwagStoreCartSummary {
  /** Units in the cart, summed over every line. */
  readonly itemCount: number;
}

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

// Every CadO2 URL, built in one place. Nested under the Sales perspective's own
// path: findPerspectiveByPath matches with `pathname.startsWith`, so anything
// under /sales keeps the Sales rail around CadO2's screens.

export const CADO2_PATH = "/sales/cado2";

/** Admin sections, each its own route under /admin. */
export type Cado2AdminSection =
  | "approval-matrix"
  | "approval-slas"
  | "legal-entities"
  | "currencies"
  | "product-categories";

/** The quote page's tabs, each its own route. */
export type Cado2QuoteTab = "quote" | "approvals" | "versions" | "history";

export const cado2Paths = {
  home: CADO2_PATH,
  quotes: `${CADO2_PATH}/quotes`,
  newQuote: `${CADO2_PATH}/quotes/new`,
  /**
   * A quote's page, on one of its tabs. `fromApprovals` makes the back link
   * lead to My Approvals; it is in the URL so a shared link opens the same
   * screen.
   */
  quote: (quoteId: number, tab: Cado2QuoteTab = "quote", fromApprovals = false): string =>
    `${CADO2_PATH}/quotes/${quoteId}/${tab}${fromApprovals ? "?from=approvals" : ""}`,
  editVersion: (quoteId: number, version: number): string =>
    `${CADO2_PATH}/quotes/${quoteId}/versions/${version}/edit`,
  approvals: `${CADO2_PATH}/approvals`,
  admin: `${CADO2_PATH}/admin`,
  adminSection: (section: Cado2AdminSection): string => `${CADO2_PATH}/admin/${section}`,
} as const;

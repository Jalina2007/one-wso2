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

/** Short descriptions shown under each step's name when browsing a read-only version. */
export const STEP_HINTS = ["Customer, term & billing", "Products & yearly schedule", "Terms, addresses & contacts", "Check & submit"] as const;

/** What each wizard step is for, shown in its intro. */
export const STEP_HINTS_LONG = [
  "Who the quote is for, which WSO2 entity issues it, the term and billing.",
  "Add the products from the price book and check the yearly schedule.",
  "Payment terms, any special terms, addresses and contacts.",
  "Check everything, then submit. A submitted version is frozen.",
] as const;

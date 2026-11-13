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

import type { LineCategory } from "@features/sales/cado2/quotes/api/quoteTypes";

/** How a classification's products are deployed (D163); null when not applicable. */
export type Deployment = "ON_PREMISES" | "SAAS";

/**
 * One Salesforce product classification (Product_Classification__c, e.g.
 * "ES") as Admin → Product Classifications shows it (D152): its category on the
 * order form and whether its products recur, both null while it isn't set up;
 * and how its products are deployed (D163).
 */
export interface ProductClassificationItem {
  readonly classification: string;
  readonly category: LineCategory | null;
  readonly recurring: boolean | null;
  readonly deployment: Deployment | null;
  /** How many active Salesforce products have it. */
  readonly productCount: number;
  readonly updatedByEmail: string | null;
  readonly updatedAt: string | null;
}

/** GET /admin/product-classifications. */
/** One classification's setting, as an Admin sends it (all three). */
export interface ProductClassificationInput {
  readonly classification: string;
  readonly category: LineCategory;
  readonly recurring: boolean;
  readonly deployment: Deployment | null;
}

export interface ProductClassifications {
  readonly items: readonly ProductClassificationItem[];
  /** False when Salesforce couldn't be read: only the codes set up, no counts. */
  readonly salesforceAvailable: boolean;
  /** Active products with no classification in Salesforce: they can't be quoted. */
  readonly unclassifiedProducts: number;
}

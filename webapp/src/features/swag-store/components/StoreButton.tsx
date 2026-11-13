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

import type { JSX } from "react";
import { Link as RouterLink, matchPath, useLocation } from "react-router";
import { useAsgardeo } from "@asgardeo/react";
import { Badge, IconButton, Tooltip } from "@wso2/oxygen-ui";
import { ShoppingBagIcon } from "@wso2/oxygen-ui-icons-react";
import { isPreviewEnabled } from "@config/previewFeatures";
import { pickAccessibleText } from "@utils/contrastText";
import { useCartSummary } from "../shop/api/useCartData";
import { SWAG_STORE_PATH } from "../swagStorePaths";

const NAME = "Swag Store";

/** The badge stops counting here and shows "99+". */
const BADGE_MAX = 99;

/** The button's accessible name: the store, and the cart count when there is one. */
function accessibleName(itemCount: number): string {
  if (itemCount <= 0) return NAME;
  return `${NAME}, ${itemCount} ${itemCount === 1 ? "item" : "items"} in cart`;
}

/**
 * The top-bar shortcut to the shop, with the cart's item count as a badge.
 * Absent while the `swagStore` preview flag is off or nobody is signed in, and
 * then asks the store nothing.
 */
export default function StoreButton(): JSX.Element | null {
  const { isSignedIn } = useAsgardeo();
  if (!isSignedIn || !isPreviewEnabled("swagStore")) return null;
  return <StoreLink />;
}

/** The button itself. A count that can't be read hides the badge; the button still opens the shop. */
function StoreLink(): JSX.Element {
  const { pathname } = useLocation();
  const summary = useCartSummary();
  const itemCount = summary.isSuccess ? summary.data.itemCount : 0;
  const inStore = Boolean(matchPath({ path: SWAG_STORE_PATH, end: false }, pathname));

  return (
    <Tooltip title={NAME}>
      <IconButton
        component={RouterLink}
        to={SWAG_STORE_PATH}
        size="small"
        aria-label={accessibleName(itemCount)}
        aria-current={inStore ? "page" : undefined}
      >
        <Badge
          badgeContent={itemCount}
          max={BADGE_MAX}
          invisible={itemCount <= 0}
          // White on the orange accent fails AA, so the count takes whichever
          // of near-black or white reads on the fill, as the user avatar does.
          sx={(t) => ({
            "& .MuiBadge-badge": {
              bgcolor: t.palette.primary.main,
              color: pickAccessibleText(t.palette.primary.main),
            },
          })}
        >
          <ShoppingBagIcon size={20} aria-hidden="true" />
        </Badge>
      </IconButton>
    </Tooltip>
  );
}

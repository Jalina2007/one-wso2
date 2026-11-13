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
import { Alert, Box, Card, Skeleton, Typography } from "@wso2/oxygen-ui";
import { WalletIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { formatBalance } from "../../util/coins";
import { messageFor } from "../../util/swagStoreError";
import { defaultWalletOf, useWallets } from "../api/useWallets";

/**
 * The balance of the shopper's default wallet. Only this card blanks when the
 * wallets can't be read; the rest of the page stays.
 */
export default function WalletBalance(): JSX.Element {
  const wallets = useWallets();

  // A balance cached from an earlier visit may be out of date, so it stays
  // hidden until this visit's own read settles.
  if (wallets.isPending || (wallets.isFetching && !wallets.isFetchedAfterMount)) {
    return <Skeleton variant="rounded" width={200} height={56} aria-label="Loading your balance" />;
  }

  if (wallets.isError) {
    return (
      <ErrorNotice onRetry={() => void wallets.refetch()} retrying={wallets.isFetching}>
        Couldn&apos;t load your balance. {messageFor(wallets.error)}
      </ErrorNotice>
    );
  }

  const wallet = defaultWalletOf(wallets.data);
  if (!wallet) {
    return (
      <Alert severity="info">
        You don&apos;t have an O2C wallet yet. You can browse the store, and pay once you have one.
      </Alert>
    );
  }

  return (
    <Card
      variant="outlined"
      sx={{ display: "inline-flex", alignItems: "center", gap: 1.5, px: 2, py: 1.25, borderRadius: 1.5 }}
    >
      <Box sx={{ display: "grid", placeItems: "center", color: "text.secondary" }} aria-hidden="true">
        <WalletIcon size={20} />
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" component="p">
          Your balance
        </Typography>
        <Typography variant="subtitle1" component="p" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
          {formatBalance(wallet.balance)}
        </Typography>
      </Box>
    </Card>
  );
}

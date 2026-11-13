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

/** The coin's symbol, written after every amount. */
export const COIN_SYMBOL = "O2C";

const DECIMAL = /^(-?)(\d+)(\.\d+)?$/;

const groupThousands = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** A whole-coin amount, such as a price or a total: `formatCoins(12500)` is "12,500 O2C". */
export function formatCoins(amount: number): string {
  return `${groupThousands(String(Math.trunc(amount)))} ${COIN_SYMBOL}`;
}

/**
 * A wallet balance, which arrives as a decimal string. The digits are kept as
 * sent, so a balance is never rounded up into one the wallet cannot pay;
 * only the whole part is grouped. A value that is not a decimal is shown as it came.
 */
export function formatBalance(balance: string): string {
  const match = DECIMAL.exec(balance);
  if (!match) return `${balance} ${COIN_SYMBOL}`;
  const [, sign, whole, fraction = ""] = match;
  return `${sign}${groupThousands(whole)}${fraction} ${COIN_SYMBOL}`;
}

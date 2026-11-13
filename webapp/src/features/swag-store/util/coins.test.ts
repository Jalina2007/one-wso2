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

import { describe, expect, it } from "vitest";
import { formatBalance, formatCoins } from "./coins";

describe("formatCoins", () => {
  it("names the currency and groups thousands", () => {
    expect(formatCoins(180)).toBe("180 O2C");
    expect(formatCoins(0)).toBe("0 O2C");
    expect(formatCoins(12500)).toBe("12,500 O2C");
  });
});

describe("formatBalance", () => {
  it("keeps the backend's decimals exactly", () => {
    expect(formatBalance("202.50")).toBe("202.50 O2C");
    expect(formatBalance("40")).toBe("40 O2C");
  });

  it("never rounds a balance up", () => {
    expect(formatBalance("39.999")).toBe("39.999 O2C");
  });

  it("groups the whole part only", () => {
    expect(formatBalance("1234567.25")).toBe("1,234,567.25 O2C");
  });

  it("shows a value it cannot read as it came, rather than as a number it is not", () => {
    expect(formatBalance("n/a")).toBe("n/a O2C");
  });
});

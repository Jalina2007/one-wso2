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
import {
  promotionRequestColor,
  promotionRequestStatusLabel,
  recommendationColor,
  recommendationStatusLabel,
} from "./promotionStatus";

describe("promotionRequestStatusLabel", () => {
  it("reads a movable status as IN_PROGRESS while its cycle is still open", () => {
    expect(promotionRequestStatusLabel("FL_APPROVED", true)).toBe("IN_PROGRESS");
    expect(promotionRequestStatusLabel("SUBMITTED", true)).toBe("IN_PROGRESS");
  });

  it("leaves the raw status alone once the cycle has closed", () => {
    // The bug this pins: a closed cycle's FL_APPROVED request never moves
    // further, so it should read as final, not "in progress".
    expect(promotionRequestStatusLabel("FL_APPROVED", false)).toBe("FL_APPROVED");
  });

  it("leaves a genuinely terminal status alone even in an open cycle", () => {
    expect(promotionRequestStatusLabel("WITHDRAW", true)).toBe("WITHDRAW");
    expect(promotionRequestStatusLabel("DRAFT", true)).toBe("DRAFT");
  });
});

describe("promotionRequestColor", () => {
  it("gives every status source itself colours its own distinct colour", () => {
    // Pins source's own getApplicationColor (utils/utils.ts) mapping —
    // REMOVED and EXPIRED were the two that got missed porting the
    // if/else chain to a switch.
    expect(promotionRequestColor("REMOVED")).toBe("#DE350B");
    expect(promotionRequestColor("EXPIRED")).toBe("#727681");
    expect(promotionRequestColor("DECLINED")).toBe("#FF5630");
    expect(promotionRequestColor("APPROVED")).toBe("#76BA1B");
    expect(promotionRequestColor("REJECTED")).toBe("#FF0000");
  });

  it("falls back to the generic blue for anything else", () => {
    expect(promotionRequestColor("PROCESSING")).toBe("#0052CC");
  });
});

describe("recommendationColor", () => {
  it("matches source's own getRecommendationColor mapping", () => {
    expect(recommendationColor("DECLINED")).toBe("#FF5630");
    expect(recommendationColor("REQUESTED")).toBe("#36B37E");
    expect(recommendationColor("SUBMITTED")).toBe("#6554C0");
    expect(recommendationColor("EXPIRED")).toBe("#DE350B");
  });
});

describe("recommendationStatusLabel", () => {
  it("reads a SUBMITTED recommendation as the lead's own approval", () => {
    expect(recommendationStatusLabel("SUBMITTED")).toBe("APPROVED");
  });

  it("leaves every other status as its raw wire value", () => {
    expect(recommendationStatusLabel("REQUESTED")).toBe("REQUESTED");
    expect(recommendationStatusLabel("DECLINED")).toBe("DECLINED");
    expect(recommendationStatusLabel("EXPIRED")).toBe("EXPIRED");
  });
});

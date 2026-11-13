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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

// The view page's Products table: free-text product fields are shown exactly
// as stored, line breaks included, and its cells sit at the top of the row.

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { UmtUpdateSummary } from "../api/umtUpdates";

vi.mock("../api/useUmtGate", () => ({
  useUmtGate: () => ({
    isAuthorized: true,
    isUser: true,
    isAdmin: true,
    isProductLead: false,
    hasRole: () => true,
    isResolving: false,
    isError: false,
    retry: () => {},
  }),
}));

vi.mock("../api/useUmtUpdateActions", () => ({
  useUmtSaveIssues: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useUmtSavePublicPullRequests: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useUmtSaveTestPullRequests: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

const pendingQuery = { isPending: true, isError: false, data: undefined, error: null, refetch: () => {} };
vi.mock("../api/useUmtUpdateViewData", () => ({
  useUmtUpdateViewData: () => ({
    pullRequestAnalysis: pendingQuery,
    productAnalysis: pendingQuery,
    dependencies: pendingQuery,
    hotfixInfo: pendingQuery,
  }),
}));

vi.mock("../components/UmtUpdateAnalysisSections", () => ({
  ProductAnalysisSection: () => null,
  PullRequestAnalysisSection: () => null,
}));

vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn(), showWarning: vi.fn() }),
}));

const { default: UmtUpdateViewSections } = await import("../components/UmtUpdateViewSections");

const DESCRIPTION = "\nFixes the token refresh.\n  Also fixes logout.\n";
const INSTRUCTION = "1. Stop the server.\n2. Apply the update.";
const IGNORE_TEST_REASON = "No test covers this.\nTested by hand.";

function makeUpdate(overrides: Partial<UmtUpdateSummary> = {}): UmtUpdateSummary {
  return {
    id: 42,
    lifecycleState: "Development",
    products: [
      {
        productId: 1,
        product: { name: "wso2am", version: "4.2.0.15.full" },
        description: DESCRIPTION,
        instruction: INSTRUCTION,
        ignoreTestReason: IGNORE_TEST_REASON,
      },
    ],
    securityAdvisories: [{ securityAdvisoryName: "WSO2-2026-0001" }],
    ...overrides,
  };
}

// Matches a cell's text exactly, without the default trim and whitespace
// collapsing, so line breaks and edge whitespace are part of the match.
const exactText = { normalizer: (text: string) => text };

describe("Products table", () => {
  it("shows the description, instruction and ignore test reason as stored, line breaks kept", () => {
    render(<UmtUpdateViewSections id="42" update={makeUpdate()} />);

    for (const value of [DESCRIPTION, INSTRUCTION, IGNORE_TEST_REASON]) {
      expect(screen.getByText(value, exactText)).toHaveStyle({ whiteSpace: "pre-wrap" });
    }
  });

  it("shows N/A for a missing description but leaves an empty instruction and ignore test reason blank", () => {
    render(
      <UmtUpdateViewSections
        id="42"
        update={makeUpdate({
          products: [
            {
              productId: 1,
              product: { name: "wso2am", version: "4.2.0.15.full" },
              description: null,
              instruction: "",
              testPr: "https://github.com/wso2-support/product-apim/pull/1",
              ignoreTestReason: "",
            },
          ],
        })}
      />,
    );

    expect(screen.getAllByText("N/A")).toHaveLength(1);
  });

  it("aligns its cells to the top of the row, unlike the other tables", () => {
    render(<UmtUpdateViewSections id="42" update={makeUpdate()} />);

    expect(screen.getByText("wso2am")).toHaveStyle({ justifyContent: "flex-start" });
    expect(screen.getByText("WSO2-2026-0001")).toHaveStyle({ justifyContent: "center" });
  });
});

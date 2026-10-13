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

// The PR analysis renders in both states of the Files Analysis step: editable
// in Development, and locked above the product analysis once PRAnalyzed.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { UmtUpdateSummary } from "../../../api/umtUpdates";

const state = vi.hoisted(() => ({
  status: "COMPLETED" as string | undefined,
  proceedMutateAsync: vi.fn(async () => undefined),
}));

vi.mock("../../../api/useUmtUpdateViewData", () => ({
  useUmtPullRequestAnalysis: () => ({
    data: {
      pullRequests: [{ pr: "https://github.com/wso2/carbon/pull/1", preferredVersion: "4.9.0" }],
      additionalFileOperations: [{ file: "repository/components/dropins/a.jar", operation: "Added" }],
      bundlesInfoChanges: [
        {
          bundlesInfoPath: "repository/components/default/bundles.info",
          jarName: "a",
          jarVersion: "1.0.0",
          relativeJarPath: "../plugins/a.jar",
          changeType: "New",
        },
      ],
    },
  }),
}));

vi.mock("../../../api/useUmtPrAnalysis", () => ({
  UmtPartialProceedError: class extends Error {},
  useUmtPrAnalysisStatus: () => ({ data: state.status }),
  useUmtStartPullRequestAnalysis: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useUmtProceedFromPrAnalysis: () => ({ isPending: false, mutateAsync: state.proceedMutateAsync }),
  useUmtUploadPullRequestAnalysisFile: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn(), showWarning: vi.fn() }),
}));

vi.mock("./UmtPrAnalysisResults", () => ({
  default: () => <div>PR analysis results</div>,
}));

const { default: UmtPrAnalysisStep } = await import("./UmtPrAnalysisStep");

function renderStep(lifecycleState: string, flags: Partial<UmtUpdateSummary> = {}) {
  const update = { id: 42, lifecycleState, praStatus: state.status, ...flags } as UmtUpdateSummary;
  render(<UmtPrAnalysisStep id="42" update={update} />);
}

describe("UmtPrAnalysisStep", () => {
  beforeEach(() => {
    localStorage.clear();
    state.status = "COMPLETED";
    state.proceedMutateAsync.mockClear();
  });

  it("shows the inputs, results and Proceed in Development once the analysis is completed", () => {
    renderStep("Development");

    expect(screen.getByText("Update Type")).toBeInTheDocument();
    expect(screen.getByText("Pull Requests")).toBeInTheDocument();
    expect(screen.getByText("PR analysis results")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Proceed" })).toBeInTheDocument();
  });

  it("still shows every input in PRAnalyzed, with Analyze disabled and no Proceed", () => {
    renderStep("PRAnalyzed");

    expect(screen.getByText("Update Type")).toBeInTheDocument();
    expect(screen.getByText("Pull Requests")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add manual file" })).toBeInTheDocument();
    expect(screen.getByText("PR analysis results")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Proceed" })).not.toBeInTheDocument();
  });

  it("disables the whole section in PRAnalyzed, results included, but not in Development", () => {
    renderStep("PRAnalyzed");
    expect(screen.getByText("Update Type").closest("[inert]")).not.toBeNull();
    expect(screen.getByText("PR analysis results").closest("[inert]")).not.toBeNull();
    cleanup();

    renderStep("Development");
    expect(screen.getByText("Update Type").closest("[inert]")).toBeNull();
  });

  it("shows the analyzed PRs, manual files and bundle info in PRAnalyzed instead of local drafts", () => {
    localStorage.setItem(
      "one-wso2.umt-pr-analysis-prs.v1.42",
      JSON.stringify([{ pr: "https://github.com/wso2/carbon/pull/999", preferredVersion: "" }]),
    );
    renderStep("PRAnalyzed");

    expect(screen.getByText("https://github.com/wso2/carbon/pull/1")).toBeInTheDocument();
    expect(screen.getByText("4.9.0")).toBeInTheDocument();
    expect(screen.queryByText("https://github.com/wso2/carbon/pull/999")).not.toBeInTheDocument();
    expect(screen.getByText("repository/components/dropins/a.jar")).toBeInTheDocument();
    expect(screen.getByText("repository/components/default/bundles.info")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it.each([
    [{}, "General Update"],
    [{ isInstructionsOnly: true }, "Instructions Only Update"],
    [{ isContainerizedUpdate: true }, "Containerized Product Update"],
  ])("selects the analyzed update type in PRAnalyzed (%o)", (flags, label) => {
    renderStep("PRAnalyzed", flags);

    expect(screen.getByRole("radio", { name: label })).toBeChecked();
  });

  it("shows only the Development notice for a state past PRAnalyzed", () => {
    renderStep("ProductAnalyzed");

    expect(screen.getByText("PR Analysis can only be done in Development.")).toBeInTheDocument();
    expect(screen.queryByText("Update Type")).not.toBeInTheDocument();
  });

  it("proceeds an Instructions Only update straight away, without Analyze, results or the files warning", () => {
    renderStep("Development");

    fireEvent.click(screen.getByLabelText("Instructions Only Update"));

    expect(screen.queryByRole("button", { name: "Analyze" })).toBeNull();
    expect(screen.queryByText("PR analysis results")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Proceed" }));

    expect(screen.queryByText("Added and Modified Files")).toBeNull();
    expect(state.proceedMutateAsync).toHaveBeenCalledWith({ isInstructionsOnly: true });
  });

  it("shows no Analyze, Proceed or results for an Instructions Only update in PRAnalyzed", () => {
    renderStep("PRAnalyzed", { isInstructionsOnly: true });

    expect(screen.queryByRole("button", { name: "Analyze" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Proceed" })).toBeNull();
    expect(screen.queryByText("PR analysis results")).toBeNull();
  });
});

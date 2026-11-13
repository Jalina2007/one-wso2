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

// A run that is still converting: a static note (no polling) and a Refresh button.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { LeadImportDetail } from "../leadImportTypes";

const refetch = vi.fn();
let detail: LeadImportDetail;
let isFetching = false;
vi.mock("../../api/useLeadImport", () => ({
  useLeadImportRun: () => ({ data: detail, isError: false, isFetching, refetch }),
  useLeadImportOptions: () => ({ data: undefined }),
  useFinishLeadImport: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDownloadLeadFile: () => ({ mutateAsync: vi.fn() }),
  useApplyLeadChanges: () => ({ mutateAsync: vi.fn() }),
  useLeadImportRebuilding: () => false,
  useLeadImportSheet: () => ({ data: undefined }),
  leadImportError: (e: Error) => e.message,
}));

const { default: LeadImportRun } = await import("./LeadImportRun");

function converting(): LeadImportDetail {
  return {
    run: {
      id: "run-1",
      status: "processing",
      source_name: "Summit - Booth.csv",
      event_name: null,
      created_at: "2026-11-06T08:00:00+00:00",
      ready_at: null,
      finished_at: null,
      expires_at: null,
      counts: null,
      rows_per_tab: null,
      pending_count: 0,
      warnings_count: 0,
      error: null,
      files: { workbook: null, rejects: null, warnings: null, changes: null },
      can_edit: false,
    },
    result: null,
    changes: [],
    user_edits: [],
  };
}

describe("a run that is still converting", () => {
  beforeEach(() => {
    refetch.mockReset();
    isFetching = false;
    detail = converting();
  });

  it("says that an email will be sent, and refreshes on request", () => {
    render(<LeadImportRun id="run-1" onBack={vi.fn()} />);
    expect(screen.getByText("Still converting. An email will be sent when it's ready.")).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("disables Refresh while a refresh is in progress", () => {
    isFetching = true;
    render(<LeadImportRun id="run-1" onBack={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Refresh" }).hasAttribute("disabled")).toBe(true);
  });
});

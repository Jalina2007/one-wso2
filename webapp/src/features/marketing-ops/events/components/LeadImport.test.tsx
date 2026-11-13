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

// The upload says an email will come, and stays on the list (nothing polls). Recently
// converted: deleting a run asks first, then removes it; a run that is still converting
// can't be opened or deleted.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { LeadImportRun } from "../leadImportTypes";

const remove = vi.fn();
const upload = vi.fn();
let runs: LeadImportRun[] = [];
let options: { claude_configured: boolean } | undefined;
vi.mock("../../api/useLeadImport", () => ({
  useLeadImportOptions: () => ({ data: options }),
  useLeadImportRuns: () => ({
    data: runs,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useUploadLeadFile: () => ({ mutateAsync: upload, isPending: false }),
  useDownloadLeadFile: () => ({ mutateAsync: vi.fn() }),
  useDeleteLeadImport: () => ({ mutateAsync: remove, isPending: false }),
  leadImportError: (e: Error) => e.message,
}));

const { default: LeadImport } = await import("./LeadImport");

function run(id: string, overrides: Partial<LeadImportRun> = {}): LeadImportRun {
  return {
    id,
    status: "ready",
    source_name: `${id}.xlsx`,
    event_name: null,
    created_at: "2026-11-06T08:00:00+00:00",
    ready_at: "2026-11-06T08:01:00+00:00",
    finished_at: null,
    expires_at: "2099-01-01T00:00:00+00:00",
    counts: null,
    rows_per_tab: null,
    pending_count: 0,
    warnings_count: 0,
    error: null,
    files: { workbook: null, rejects: null, warnings: null, changes: null },
    can_edit: true,
    ...overrides,
  };
}

describe("choosing the sheet type", () => {
  beforeEach(() => {
    runs = [];
    options = undefined;
  });

  function chooseFile(container: HTMLElement, name: string) {
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["email\n"], name)] } });
  }

  function chooseType(label: string) {
    fireEvent.mouseDown(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: label }));
  }

  const convertButton = () => screen.getByRole("button", { name: "Convert to List Import Template" });

  it("needs a sheet type before converting", () => {
    const { container } = render(<LeadImport onOpen={vi.fn()} />);
    chooseFile(container, "Summit - Booth.csv");
    expect(convertButton().hasAttribute("disabled")).toBe(true);
    chooseType("Booth Scan");
    expect(convertButton().hasAttribute("disabled")).toBe(false);
  });

  it("offers no upload when the server cannot convert files", () => {
    options = { claude_configured: false };
    const { container } = render(<LeadImport onOpen={vi.fn()} />);
    chooseFile(container, "Summit - Booth.csv");
    chooseType("Booth Scan");
    expect(screen.getByText(/isn't available on this server/)).toBeTruthy();
    expect(convertButton().hasAttribute("disabled")).toBe(true);
  });

  it("is quiet when the file name matches the sheet type", () => {
    const { container } = render(<LeadImport onOpen={vi.fn()} />);
    chooseFile(container, "Summit - Session.csv");
    chooseType("Session Attendee");
    expect(screen.queryByText(/naming convention|but you chose/)).toBeNull();
  });

  it("uploads the file with the chosen sheet type, then says an email will come", async () => {
    upload.mockReset().mockResolvedValue({ id: "run-1" });
    const onOpen = vi.fn();
    const { container } = render(<LeadImport onOpen={onOpen} />);
    chooseFile(container, "Summit - Booth.csv");
    chooseType("Booth Scan");
    await act(async () => {
      fireEvent.click(convertButton());
    });
    expect(upload).toHaveBeenCalledWith({ file: expect.any(File), sheetType: "booth" });
    expect(screen.getByText(/An email will be sent when it's ready/)).toBeTruthy();
    expect(screen.getByText("Summit - Booth.csv")).toBeTruthy();
    // The page stays on the list: there is nothing to open until the run is ready.
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("warns, without blocking, when the file name says another type", () => {
    const { container } = render(<LeadImport onOpen={vi.fn()} />);
    chooseFile(container, "Summit - Attendees.csv");
    chooseType("Booth Scan");
    expect(screen.getByText(/but you chose Booth Scan/)).toBeTruthy();
    expect(convertButton().hasAttribute("disabled")).toBe(false);
  });
});

describe("deleting a recent conversion", () => {
  beforeEach(() => {
    remove.mockReset().mockResolvedValue(undefined);
    runs = [run("summit"), run("webinar", { status: "processing", ready_at: null, expires_at: null })];
  });

  it("asks before deleting, then deletes that run", async () => {
    render(<LeadImport onOpen={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Delete summit/ }));
    expect(screen.getByText("Delete this conversion?")).toBeTruthy();
    expect(remove).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    });
    expect(remove).toHaveBeenCalledWith("summit");
  });

  it("does nothing when the question is cancelled", () => {
    render(<LeadImport onOpen={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Delete summit/ }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(remove).not.toHaveBeenCalled();
  });

  it("can't open or delete a run that is still converting", () => {
    render(<LeadImport onOpen={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Delete webinar/ }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Converting. An email will be sent when it's ready.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^webinar\.xlsx/ })).toBeNull();
    expect(screen.getByRole("button", { name: /^summit\.xlsx/ })).toBeTruthy();
  });

  it("shows the server's reason when deleting fails", async () => {
    remove.mockRejectedValue(new Error("This file is still converting."));
    render(<LeadImport onOpen={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Delete summit/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    });
    expect(screen.getByText("This file is still converting.")).toBeTruthy();
  });
});

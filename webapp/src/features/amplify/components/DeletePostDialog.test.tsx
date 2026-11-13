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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Campaign } from "../api/amplifyTypes";

const mutate = vi.fn();
const showError = vi.fn();
const showSuccess = vi.fn();
vi.mock("../api/useAmplifyMutations", () => ({ useArchiveCampaign: () => ({ mutate, isPending: false }) }));
vi.mock("@context/notifications/NotificationsContext", () => ({ useNotifications: () => ({ showError, showSuccess }) }));

import DeletePostDialog from "./DeletePostDialog";

const campaign = { id: "c-1", title: "Big launch" } as unknown as Campaign;
const go = () => screen.getByRole("button", { name: "Go" });
const type = (value: string) =>
  fireEvent.change(screen.getByPlaceholderText("delete"), { target: { value } });

describe("DeletePostDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("names the post and explains the step", () => {
    render(<DeletePostDialog campaign={campaign} onCancel={vi.fn()} onDeleted={vi.fn()} />);
    expect(screen.getByText("Please confirm delete of: Big launch")).toBeTruthy();
    expect(screen.getByText("Type delete and click the go button")).toBeTruthy();
  });

  it("keeps Go disabled until the word matches", () => {
    render(<DeletePostDialog campaign={campaign} onCancel={vi.fn()} onDeleted={vi.fn()} />);
    expect((go() as HTMLButtonElement).disabled).toBe(true);
    type("del");
    expect((go() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(go());
    expect(mutate).not.toHaveBeenCalled();
  });

  it("accepts the word in any case, trimmed, and archives the post", () => {
    const onDeleted = vi.fn();
    mutate.mockImplementation((_v, opts) => opts.onSuccess());
    render(<DeletePostDialog campaign={campaign} onCancel={vi.fn()} onDeleted={onDeleted} />);
    type("  DeLeTe ");
    fireEvent.click(go());
    expect(mutate.mock.calls[0][0]).toEqual({ id: "c-1" });
    expect(showSuccess).toHaveBeenCalledWith("Post deleted");
    expect(onDeleted).toHaveBeenCalled();
  });

  it("submits with the Enter key once the word matches", async () => {
    const onDeleted = vi.fn();
    mutate.mockImplementation((_v, opts) => opts.onSuccess());
    render(<DeletePostDialog campaign={campaign} onCancel={vi.fn()} onDeleted={onDeleted} />);
    await userEvent.type(screen.getByPlaceholderText("delete"), "delete{Enter}");
    expect(mutate.mock.calls[0][0]).toEqual({ id: "c-1" });
    expect(onDeleted).toHaveBeenCalled();
  });

  it("does not submit with Enter before the word matches", async () => {
    render(<DeletePostDialog campaign={campaign} onCancel={vi.fn()} onDeleted={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText("delete"), "del{Enter}");
    expect(mutate).not.toHaveBeenCalled();
  });

  it("shows the error and stays open when the delete fails", () => {
    const onDeleted = vi.fn();
    mutate.mockImplementation((_v, opts) => opts.onError(new Error("boom")));
    render(<DeletePostDialog campaign={campaign} onCancel={vi.fn()} onDeleted={onDeleted} />);
    type("delete");
    fireEvent.click(go());
    expect(showError).toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("Cancel closes without deleting", () => {
    const onCancel = vi.fn();
    render(<DeletePostDialog campaign={campaign} onCancel={onCancel} onDeleted={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
  });
});

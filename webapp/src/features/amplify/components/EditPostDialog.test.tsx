// Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
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
import type { Campaign } from "../api/amplifyTypes";

const mutate = vi.fn();
const archive = vi.fn();
vi.mock("../api/useAmplifyMutations", () => ({
  useEditCampaign: () => ({ mutate, isPending: false }),
  useArchiveCampaign: () => ({ mutate: archive, isPending: false }),
}));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showError: vi.fn(), showSuccess: vi.fn() }),
}));
vi.mock("./CategoryPicker", () => ({ default: () => <div /> }));

import EditPostDialog from "./EditPostDialog";

const campaign = {
  id: "c-1",
  resourceUrn: "urn:li:share:7123",
  resourceUrl: "https://www.linkedin.com/feed/update/urn:li:share:7123/",
  title: "Hello",
  summary: "",
  imageUrl: null,
  categoryCode: "PRODUCT",
  isPriority: false,
  closesAt: "2026-12-01T00:00:00Z",
  version: 3,
} as unknown as Campaign;

const patchOf = () => mutate.mock.calls[0][0].patch;
const save = () => fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));

describe("EditPostDialog post URL", () => {
  beforeEach(() => mutate.mockClear());

  it("starts with the stored link and sends nothing for it when unchanged", () => {
    render(<EditPostDialog campaign={campaign} onClose={vi.fn()} />);
    expect((screen.getByLabelText(/Post URL/) as HTMLInputElement).value).toBe(campaign.resourceUrl);
    save();
    expect(patchOf().resourceUrl).toBeUndefined();
  });

  it("sends the edited link trimmed", () => {
    render(<EditPostDialog campaign={campaign} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Post URL/), { target: { value: "  https://www.linkedin.com/posts/x  " } });
    save();
    expect(patchOf().resourceUrl).toBe("https://www.linkedin.com/posts/x");
  });

  it("sends a blank string to clear the link", () => {
    render(<EditPostDialog campaign={campaign} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Post URL/), { target: { value: "" } });
    save();
    expect(patchOf().resourceUrl).toBe("");
  });
});

describe("EditPostDialog delete", () => {
  beforeEach(() => archive.mockReset());

  const openConfirm = (onClose = vi.fn()) => {
    render(<EditPostDialog campaign={campaign} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    return onClose;
  };

  it("opens the delete confirmation from the footer Delete button", () => {
    render(<EditPostDialog campaign={campaign} onClose={vi.fn()} />);
    expect(screen.queryByText(/Please confirm delete of/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("Please confirm delete of: Hello")).toBeTruthy();
  });

  it("Cancel hides the confirmation and leaves Update post open", () => {
    const onClose = openConfirm();
    fireEvent.click(screen.getAllByRole("button", { name: "Cancel" }).at(-1)!);
    expect(screen.queryByText(/Please confirm delete of/)).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes Update post after a successful delete", () => {
    archive.mockImplementation((_v, opts) => opts?.onSuccess());
    const onClose = openConfirm();
    fireEvent.change(screen.getByPlaceholderText("delete"), { target: { value: "delete" } });
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(archive.mock.calls[0][0]).toEqual({ id: "c-1" });
    expect(onClose).toHaveBeenCalled();
  });
});

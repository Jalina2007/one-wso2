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

const mutate = vi.fn();
const showSuccess = vi.fn();
vi.mock("../api/useAmplifyMutations", () => ({ useRequestShare: () => ({ mutate, isPending: false }) }));
vi.mock("../api/useAmplifyData", () => ({
  useAmplifyCategories: () => ({ data: [{ code: "PRODUCT", label: "Product" }] }),
  useAmplifyConfig: () => ({ linkedinOrgUrn: "urn:li:organization:1", privacyNoticeUrl: "https://example.test/privacy", campaignLinkOrigins: ["https://www.linkedin.com", "https://linkedin.com"] }),
}));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showError: vi.fn(), showSuccess }),
}));

import ShareDialog, { SHARE_QUEUED_MESSAGE } from "./ShareDialog";
import type { Campaign } from "../api/amplifyTypes";

describe("ShareDialog", () => {
  const campaign = {
    id: "c-1",
    title: "WSO2 Integrator 5.0 is here",
    resourceUrn: "urn:li:share:1",
    opensAt: "2026-10-18T00:00:00Z",
    categoryCode: "PRODUCT",
    isPriority: true,
  } as Campaign;
  beforeEach(() => {
    mutate.mockReset();
    showSuccess.mockClear();
  });

  it("asks for a REPOST of the post, not a new post that links to it", () => {
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Amplify" }));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toEqual({ campaignId: "c-1", kind: "REPOST" });
  });

  const thoughts = () => screen.getByLabelText(/Add your thoughts/);

  it("shows the post as its card (title, priority and category chips) above the thoughts box", () => {
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    expect(screen.getByText("Amplify this post")).toBeTruthy();
    expect(screen.getByText("WSO2 Integrator 5.0 is here")).toBeTruthy();
    expect(screen.getByText("Priority")).toBeTruthy();
    expect(screen.getByText("Product")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Amplify" })).toHaveLength(1);
  });

  it("sends REPOST_COMMENTARY with the trimmed text when the employee adds thoughts", () => {
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    fireEvent.change(thoughts(), { target: { value: "  Proud of this team  " } });
    fireEvent.click(screen.getByRole("button", { name: "Amplify" }));
    expect(mutate.mock.calls[0][0]).toEqual({
      campaignId: "c-1",
      kind: "REPOST_COMMENTARY",
      commentary: "Proud of this team",
    });
  });

  it("stays a plain REPOST when the thoughts are only whitespace", () => {
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    fireEvent.change(thoughts(), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Amplify" }));
    expect(mutate.mock.calls[0][0]).toEqual({ campaignId: "c-1", kind: "REPOST" });
  });

  it("says the share is queued and may take a while, since shares go out one at a time", () => {
    mutate.mockImplementation((_body, opts: { onSuccess: () => void }) => opts.onSuccess());
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Amplify" }));
    expect(showSuccess).toHaveBeenCalledWith(SHARE_QUEUED_MESSAGE);
    expect(SHARE_QUEUED_MESSAGE).toMatch(/one at a time/);
  });

  it("caps the text at the API limit", () => {
    render(<ShareDialog campaign={campaign} onClose={() => {}} />);
    expect(thoughts().getAttribute("maxlength")).toBe("3000");
  });
});

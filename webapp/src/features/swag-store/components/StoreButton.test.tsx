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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";

const state = vi.hoisted(() => ({ signedIn: true, configured: true }));
const http = vi.hoisted(() => ({ authedGet: vi.fn() }));

vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: state.signedIn }) }));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "shopper" }, retry: () => {} }),
  foldIdentityError: (query: unknown) => query,
}));
vi.mock("@config/apiConfig", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@config/apiConfig")>()),
  isSwagStoreBackendConfigured: () => state.configured,
}));
vi.mock("@api/http", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@api/http")>()),
  authedGet: http.authedGet,
}));

import { HttpError } from "@api/http";
import StoreButton from "./StoreButton";

const originalConfig = window.config;

function setFlag(on: boolean) {
  window.config = {
    ...(originalConfig ?? {}),
    ONE_WSO2_PREVIEW_FEATURES: on ? { swagStore: true } : {},
  } as Window["config"];
}

function renderAt(path = "/me") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <StoreButton />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  state.signedIn = true;
  state.configured = true;
  setFlag(true);
  http.authedGet.mockReset();
  http.authedGet.mockResolvedValue({ itemCount: 0 });
});

afterEach(() => {
  window.config = originalConfig;
});

describe("the Swag Store top-bar button", () => {
  it("is absent while the preview flag is off, and asks nothing", () => {
    setFlag(false);
    renderAt();
    expect(screen.queryByRole("link", { name: /Swag Store/ })).toBeNull();
    expect(http.authedGet).not.toHaveBeenCalled();
  });

  it("is absent for someone who isn't signed in", () => {
    state.signedIn = false;
    renderAt();
    expect(screen.queryByRole("link", { name: /Swag Store/ })).toBeNull();
  });

  it("opens the shop", () => {
    renderAt();
    expect(screen.getByRole("link", { name: "Swag Store" })).toHaveAttribute("href", "/store");
  });

  it("still opens the shop when the backend isn't connected, but asks it nothing", () => {
    state.configured = false;
    renderAt();
    expect(screen.getByRole("link", { name: "Swag Store" })).toBeInTheDocument();
    expect(http.authedGet).not.toHaveBeenCalled();
  });

  it("puts the cart count in its accessible name", async () => {
    http.authedGet.mockResolvedValue({ itemCount: 3 });
    renderAt();
    expect(await screen.findByRole("link", { name: "Swag Store, 3 items in cart" })).toBeInTheDocument();
    expect(http.authedGet).toHaveBeenCalledWith("/cart/summary", "token");
  });

  it("says one item, not one items", async () => {
    http.authedGet.mockResolvedValue({ itemCount: 1 });
    renderAt();
    expect(await screen.findByRole("link", { name: "Swag Store, 1 item in cart" })).toBeInTheDocument();
  });

  it("hides the badge when the count can't be read, and keeps working", async () => {
    http.authedGet.mockRejectedValue(new HttpError("/cart/summary", 503, "{}"));
    renderAt();
    await waitFor(() => expect(http.authedGet).toHaveBeenCalled());
    expect(screen.getByRole("link", { name: "Swag Store" })).toHaveAttribute("href", "/store");
  });

  it("marks itself current on the store's pages only", () => {
    const { unmount } = renderAt("/store/p/hoodie");
    expect(screen.getByRole("link", { name: /Swag Store/ })).toHaveAttribute("aria-current", "page");
    unmount();
    renderAt("/storefront");
    expect(screen.getByRole("link", { name: /Swag Store/ })).not.toHaveAttribute("aria-current");
  });
});

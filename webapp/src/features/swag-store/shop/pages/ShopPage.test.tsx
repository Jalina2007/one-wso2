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
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { wallet } from "../../testing/fixtures";

const http = vi.hoisted(() => ({ authedGet: vi.fn() }));

vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "shopper" }, retry: () => {} }),
  foldIdentityError: (query: unknown) => query,
}));
vi.mock("@config/apiConfig", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@config/apiConfig")>()),
  isSwagStoreBackendConfigured: () => true,
}));
vi.mock("@api/http", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@api/http")>()),
  authedGet: http.authedGet,
}));

import { HttpError } from "@api/http";
import ShopPage from "./ShopPage";

const originalConfig = window.config;

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/store"]}>
        <ShopPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.config = { ...(originalConfig ?? {}), ONE_WSO2_PREVIEW_FEATURES: { swagStore: true } } as Window["config"];
  http.authedGet.mockReset();
});

afterEach(() => {
  window.config = originalConfig;
});

describe("the Shop page", () => {
  it("has one h1 naming the store and the browser tab", () => {
    http.authedGet.mockResolvedValue([wallet()]);
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Swag Store" })).toBeInTheDocument();
    expect(document.title).toMatch(/^Swag Store/);
  });

  it("shows the default wallet's balance with the backend's decimals", async () => {
    http.authedGet.mockResolvedValue([
      wallet({ walletAddress: "0xA", balance: "12.00", defaultWallet: false }),
      wallet({ walletAddress: "0xB", balance: "202.50", defaultWallet: true }),
    ]);
    renderPage();
    expect(await screen.findByText("202.50 O2C")).toBeInTheDocument();
    expect(http.authedGet).toHaveBeenCalledWith("/wallets", "token");
  });

  it("says so when there is no wallet, rather than showing a zero balance", async () => {
    http.authedGet.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText(/don't have an O2C wallet yet/)).toBeInTheDocument();
    expect(screen.queryByText(/0 O2C/)).toBeNull();
  });

  it("explains a wallet failure in the store's words, with Retry, and keeps the page", async () => {
    http.authedGet.mockRejectedValue(
      new HttpError("/wallets", 503, JSON.stringify({ message: "upstream", errorCode: "coins_unavailable" })),
    );
    renderPage();
    expect(await screen.findByText(/Your wallets can't be reached right now/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Swag Store" })).toBeInTheDocument();
  });
});

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
import { HttpError } from "@api/http";
import { me } from "../testing/fixtures";

// NothingHere comes from PerspectiveLanding, whose visibility hook pulls
// @asgardeo/browser into the module graph; stubbed as the other shell tests do.
vi.mock("@components/side-rail/usePerspectiveVisibility", () => ({
  usePerspectiveVisibility: () => ({
    resolveVisible: () => true,
    isResolving: false,
    visibleLeaves: [],
    isError: false,
    retry: () => {},
  }),
}));

const state = vi.hoisted(() => ({
  configured: true,
  me: { data: undefined as unknown, isPending: false, isLoading: false, isError: false, error: null as unknown },
}));
const refetch = vi.fn();
vi.mock("@config/apiConfig", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@config/apiConfig")>()),
  isSwagStoreBackendConfigured: () => state.configured,
}));
vi.mock("../api/useSwagStoreUserInfo", () => ({
  useSwagStoreUserInfo: () => ({ ...state.me, refetch }),
}));
// The page has its own test; here it only needs to say it rendered.
vi.mock("../shop/pages/ShopPage", () => ({ default: () => <h1>Shop page</h1> }));

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, useLocation } from "react-router";
import { swagStoreShopRoutes } from "../routes";

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function open(at: string) {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <Where />
      <Routes>{swagStoreShopRoutes}</Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  state.configured = true;
  state.me = { data: me(), isPending: false, isLoading: false, isError: false, error: null };
  refetch.mockClear();
});

describe("the Swag Store access ladder", () => {
  it("names the key to set when the backend isn't configured", () => {
    state.configured = false;
    open("/store");
    expect(screen.getByRole("heading", { level: 1, name: "Swag Store" })).toBeInTheDocument();
    expect(screen.getByText(/isn.t connected yet/)).toBeInTheDocument();
    expect(screen.getByText("ONE_WSO2_SWAG_STORE_BACKEND_URL")).toBeInTheDocument();
    expect(screen.queryByText("Shop page")).toBeNull();
  });

  it("holds the page, and redirects nothing, while access is being checked", () => {
    state.me = { ...state.me, data: undefined, isPending: true };
    open("/store");
    expect(screen.getByText("Checking your Swag Store access…")).toBeInTheDocument();
    expect(screen.getByTestId("where").textContent).toBe("/store");
  });

  it("offers Retry when the check itself failed, rather than claiming no access", () => {
    state.me = { ...state.me, data: undefined, isError: true, error: new HttpError("/users/me", 503, "{}") };
    open("/store");
    expect(screen.getByText(/Couldn't check your Swag Store access\./)).toBeInTheDocument();
    screen.getByRole("button", { name: "Retry" }).click();
    expect(refetch).toHaveBeenCalled();
    expect(screen.queryByText("Nothing here for you yet")).toBeNull();
  });

  it("treats a gateway 403 with no store code as a failure, not a denial", () => {
    state.me = { ...state.me, data: undefined, isError: true, error: new HttpError("/users/me", 403, "Forbidden") };
    open("/store");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows the shared no-access card to someone outside WSO2", () => {
    const denial = new HttpError("/users/me", 403, JSON.stringify({ message: "m", errorCode: "not_wso2" }));
    state.me = { ...state.me, data: undefined, isError: true, error: denial };
    open("/store");
    expect(screen.getByText("Nothing here for you yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("renders the shop once allowed", async () => {
    open("/store");
    expect(await screen.findByRole("heading", { name: "Shop page" })).toBeInTheDocument();
  });
});

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
import { ShieldIcon } from "@wso2/oxygen-ui-icons-react";
import type { PerspectiveDef, PerspectiveSection } from "@constants/perspectives";
import type { PerspectiveVisibility } from "@components/side-rail/usePerspectiveVisibility";

// Both hooks are stubbed with factories rather than provided for real. That is
// not only convenience: the real visibility hook pulls @asgardeo/browser into
// this file's module graph, and that package's `buffer` directory import does
// not resolve under vitest's ESM loader — the same failure
// features/tour/tourTargets.test.tsx hits. A factory mock keeps the real module
// from ever being evaluated.
const visibility: { current: PerspectiveVisibility } = {
  current: { resolveVisible: () => true, isResolving: false, visibleLeaves: [], isError: false, retry: () => {} },
};
const perspective: { current: PerspectiveDef } = {
  current: { key: "security", label: "Security and Compliance", icon: ShieldIcon, access: true, path: "/security" },
};

vi.mock("@components/side-rail/usePerspectiveVisibility", () => ({
  usePerspectiveVisibility: () => visibility.current,
}));
vi.mock("@context/perspective/PerspectiveContext", () => ({
  useActivePerspective: () => perspective.current,
}));

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import PerspectiveLanding from "./PerspectiveLanding";

function UrlProbe() {
  const { pathname, state } = useLocation();
  return (
    <>
      <div data-testid="url">{pathname}</div>
      <div data-testid="from">
        {(state as { fromPerspective?: string } | null)?.fromPerspective ?? "none"}
      </div>
    </>
  );
}

function renderLanding() {
  return render(
    <MemoryRouter initialEntries={["/security"]}>
      <UrlProbe />
      <Routes>
        <Route path="/security" element={<PerspectiveLanding />} />
        <Route path="*" element={<div>elsewhere</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const leaf = (id: string, path: string): PerspectiveSection => ({ id, label: id, path });

beforeEach(() => {
  visibility.current = {
    resolveVisible: () => true,
    isResolving: false,
    visibleLeaves: [],
    isError: false,
    retry: () => {},
  };
  perspective.current = {
    key: "security",
    label: "Security and Compliance",
    icon: ShieldIcon,
    access: true,
    path: "/security",
  };
});

describe("a perspective landing that forwards to the first item", () => {
  it("opens the first item someone can see", () => {
    visibility.current.visibleLeaves = [
      leaf("risk-dashboard", "/security/risk/dashboard"),
      leaf("risk-registers", "/security/risk/registers"),
    ];
    renderLanding();
    expect(screen.getByTestId("url")).toHaveTextContent("/security/risk/dashboard");
  });

  // Some destinations sit outside their perspective's path prefix — Legal and
  // Finance both forward into the shared /due-diligence/* routes — and the rail
  // reads the URL first. Without this the perspective survives only by the
  // sessionStorage memory an effect happened to write before we left.
  it("carries the perspective through the redirect", () => {
    visibility.current.visibleLeaves = [leaf("dd-partners", "/due-diligence/partners")];
    renderLanding();
    expect(screen.getByTestId("from")).toHaveTextContent("security");
  });

  // THE bug this guards. Every gate fails closed while it answers, so the
  // first visible item read mid-flight is either the wrong one or absent —
  // redirecting on it lands people on a screen they did not ask for, or
  // refuses one they can open.
  it("waits rather than redirecting while the gates are still answering", () => {
    visibility.current = {
      ...visibility.current,
      isResolving: true,
      visibleLeaves: [leaf("risk-registers", "/security/risk/registers")],
    };
    renderLanding();
    expect(screen.getByTestId("url")).toHaveTextContent("/security");
    expect(screen.getByText(/Opening Security and Compliance/)).toBeInTheDocument();
  });

  it("says nothing is open to you when nothing is", () => {
    renderLanding();
    expect(screen.getByTestId("url")).toHaveTextContent("/security");
    expect(screen.getByRole("heading", { name: "Nothing here for you yet" })).toBeInTheDocument();
  });

  // A failed privileges call also leaves us with no items. Reporting that as
  // "you have no access" sends someone chasing a grant they already hold, so
  // the error is checked before the empty state.
  it("reports a failed check as a failure, not as no access", async () => {
    const retry = vi.fn();
    visibility.current = { ...visibility.current, isError: true, error: new Error("boom"), retry };
    renderLanding();
    expect(screen.queryByText("Nothing here for you yet")).not.toBeInTheDocument();
    expect(screen.getByText(/Couldn't work out what you can open/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalled();
  });

  // The same sentence for every perspective, naming only the one it is on.
  it("names the perspective and nothing else", () => {
    perspective.current = { ...perspective.current, key: "finance", label: "Finance" };
    renderLanding();
    expect(
      screen.getByText(/Finance is here, but none of it is open to you at the moment/),
    ).toBeInTheDocument();
  });
});

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
import { SAMPLE_RESPONSE } from "../testing/fixtures";

// The data hook is stubbed with a factory, so the real one (and the runtime
// config it reads at load) is never evaluated. It records the range each render
// asks for, which is how "one fetch per grid" is checked.
const itemsHook = vi.fn<(from: string, to: string) => unknown>(() => ({
  data: SAMPLE_RESPONSE,
  isSuccess: true,
  isError: false,
  isFetching: false,
  error: null,
  refetch: vi.fn(),
}));
vi.mock("../../api/useMarketingCalendar", () => ({
  useMarketingCalendarItems: (from: string, to: string) => itemsHook(from, to),
}));

import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { MARKETING_CALENDAR_PATH } from "../calendarOutlet";
import { shortDate } from "../calendarRange";
import { marketingCalendarViewRoutes } from "../routes";
import MarketingCalendarLayout from "./MarketingCalendarLayout";

function UrlProbe() {
  const { pathname, search } = useLocation();
  return <div data-testid="url">{pathname + search}</div>;
}

function renderCalendar(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path={MARKETING_CALENDAR_PATH} element={<MarketingCalendarLayout />}>
          {marketingCalendarViewRoutes}
        </Route>
      </Routes>
      <UrlProbe />
    </MemoryRouter>,
  );
  return userEvent.setup();
}

const url = () => screen.getByTestId("url").textContent;
const onGrid = (title: string) => within(screen.getByRole("grid", { name: "Month" })).queryByText(title);

const SOCIAL_POST = "[Social] Facebook: Solutions team in Nairobi";
const EMAIL = "[Email] Year-end customer thank you";
const WHITEPAPER = "[Whitepaper] Securing agent-to-API traffic";
const BLOG = "[Blog] Integrator 5.1 launch recap";

beforeEach(() => {
  itemsHook.mockClear();
});

describe("tabs", () => {
  it("offers All and one tab per category, All lit at the calendar's own path", () => {
    renderCalendar(`${MARKETING_CALENDAR_PATH}?month=2026-11`);
    const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(tabs).toEqual(["All", "Events", "Content", "Social", "Email", "Releases"]);
    expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute("aria-selected", "true");
  });

  it("keeps the month across a tab switch, and asks for the same range", async () => {
    const user = renderCalendar(`${MARKETING_CALENDAR_PATH}?month=2026-11`);
    await user.click(screen.getByRole("tab", { name: "Social" }));
    expect(url()).toBe(`${MARKETING_CALENDAR_PATH}/social?month=2026-11`);
    expect(screen.getByRole("heading", { name: "November 2026" })).toBeVisible();
    expect(onGrid(SOCIAL_POST)).not.toBeNull();
    expect(onGrid(EMAIL)).toBeNull();

    const ranges = new Set(itemsHook.mock.calls.map(([from, to]) => `${from}..${to}`));
    expect(ranges).toEqual(new Set(["2026-10-26..2026-12-06"]));
  });

  it("links every tab with the month only, dropping the other parameters", () => {
    renderCalendar(`${MARKETING_CALENDAR_PATH}/content?month=2026-11&format=Blog&bu=API&show=email`);
    expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute("href", `${MARKETING_CALENDAR_PATH}?month=2026-11`);
    expect(screen.getByRole("tab", { name: "Events" })).toHaveAttribute(
      "href",
      `${MARKETING_CALENDAR_PATH}/events?month=2026-11`,
    );
  });

  it("does not carry a filter set on Content into Events", async () => {
    const user = renderCalendar(`${MARKETING_CALENDAR_PATH}/content?month=2026-11`);
    // Content type, Format, Target persona, BU.
    await user.click(screen.getAllByRole("combobox")[3]);
    await user.click(screen.getByRole("option", { name: "Corporate" }));
    await user.keyboard("{Escape}");
    expect(url()).toBe(`${MARKETING_CALENDAR_PATH}/content?month=2026-11&bu=Corporate`);

    await user.click(screen.getByRole("tab", { name: "Events" }));
    expect(url()).toBe(`${MARKETING_CALENDAR_PATH}/events?month=2026-11`);
    expect(screen.queryByRole("button", { name: /Clear filters/ })).toBeNull();
  });
});

describe("the retired ?category=", () => {
  it("redirects to the matching tab, keeping the month", () => {
    renderCalendar(`${MARKETING_CALENDAR_PATH}?month=2026-11&category=event`);
    expect(url()).toBe(`${MARKETING_CALENDAR_PATH}/events?month=2026-11`);
    expect(screen.getByRole("tab", { name: "Events" })).toHaveAttribute("aria-selected", "true");
  });

  it("drops an unknown or `all` value and stays on All", () => {
    renderCalendar(`${MARKETING_CALENDAR_PATH}?category=all&month=2026-11`);
    expect(url()).toBe(`${MARKETING_CALENDAR_PATH}?month=2026-11`);
  });
});

describe("the All view's legend (?show=)", () => {
  it("reads the categories from the URL", () => {
    renderCalendar(`${MARKETING_CALENDAR_PATH}?month=2026-11&show=email`);
    expect(screen.getByRole("button", { name: "Email" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Social" })).toHaveAttribute("aria-pressed", "false");
    expect(onGrid(EMAIL)).not.toBeNull();
    expect(onGrid(SOCIAL_POST)).toBeNull();
  });

  it("writes a toggle back to the URL, and drops ?show= once every category is on", async () => {
    const user = renderCalendar(`${MARKETING_CALENDAR_PATH}?month=2026-11`);
    await user.click(screen.getByRole("button", { name: "Events" }));
    expect(url()).toBe(`${MARKETING_CALENDAR_PATH}?month=2026-11&show=content,social,email,release`);
    await user.click(screen.getByRole("button", { name: "Events" }));
    expect(url()).toBe(`${MARKETING_CALENDAR_PATH}?month=2026-11`);
  });

  it("keeps the last category on", async () => {
    const user = renderCalendar(`${MARKETING_CALENDAR_PATH}?month=2026-11&show=email`);
    await user.click(screen.getByRole("button", { name: "Email" }));
    expect(url()).toBe(`${MARKETING_CALENDAR_PATH}?month=2026-11&show=email`);
    expect(screen.getByRole("button", { name: "Email" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("a type tab's filters", () => {
  it("reads its filters from the URL and offers Clear filters", () => {
    renderCalendar(`${MARKETING_CALENDAR_PATH}/content?month=2026-11&format=Whitepaper`);
    expect(onGrid(WHITEPAPER)).not.toBeNull();
    expect(onGrid(BLOG)).toBeNull();
    expect(screen.getByRole("button", { name: "Clear filters (1)" })).toBeVisible();
  });

  it("writes a selection to the URL", async () => {
    const user = renderCalendar(`${MARKETING_CALENDAR_PATH}/content?month=2026-11`);
    expect(screen.queryByRole("button", { name: /Clear filters/ })).toBeNull();
    // Content type, Format, Target persona, BU.
    await user.click(screen.getAllByRole("combobox")[1]);
    await user.click(screen.getByRole("option", { name: "Blog" }));
    expect(url()).toBe(`${MARKETING_CALENDAR_PATH}/content?month=2026-11&format=Blog`);
    // A multi-select stays open, and hides the page from the a11y tree while it is.
    await user.keyboard("{Escape}");
    expect(onGrid(BLOG)).not.toBeNull();
    expect(onGrid(WHITEPAPER)).toBeNull();
  });

  it("clears only its own filters, keeping the month", async () => {
    const user = renderCalendar(`${MARKETING_CALENDAR_PATH}/content?month=2026-11&format=Blog&bu=Integration`);
    await user.click(screen.getByRole("button", { name: "Clear filters (2)" }));
    expect(url()).toBe(`${MARKETING_CALENDAR_PATH}/content?month=2026-11`);
  });

  it("names the view and the filters when nothing matches", () => {
    renderCalendar(`${MARKETING_CALENDAR_PATH}/content?month=2026-11&format=Blog&bu=API`);
    expect(screen.getByText("No content planned for November 2026 with these filters.")).toBeVisible();
  });
});

describe("the Calendar | List toggle", () => {
  const toggle = (name: "Calendar" | "List") =>
    within(screen.getByRole("group", { name: "Show as" })).getByRole("button", { name });
  const itemList = () => screen.queryByRole("region", { name: "Items by date" });
  const ranges = () => new Set(itemsHook.mock.calls.map(([from, to]) => `${from}..${to}`));

  it("starts on Calendar, with the month grid", () => {
    renderCalendar(`${MARKETING_CALENDAR_PATH}?month=2026-11`);
    expect(toggle("Calendar")).toHaveAttribute("aria-pressed", "true");
    expect(toggle("List")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("grid", { name: "Month" })).toBeVisible();
    expect(itemList()).toBeNull();
    expect(screen.queryByLabelText("From")).toBeNull();
  });

  it("switches to List: ?view=list, From and To for the month, the list, and a fetch of just that range", async () => {
    const user = renderCalendar(`${MARKETING_CALENDAR_PATH}?month=2026-11`);
    itemsHook.mockClear();
    await user.click(toggle("List"));

    expect(url()).toBe(`${MARKETING_CALENDAR_PATH}?month=2026-11&view=list`);
    expect(toggle("List")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("From")).toHaveValue("2026-11-01");
    expect(screen.getByLabelText("To")).toHaveValue("2026-11-30");
    expect(screen.queryByRole("button", { name: "Previous month" })).toBeNull();
    expect(screen.queryByRole("grid", { name: "Month" })).toBeNull();
    expect(within(itemList()!).getByText(WHITEPAPER)).toBeVisible();
    // Last updated and Refresh stay.
    expect(screen.getByRole("button", { name: "Refresh" })).toBeVisible();
    expect(ranges()).toEqual(new Set(["2026-11-01..2026-11-30"]));
  });

  it("puts both dates in the URL when one changes, and fetches that range", () => {
    renderCalendar(`${MARKETING_CALENDAR_PATH}?month=2026-11&view=list`);
    itemsHook.mockClear();
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-11-15" } });
    expect(url()).toBe(`${MARKETING_CALENDAR_PATH}?month=2026-11&view=list&from=2026-11-15&to=2026-11-30`);
    expect(ranges()).toEqual(new Set(["2026-11-15..2026-11-30"]));
  });

  it("sets aside a range that ends before it starts, says why, and lists the month", () => {
    renderCalendar(`${MARKETING_CALENDAR_PATH}?month=2026-11&view=list&from=2026-12-10&to=2026-12-01`);
    expect(screen.getByLabelText("From")).toHaveValue("2026-12-10");
    expect(screen.getByText("Must be on or after From")).toBeVisible();
    expect(ranges()).toEqual(new Set(["2026-11-01..2026-11-30"]));
    expect(itemList()).not.toBeNull();
  });

  it("shows a missing date as blank, not as the month's", () => {
    renderCalendar(`${MARKETING_CALENDAR_PATH}?month=2026-11&view=list&to=2026-11-20`);
    expect(screen.getByLabelText("From")).toHaveValue("");
    expect(screen.getByLabelText("To")).toHaveValue("2026-11-20");
    expect(screen.getByText("Enter a valid date")).toBeVisible();
    expect(ranges()).toEqual(new Set(["2026-11-01..2026-11-30"]));
  });

  it("opens the drawer from a row", async () => {
    const user = renderCalendar(`${MARKETING_CALENDAR_PATH}/content?month=2026-11&view=list`);
    await user.click(screen.getByRole("button", { name: /Securing agent-to-API traffic/ }));
    expect(screen.getByRole("heading", { name: WHITEPAPER })).toBeVisible();
  });

  it("goes back to Calendar keeping the month and the range, and draws the grid again", async () => {
    const user = renderCalendar(`${MARKETING_CALENDAR_PATH}?month=2026-11&view=list&from=2026-11-15&to=2026-11-30`);
    itemsHook.mockClear();
    await user.click(toggle("Calendar"));
    expect(url()).toBe(`${MARKETING_CALENDAR_PATH}?month=2026-11&from=2026-11-15&to=2026-11-30`);
    expect(screen.getByRole("heading", { name: "November 2026" })).toBeVisible();
    expect(onGrid(SOCIAL_POST)).not.toBeNull();
    expect(itemList()).toBeNull();
    expect(ranges()).toEqual(new Set(["2026-10-26..2026-12-06"]));
  });

  it("keeps the view and the range across a tab switch, but not the tab's filters", async () => {
    const user = renderCalendar(
      `${MARKETING_CALENDAR_PATH}/content?month=2026-11&view=list&from=2026-11-15&to=2026-11-30&format=Blog`,
    );
    await user.click(screen.getByRole("tab", { name: "Social" }));
    expect(url()).toBe(`${MARKETING_CALENDAR_PATH}/social?month=2026-11&view=list&from=2026-11-15&to=2026-11-30`);
    expect(toggle("List")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("From")).toHaveValue("2026-11-15");
    expect(within(itemList()!).getByText(SOCIAL_POST)).toBeVisible();
  });

  it("names the range when nothing matches", () => {
    renderCalendar(`${MARKETING_CALENDAR_PATH}/content?month=2026-11&view=list&format=Blog&bu=API`);
    expect(
      screen.getByText(
        `No content planned between ${shortDate("2026-11-01")} and ${shortDate("2026-11-30")} with these filters.`,
      ),
    ).toBeVisible();
  });
});

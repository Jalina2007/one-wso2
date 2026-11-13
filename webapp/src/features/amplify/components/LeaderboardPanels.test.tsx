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

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Leaderboard, TopBoard } from "../api/amplifyTypes";
import { TeamLeaderboardPanel, TopAmplifiersPanel } from "./LeaderboardPanels";

vi.mock("./PersonLink", () => ({ default: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));

function board(): Leaderboard {
  return {
    topN: 3,
    company: [],
    me: { employeeId: "e1", points: 10, rank: 1, pointsToNextRank: 0, pointsToTopN: 0, inTopN: true },
    myTeam: {
      teamName: "Digital Engineering",
      headcount: 2,
      activeCount: 2,
      entries: [
        { employeeId: "e1", displayName: "Ada Lovelace", email: "ada@example.com", points: 10, teamRank: 1, companyRank: 1, houseName: "Oak", isMe: true },
        { employeeId: "e2", displayName: "Grace Hopper", email: "grace@example.com", points: 5, teamRank: 2, companyRank: 2, houseName: null, isMe: false },
      ],
    },
    teamStatus: "OK",
  };
}

describe("TeamLeaderboardPanel", () => {
  it("shows each member's house, and a dash for a member with none", () => {
    render(<TeamLeaderboardPanel board={board()} people={new Map()} />);
    expect(screen.getByRole("columnheader", { name: "House" })).toBeTruthy();
    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("Oak")).toBeTruthy();
    expect(within(rows[2]).getByText("—")).toBeTruthy();
  });
});

describe("TopAmplifiersPanel", () => {
  function topBoard(minPoints?: number | null): TopBoard {
    return {
      period: "MONTH",
      minPoints,
      topN: 3,
      generatedAt: "2026-11-04T00:00:00Z",
      company: [
        { employeeId: "e1", displayName: "Ada Lovelace", email: "ada@example.com", points: 120, rank: 1 },
        { employeeId: "e2", displayName: "Grace Hopper", email: "grace@example.com", points: 110, rank: 2 },
        { employeeId: "e3", displayName: "Alan Turing", email: "alan@example.com", points: 90, rank: 3 },
      ],
      me: { employeeId: "e1", points: 120, rank: 1, pointsToNextRank: 0, pointsToTopN: 0, inTopN: true },
    };
  }

  it("shows the 100 minimum rule when the API sends none", () => {
    render(<TopAmplifiersPanel board={topBoard(null)} people={new Map()} />);
    expect(screen.getByText("100")).toBeTruthy();
    expect(screen.getByText("Minimum to qualify.")).toBeTruthy();
    expect(screen.getByText("Top 3")).toBeTruthy();
    // The podium still holds three people, including one under the minimum.
    expect(screen.getByText("Alan Turing")).toBeTruthy();
  });

  it("follows the API's minimum when it sends one", () => {
    render(<TopAmplifiersPanel board={topBoard(250)} people={new Map()} />);
    expect(screen.getByText("250")).toBeTruthy();
  });

  it("gives the time they reached their points on hover, only when the API sent it", () => {
    const withTimes = topBoard(null);
    withTimes.company[0].reachedAt = "2026-11-10T08:36:49Z";
    render(<TopAmplifiersPanel board={withTimes} people={new Map()} />);
    const labelled = document.querySelectorAll('[aria-label^="Reached "]');
    expect(labelled).toHaveLength(1);
    expect(labelled[0].getAttribute("aria-label")).toContain("Reached 120 pts");
    expect(labelled[0].getAttribute("aria-label")).toContain("(2026-11-10 08:36:49 UTC)");
  });

  it("shows no time to an ordinary employee", () => {
    render(<TopAmplifiersPanel board={topBoard(null)} people={new Map()} />);
    expect(document.querySelectorAll('[aria-label^="Reached "]')).toHaveLength(0);
  });

  it("shows the rule only for the monthly board", () => {
    const allTime = { ...topBoard(null), period: "ALL" as const };
    render(<TopAmplifiersPanel board={allTime} people={new Map()} />);
    expect(screen.queryByText("Minimum to qualify.")).toBeNull();
    expect(screen.queryByText("Top 3")).toBeNull();
  });
});

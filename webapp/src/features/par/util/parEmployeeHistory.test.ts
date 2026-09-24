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

import { describe, expect, it } from "vitest";
import { buildMergedCycleOptions, filterEmployeesForCycle } from "./parEmployeeHistory";
import type { ParCycle, ParEmployee, ParLegacyHistory } from "../api/types";
import type { ParLegacyHistoryByEmail } from "../api/useLeadHistory";

function realCycle(overrides: Partial<ParCycle>): ParCycle {
  return {
    parCycleId: 1,
    parCycleName: "2026 H1",
    parCycleStartDate: "2026-01-01",
    parCycleEndDate: "2026-06-30",
    parEvaluationStartDate: "2026-01-01",
    parEvaluationEndDate: "2026-06-30",
    parEmployeeDeadline: "2026-02-01",
    parThreeSixtyRatingDeadline: "2026-03-01",
    parLeadDeadline: "2026-04-01",
    parF2FDeadline: "2026-05-01",
    parCycleConfigurations: {
      employeeParQuestion: "",
      threeSixtyReviewQuestion: "",
      parRatings: [],
      threeSixtyReviewRatings: [],
    },
    parCycleStatus: "CLOSED",
    ...overrides,
  };
}

function legacyRecord(overrides: Partial<ParLegacyHistory>): ParLegacyHistory {
  return {
    legacyHeaderId: 1,
    employeeEmail: "jane@wso2.com",
    location: null,
    businessUnit: null,
    department: null,
    team: null,
    subTeam: null,
    reviewerName: null,
    reviewerEmail: null,
    cycleName: "2023 Performance Evaluation - H1",
    reviewCompletedDate: null,
    overallRating: null,
    overallSpecialRating: null,
    overallCommentEmployee: null,
    overallCommentManager: null,
    employeeScoreCode: null,
    managerScoreCode: null,
    questionAnswers: null,
    feedback360: null,
    ...overrides,
  };
}

describe("buildMergedCycleOptions", () => {
  it("includes one option per real cycle", () => {
    const options = buildMergedCycleOptions([realCycle({ parCycleId: 1 }), realCycle({ parCycleId: 2 })], {});
    expect(options.filter((o) => !o.isLegacy)).toHaveLength(2);
  });

  it("dedupes legacy cycles across multiple reports sharing one cycle name", () => {
    const byEmail: ParLegacyHistoryByEmail = {
      "a@wso2.com": [legacyRecord({ cycleName: "2023 Performance Evaluation - H1" })],
      "b@wso2.com": [legacyRecord({ cycleName: "2023 Performance Evaluation - H1" })],
    };
    const options = buildMergedCycleOptions([], byEmail);
    expect(options).toHaveLength(1);
    expect(options[0].label).toBe("2023 Performance Evaluation - H1 (Legacy)");
  });

  it("sorts latest first, real and legacy cycles interleaved by date", () => {
    const real = realCycle({ parCycleId: 1, parCycleName: "2024 H2", parCycleStartDate: "2024-07-01" });
    const byEmail: ParLegacyHistoryByEmail = {
      "a@wso2.com": [legacyRecord({ cycleName: "2023 Performance Evaluation - H2" })],
    };
    const options = buildMergedCycleOptions([real], byEmail);
    expect(options.map((o) => o.cycleName)).toEqual(["2024 H2", "2023 Performance Evaluation - H2"]);
  });

  it("sorts an option with no derivable date to the end", () => {
    const byEmail: ParLegacyHistoryByEmail = {
      "a@wso2.com": [legacyRecord({ cycleName: "Unparseable Cycle Name" })],
    };
    const real = realCycle({ parCycleId: 1 });
    const options = buildMergedCycleOptions([real], byEmail);
    expect(options[options.length - 1].cycleName).toBe("Unparseable Cycle Name");
  });
});

function employee(overrides: Partial<ParEmployee>): ParEmployee {
  return { employeeName: "Jane Doe", workEmail: "jane@wso2.com", ...overrides };
}

describe("filterEmployeesForCycle", () => {
  it("excludes the caller's own email", () => {
    const employees = [employee({ workEmail: "me@wso2.com" }), employee({ workEmail: "jane@wso2.com" })];
    expect(filterEmployeesForCycle(employees, "", "me@wso2.com", null)).toHaveLength(1);
  });

  it("matches the search term against name or email", () => {
    const employees = [employee({ employeeName: "Jane Doe", workEmail: "jane@wso2.com" })];
    expect(filterEmployeesForCycle(employees, "jane", undefined, null)).toHaveLength(1);
    expect(filterEmployeesForCycle(employees, "Doe", undefined, null)).toHaveLength(1);
    expect(filterEmployeesForCycle(employees, "nope", undefined, null)).toHaveLength(0);
  });

  it("scopes to a real cycle's participants", () => {
    const employees = [employee({ workEmail: "jane@wso2.com" }), employee({ workEmail: "amy@wso2.com" })];
    const scope = { participantEmails: new Set(["jane@wso2.com"]) };
    expect(filterEmployeesForCycle(employees, "", undefined, scope)).toEqual([employees[0]]);
  });

  it("scopes to a legacy cycle's reports", () => {
    const employees = [employee({ workEmail: "jane@wso2.com" }), employee({ workEmail: "amy@wso2.com" })];
    const scope = {
      legacyCycleName: "2023 H1",
      legacyHistoryByEmail: { "jane@wso2.com": [legacyRecord({ cycleName: "2023 H1" })] },
    };
    expect(filterEmployeesForCycle(employees, "", undefined, scope)).toEqual([employees[0]]);
  });

  it("returns every report unfiltered by scope when no cycle is selected", () => {
    const employees = [employee({ workEmail: "jane@wso2.com" }), employee({ workEmail: "amy@wso2.com" })];
    expect(filterEmployeesForCycle(employees, "", undefined, null)).toHaveLength(2);
  });

  it("falls back to the full in-scope list when the search text is the selected option's own label", () => {
    // MUI Autocomplete resets inputValue to `${name} (${email})` on
    // selection — filtering literally against that string would otherwise
    // match nothing and leave the dropdown empty on reopen.
    const jane = employee({ employeeName: "Jane Doe", workEmail: "jane@wso2.com" });
    const amy = employee({ employeeName: "Amy Lee", workEmail: "amy@wso2.com" });
    const result = filterEmployeesForCycle([jane, amy], "Jane Doe (jane@wso2.com)", undefined, null, jane);
    expect(result).toEqual([jane, amy]);
  });
});

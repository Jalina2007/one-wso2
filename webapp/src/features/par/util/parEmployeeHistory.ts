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

import { deriveLegacyCycleDates } from "./parLegacyHistory";
import type { ParCycle, ParEmployee, ParLegacyHistory } from "../api/types";
import type { ParLegacyHistoryByEmail } from "../api/useLeadHistory";

export interface MergedCycleOption {
  key: string;
  label: string;
  isLegacy: boolean;
  parCycleId?: number;
  cycleName: string;
  sortDate: string | null;
}

// Ports EmployeeHistoryView.tsx's own mergedCycleOptions useMemo: every real
// closed cycle plus one entry per DISTINCT legacy cycle name across every
// one of the lead's reports (deduplicated — however many reports have a
// record for a given legacy cycle, it's one dropdown row), latest first.
export function buildMergedCycleOptions(
  realCycles: ParCycle[],
  legacyHistoryByEmail: ParLegacyHistoryByEmail,
): MergedCycleOption[] {
  const legacyCycleMap = new Map<string, ParLegacyHistory>();
  Object.values(legacyHistoryByEmail).forEach((records) => {
    (records ?? []).forEach((record) => {
      if (!legacyCycleMap.has(record.cycleName)) legacyCycleMap.set(record.cycleName, record);
    });
  });

  const options: MergedCycleOption[] = [
    ...realCycles.map((cycle) => ({
      key: `cycle-${cycle.parCycleId}`,
      label: cycle.parCycleName,
      isLegacy: false,
      parCycleId: cycle.parCycleId,
      cycleName: cycle.parCycleName,
      sortDate: cycle.parCycleStartDate,
    })),
    ...Array.from(legacyCycleMap.values()).map((record) => ({
      key: `legacy-${record.cycleName}`,
      label: `${record.cycleName} (Legacy)`,
      isLegacy: true,
      cycleName: record.cycleName,
      sortDate: deriveLegacyCycleDates(record.cycleName).startDate,
    })),
  ];

  // Latest cycle at the top, oldest at the bottom; an option with no
  // derivable date sorts to the very end rather than the top.
  return options.sort((a, b) => {
    if (!a.sortDate) return 1;
    if (!b.sortDate) return -1;
    return b.sortDate.localeCompare(a.sortDate);
  });
}

// Ports EmployeeHistoryView.tsx's own employeesWithCycleData +
// filteredEmployees: which of the lead's reports show up in the employee
// picker for the currently selected cycle, narrowed further by a search
// term against name or email. `null` selection scope (no cycle picked yet)
// leaves the full report list unfiltered — same as source.
export function filterEmployeesForCycle(
  employees: ParEmployee[],
  searchTerm: string,
  selfEmail: string | undefined,
  scope: { legacyCycleName: string; legacyHistoryByEmail: ParLegacyHistoryByEmail } | { participantEmails: Set<string> } | null,
  selectedEmployee?: ParEmployee | null,
): ParEmployee[] {
  const inScope = (email: string): boolean => {
    if (!scope) return true;
    if ("legacyCycleName" in scope) {
      return (scope.legacyHistoryByEmail[email] ?? []).some((record) => record.cycleName === scope.legacyCycleName);
    }
    return scope.participantEmails.has(email);
  };

  const inScopeEmployees = employees.filter((employee) => employee.workEmail !== selfEmail && inScope(employee.workEmail));

  // MUI Autocomplete resets inputValue to the selected option's own label on
  // selection — filtering literally against that string would then match
  // nothing. EmployeeHistoryView.tsx's own filteredEmployees special-cases
  // this exact string back to the unfiltered (in-scope) list.
  if (selectedEmployee && searchTerm === `${selectedEmployee.employeeName} (${selectedEmployee.workEmail})`) {
    return inScopeEmployees;
  }

  const term = searchTerm.toLowerCase();
  return inScopeEmployees.filter(
    (employee) => employee.employeeName.toLowerCase().includes(term) || employee.workEmail.toLowerCase().includes(term),
  );
}

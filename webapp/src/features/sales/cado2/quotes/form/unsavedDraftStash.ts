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

// Keeps the wizard's unsaved changes when it is left without saving — by the
// rail, the Back button, a reload or a "sign in again" round trip — until the
// same page is opened again (see useLeaveGuard):
//
//   left unsaved ─► stash(page, form values) ─► … ─► back on the page
//                                                    └► "Restore your unsaved changes?"
//
// sessionStorage: it belongs to this tab only, survives the redirect and is
// gone when the tab closes. All access is wrapped because storage can be blocked.

import type { DraftFormValues } from "./draftForm";

const KEY = "one-wso2.cado2.unsaved-draft";

export interface StashedDraft {
  /** The wizard page it came from, e.g. /quotes/5/versions/1/edit. */
  readonly path: string;
  readonly values: DraftFormValues;
  /** When it was kept aside (ISO). */
  readonly stashedAt: string;
}

export function stashUnsavedDraft(path: string, values: DraftFormValues, now = new Date()): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ path, values, stashedAt: now.toISOString() }));
  } catch {
    // Blocked storage: the changes can't be kept; the dialog still works.
  }
}

/** The kept changes for this page, if any. */
export function readUnsavedDraft(path: string): StashedDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as StashedDraft;
    return s && s.path === path && s.values ? s : null;
  } catch {
    return null;
  }
}

export function forgetUnsavedDraft(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to do.
  }
}

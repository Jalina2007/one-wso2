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

// Keeps the wizard's unsaved changes when it is left by a way it doesn't
// control. The rail, the launcher and the browser's Back button know nothing
// about this form, and the router here has no blocker, so instead of stopping
// the navigation the changes are kept aside and offered back on return:
//
//   rail click, Back            → unmount  ─┐
//   reload, closed tab, sign-in → pagehide ─┼─► stashUnsavedDraft(page, values)
//                                           │
//   reopen the same page ◄──────────────────┘   "Restore your unsaved changes?"
//
// The wizard's own Close asks first, as before. A reload or closed tab also
// gets the browser's warning.

import { useCallback, useEffect, useRef } from "react";
import { stashUnsavedDraft } from "./unsavedDraftStash";
import type { DraftFormValues } from "./draftForm";

/** The message shown before unsaved work is thrown away. */
export const UNSAVED_MESSAGE = "You have unsaved changes. Leave without saving?";

export interface LeaveGuard {
  /** Asks before the wizard's own Close throws away unsaved work; true means go ahead. */
  confirmLeave: () => boolean;
  /** Leave without keeping anything: the work was saved, deleted or deliberately discarded. */
  allowLeave: () => void;
}

export function useLeaveGuard(dirty: boolean, page: string, values: () => DraftFormValues): LeaveGuard {
  // Refs, so the unmount and pagehide handlers read the latest answer without re-subscribing.
  const dirtyRef = useRef(dirty);
  const leaving = useRef(false);
  const read = useRef(values);
  useEffect(() => {
    dirtyRef.current = dirty;
    read.current = values;
  });

  const keep = useCallback(() => {
    if (dirtyRef.current && !leaving.current) stashUnsavedDraft(page, read.current());
  }, [page]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      if (!leaving.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    window.addEventListener("pagehide", keep);
    return () => {
      window.removeEventListener("pagehide", keep);
      keep(); // the wizard is going away inside the app
    };
  }, [keep]);

  const allowLeave = useCallback(() => {
    leaving.current = true;
  }, []);

  const confirmLeave = useCallback(() => {
    if (!dirtyRef.current) return true;
    const ok = window.confirm(UNSAVED_MESSAGE);
    if (ok) leaving.current = true;
    return ok;
  }, []);

  return { confirmLeave, allowLeave };
}

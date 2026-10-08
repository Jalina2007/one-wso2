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

import { beforeEach, describe, expect, it } from "vitest";
import { emptyDraftForm } from "./draftForm";
import { forgetUnsavedDraft, readUnsavedDraft, stashUnsavedDraft } from "./unsavedDraftStash";

beforeEach(() => sessionStorage.clear());

describe("unsavedDraftStash", () => {
  it("keeps the changes for the page they came from only", () => {
    const values = { ...emptyDraftForm(), poNumber: "PO-1" };
    stashUnsavedDraft("/quotes/5/versions/1/edit", values, new Date("2026-09-28T10:00:00Z"));

    expect(readUnsavedDraft("/quotes/5/versions/1/edit")).toEqual({
      path: "/quotes/5/versions/1/edit",
      values,
      stashedAt: "2026-09-28T10:00:00.000Z",
    });
    expect(readUnsavedDraft("/quotes/new")).toBeNull();

    forgetUnsavedDraft();
    expect(readUnsavedDraft("/quotes/5/versions/1/edit")).toBeNull();
  });

  it("ignores unreadable data", () => {
    sessionStorage.setItem("one-wso2.cado2.unsaved-draft", "{not json");
    expect(readUnsavedDraft("/quotes/new")).toBeNull();
  });
});

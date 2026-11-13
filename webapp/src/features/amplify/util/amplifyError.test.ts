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
import { HttpError } from "@api/http";
import { describeAmplifyError } from "./amplifyError";

const problem = (status: number, code: string) =>
  new HttpError("https://api.test/amplify/campaigns/c-1/shares", status, JSON.stringify({ status, code }));

describe("describeAmplifyError", () => {
  it("asks for words of their own when the thoughts only repeat the post", () => {
    expect(describeAmplifyError(problem(422, "COMMENTARY_NOT_OWN_WORDS"))).toBe(
      "Add a few more words of your own. Words copied from the post don't count. Or share it without thoughts.",
    );
  });

  it("falls back to a generic line for a code it has no copy for", () => {
    expect(describeAmplifyError(problem(422, "SOMETHING_NEW"))).toBe("Something went wrong, please try again.");
    expect(describeAmplifyError(new Error("network"))).toBe("Something went wrong, please try again.");
  });
});

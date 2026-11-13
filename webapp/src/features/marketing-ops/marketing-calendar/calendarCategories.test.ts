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
import { contrastRatio, parseColor } from "@utils/contrastText";
import { categoryChipColor, categoryStyle } from "./calendarCategories";

function ratio(a: string, b: string): number {
  const x = parseColor(a);
  const y = parseColor(b);
  if (!x || !y) throw new Error(`Unparseable colour ${a} or ${b}`);
  return contrastRatio(x, y);
}

describe("the email colour", () => {
  const email = categoryStyle("email").color;
  if (typeof email === "string") throw new Error("email is expected to carry its own hue");

  it("clears 3:1 against white, against the dark theme's background, and under white text", () => {
    expect(ratio(email.main, "#ffffff")).toBeGreaterThanOrEqual(3);
    expect(ratio(email.main, "#0f172a")).toBeGreaterThanOrEqual(3);
    expect(ratio("#ffffff", email.dark)).toBeGreaterThanOrEqual(3);
  });

  it("paints an outlined chip's text and a filled chip's fill with it", () => {
    const style = categoryStyle("email");
    expect(categoryChipColor(style, "outlined").sx).toMatchObject({ color: email.main });
    expect(categoryChipColor(style, "filled").sx).toMatchObject({ bgcolor: email.main, color: "#ffffff" });
  });

  it("leaves the palette categories to their palette key", () => {
    expect(categoryChipColor(categoryStyle("content"), "filled")).toEqual({ color: "info", sx: {} });
  });
});

describe("the release colour", () => {
  const release = categoryStyle("release").color;
  if (typeof release === "string") throw new Error("release is expected to carry its own hue");

  it("clears 3:1 against white, against the dark theme's background, and under white text", () => {
    expect(ratio(release.main, "#ffffff")).toBeGreaterThanOrEqual(3);
    expect(ratio(release.main, "#0f172a")).toBeGreaterThanOrEqual(3);
    expect(ratio("#ffffff", release.main)).toBeGreaterThanOrEqual(3);
    expect(ratio("#ffffff", release.dark)).toBeGreaterThanOrEqual(3);
  });

  it("paints an outlined chip's text and a filled chip's fill with it", () => {
    const style = categoryStyle("release");
    expect(categoryChipColor(style, "outlined").sx).toMatchObject({ color: release.main });
    expect(categoryChipColor(style, "filled").sx).toMatchObject({ bgcolor: release.main, color: "#ffffff" });
  });
});

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

// `npm run check:prod-pdf`: a production build can break the NDA PDF in ways
// that never show up under `npm run dev`. This builds scripts/prod-pdf-check/
// with the app's vite.config, serves it with `vite preview`, and has Chrome
// generate and download the NDA.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { build, preview } from "vite";

const webappDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configFile = path.join(webappDir, "vite.config.ts");
const outDir = path.join(webappDir, "node_modules/.tmp/prod-pdf-check");
const pagePath = "scripts/prod-pdf-check/index.html";

// PDF layout runs in the browser and can take a while on a slow machine.
const GENERATE_TIMEOUT_MS = 60_000;

// yoga-layout first tries fetch() on its embedded data: URL, which connect-src
// blocks, then falls back to decoding the same bytes itself (its loader's
// .catch). Harmless, and not worth adding data: to connect-src for. Every
// other violation fails the check.
const isExpectedViolation = (v) => v === "connect-src blocked data";

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "chrome" });
  } catch {
    try {
      return await chromium.launch();
    } catch {
      throw new Error("No browser found. Install Google Chrome, or run: npx playwright install chromium");
    }
  }
}

async function main() {
  console.log("Building the check page with the production config…");
  await build({
    configFile,
    root: webappDir,
    logLevel: "warn",
    publicDir: false,
    build: {
      outDir,
      emptyOutDir: true,
      rollupOptions: { input: path.join(webappDir, pagePath) },
    },
  });

  const server = await preview({
    configFile,
    root: webappDir,
    logLevel: "warn",
    build: { outDir },
    preview: { port: 4319, strictPort: false, open: false },
  });
  const browser = await launchBrowser().catch(async (e) => {
    await server.close();
    throw e;
  });

  try {
    const page = await browser.newPage({ acceptDownloads: true });
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));
    page.on("console", (m) => m.type() === "error" && pageErrors.push(m.text()));

    const url = new URL(pagePath, server.resolvedUrls.local[0]).href;
    console.log(`Generating the NDA at ${url}`);
    await page.goto(url);

    const download = page.waitForEvent("download", { timeout: GENERATE_TIMEOUT_MS });
    download.catch(() => {}); // awaited below only when generation succeeded
    await page.click("#generate");
    const status = page.locator("#status");
    await status.and(page.locator('[data-state="ok"], [data-state="error"]')).waitFor({ timeout: GENERATE_TIMEOUT_MS });

    const state = await status.getAttribute("data-state");
    const message = await status.textContent();
    const violations = await page.evaluate(() => window.cspViolations);

    const problems = [];
    if (state !== "ok") problems.push(`PDF generation failed: ${message}`);
    for (const v of violations) {
      if (!isExpectedViolation(v)) problems.push(`CSP violation: ${v}`);
    }

    if (state === "ok") {
      const file = await readFile(await (await download).path());
      if (file.subarray(0, 5).toString() !== "%PDF-") {
        problems.push("The downloaded file is not a PDF (no %PDF- header).");
      }
    }

    if (problems.length > 0) {
      for (const e of pageErrors) problems.push(`Browser console: ${e.slice(0, 300)}`);
      throw new Error(problems.join("\n  "));
    }
    console.log(`OK: the NDA PDF downloads from a production build (${message})`);
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((e) => {
  console.error(`FAILED: ${e.message}`);
  process.exit(1);
});

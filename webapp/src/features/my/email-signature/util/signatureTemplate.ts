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

import DOMPurify from "dompurify";
import { escapeHtml, isSafeUrl, type SignatureData } from "./signatureGenerator";

// Renders an operator-supplied signature template (an HTML file loaded at
// runtime) with the form's values.
//
// Placeholders: {{name}} {{designation}} {{workPhone}} {{personalPhone}}
// {{medium}} {{linkedin}} {{customUrl}} {{customUrlLabel}} {{emailUser}} {{logoUrl}}.
// {{emailUser}} is the work email before "@"; the template adds the domain.
// A section {{#key}}...{{/key}} is kept only when that value is non-empty, so a
// row for a blank field disappears. Values are HTML-escaped, and a URL value
// that isn't http(s) counts as empty.
//
// Separators: mark one with a data-sep attribute (<span data-sep>·</span>) and put
// it before each item. A marked separator that has nothing before it in the same
// parent is removed, so a row never starts with one and no item is left without
// a neighbour to be separated from.
//
// Mail clients drop <style> blocks, so the output keeps the body only and
// removes <style>, <link> and scripts; styles must be inline attributes.

function templateValues(data: SignatureData, logoUrl: string): Record<string, string> {
  const safe = (url: string) => (isSafeUrl(url) ? url.trim() : "");
  const customUrl = data.customUrlLabel.trim() ? safe(data.customUrl) : "";
  return {
    name: data.name.trim(),
    designation: data.designation.trim(),
    workPhone: data.workPhone.trim(),
    personalPhone: data.personalPhone.trim(),
    medium: safe(data.medium),
    linkedin: safe(data.linkedin),
    customUrl,
    customUrlLabel: customUrl ? data.customUrlLabel.trim() : "",
    emailUser: /^[\w.+-]+$/.test(data.emailUser.trim()) ? data.emailUser.trim() : "",
    logoUrl: safe(logoUrl),
  };
}

export function renderSignatureTemplate(template: string, data: SignatureData, logoUrl: string): string {
  const values = templateValues(data, logoUrl);
  // Sections can nest: keep resolving until none are left, so the inner ones
  // inside a kept outer section are evaluated too.
  const sectionPattern = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
  let withSections = template;
  for (let i = 0; i < 10; i++) {
    const next = withSections.replace(sectionPattern, (_match, key: string, inner: string) => (values[key] ? inner : ""));
    if (next === withSections) break;
    withSections = next;
  }
  const filled = withSections.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => escapeHtml(values[key] ?? ""));
  const clean = DOMPurify.sanitize(filled, {
    FORBID_TAGS: ["style", "link", "script", "iframe", "object", "embed", "form"],
    FORBID_ATTR: ["class", "id"],
  });
  return tidySeparators(clean);
}

// Drops each data-sep element with no content before it in its parent, then
// strips the marker from the rest.
function tidySeparators(html: string): string {
  if (!html.includes("data-sep")) return html;
  const body = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html").body;
  for (const sep of Array.from(body.querySelectorAll("[data-sep]"))) {
    let hasContentBefore = false;
    for (let n = sep.previousSibling; n && !hasContentBefore; n = n.previousSibling) {
      if (n.nodeType === Node.ELEMENT_NODE) hasContentBefore = !(n as Element).hasAttribute("data-sep");
      else if (n.nodeType === Node.TEXT_NODE) hasContentBefore = (n.textContent ?? "").trim().length > 0;
    }
    if (hasContentBefore) sep.removeAttribute("data-sep");
    else sep.remove();
  }
  return body.innerHTML;
}

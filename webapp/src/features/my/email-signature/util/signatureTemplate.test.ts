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
import { EMPTY_SIGNATURE_DATA, type SignatureData } from "./signatureGenerator";
import { renderSignatureTemplate } from "./signatureTemplate";

const data = (o: Partial<SignatureData> = {}): SignatureData => ({ ...EMPTY_SIGNATURE_DATA, ...o });
const LOGO = "https://cdn.example.com/logo.png";

describe("renderSignatureTemplate", () => {
  it("fills placeholders and escapes the values", () => {
    const html = renderSignatureTemplate("<p>{{name}}</p><img src=\"{{logoUrl}}\">", data({ name: "<b>Jo</b> & co" }), LOGO);
    expect(html).toContain("&lt;b&gt;Jo&lt;/b&gt; &amp; co");
    expect(html).toContain(`src="${LOGO}"`);
  });

  it("keeps a section only when its value is filled in", () => {
    const t = "<p>a</p>{{#workPhone}}<p>W {{workPhone}}</p>{{/workPhone}}";
    expect(renderSignatureTemplate(t, data(), LOGO)).not.toContain("W ");
    expect(renderSignatureTemplate(t, data({ workPhone: "123" }), LOGO)).toContain("W 123");
  });

  it("treats a non-http(s) URL as empty", () => {
    const t = '{{#linkedin}}<a href="{{linkedin}}">in</a>{{/linkedin}}';
    expect(renderSignatureTemplate(t, data({ linkedin: "javascript:alert(1)" }), LOGO)).toBe("");
    expect(renderSignatureTemplate(t, data({ linkedin: "https://linkedin.com/in/x" }), LOGO)).toContain("https://linkedin.com/in/x");
  });

  it("needs a label before it shows the custom link", () => {
    const t = "{{#customUrl}}<a href=\"{{customUrl}}\">{{customUrlLabel}}</a>{{/customUrl}}";
    expect(renderSignatureTemplate(t, data({ customUrl: "https://x.com" }), LOGO)).toBe("");
    expect(renderSignatureTemplate(t, data({ customUrl: "https://x.com", customUrlLabel: "Site" }), LOGO)).toContain(">Site<");
  });

  it("drops scripts, style blocks and event handlers, and keeps inline styles", () => {
    const t = '<style>body{}</style><p style="color:red" onclick="x()">hi</p><script>alert(1)</script>';
    const html = renderSignatureTemplate(t, data(), LOGO);
    expect(html).toContain('style="color:red"');
    expect(html).not.toMatch(/script|<style|onclick/);
  });

  it("shows the email user only when it is a plain mailbox name", () => {
    const t = "{{#emailUser}}<a href=\"mailto:{{emailUser}}@example.com\">{{emailUser}}@example.com</a>{{/emailUser}}";
    expect(renderSignatureTemplate(t, data({ emailUser: "jane.doe" }), LOGO)).toContain(">jane.doe@example.com<");
    expect(renderSignatureTemplate(t, data(), LOGO)).toBe("");
    expect(renderSignatureTemplate(t, data({ emailUser: 'x"><b>' }), LOGO)).toBe("");
  });

  it("puts separators only between the items that are shown", () => {
    const t =
      "<div>{{#linkedin}}<span data-sep>|</span><a href=\"{{linkedin}}\">L</a>{{/linkedin}}" +
      "{{#medium}}<span data-sep>|</span><a href=\"{{medium}}\">M</a>{{/medium}}" +
      "{{#customUrl}}<span data-sep>|</span><a href=\"{{customUrl}}\">{{customUrlLabel}}</a>{{/customUrl}}</div>";
    const text = (d: Partial<SignatureData>) => renderSignatureTemplate(t, data(d), LOGO).replace(/<[^>]+>/g, "");
    expect(text({ medium: "https://m.com" })).toBe("M");
    expect(text({ linkedin: "https://l.com", medium: "https://m.com" })).toBe("L|M");
    expect(text({ medium: "https://m.com", customUrl: "https://x.com", customUrlLabel: "G" })).toBe("M|G");
    expect(text({ linkedin: "https://l.com", medium: "https://m.com", customUrl: "https://x.com", customUrlLabel: "G" })).toBe("L|M|G");
    expect(renderSignatureTemplate(t, data(), LOGO)).not.toContain("data-sep");
  });

  it("resolves a section nested inside another one", () => {
    const t = "{{#name}}<p>{{name}}</p>{{#workPhone}}<p>W {{workPhone}}</p>{{/workPhone}}{{/name}}";
    const html = renderSignatureTemplate(t, data({ name: "Jo" }), LOGO);
    expect(html).toContain("Jo");
    expect(html).not.toMatch(/W |\{\{/);
    expect(renderSignatureTemplate(t, data({ name: "Jo", workPhone: "1" }), LOGO)).toContain("W 1");
  });
});

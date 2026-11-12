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

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { LegalView } from "@features/sales/cado2/quotes/api/quoteTypes";
import LegalTermsEditor from "./LegalTermsEditor";

const write = { mutate: vi.fn(), isPending: false, error: null as unknown };
vi.mock("@features/sales/cado2/quotes/api/useQuoteApi", () => ({ useWriteLegalTerms: () => write }));
// The rich-text editor as a plain text box, so the test can type into it.
vi.mock("@features/sales/cado2/components/legal-rich-text/LegalRichTextField", () => ({
  default: ({ label, value, onChange, helperText }: { label: string; value: string; onChange: (v: string) => void; helperText?: string }) => (
    <>
      <textarea aria-label={label} defaultValue={value} onChange={(e) => onChange(e.target.value)} />
      {helperText ? <p>{helperText}</p> : null}
    </>
  ),
}));

const legal: LegalView = {
  onPrem: true, saas: true, onPremNonStandard: false, saasNonStandard: true,
  contractName: "Value Added Reseller", partnerName: "Acme Reseller", contractDate: "2024-03-12",
  sections: {
    blocks: [{ kind: "ONPREM", nonStandard: false, text: "Standard." }, { kind: "SAAS", nonStandard: true, text: "" }],
    notices: [], contractName: "Value Added Reseller",
  },
  specialTerms: "AM's wording", specialTermsByLegal: false, amSpecialTerms: "AM's wording", frozen: true,
};

// Legal writes the non-standard terms and may reword the special terms.
describe("LegalTermsEditor", () => {
  it("lets Legal write the non-standard terms and reword the special terms, then saves them", async () => {
    render(<LegalTermsEditor quoteId={7} versionNumber={1} legal={legal} />);
    const user = userEvent.setup();
    expect(screen.getByText(/Value Added Reseller · Acme Reseller · 2024-03-12/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /On-premises products/ })).toBeNull(); // standard: nothing to write
    const saveButton = screen.getByRole("button", { name: "Save terms" });
    expect(saveButton).toBeDisabled();

    await user.type(screen.getByRole("textbox", { name: /SaaS products: governing terms/ }), "Bespoke SaaS terms.");
    const special = screen.getByRole("textbox", { name: "Special terms" });
    await user.clear(special);
    await user.type(special, "Legal's wording");
    await user.click(saveButton);
    expect(write.mutate).toHaveBeenCalledWith(
      { onPremTerms: undefined, saasTerms: "Bespoke SaaS terms.", specialTerms: "Legal's wording" },
      expect.anything(),
    );
  });

  it("says the terms are standard when there is nothing to write", () => {
    render(
      <LegalTermsEditor
        quoteId={7}
        versionNumber={1}
        legal={{ ...legal, saasNonStandard: false, sections: { ...legal.sections, blocks: [legal.sections.blocks[0]] }, specialTerms: null }}
      />,
    );
    expect(screen.getByText("The terms on this quote are standard.")).toBeInTheDocument();
  });

  // D129: under Legal's lens each is written in its own place and saved on its own.
  it("writes only the governing terms, or only the special terms, under the lens", async () => {
    const user = userEvent.setup();
    write.mutate.mockClear();
    const { unmount } = render(<LegalTermsEditor quoteId={7} versionNumber={1} legal={legal} part="governing" />);
    expect(screen.queryByRole("textbox", { name: "Special terms" })).toBeNull();
    await user.type(screen.getByRole("textbox", { name: /SaaS products: governing terms/ }), "Bespoke SaaS terms.");
    await user.click(screen.getByRole("button", { name: "Save governing terms" }));
    expect(write.mutate).toHaveBeenLastCalledWith({ onPremTerms: undefined, saasTerms: "Bespoke SaaS terms.", specialTerms: undefined }, expect.anything());
    unmount();

    render(<LegalTermsEditor quoteId={7} versionNumber={1} legal={legal} part="special" />);
    expect(screen.queryByRole("textbox", { name: /governing terms/ })).toBeNull();
    expect(screen.queryByText(/Value Added Reseller · Acme Reseller/)).toBeNull();
    const special = screen.getByRole("textbox", { name: "Special terms" });
    await user.clear(special);
    await user.type(special, "Legal's wording");
    await user.click(screen.getByRole("button", { name: "Save special terms" }));
    expect(write.mutate).toHaveBeenLastCalledWith({ onPremTerms: undefined, saasTerms: undefined, specialTerms: "Legal's wording" }, expect.anything());
  });

  it("says Saved after a save, until the next change", async () => {
    const user = userEvent.setup();
    write.mutate.mockImplementation((_body: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.());
    render(<LegalTermsEditor quoteId={7} versionNumber={1} legal={legal} part="special" />);
    const special = screen.getByRole("textbox", { name: "Special terms" });
    await user.type(special, " more");
    await user.click(screen.getByRole("button", { name: "Save special terms" }));
    expect(screen.getByRole("status")).toHaveTextContent("Saved on this version");
    expect(screen.getByRole("button", { name: "Save special terms" })).toBeDisabled();
    await user.type(special, "!");
    expect(screen.queryByRole("status")).toBeNull();
    write.mutate.mockReset();
  });

  // D166: written by Legal in an earlier version, and not changed since.
  it("says Legal wrote the terms in an earlier version, until they're changed", async () => {
    const carried: LegalView = {
      ...legal,
      sections: { ...legal.sections, blocks: [legal.sections.blocks[0], { kind: "SAAS", nonStandard: true, text: "Bespoke SaaS terms." }] },
      saasTermsFromVersion: 1,
      specialTerms: "Legal's wording",
      amSpecialTerms: "Legal's wording",
      specialTermsFromVersion: 1,
    };
    render(<LegalTermsEditor quoteId={7} versionNumber={2} legal={carried} />);
    expect(screen.getByText("Written by Legal in version 1.")).toBeInTheDocument();
    expect(screen.getByText("Written by Legal in version 1. Change the wording only if it needs it.")).toBeInTheDocument();

    await userEvent.setup().type(screen.getByRole("textbox", { name: /SaaS products: governing terms/ }), " Changed.");
    expect(screen.queryByText("Written by Legal in version 1.")).toBeNull();
  });

  it("says so for the on-premises terms too, each block on its own", () => {
    const both: LegalView = {
      ...legal,
      onPremNonStandard: true,
      sections: {
        ...legal.sections,
        blocks: [
          { kind: "ONPREM", nonStandard: true, text: "Bespoke on-prem terms." },
          { kind: "SAAS", nonStandard: true, text: "New SaaS terms." },
        ],
      },
      onPremTermsFromVersion: 1,
      saasTermsFromVersion: null,
      specialTerms: null,
    };
    render(<LegalTermsEditor quoteId={7} versionNumber={2} legal={both} />);
    expect(screen.getAllByText("Written by Legal in version 1.")).toHaveLength(1); // on-premises only
    expect(screen.getByText("The AM marked these non-standard: write the terms that apply to this customer.")).toBeInTheDocument(); // SaaS
  });
});

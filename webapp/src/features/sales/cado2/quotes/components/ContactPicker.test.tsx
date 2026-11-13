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
import type { JSX } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Contact } from "@features/sales/cado2/quotes/api/quoteTypes";
import { emptyDraftForm, type ContactValue, type DraftFormValues } from "@features/sales/cado2/quotes/form/draftForm";
import ContactPicker from "./ContactPicker";

const OPP = "006000000000001AAA";
const contacts: Contact[] = [
  { id: "003A", name: "Marco Ruiz", title: "Head of IT", email: "marco@acme.example", roles: ["Economic Buyer", "Champion"] },
  { id: "003B", name: "Ana Payables", title: "Finance", email: "ap@acme.example", roles: [] },
];

function Harness({
  list = contacts,
  billing,
  loadError,
  onRetry,
}: {
  list?: Contact[];
  billing?: ContactValue;
  loadError?: unknown;
  onRetry?: () => void;
}): JSX.Element {
  const form = useForm<DraftFormValues>({ defaultValues: { ...emptyDraftForm(), ...(billing ? { billingContact: billing } : {}) } });
  return (
    <FormProvider {...form}>
      <ContactPicker
        name="billingContact"
        issueField="contacts.billing"
        label="Billing contact"
        opportunityId={OPP}
        contacts={list}
        loading={false}
        loadError={loadError}
        onRetry={onRetry}
      />
      <Value />
    </FormProvider>
  );
}
function Value(): JSX.Element {
  const v = useWatch<DraftFormValues, "billingContact">({ name: "billingContact" });
  return <p>value: {v.mode} {v.sfContactId}</p>;
}

describe("ContactPicker", () => {
  // 2026-10-09: nothing is listed until the AM chooses to pick (an open list
  // on arrival read as a directory, not a choice). D124: no typing in.
  it("starts with nothing chosen and one way to choose, without a list", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    const empty = within(screen.getByLabelText("Billing contact: none chosen"));
    expect(empty.getByText("No billing contact chosen yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /not in Salesforce/ })).toBeNull();
    expect(screen.queryByRole("radiogroup")).toBeNull();

    await user.click(empty.getByRole("button", { name: "Choose from the opportunity" }));
    expect(screen.getByText("Choose the billing contact")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Billing contact" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /not in Salesforce/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.getByText("value: none")).toBeInTheDocument();
  });

  it("lists the opportunity's contacts with their roles, searches and shows the choice as a card", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Choose from the opportunity" }));
    const list = () => within(screen.getByRole("radiogroup", { name: "Billing contact" }));
    expect(list().getAllByRole("radio")).toHaveLength(2);
    expect(list().getByText(/Economic Buyer, Champion · Head of IT/)).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "Search billing contact" }), "champion");
    expect(list().getAllByRole("radio")).toHaveLength(1);
    await user.clear(screen.getByRole("textbox", { name: "Search billing contact" }));
    await user.type(screen.getByRole("textbox", { name: "Search billing contact" }), "finance");
    await user.click(list().getByRole("radio", { name: "Ana Payables" }));

    expect(screen.getByText("value: salesforce 003B")).toBeInTheDocument();
    const card = within(screen.getByLabelText("Billing contact: Ana Payables"));
    expect(card.getByText("Finance · ap@acme.example")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Change billing contact" }));
    expect(screen.getByRole("radiogroup", { name: "Billing contact" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByLabelText("Billing contact: Ana Payables")).toBeInTheDocument();
  });

  // D124: most opportunities have no contacts yet; the AM adds one in Salesforce.
  it("with no contacts on the opportunity, links to it in Salesforce and refreshes", async () => {
    const retry = vi.fn();
    render(<Harness list={[]} onRetry={retry} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Choose from the opportunity" }));
    expect(screen.getByText(/This opportunity has no contacts in Salesforce\. Add the billing contact/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open the opportunity in Salesforce/ })).toHaveAttribute("href", expect.stringContaining(OPP));
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(retry).toHaveBeenCalled();
  });

  // D124: a contact typed in before is shown, with a request to choose again.
  it("asks to choose again for a contact typed in before", async () => {
    render(<Harness billing={{ mode: "manual", sfContactId: "", name: "Jane Payables", title: "", email: "ap@reseller.example" }} />);
    const user = userEvent.setup();
    const warning = screen.getByLabelText("Billing contact: typed in");
    expect(warning).toHaveTextContent("Jane Payables · ap@reseller.example was typed in.");
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
    await user.click(within(warning).getByRole("button", { name: "Choose from the opportunity" }));
    await user.click(screen.getByRole("radio", { name: "Marco Ruiz" }));
    expect(screen.getByText("value: salesforce 003A")).toBeInTheDocument();
  });
});

// A failed load is an error, never "no contacts" (2026-10-13).
describe("ContactPicker — contacts that fail to load", () => {
  it("says the contacts couldn't be loaded, with a retry", async () => {
    const retry = vi.fn();
    render(<Harness list={[]} loadError={new Error("down")} onRetry={retry} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Choose from the opportunity" }));
    expect(screen.getByText(/^Couldn't load the opportunity's contacts from Salesforce\./)).toBeInTheDocument();
    expect(screen.queryByText(/This opportunity has no contacts/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalled();
  });
});

// D165: the legal contact often isn't on the opportunity, so it may be entered here.
function LegalHarness(): JSX.Element {
  const form = useForm<DraftFormValues>({ defaultValues: emptyDraftForm() });
  return (
    <FormProvider {...form}>
      <ContactPicker
        name="legalContact"
        issueField="contacts.legal"
        label="Legal contact (optional)"
        opportunityId={OPP}
        contacts={contacts}
        loading={false}
        allowTyped
      />
      <LegalValue />
    </FormProvider>
  );
}
function LegalValue(): JSX.Element {
  const v = useWatch<DraftFormValues, "legalContact">({ name: "legalContact" });
  return <p>legal: {[v.mode, v.name, v.email].filter(Boolean).join(" ")}</p>;
}

describe("ContactPicker — entered here (D165)", () => {
  it("takes a legal contact typed in, or one chosen from the opportunity instead", async () => {
    render(<LegalHarness />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Enter an email" }));
    const card = within(screen.getByLabelText("Legal contact (optional): entered here"));
    expect(card.queryByLabelText(/Name|Title/)).toBeNull(); // only the email matters
    await user.type(card.getByLabelText("Email"), "legal@acme.example");
    expect(screen.getByText("legal: manual legal@acme.example")).toBeInTheDocument();

    await user.click(card.getByRole("button", { name: "Choose from the opportunity instead" }));
    await user.click(screen.getByRole("radio", { name: "Marco Ruiz" }));
    expect(screen.getByText(/^legal: salesforce Marco Ruiz/)).toBeInTheDocument();
  });

  it("offers typing in only where it's allowed", () => {
    render(<Harness />);
    expect(screen.queryByRole("button", { name: "Enter an email" })).toBeNull();
  });
});

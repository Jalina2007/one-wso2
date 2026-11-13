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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { useState, type JSX } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Alert, Box, Button, Checkbox, FormControlLabel, InputAdornment, Stack, TextField, Typography } from "@wso2/oxygen-ui";
import { HandshakeIcon } from "@wso2/oxygen-ui-icons-react";
import SectionCard from "@features/sales/cado2/components/section-card/SectionCard";
import { commissionProblem, type DraftFormValues } from "@features/sales/cado2/quotes/form/draftForm";
import { useFieldIssue } from "@features/sales/cado2/quotes/components/fieldIssues";
import { formatMoney } from "@features/sales/cado2/utils/money";

/** One year's rate, with what it comes to once priced (D151). */
function YearRate({ index, amount, currency }: { index: number; amount: string | undefined; currency: string }): JSX.Element {
  const { control } = useFormContext<DraftFormValues>();
  const issue = useFieldIssue(`partnerCommissionByYear[${index}]`);
  return (
    <Controller
      name={`partnerCommissionByYear.${index}`}
      control={control}
      render={({ field }) => {
        const problem = field.value.trim() ? commissionProblem(field.value) : "";
        return (
          <TextField
            {...field}
            label={`Year ${index + 1}`}
            size="small"
            required
            inputMode="decimal"
            sx={{ width: 150 }}
            error={Boolean(problem || issue)}
            helperText={problem || issue || (amount ? `${currency} ${formatMoney(amount)}` : " ")}
            slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
          />
        );
      }}
    />
  );
}

/**
 * The partner's commission on a partner-led quote: one % for every line,
 * as Salesforce records it on each opportunity line, or one per contract
 * year when they differ (D151). The partner keeps it; WSO2 invoices the rest
 * (A6).
 */
export default function PartnerCommissionCard({
  commission,
  total,
  currency,
  yearCommissions = [],
}: {
  /** The worked-out commission and the total it is taken from, once priced. */
  commission: string | null;
  total: string | null;
  currency: string;
  /** Each year's worked-out commission, once priced. */
  yearCommissions?: readonly (string | undefined)[];
}): JSX.Element {
  const { control, getValues, setValue } = useFormContext<DraftFormValues>();
  const issue = useFieldIssue("partnerCommissionPercent");
  const [yearCount, byYear] = useWatch({ control, name: ["yearCount", "partnerCommissionByYear"] });
  const perYear = byYear.length > 0;
  // Unticking with different rates asks first: they become Year 1's.
  const [confirming, setConfirming] = useState(false);

  const split = () => {
    const rate = getValues("partnerCommissionPercent").trim();
    setValue("partnerCommissionByYear", Array.from({ length: yearCount }, () => rate), { shouldDirty: true });
  };
  const join = () => {
    setValue("partnerCommissionPercent", byYear[0] ?? "", { shouldDirty: true });
    setValue("partnerCommissionByYear", [], { shouldDirty: true });
    setConfirming(false);
  };
  const toggle = (on: boolean) => {
    if (on) split();
    else if (byYear.some((r) => Number(r) !== Number(byYear[0]))) setConfirming(true);
    else join();
  };
  const summary =
    commission && total
      ? `= ${currency} ${formatMoney(commission)} of ${formatMoney(total)}${perYear ? ` over the ${yearCount} years` : ""}. `
      : "";

  return (
    <SectionCard title="Partner Commission" icon={<HandshakeIcon size={18} />}>
      <Stack spacing={1.5}>
        {perYear ? (
          <Stack direction="row" useFlexGap flexWrap="wrap" spacing={2} aria-label="Commission per year">
            {byYear.map((_, i) => (
              <YearRate key={i} index={i} amount={yearCommissions[i]} currency={currency} />
            ))}
          </Stack>
        ) : (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
            <Controller
              name="partnerCommissionPercent"
              control={control}
              render={({ field }) => {
                const problem = field.value.trim() ? commissionProblem(field.value) : "";
                return (
                  <TextField
                    {...field}
                    label="Commission"
                    size="small"
                    required
                    inputMode="decimal"
                    sx={{ maxWidth: 180 }}
                    error={Boolean(problem || issue)}
                    helperText={problem || issue || "0 if none"}
                    slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
                  />
                );
              }}
            />
          </Stack>
        )}
        <Typography variant="body2" color="text.secondary">
          {summary}The partner keeps this share of every line; WSO2 invoices the rest.
        </Typography>
        {/* Only a multi-year quote can have a rate per year. */}
        {yearCount > 1 || perYear ? (
          <Box>
            <FormControlLabel
              control={<Checkbox size="small" checked={perYear} onChange={(e) => toggle(e.target.checked)} />}
              label="Different rate per year"
            />
          </Box>
        ) : null}
        {confirming ? (
          <Alert
            severity="warning"
            action={
              <Stack direction="row" spacing={1}>
                <Button color="inherit" size="small" onClick={() => setConfirming(false)}>
                  Keep
                </Button>
                <Button color="inherit" size="small" variant="outlined" onClick={join}>
                  Use {Number(byYear[0])}%
                </Button>
              </Stack>
            }
          >
            Every year will use Year 1&apos;s {Number(byYear[0])}%.
          </Alert>
        ) : null}
      </Stack>
    </SectionCard>
  );
}

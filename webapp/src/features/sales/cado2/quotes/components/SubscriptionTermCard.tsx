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

import type { JSX } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import {
  Chip,
  DatePickers,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { CalendarDaysIcon } from "@wso2/oxygen-ui-icons-react";
import SectionCard from "@features/sales/cado2/components/section-card/SectionCard";
import type { TermMode } from "@features/sales/cado2/quotes/api/quoteTypes";
import {
  MULTI_YEAR_OPTIONS,
  formatDate,
  isShortMode,
  parseDateString,
  shortTermLatestEnd,
  shortTermProblem,
  termEnd,
  toDateString,
  type DraftFormValues,
} from "@features/sales/cado2/quotes/form/draftForm";
import { useFieldIssue } from "@features/sales/cado2/quotes/components/fieldIssues";

const { DatePicker } = DatePickers;

const MODES: readonly { value: TermMode; label: string; help: string }[] = [
  { value: "ONE_YEAR", label: "1 year", help: "A full year from the start date." },
  { value: "MULTI_YEAR", label: "Multi-year", help: "2 to 10 whole years, as one quote." },
  {
    value: "CO_TERMED",
    label: "Co-termed",
    help: "Ends on the same day as the customer's running contract, within a year.",
  },
  { value: "SHORTER", label: "Shorter term", help: "A stand-alone term of less than a year." },
];

/**
 * The Subscription term card. Shown when a line is a Subscription
 * or Support; a services-only quote has no term.
 *
 *   1 year        start → end derived
 *   Multi-year    start → end derived from the years; billing chosen here
 *   Co-termed     start → end typed, within a year
 *   Shorter term  start → end typed, within a year
 */
export default function SubscriptionTermCard(): JSX.Element {
  const { control } = useFormContext<DraftFormValues>();
  const [startDate, termMode, termYears, termEndDate] = useWatch({
    control,
    name: ["startDate", "termMode", "termYears", "termEndDate"],
  });
  const end = termEnd({ startDate, termMode, termYears, termEndDate });
  const modeIssue = useFieldIssue("termMode");
  const yearsIssue = useFieldIssue("termYears");
  const endIssue = useFieldIssue("subscriptionEndDate");
  const billingIssue = useFieldIssue("billingFrequency");
  const help = MODES.find((m) => m.value === termMode)?.help;
  const typedProblem = isShortMode(termMode) ? shortTermProblem(startDate, termEndDate) : "";

  return (
    <SectionCard
      title="Subscription term"
      icon={<CalendarDaysIcon size={18} />}
      aside={
        startDate && end ? (
          <Chip size="small" variant="outlined" color="primary" label={`${formatDate(startDate)} – ${formatDate(end)}`} />
        ) : undefined
      }
    >
      <Stack spacing={2}>
        <Controller
          name="termMode"
          control={control}
          render={({ field }) => (
            <RadioGroup row value={field.value} onChange={(_, v) => field.onChange(v)} aria-label="Subscription term">
              {MODES.map((m) => (
                <FormControlLabel key={m.value} value={m.value} control={<Radio />} label={m.label} />
              ))}
            </RadioGroup>
          )}
        />
        {modeIssue ? (
          <Typography variant="caption" color="error">
            {modeIssue}
          </Typography>
        ) : help ? (
          <Typography variant="body2" color="text.secondary">
            {help}
          </Typography>
        ) : null}

        {termMode === "MULTI_YEAR" ? (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
            <Controller
              name="termYears"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Years"
                  size="small"
                  sx={{ minWidth: 140 }}
                  error={Boolean(yearsIssue)}
                  helperText={yearsIssue}
                >
                  {MULTI_YEAR_OPTIONS.map((n) => (
                    <MenuItem key={n} value={String(n)}>
                      {n} years
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Controller
              name="billingFrequency"
              control={control}
              render={({ field }) => (
                <RadioGroup row value={field.value} onChange={(_, v) => field.onChange(v)} aria-label="Billing frequency">
                  <FormControlLabel value="ANNUAL" control={<Radio />} label="Annual billing" />
                  <FormControlLabel value="UPFRONT" control={<Radio />} label="Full amount upfront" />
                </RadioGroup>
              )}
            />
          </Stack>
        ) : null}
        {termMode === "MULTI_YEAR" && billingIssue ? (
          <Typography variant="caption" color="error">
            {billingIssue}
          </Typography>
        ) : null}

        {isShortMode(termMode) ? (
          <Controller
            name="termEndDate"
            control={control}
            render={({ field }) => (
              <DatePicker
                label="End date"
                value={parseDateString(field.value)}
                minDate={parseDateString(startDate) ?? undefined}
                maxDate={startDate ? (parseDateString(shortTermLatestEnd(startDate)) ?? undefined) : undefined}
                onChange={(d: Date | null) => field.onChange(d && !Number.isNaN(d.getTime()) ? toDateString(d) : "")}
                slotProps={{
                  textField: {
                    size: "small",
                    required: true,
                    error: Boolean(typedProblem || endIssue),
                    helperText:
                      typedProblem ||
                      endIssue ||
                      (startDate ? `By ${formatDate(shortTermLatestEnd(startDate))} at the latest` : undefined),
                    sx: { maxWidth: 240 },
                  },
                }}
              />
            )}
          />
        ) : null}
      </Stack>
    </SectionCard>
  );
}

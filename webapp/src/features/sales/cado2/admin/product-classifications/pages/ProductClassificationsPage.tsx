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

import { useState, type JSX } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  InputAdornment,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useCado2Toast } from "@features/sales/cado2/components/toast/toastContext";
import PageHeader from "@features/sales/cado2/components/page-header/PageHeader";
import type { LineCategory } from "@features/sales/cado2/quotes/api/quoteTypes";
import {
  useProductClassifications,
  useSetProductClassification,
} from "@features/sales/cado2/admin/product-classifications/api/useProductClassifications";
import type {
  Deployment,
  ProductClassificationInput,
  ProductClassificationItem,
} from "@features/sales/cado2/admin/product-classifications/api/productClassificationTypes";

/** The categories, in the order form's order and words. */
const GROUPS: readonly { value: LineCategory; label: string }[] = [
  { value: "SUBSCRIPTION", label: "Subscription" },
  { value: "SUPPORT", label: "Support" },
  { value: "PROFESSIONAL_SERVICE", label: "Professional Services" },
];

const RECURRING = "RECURRING";
const NON_RECURRING = "NON_RECURRING";
/** A select's value before anything is chosen. */
const NONE = "";

/** What a row shows: the saved values, or a not-set-up row's choices so far. */
interface Choice {
  readonly category: LineCategory | null;
  readonly recurring: boolean | null;
  readonly deployment: Deployment | null;
}

/** The deployment choices (D163); "not applicable" is a value of its own here, null when saved. */
const NOT_APPLICABLE = "NOT_APPLICABLE";
const DEPLOYMENTS: readonly { value: string; label: string }[] = [
  { value: "ON_PREMISES", label: "On-premises" },
  { value: "SAAS", label: "SaaS" },
  { value: NOT_APPLICABLE, label: "Not applicable" },
];

/** Where each setting is used in QuickQuote, for reference (D163). */
const USES: readonly { setting: string; uses: string }[] = [
  {
    setting: "Category",
    uses: "Which section a product is listed under on the quote and the order form; which lines a pricing formula's category total adds up; and which lines count as support in the support plan check.",
  },
  {
    setting: "Type",
    uses: "Recurring products cover the whole of each contract year, are charged every year and count in ARR. Non-recurring products are charged once, with their own start and end dates.",
  },
  {
    setting: "Deployment",
    uses: "Which standard terms the order form's section 04 shows: the on-premises terms for on-premises products, the SaaS terms for SaaS products, both when a quote has both, and the on-premises terms when it has neither.",
  },
];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function SettingSelect({
  label,
  value,
  saving,
  disabled,
  options,
  onChange,
}: {
  label: string;
  value: string;
  saving: boolean;
  disabled: boolean;
  options: readonly { value: string; label: string }[];
  onChange: (v: string) => void;
}): JSX.Element {
  return (
    <TextField
      select
      size="small"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      sx={{ minWidth: 200 }}
      slotProps={{
        // Shows "Choose…" rather than an empty box.
        select: { displayEmpty: true },
        htmlInput: { "aria-label": label },
        input: saving
          ? {
              endAdornment: (
                <InputAdornment position="end" sx={{ mr: 3 }}>
                  <CircularProgress size={14} aria-label="Saving" />
                </InputAdornment>
              ),
            }
          : undefined,
      }}
    >
      {value === NONE ? (
        <MenuItem value={NONE} disabled>
          <Typography variant="body2" color="text.secondary">
            Choose…
          </Typography>
        </MenuItem>
      ) : null}
      {options.map((o) => (
        <MenuItem key={o.value} value={o.value}>
          {o.label}
        </MenuItem>
      ))}
    </TextField>
  );
}

/** A heading row: a category, or "Not set up". */
function SectionRow({ label }: { label: string }): JSX.Element {
  return (
    <TableRow>
      <TableCell colSpan={5} sx={{ pt: 2, pb: 0.75 }}>
        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: "0.06em" }}>
          {label}
        </Typography>
      </TableCell>
    </TableRow>
  );
}

/**
 * CadO2 Admin → Product Classifications (D152): for each Salesforce product
 * classification, the order-form category its products go in and whether they
 * are charged every contract year (recurring, counted in ARR) or once.
 * Replaces the per-product mapping. The codes come from Salesforce's active
 * products, so a new one shows up here, not set up, by itself; until it is
 * set up its products can't be added to a quote.
 */
export default function ProductClassificationsPage(): JSX.Element {
  const data = useProductClassifications();
  const set = useSetProductClassification();
  const notify = useCado2Toast();
  // A not-set-up row's first choice, kept until the second one saves both.
  const [pending, setPending] = useState<Record<string, Choice>>({});

  const choiceOf = (item: ProductClassificationItem): Choice =>
    pending[item.classification] ?? { category: item.category, recurring: item.recurring, deployment: item.deployment };
  const savingCode = set.isPending ? set.variables?.classification : undefined;
  // One save, for a choice and for Retry, so both clear the pending choice and say so.
  const save = (input: ProductClassificationInput) =>
    set.mutate(input, {
      onSuccess: () => {
        setPending((p) => {
          const next = { ...p };
          delete next[input.classification];
          return next;
        });
        notify(`${input.classification} saved`);
      },
    });
  const choose = (item: ProductClassificationItem, change: Partial<Choice>) => {
    const next = { ...choiceOf(item), ...change };
    if (next.category === null || next.recurring === null) {
      setPending((p) => ({ ...p, [item.classification]: next }));
      return;
    }
    save({ classification: item.classification, category: next.category, recurring: next.recurring, deployment: next.deployment });
  };

  const items = data.data?.items ?? [];
  const notSetUp = items.filter((i) => i.category === null || i.recurring === null);
  const sections = [
    { label: "Not set up", rows: notSetUp },
    ...GROUPS.map((g) => ({
      label: g.label,
      rows: items.filter((i) => i.category === g.value && i.recurring !== null),
    })),
  ].filter((s) => s.rows.length > 0);

  return (
    <Stack spacing={3} sx={{ maxWidth: 1100 }}>
      <PageHeader title="Product Classifications" />
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: "75ch" }}>
        Each Salesforce product has a classification. Here you set where its products are listed on the order form,
        whether they are charged every contract year (recurring) or once (non-recurring), and how they are deployed. A
        change applies to drafts at their next save; submitted quotes keep what they were submitted with.
      </Typography>

      {set.error ? (
        <ErrorNotice error={set.error} onRetry={() => set.variables && save(set.variables)} retrying={set.isPending}>
          Couldn&apos;t save the classification.
        </ErrorNotice>
      ) : null}

      {data.error ? (
        <ErrorNotice error={data.error} onRetry={() => void data.refetch()} retrying={data.isFetching}>
          Couldn&apos;t load the product classifications.
        </ErrorNotice>
      ) : data.isPending ? (
        <Skeleton variant="rounded" height={320} aria-label="Loading product classifications" />
      ) : (
        <Stack spacing={2}>
          {!data.data.salesforceAvailable ? (
            <Alert severity="info">
              Salesforce couldn&apos;t be read, so only the classifications already set up are listed, without product
              counts.
            </Alert>
          ) : null}
          {notSetUp.length > 0 ? (
            <Alert severity="warning">
              <b>
                {plural(notSetUp.length, "classification isn't", "classifications aren't")} set up.
              </b>{" "}
              Products classified {notSetUp.map((i) => i.classification).join(", ")} can&apos;t be added to a quote until
              you choose {notSetUp.length === 1 ? "its" : "their"} category and type.
            </Alert>
          ) : null}
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5 }}>
            <Table size="small" aria-label="Product classifications">
              <TableHead>
                <TableRow>
                  <TableCell>Classification</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Deployment</TableCell>
                  <TableCell align="right">Products</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sections.map((s) => [
                  <SectionRow key={`section-${s.label}`} label={s.label} />,
                  ...s.rows.map((item) => {
                    const shown = choiceOf(item);
                    const unset = item.category === null || item.recurring === null;
                    return (
                      <TableRow key={item.classification} sx={unset ? { bgcolor: "warning.light" } : undefined}>
                        <TableCell sx={{ fontWeight: 700, width: 140 }}>{item.classification}</TableCell>
                        <TableCell>
                          <SettingSelect
                            label={`Category of ${item.classification}`}
                            value={shown.category ?? NONE}
                            options={GROUPS}
                            saving={savingCode === item.classification}
                            disabled={set.isPending}
                            onChange={(v) => choose(item, { category: v as LineCategory })}
                          />
                        </TableCell>
                        <TableCell>
                          <SettingSelect
                            label={`Type of ${item.classification}`}
                            value={shown.recurring === null ? NONE : shown.recurring ? RECURRING : NON_RECURRING}
                            options={[
                              { value: RECURRING, label: "Recurring" },
                              { value: NON_RECURRING, label: "Non-recurring" },
                            ]}
                            saving={false}
                            disabled={set.isPending}
                            onChange={(v) => choose(item, { recurring: v === RECURRING })}
                          />
                        </TableCell>
                        <TableCell>
                          <SettingSelect
                            label={`Deployment of ${item.classification}`}
                            value={shown.deployment ?? NOT_APPLICABLE}
                            options={DEPLOYMENTS}
                            saving={false}
                            disabled={set.isPending}
                            onChange={(v) => choose(item, { deployment: v === NOT_APPLICABLE ? null : (v as Deployment) })}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" color="text.secondary">
                            {data.data.salesforceAvailable ? plural(item.productCount, "product", "products") : "—"}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  }),
                ])}
              </TableBody>
            </Table>
          </TableContainer>
          {data.data.unclassifiedProducts > 0 ? (
            <Typography variant="body2" color="text.secondary">
              {plural(data.data.unclassifiedProducts, "active product has", "active products have")} no classification in
              Salesforce, so {data.data.unclassifiedProducts === 1 ? "it" : "they"} can&apos;t be quoted.
            </Typography>
          ) : null}
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 1.5 }} component="section" aria-label="Where these settings are used">
            <Typography variant="subtitle2" component="h2" sx={{ fontWeight: 700, mb: 1 }}>
              Where these settings are used
            </Typography>
            <Stack component="dl" spacing={1} sx={{ m: 0 }}>
              {USES.map((u) => (
                <Box key={u.setting} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "120px minmax(0,1fr)" }, columnGap: 2 }}>
                  <Typography component="dt" variant="body2" sx={{ fontWeight: 600 }}>
                    {u.setting}
                  </Typography>
                  <Typography component="dd" variant="body2" color="text.secondary" sx={{ m: 0, maxWidth: "80ch" }}>
                    {u.uses}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Paper>
        </Stack>
      )}
    </Stack>
  );
}

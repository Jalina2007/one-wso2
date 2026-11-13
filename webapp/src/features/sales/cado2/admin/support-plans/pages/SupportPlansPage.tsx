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
import { Box, Button, Paper, Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useCado2Toast } from "@features/sales/cado2/components/toast/toastContext";
import PageHeader from "@features/sales/cado2/components/page-header/PageHeader";
import { ProductField, ProductsField } from "@features/sales/cado2/admin/components/AdminProductFields";
import { problemOf } from "@features/sales/cado2/quotes/api/errors";
import type { FormulaProduct, SupportPlanProduct, SupportPlans } from "@features/sales/cado2/quotes/api/quoteTypes";
import { formatDate } from "@features/sales/cado2/quotes/form/draftForm";
import {
  useSaveSupportPlans,
  useSupportPlans,
  type SupportPlansInput,
} from "@features/sales/cado2/admin/support-plans/api/useSupportPlans";

const asPicked = (p: SupportPlanProduct | null): FormulaProduct | null => (p ? { id: p.productId, name: p.name, code: p.code } : null);

const inputOf = (p: SupportPlans): SupportPlansInput => ({
  enterpriseProductId: p.enterprise?.productId ?? null,
  standardProductId: p.standard?.productId ?? null,
  premiumProductIds: p.premium.map((x) => x.productId),
});

/**
 * CadO2 Admin → Support Plans (D155): the Enterprise and Standard Support
 * products QuickQuote checks each year with a subscription for, and the
 * Premium ones it offers with Enterprise. Each change saves the whole set at
 * once; drafts show it straight away (it is only a warning).
 */
export default function SupportPlansPage(): JSX.Element {
  const data = useSupportPlans();
  const save = useSaveSupportPlans();
  const notify = useCado2Toast();
  const issues = problemOf(save.error)?.issues ?? [];
  const issueOn = (field: string) => issues.find((i) => i.field === field)?.message;

  // Each save sends the whole set, so a change made while one is still
  // saving builds on that one, not on the set as last loaded.
  const change = (next: Partial<SupportPlansInput>) => {
    if (!data.data) return;
    const base = save.isPending && save.variables ? save.variables : inputOf(data.data);
    save.mutate({ ...base, ...next }, { onSuccess: () => notify("Support plans saved") });
  };

  return (
    <Stack spacing={3} sx={{ maxWidth: 760 }}>
      <PageHeader title="Support Plans" />
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: "75ch" }}>
        The products QuickQuote checks for and offers in a year with subscriptions. Leave Enterprise and Standard empty
        to switch the check off.
      </Typography>

      {save.error && issues.length === 0 ? (
        <ErrorNotice error={save.error} onRetry={() => save.variables && save.mutate(save.variables)} retrying={save.isPending}>
          Couldn&apos;t save the support plans.
        </ErrorNotice>
      ) : null}

      {data.error ? (
        <ErrorNotice error={data.error} onRetry={() => void data.refetch()} retrying={data.isFetching}>
          Couldn&apos;t load the support plans.
        </ErrorNotice>
      ) : data.isPending ? (
        <Skeleton variant="rounded" height={260} aria-label="Loading support plans" />
      ) : (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Stack spacing={2.5}>
            {(
              [
                { label: "Enterprise Support", value: data.data.enterprise, field: "enterpriseProductId" },
                { label: "Standard Support", value: data.data.standard, field: "standardProductId" },
              ] as const
            ).map((plan) => (
              <Stack key={plan.field} direction="row" spacing={1} alignItems="flex-start">
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <ProductField
                    label={plan.label}
                    value={asPicked(plan.value)}
                    onChange={(p) => change({ [plan.field]: p?.id ?? null })}
                    error={issueOn(plan.field)}
                  />
                </Box>
                {plan.value ? (
                  <Button sx={{ mt: 1 }} onClick={() => change({ [plan.field]: null })} aria-label={`Clear ${plan.label}`}>
                    Clear
                  </Button>
                ) : null}
              </Stack>
            ))}
            <Stack spacing={0.75}>
              <Typography variant="subtitle2">Premium Support (optional, any number)</Typography>
              <ProductsField
                name="Premium Support"
                value={data.data.premium.map((p) => asPicked(p)!)}
                onChange={(ps) => change({ premiumProductIds: ps.map((p) => p.id) })}
                error={issueOn("premiumProductIds") ?? issueOn("productId")}
                helperText="Offered in a year that has Enterprise Support. Empty: not offered."
              />
            </Stack>
            {data.data.updatedByEmail && data.data.updatedAt ? (
              <Typography variant="caption" color="text.secondary">
                Last changed by {data.data.updatedByEmail} on {formatDate(data.data.updatedAt.slice(0, 10))}.
              </Typography>
            ) : null}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

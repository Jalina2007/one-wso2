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

import { useMemo, useState, type JSX } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import {
  Alert,
  Box,
  Button,
  Menu,
  MenuItem,
  Stack,
  TableCell,
  TableRow,
  Tooltip,
  Typography,
  IconButton,
} from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import {
  ChartColumnIcon,
  ChevronDownIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  CopyIcon,
  HistoryIcon,
  PackageIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "@wso2/oxygen-ui-icons-react";
import SectionCard from "@features/sales/cado2/components/section-card/SectionCard";
import DealFiguresSection from "@features/sales/cado2/quotes/components/sheet/DealFiguresSection";
import ScheduleTable from "@features/sales/cado2/quotes/components/sheet/ScheduleTable";
import YearSections, { OrderTotalsFooter, type SectionYear } from "@features/sales/cado2/quotes/components/sheet/YearSections";
import { useCollapsedYears } from "@features/sales/cado2/quotes/components/sheet/useCollapsedYears";
import { hasYearlySchedule, orderForm, sheetFromForm } from "@features/sales/cado2/quotes/sheet/sheetModel";
import type { PricingPreview } from "@features/sales/cado2/quotes/api/quoteTypes";
import {
  usePricingFormulas,
  useProductsByIds,
  useQuoteSettings,
} from "@features/sales/cado2/quotes/api/useQuoteApi";
import {
  lineFromProduct,
  supportCheckOn,
  supportProblems,
  yearHasEnterprise,
  yearHasPremium,
} from "@features/sales/cado2/quotes/form/supportPlans";
import { unitOfMeasureFor } from "@features/sales/cado2/utils/pricingFormula";
import {
  addYear,
  commissionAfterYearChange,
  cloneYear,
  contractYears,
  deleteYear,
  insertIndex,
  isPartnerLed,
  lastYearEarliestEnd,
  lastYearEndProblem,
  MAX_YEARS,
  setLastYearEnd,
  type ContractYear,
  type DraftFormValues,
  type LineValue,
} from "@features/sales/cado2/quotes/form/draftForm";
import AddLineDialog from "@features/sales/cado2/quotes/components/AddLineDialog";
import TermCard from "@features/sales/cado2/quotes/components/TermCard";
import LastYearEnd from "@features/sales/cado2/quotes/components/LastYearEnd";
import PreviousProductsDialog from "@features/sales/cado2/quotes/components/PreviousProductsDialog";
import PartnerCommissionCard from "@features/sales/cado2/quotes/components/PartnerCommissionCard";
import PricingSetupCard from "@features/sales/cado2/quotes/components/PricingSetupCard";
import { useFieldIssue } from "@features/sales/cado2/quotes/components/fieldIssues";


interface ProductsStepProps {
  /** The latest live preview, if the quote could be priced. */
  readonly preview: PricingPreview | null;
}

function LineIssue({ index }: { index: number }) {
  const issues = [
    useFieldIssue(`lines[${index}].pricebookEntryId`),
    useFieldIssue(`lines[${index}].quantity`),
    useFieldIssue(`lines[${index}].discretionaryDiscountPercent`),
    useFieldIssue(`lines[${index}].yearNumber`),
    useFieldIssue(`lines[${index}].startDate`),
    useFieldIssue(`lines[${index}].endDate`),
    useFieldIssue(`lines[${index}]`),
  ].filter(Boolean);
  if (issues.length === 0) return null;
  return (
    <TableRow>
      <TableCell colSpan={8} sx={{ pt: 0, borderTop: 0 }}>
        <Typography variant="caption" color="error">
          {[...new Set(issues)].join(" · ")}
        </Typography>
      </TableCell>
    </TableRow>
  );
}

/**
 * Step ② Products & Pricing, laid out by year:
 *
 *   Price book → partner commission → Term (start date; where the years take it)
 *   Products                                          [Collapse all]
 *     ▾ Year 1  dates          3 products · USD …   [+ Product] [Clone] [Delete]
 *         Subscription / Support / Professional Services
 *     ▸ Year 2  dates (6 months)  …                  (the last year's end can be brought forward)
 *     [+ Add Year 3]
 *     Total order value · all 2 years              (the card's footer)
 *   Deal Figures → Yearly Schedule
 *
 * The AM adds the years; nothing is split automatically. Every year is 12
 * months except the last, which can be shorter. Any year can be deleted:
 * later ones move up. Clone year copies a year's recurring products into a
 * new year at the end. A new product goes after its year's other lines, so
 * line numbers run year by year.
 */
export default function ProductsStep({ preview }: ProductsStepProps): JSX.Element {
  const { control, getValues, setValue } = useFormContext<DraftFormValues>();
  const { fields, insert, update, remove, replace } = useFieldArray({
    control,
    name: "lines",
  });
  const values = useWatch({ control }) as DraftFormValues;
  const [editing, setEditing] = useState<{ open: boolean; index: number | null; year: number }>({
    open: false,
    index: null,
    year: 1,
  });
  // D159: a renewal's previous opportunities' products, read only, synced
  // or not; the AM adds products one by one.
  const isRenewal = Boolean(values.opportunityId) && values.dealKind === "RENEWAL";
  const previousIds = values.previousOpportunityIds ?? [];
  const [viewingPrevious, setViewingPrevious] = useState(false);
  const fold = useCollapsedYears();
  const linesIssue = useFieldIssue("lines");
  const yearsIssue = useFieldIssue("years");
  const lastEndIssue = useFieldIssue("lastYearEndDate");

  const currency = values.currencyIsoCode;
  // The opportunity's book must be usable; the card says what to fix otherwise.
  // Products can be added before the start date (D78); they are priced once it is chosen.
  const ready = Boolean(currency && values.defaultPricebookId);
  const years: SectionYear[] = values.startDate
    ? contractYears(values.startDate, values.yearCount, values.lastYearEndDate)
    : Array.from({ length: values.yearCount }, (_, i) => ({ number: i + 1, start: "", end: "" }));
  const fullLastEnd = contractYears(values.startDate, values.yearCount).at(-1)?.end ?? "";
  const lastProblem = lastYearEndProblem(values.startDate, values.yearCount, values.lastYearEndDate);
  // Why the amounts are blank.
  const amountsHint =
    preview || values.lines.length === 0
      ? null
      : !values.startDate
        ? "Amounts appear once the start date is chosen."
        : null;
  // The same lines, amounts and figures as the Review step's sheet.
  const sheet = useMemo(() => sheetFromForm(values, preview, null), [values, preview]);
  const total = orderForm(sheet.lines, sheet.partnerCommissionPercent);

  const onSave = (line: LineValue) => {
    if (editing.index === null) insert(insertIndex(getValues("lines"), line.yearNumber), line);
    else update(editing.index, line);
    setEditing({ open: false, index: null, year: 1 });
  };

  // D155: each year with a subscription is checked for its support plan; a
  // warning with one-click adds, never a block, never added by itself.
  const settings = useQuoteSettings();
  const plans = settings.data?.supportPlans ?? null;
  const supportOn = supportCheckOn(plans);
  const supportIds = supportOn
    ? [plans.enterprise?.productId, plans.standard?.productId, ...plans.premium.map((p) => p.productId)].filter(
        (id): id is string => Boolean(id),
      )
    : [];
  const supportProducts = useProductsByIds(supportIds, currency, values.defaultPricebookId);
  const formulas = usePricingFormulas();
  const supportIssues = supportProblems(values.lines, plans);
  const [premiumMenu, setPremiumMenu] = useState<{ anchor: HTMLElement; year: number } | null>(null);
  // A support product as a line in a year: quantity 1, priced from the book
  // (its formula, if any; the unit of measure its version's with %LIST_PRICE%
  // filled in, else Salesforce's, D158).
  const supportLine = (productId: string, year: SectionYear): LineValue | null => {
    const p = supportProducts.data?.find((x) => x.id === productId);
    if (!p) return null;
    const f = formulas.data?.find((x) => x.productId === p.id && x.status === "ACTIVE");
    return lineFromProduct(p, year, f ? unitOfMeasureFor(f.unitOfMeasure, p.pricebookEntries[0]?.unitPrice ?? "") : (p.unitOfMeasure ?? ""));
  };
  // Why a support product can't be added: not priced in the book, or its
  // classification isn't set up (as the product dialog says, D152).
  const notPriced = (productId: string) => {
    if (supportProducts.isPending) return "Loading…";
    const p = supportProducts.data?.find((x) => x.id === productId);
    if (!p || p.pricebookEntries.length === 0) return `Not in ${values.defaultPricebookName || "the quote's price book"} in ${currency}`;
    return p.classificationProblem ?? "";
  };
  const addSupport = (productId: string, n: number) => {
    const year = years.find((y) => y.number === n);
    const line = year ? supportLine(productId, year) : null;
    if (line) insert(insertIndex(getValues("lines"), n), line);
  };
  const supportButton = (label: string, productId: string, n: number, primary: boolean) => {
    const why = notPriced(productId);
    return (
      <Tooltip key={label} title={why}>
        <span>
          <Button
            size="small"
            variant={primary ? "outlined" : "text"}
            color="inherit"
            disabled={Boolean(why) || !ready}
            onClick={() => addSupport(productId, n)}
          >
            {label}
          </Button>
        </span>
      </Tooltip>
    );
  };

  // Year changes rewrite the count, the last year's end and, for clone and
  // delete, the lines together.
  // A year's rate follows the year (D151): added, cloned or deleted with it.
  const setYears = (
    next: { yearCount: number; lastYearEndDate: string; lines?: LineValue[] },
    change?: Parameters<typeof commissionAfterYearChange>[1],
  ) => {
    setValue("yearCount", next.yearCount, { shouldDirty: true });
    setValue("lastYearEndDate", next.lastYearEndDate, { shouldDirty: true });
    if (next.lines) replace(next.lines);
    const rates = getValues("partnerCommissionByYear");
    if (change && rates.length > 0) {
      const after = commissionAfterYearChange(rates, change);
      setValue("partnerCommissionByYear", after.byYear, { shouldDirty: true });
      if (after.single !== null) setValue("partnerCommissionPercent", after.single, { shouldDirty: true });
    }
  };
  const changeLastEnd = (end: string) => setValue("lastYearEndDate", setLastYearEnd(getValues(), end), { shouldDirty: true });

  const addButton = (n: number, label = "Product") => (
    <Button
      size="small"
      startIcon={<PlusIcon size={14} />}
      disabled={!ready}
      aria-label={`Add product to Year ${n}`}
      onClick={() => setEditing({ open: true, index: null, year: n })}
    >
      {label}
    </Button>
  );

  const yearActions = (n: number) => {
    const ofYear = values.lines.filter((l) => l.yearNumber === n);
    // An empty year has nothing to clone, and its add is in the empty state.
    // Any year can be deleted but the only one: a quote always has Year 1.
    const empty = ofYear.length === 0;
    const deletable = values.yearCount > 1;
    if (empty && !deletable) return null;
    const recurring = ofYear.filter((l) => l.recurring).length;
    // Premium Support, offered in a year with Enterprise Support until it
    // has one (D155).
    const premium =
      supportOn && plans.premium.length > 0 && yearHasEnterprise(values.lines, plans, n) && !yearHasPremium(values.lines, plans, n);
    return (
      <>
        {empty ? null : addButton(n)}
        {premium ? (
          <Button
            size="small"
            endIcon={<ChevronDownIcon size={14} />}
            disabled={!ready}
            aria-haspopup="menu"
            onClick={(e) => setPremiumMenu({ anchor: e.currentTarget, year: n })}
          >
            Add Premium Support
          </Button>
        ) : null}
        {empty ? null : (
          <Tooltip
            title={
              recurring === 0
                ? "No recurring products to copy"
                : emptyYear !== null
                  ? `Add a product to Year ${emptyYear} first`
                  : values.yearCount >= MAX_YEARS
                    ? `A quote has at most ${MAX_YEARS} years`
                    : `Copy Year ${n}'s ${recurring} recurring product${recurring === 1 ? "" : "s"} into a new Year ${values.yearCount + 1}`
            }
          >
            <span>
              <Button
                size="small"
                startIcon={<CopyIcon size={14} />}
                disabled={recurring === 0 || emptyYear !== null || values.yearCount >= MAX_YEARS || !values.startDate}
                onClick={() => setYears(cloneYear(getValues(), n), { clone: n })}
              >
                Clone
              </Button>
            </span>
          </Tooltip>
        )}
        {deletable ? (
          <Tooltip
            title={`Delete Year ${n}${ofYear.length ? ` and its ${ofYear.length} product${ofYear.length === 1 ? "" : "s"}` : ""}${n < values.yearCount ? "; later years move up" : ""}`}
          >
            <IconButton
              size="small"
              aria-label={`Delete Year ${n}`}
              onClick={() => {
                setYears(deleteYear(getValues(), n), { remove: n });
                fold.reset();
              }}
            >
              <Trash2Icon size={16} />
            </IconButton>
          </Tooltip>
        ) : null}
      </>
    );
  };

  // Only the last year may be shorter than 12 months: its end date in the
  // header is clickable (2026-10-26); a problem with it shows above its products.
  const yearEnd = (n: number) =>
    n === values.yearCount && values.startDate && years[n - 1]?.end ? (
      <LastYearEnd
        yearNumber={n}
        start={years[n - 1].start}
        end={years[n - 1].end}
        fullEnd={fullLastEnd}
        earliest={lastYearEarliestEnd(values)}
        onChange={changeLastEnd}
      />
    ) : null;
  const yearTop = (n: number) => {
    const ofYear = supportIssues.filter((p) => p.year === n);
    const lastEnd = n === values.yearCount && (lastProblem || lastEndIssue);
    if (!lastEnd && ofYear.length === 0) return null;
    return (
      <Stack spacing={1}>
        {lastEnd ? <Alert severity="error">{lastProblem || lastEndIssue}</Alert> : null}
        {ofYear.map((p) => (
          <Alert
            key={p.kind}
            severity="warning"
            aria-label="Support plan"
            action={
              p.kind === "NONE" && plans ? (
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  {plans.enterprise ? supportButton("Add Enterprise Support", plans.enterprise.productId, n, true) : null}
                  {plans.standard ? supportButton("Add Standard Support", plans.standard.productId, n, false) : null}
                </Stack>
              ) : undefined
            }
          >
            {p.message}
          </Alert>
        ))}
      </Stack>
    );
  };
  // The first year without products, if any: it's filled before another is added.
  const emptyYear = years.find((y) => !values.lines.some((l) => l.yearNumber === y.number))?.number ?? null;

  // Lines whose year was removed or never set (none normally): listed so they can be fixed.
  const orphans = values.lines.flatMap((l, i) => (l.yearNumber >= 1 && l.yearNumber <= values.yearCount ? [] : [i]));
  const editingYear = years.find((y) => y.number === editing.year);
  const anyFolded = fold.collapsed.size > 0;

  return (
    <Stack spacing={2.5}>
      {linesIssue ? <Alert severity="error">{linesIssue}</Alert> : null}

      {/* The opportunity's currency and price book, locked. */}
      <PricingSetupCard />

      {/* Partner-led: the commission, right above the products whose totals it
          changes (D91); shown before any product too. */}
      {isPartnerLed(values) ? (
        <PartnerCommissionCard
          commission={total.commission}
          total={total.total}
          currency={currency}
          yearCommissions={Array.from({ length: values.yearCount }, (_, i) => preview?.years.find((y) => y.yearNumber === i + 1)?.commission)}
        />
      ) : null}

      {/* When it starts and where the years take it, right above the products
          it lays out (2026-10-23). */}
      <TermCard />

      <SectionCard
        title="Products"
        icon={<PackageIcon size={18} />}
        aside={
          isRenewal || years.length > 1 ? (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {/* D159: the products on the opportunities this renewal replaces. */}
              {isRenewal ? (
                <Tooltip title={previousIds.length === 0 ? "Choose the opportunities this renewal replaces in Overview to see their products." : ""}>
                  <span>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<HistoryIcon size={14} />}
                      disabled={previousIds.length === 0}
                      onClick={() => setViewingPrevious(true)}
                    >
                      Previous year&apos;s products
                    </Button>
                  </span>
                </Tooltip>
              ) : null}
              {years.length > 1 ? (
                <Button
                  size="small"
                  startIcon={anyFolded ? <ChevronsUpDownIcon size={14} /> : <ChevronsDownUpIcon size={14} />}
                  onClick={() => fold.toggleAll(years.map((y) => y.number))}
                >
                  {anyFolded ? "Expand all" : "Collapse all"}
                </Button>
              ) : null}
            </Stack>
          ) : undefined
        }
      >
        {yearsIssue ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {yearsIssue}
          </Alert>
        ) : null}
        {/* A failed lookup says so, rather than looking like "off" or "not a renewal". */}
        {settings.error ? (
          <ErrorNotice error={settings.error} onRetry={() => void settings.refetch()} retrying={settings.isFetching} sx={{ mb: 2 }}>
            Couldn&apos;t load the support plans, so this quote&apos;s support isn&apos;t checked.
          </ErrorNotice>
        ) : null}
        {orphans.length ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {orphans.length === 1 ? "1 product has" : `${orphans.length} products have`} no year:{" "}
            {orphans.map((i) => values.lines[i].productName).join(", ")}. Remove {orphans.length === 1 ? "it" : "them"} and
            add {orphans.length === 1 ? "it" : "them"} to a year.
            <Box sx={{ mt: 1 }}>
              {orphans.map((i) => (
                <Button key={fields[i]?.id ?? i} size="small" color="inherit" onClick={() => remove(i)}>
                  Remove {values.lines[i].productName}
                </Button>
              ))}
            </Box>
          </Alert>
        ) : null}

        {/* Year 1 is always there (2026-10-26). */}
        <>
            <YearSections
              years={years}
              lines={sheet.lines}
              currency={currency}
              commissionPercent={sheet.partnerCommissionPercent}
              collapsed={fold.collapsed}
              onToggle={fold.toggle}
              yearActions={yearActions}
              yearTop={yearTop}
              yearEnd={yearEnd}
              empty={(n) => (
                // A slim panel, the size of a couple of product rows: an empty
                // year doesn't outweigh a filled one (2026-10-26).
                <Stack
                  spacing={1}
                  alignItems="center"
                  sx={{ py: 1.75, px: 2, border: 1, borderStyle: "dashed", borderColor: "divider", borderRadius: 2 }}
                >
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
                    No products yet. Add them from {values.defaultPricebookName || "the quote's price book"}.
                  </Typography>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<PlusIcon size={14} />}
                    disabled={!ready}
                    aria-label={`Add product to Year ${n}`}
                    onClick={() => setEditing({ open: true, index: null, year: n })}
                  >
                    Add product
                  </Button>
                </Stack>
              )}
              lineActions={(i) => (
                <>
                  <Tooltip title="Edit">
                    <IconButton
                      size="small"
                      aria-label={`Edit line ${i + 1}`}
                      onClick={() => setEditing({ open: true, index: i, year: values.lines[i].yearNumber })}
                    >
                      <PencilIcon size={16} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Remove">
                    <IconButton size="small" aria-label={`Remove line ${i + 1}`} onClick={() => remove(i)}>
                      <Trash2Icon size={16} />
                    </IconButton>
                  </Tooltip>
                </>
              )}
              below={(i) => <LineIssue key={fields[i]?.id} index={i} />}
              flagNotSetUp
            />
            {/* The next year once every year has products, so empty years
                don't pile up. */}
            {values.lines.length > 0 && values.yearCount < MAX_YEARS ? (
              <Tooltip title={emptyYear === null ? "" : `Add a product to Year ${emptyYear} first`}>
                <Box component="span" sx={{ display: "inline-block", my: 2 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<PlusIcon size={14} />}
                    disabled={emptyYear !== null}
                    onClick={() => setYears(addYear(getValues()), { add: true })}
                  >
                    Add Year {values.yearCount + 1}
                  </Button>
                </Box>
              </Tooltip>
            ) : null}
            {amountsHint ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {amountsHint}
              </Typography>
            ) : null}
            {/* Totals with the first product. */}
            {values.lines.length > 0 ? (
              <OrderTotalsFooter
                lines={sheet.lines}
                currency={currency}
                commissionPercent={sheet.partnerCommissionPercent}
                commissionRates={sheet.partnerCommissionRates}
                yearCount={values.yearCount}
              />
            ) : null}
        </>
      </SectionCard>

      {fields.length > 0 ? <DealFiguresSection sheet={sheet} /> : null}

      {hasYearlySchedule(sheet) ? (
        <SectionCard title="Yearly Schedule" icon={<ChartColumnIcon size={18} />}>
          <ScheduleTable
            years={sheet.years}
            lines={sheet.lines}
            netOfCommission={sheet.partnerCommissionPercent !== null}
            commissionRates={sheet.partnerCommissionRates ?? (sheet.partnerCommissionPercent ? [sheet.partnerCommissionPercent] : null)}
          />
        </SectionCard>
      ) : null}

      {editing.open && values.defaultPricebookId ? (
        <AddLineDialog
          key={editing.index ?? `new-${editing.year}`}
          open
          line={editing.index === null ? null : getValues(`lines.${editing.index}`)}
          currency={currency}
          pricebook={{ id: values.defaultPricebookId, name: values.defaultPricebookName }}
          year={editingYear && editingYear.start ? (editingYear as ContractYear) : null}
          onSave={onSave}
          onClose={() => setEditing({ open: false, index: null, year: 1 })}
        />
      ) : null}
      <Menu
        anchorEl={premiumMenu?.anchor ?? null}
        open={premiumMenu !== null}
        onClose={() => setPremiumMenu(null)}
      >
        {(plans?.premium ?? []).map((p) => (
          <MenuItem
            key={p.productId}
            disabled={Boolean(notPriced(p.productId))}
            onClick={() => {
              if (premiumMenu) addSupport(p.productId, premiumMenu.year);
              setPremiumMenu(null);
            }}
          >
            {p.code ? `${p.name} · ${p.code}` : p.name}
          </MenuItem>
        ))}
      </Menu>
      <PreviousProductsDialog
        open={viewingPrevious}
        opportunityIds={previousIds}
        accountName={values.accountName}
        onClose={() => setViewingPrevious(false)}
      />
    </Stack>
  );
}

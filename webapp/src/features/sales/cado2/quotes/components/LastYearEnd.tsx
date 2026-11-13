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

import { useState, type JSX, type SyntheticEvent } from "react";
import { Box, Button, DatePickers, Popover, Stack, Tooltip, Typography } from "@wso2/oxygen-ui";
import { PencilIcon } from "@wso2/oxygen-ui-icons-react";
import { formatDate, parseDateString, toDateString } from "@features/sales/cado2/quotes/form/draftForm";

const { DateCalendar } = DatePickers;

// Clicks inside don't fold the year whose header holds it.
const keep = (e: SyntheticEvent) => e.stopPropagation();

/**
 * The last year's end date in its header, clickable (2026-10-26): a small
 * calendar opens to bring it forward; only the last year can be shorter
 * than 12 months. "Full year" puts it back.
 *
 *   Year 2   1 Feb 2028 – 31 Jan 2029 ✎
 */
export default function LastYearEnd({
  yearNumber,
  start,
  end,
  fullEnd,
  earliest,
  onChange,
}: {
  yearNumber: number;
  start: string;
  end: string;
  /** The end of a full 12-month year: the latest it can be. */
  fullEnd: string;
  /** The latest-ending one-off line in the year: it can't end before it (D146). */
  earliest?: { date: string; productName: string } | null;
  onChange: (end: string) => void;
}): JSX.Element {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = () => setAnchor(null);
  // What clicking it does, said on hover and to screen readers.
  const purpose =
    end === fullEnd
      ? `Shorten Year ${yearNumber}: the last year can end earlier`
      : `Change when Year ${yearNumber} ends, or make it a full year again`;
  return (
    <>
      <Tooltip title={purpose}>
        <Button
          size="small"
          variant="text"
          color="inherit"
          endIcon={<PencilIcon size={12} />}
          aria-label={`Year ${yearNumber} ends ${formatDate(end)}. ${purpose}`}
          onClick={(e) => {
            keep(e);
            setAnchor(e.currentTarget);
          }}
          onKeyDown={keep}
          sx={{
            minWidth: 0,
            px: 0.5,
            py: 0,
            font: "inherit",
            color: "text.secondary",
            textTransform: "none",
            borderBottom: 1,
            borderStyle: "dashed",
            borderColor: "divider",
            borderRadius: 0,
            "&:hover": { color: "text.primary", bgcolor: "transparent", borderColor: "primary.main" },
          }}
        >
          {formatDate(end)}
        </Button>
      </Tooltip>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        onClick={keep}
        onKeyDown={keep}
      >
        <Box sx={{ p: 1.5 }} aria-label={`When Year ${yearNumber} ends`}>
          <Typography variant="subtitle2" sx={{ px: 1 }}>
            Year {yearNumber} ends
          </Typography>
          <DateCalendar
            value={parseDateString(end)}
            minDate={parseDateString(earliest && earliest.date > start ? earliest.date : start) ?? undefined}
            maxDate={parseDateString(fullEnd) ?? undefined}
            onChange={(d: Date | null) => {
              if (d && !Number.isNaN(d.getTime())) {
                onChange(toDateString(d));
                close();
              }
            }}
          />
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ px: 1, maxWidth: 320 }}>
            <Typography variant="caption" color="text.secondary">
              {earliest
                ? `Can't end before ${formatDate(earliest.date)}: ${earliest.productName} runs until then. Change its dates first.`
                : "Only the last year can be shorter."}
            </Typography>
            {end !== fullEnd ? (
              <Button
                size="small"
                onClick={() => {
                  onChange(fullEnd);
                  close();
                }}
              >
                Full year
              </Button>
            ) : null}
          </Stack>
        </Box>
      </Popover>
    </>
  );
}

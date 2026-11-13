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

import { Box, Button, Chip, Drawer, IconButton, Link, Typography } from "@wso2/oxygen-ui";
import { ExternalLinkIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import { categoryChipColor, categoryStyle } from "../calendarCategories";
import { longDate } from "../calendarDates";
import type { CalendarItem } from "../marketingCalendarTypes";

// One item's details in a drawer on the right. The fields are chosen by the
// item's own category, so an item opened from the All view reads the same as
// from its tab. A field with no value is left out rather than shown as a dash.
export default function CalendarItemDrawer({
  item,
  onClose,
}: {
  // Open while an item is set.
  item: CalendarItem | null;
  onClose: () => void;
}) {
  return (
    <Drawer
      anchor="right"
      open={item !== null}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: "100%", sm: 400 }, p: 3 } } }}
    >
      {item && <ItemDetails item={item} onClose={onClose} />}
    </Drawer>
  );
}

interface Field {
  label: string;
  value: string | readonly string[] | undefined;
  // "date": a YYYY-MM-DD shown long. "text": an abstract or email body, shown as
  // written with its line breaks — plain text, never HTML or markdown. "link":
  // a link when it is an https URL, text otherwise.
  kind?: "date" | "text" | "link";
}

// The heading and the rows under it, per category, in the order the marketing
// team listed them. The heading is each list's first field (Title, or the Event
// Name), so it isn't repeated as a row.
function itemFields(item: CalendarItem): { heading: string; fields: Field[] } {
  const date: Field = { label: categoryStyle(item.category).dateLabel, value: item.date, kind: "date" };
  const bu: Field = { label: "BU", value: item.bu };
  const region: Field = { label: "Region", value: item.region };

  switch (item.category) {
    case "content":
      return {
        heading: item.title,
        fields: [
          { label: "Author", value: item.details.author },
          { label: "Content type", value: item.details.contentType },
          { label: "Format", value: item.details.format },
          { label: "Target persona", value: item.details.targetPersona },
          date,
          bu,
          { label: "Abstract", value: item.details.abstract, kind: "text" },
        ],
      };
    case "event":
      return {
        heading: item.details.eventName ?? item.title,
        fields: [
          { label: "Event Start Date", value: item.details.startDate, kind: "date" },
          { label: "Event End Date", value: item.details.endDate, kind: "date" },
          { label: "Event Type", value: item.details.eventType },
          { label: "Salesforce Campaign", value: item.details.salesforceCampaign, kind: "link" },
          bu,
          region,
        ],
      };
    case "social":
      return {
        heading: item.title,
        fields: [
          date,
          { label: "Platform", value: item.details.platform },
          { label: "Handle", value: item.details.handle },
          bu,
        ],
      };
    case "email":
      return {
        heading: item.title,
        fields: [
          date,
          bu,
          region,
          { label: "Subject line", value: item.details.subjectLine },
          { label: "Sender", value: item.details.sender },
          { label: "Email body copy", value: item.details.bodyCopy, kind: "text" },
        ],
      };
    case "release":
      return {
        heading: item.title,
        fields: [
          { label: "Product name", value: item.details.productName },
          { label: "Version", value: item.details.version },
          bu,
          { label: "Release type", value: item.details.releaseType },
          { label: "Tier", value: item.details.tier },
          { label: "Website Availability Date", value: item.details.websiteDate, kind: "date" },
          date,
        ],
      };
  }
}

function ItemDetails({ item, onClose }: { item: CalendarItem; onClose: () => void }) {
  const style = categoryStyle(item.category);
  const paint = categoryChipColor(style, "outlined");
  const { heading, fields } = itemFields(item);
  const shownFields = fields.filter((field) => field.value !== undefined && field.value.length > 0);
  const state = item.state === "open" ? "Open" : "Closed";

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Chip label={style.label} color={paint.color} variant="outlined" size="small" sx={paint.sx} />
        <IconButton size="small" aria-label="Close details" onClick={onClose}>
          <XIcon size={18} />
        </IconButton>
      </Box>

      <Typography variant="h6" component="h2" sx={{ fontWeight: 600, mb: 0.5 }}>
        {heading}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {item.status ? `${item.status} · ${state}` : state}
      </Typography>

      {shownFields.length > 0 && (
        <Box component="dl" sx={{ m: 0, mb: 3 }}>
          {shownFields.map((field) => (
            <Box key={field.label} sx={{ py: 0.75, borderBottom: 1, borderColor: "divider" }}>
              <Typography component="dt" variant="caption" color="text.secondary">
                {field.label}
              </Typography>
              <Typography
                component="dd"
                variant="body2"
                sx={{ m: 0, overflowWrap: "anywhere", whiteSpace: field.kind === "text" ? "pre-wrap" : undefined }}
              >
                <FieldValue field={field} />
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Only https links are written into an href — docs/conventions.md. */}
      {isHttpsUrl(item.url) && (
        <Button
          component="a"
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          variant="outlined"
          size="small"
          startIcon={<ExternalLinkIcon size={16} />}
        >
          Open in GitHub
        </Button>
      )}
    </>
  );
}

function FieldValue({ field }: { field: Field }) {
  const { value } = field;
  if (value === undefined) return null;
  if (typeof value !== "string") return value.join(", ");
  if (field.kind === "date") return longDate(value);
  if (field.kind === "link" && isHttpsUrl(value)) {
    return (
      <Link href={value} target="_blank" rel="noopener noreferrer">
        {value}
      </Link>
    );
  }
  return value;
}

function isHttpsUrl(url: string): boolean {
  return /^https:\/\//i.test(url);
}

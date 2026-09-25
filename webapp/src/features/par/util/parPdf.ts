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

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Par360Review, ParRating } from "../api/types";
import { decodeParComment, sanitizeParHtml } from "./parComment";
import { pdfRatingText } from "./parLabels";

type PdfRow = (string | { content: string; colSpan?: number; styles: Record<string, unknown> })[];

// Ports par-app's EmployeePar.tsx downloadPDF (and, when `reviews` is
// passed, LeadReviewPanel.tsx's extended version): a two-column table under
// a header naming the employee, their rating, special rating, and who
// shared it, optionally followed by a "360° Reviews" section — one row per
// reviewer, unfiltered by review status (the on-screen 360 list filters to
// SHARED-only; the PDF export never did).
export function downloadParPdf(rating: ParRating, selfComment: string, leadComment: string, reviews?: Par360Review[]): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  const rows: PdfRow[] = [];
  if (selfComment) {
    rows.push([
      "Employee Comment",
      "",
      { content: htmlToPdfText(selfComment), styles: { textColor: [50, 50, 50], cellPadding: 6 } },
    ]);
  }
  if (leadComment) {
    rows.push([
      "Lead Comment",
      "",
      { content: htmlToPdfText(leadComment), styles: { textColor: [50, 50, 50], cellPadding: 6 } },
    ]);
  }

  if (reviews && reviews.length > 0) {
    rows.push([{ content: "360° Reviews", colSpan: 3, styles: { fontStyle: "bold", fillColor: [200, 200, 200], halign: "center" } }]);
  }
  (reviews ?? []).forEach((review) => {
    rows.push([
      review.reviewerEmail ?? "-",
      review.reviewRating ?? "-",
      {
        content: review.reviewComment ? htmlToPdfText(decodeParComment(review.reviewComment)) : "-",
        styles: { textColor: [50, 50, 50], cellPadding: 6 },
      },
    ]);
  });

  autoTable(doc, {
    head: [
      [
        {
          content:
            ` - Employee: ${rating.parEmployeeEmail}\n` +
            ` - PAR Rating: ${pdfRatingText(rating.parRating)}\n` +
            ` - Top 5%/20% Rating: ${pdfRatingText(rating.parSpecialRating)}\n` +
            ` - PAR Shared By: ${rating.parRatingSharedBy || "Not Provided"}`,
          colSpan: 3,
          styles: { halign: "left", fontSize: 12, cellPadding: 10 },
        },
      ],
    ],
    showHead: "firstPage",
    body: rows,
    startY: 30,
    styles: { fontSize: 9, cellPadding: 4, overflow: "linebreak", valign: "top" },
    columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 60 }, 2: { cellWidth: "auto" } },
  });

  doc.save(`${rating.parEmployeeEmail}_par_summary.pdf`);
}

// Converts sanitized comment HTML into indented plain text for the PDF body
// — lists become "•"/"1." lines, matching what the rich-text editor showed.
const BLOCK_TAGS = new Set(["P", "UL", "OL"]);

export function htmlToPdfText(html: string): string {
  const root = document.createElement("div");
  root.innerHTML = sanitizeParHtml(html);

  const walk = (el: Element, depth: number): string => {
    const indent = "    ".repeat(depth);
    if (el.tagName === "UL" || el.tagName === "OL") {
      const ordered = el.tagName === "OL";
      return Array.from(el.children)
        .map((li, i) => `${indent}${ordered ? `${i + 1}.` : "•"} ${walk(li, depth + 1).trim()}\n`)
        .join("");
    }
    // Recurse only while there are further block-level children (nested
    // paragraphs/lists), so each one keeps its own line. A leaf paragraph
    // or list item is read via `textContent` in one go — walking its
    // *element* children alone would skip direct text sitting beside
    // inline formatting, e.g. "the"/"." in <p><b>Shipped</b> the <em>port</em>.</p>.
    const hasBlockChildren = Array.from(el.children).some((c) => BLOCK_TAGS.has(c.tagName));
    if (hasBlockChildren) {
      return Array.from(el.children)
        .map((child) => walk(child, depth))
        .join("");
    }
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    return text ? `${text}\n` : "";
  };

  const text = walk(root, 0)
    .split("\n")
    .map((line) => (line.trim() ? `    ${line}` : line))
    .join("\n")
    .trim();
  return text || "-";
}

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

// Lead import: the shapes of POST /api/events/lead-import/suggest and of the page's own
// mapping state.

export type Confidence = "high" | "medium" | "low";

/** Which half of a full name a column takes. */
export type Split = "first" | "last";

/** How a template column got its source. The server answers exact/claude/none; "you" is
 *  a choice the person made on the page. */
export type MappingHow = "exact" | "claude" | "none" | "you";

/** What the Claude step came to, for the notice above the mapping. */
export type ClaudeStep = "used" | "not_needed" | "not_configured" | "failed";

/** One column of the raw file, below its heading row. */
export interface SourceColumn {
  /** 0-based column index in the sheet. */
  index: number;
  heading: string;
  /** The first few distinct non-empty values, cut short. */
  samples: string[];
  /** How many cells below the heading have a value. */
  filled: number;
}

/** Where one template column takes its values from. */
export interface MappingEntry {
  /** The template column (FieldDef.field_name). */
  field_name: string;
  source_index: number | null;
  split: Split | null;
  how: MappingHow;
  confidence: Confidence | null;
  reason: string | null;
}

export interface SuggestRequest {
  status: string;
  columns: { index: number; heading: string; samples: string[] }[];
}

export interface SuggestResponse {
  claude: ClaudeStep;
  mapping: MappingEntry[];
}

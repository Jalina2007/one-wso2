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

// A call produces a new recording, transcript or smart notes each time one is stopped and
// restarted. These place a transcript line on the right recording.
//
// A transcript line carries the absolute instant it was spoken; a recording part carries
// the instants it started and ended. Within a part, a line's position is how long after
// the part's start it was said. Parts Meet no longer has times for (it keeps them 30 days)
// cannot be placed this way, so the line's own offset is used, as before parts existed.

import type { MeetingPart, TranscriptLine } from "../api/salesTypes";
import { parseUtc } from "./salesTime";

/** The parts that can be opened, in the order the backend listed them. */
export function attachedParts(parts: readonly MeetingPart[] | undefined): MeetingPart[] {
  return (parts ?? []).filter((part) => part.state === "ATTACHED");
}

/** True when every part has a start, so lines can be placed on them by time. */
export function partsAreTimed(parts: readonly MeetingPart[]): boolean {
  return parts.length > 0 && parts.every((part) => parseUtc(part.startTime) !== null);
}

/** Where a line falls: which recording, and how many seconds into it. */
export interface LinePlace {
  recordingId: number;
  offsetSeconds: number;
}

/**
 * The recording a line was spoken during, and its position there.
 *
 * Null when the parts are timed and the line falls between them -- said while nothing was
 * recording. When they are not timed, the line's own offset is the best there is, and that
 * offset counts from the start of the call, which is where the FIRST recording starts: the
 * line goes there, whichever part is being played, so switching parts never moves it. A
 * meeting listing no recordings at all puts its lines on `defaultRecordingId`.
 */
export function placeLine(
  line: TranscriptLine,
  recordings: readonly MeetingPart[],
  defaultRecordingId: number,
): LinePlace | null {
  if (!partsAreTimed(recordings)) {
    return { recordingId: recordings[0]?.id ?? defaultRecordingId, offsetSeconds: line.offsetSeconds };
  }
  const spoken = parseUtc(line.startTime);
  if (!spoken) return null;
  for (const recording of recordings) {
    const start = parseUtc(recording.startTime) as Date;
    const end = parseUtc(recording.endTime);
    if (spoken >= start && (end === null || spoken <= end)) {
      return { recordingId: recording.id, offsetSeconds: (spoken.getTime() - start.getTime()) / 1000 };
    }
  }
  return null;
}

/**
 * A part's label: "Part 2 · 10:30" when the call has several, by its start in the viewer's
 * own zone, or just "Part 2" when Meet no longer has its time. `noun` names the kind, e.g.
 * "Transcript 2".
 */
export function partLabel(part: MeetingPart, index: number, noun = "Part"): string {
  const start = parseUtc(part.startTime);
  if (!start) return `${noun} ${index + 1}`;
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${noun} ${index + 1} · ${pad(start.getHours())}:${pad(start.getMinutes())}`;
}

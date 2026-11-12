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

// Lead import data layer — a raw event lead file in, the List Import Template out.
//
// Gated by the same `events` capability as My Submissions (the backend mounts these
// routes under the Events router's guard). Runs are PER-USER (owner-scoped server-side),
// so the list key carries the sub, as the Events submission keys do. A run and its sheet
// are keyed by their unguessable id, and the server answers 404 for another user's id.
//
// A conversion runs in the background on the server (30 s to a few minutes). Nothing
// polls: the server emails the uploader when the run is ready or failed, and the email
// links back here. The list refreshes on Refresh and when the person comes back to the tab
// (the app turns focus refetch off, so these queries turn it on).

import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedDelete, authedGet, authedPost, fetchWithReauth, HttpError } from "@api/http";
import { describeError, httpRetry } from "@api/errors";
import { useAccessToken } from "@hooks/useAccessToken";
import { useAsgardeoSub } from "@hooks/useAsgardeoSub";
import {
  isMarketingOpsBackendConfigured,
  marketingOpsServiceUrls as urls,
} from "@config/apiConfig";
import { isPreviewEnabled } from "@config/previewFeatures";
import { downloadAuthed } from "../events/lib/download";
import type { SheetType } from "../events/lib/leadImport";
import type {
  CellEdit,
  LeadImportDetail,
  LeadImportFileKind,
  LeadImportOptions,
  LeadImportRun,
  LeadSheet,
} from "../events/leadImportTypes";

const KEY = {
  options: ["marketing-ops", "events", "lead-import", "options"] as const,
  /** Every user's list: the prefix to invalidate. */
  runs: ["marketing-ops", "events", "lead-import", "runs"] as const,
  ownRuns: (sub?: string) => ["marketing-ops", "events", "lead-import", "runs", sub] as const,
  run: (id: string) => ["marketing-ops", "events", "lead-import", "run", id] as const,
  sheet: (id: string) => ["marketing-ops", "events", "lead-import", "sheet", id] as const,
  /** Mutations that rebuild a run's workbook: confirm/undo and cell edits. */
  rebuild: ["marketing-ops", "events", "lead-import", "rebuild"] as const,
};

function useBase() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state } = useAsgardeoSub();
  const sub = state.status === "ready" ? state.sub : undefined;
  const ready = isSignedIn && isMarketingOpsBackendConfigured() && isPreviewEnabled("eventsLeadImport");
  return { getAccessToken, sub, ready };
}

/** The backend's message for a refusal ("Upload an .xlsx, .xls or .csv file…").
 *  FastAPI nests it under `detail`, which describeError does not read; the raw body is
 *  still never shown. */
export function leadImportError(err: unknown): string {
  if (err instanceof HttpError && err.responseBody) {
    try {
      const parsed = JSON.parse(err.responseBody) as { detail?: { message?: unknown } };
      const message = parsed?.detail?.message;
      if (typeof message === "string" && message.trim()) return message;
    } catch {
      // not JSON — fall through
    }
  }
  return describeError(err);
}

export function useLeadImportOptions() {
  const { getAccessToken, ready } = useBase();
  return useQuery<LeadImportOptions>({
    queryKey: KEY.options,
    enabled: ready,
    queryFn: async () =>
      authedGet<LeadImportOptions>(urls.eventsLeadImportOptions, await getAccessToken()),
    staleTime: 10 * 60 * 1000,
    retry: httpRetry,
  });
}

/** Recently converted — the caller's live runs, newest first. */
export function useLeadImportRuns() {
  const { getAccessToken, sub, ready } = useBase();
  return useQuery<LeadImportRun[]>({
    queryKey: KEY.ownRuns(sub),
    enabled: ready && Boolean(sub),
    queryFn: async () =>
      authedGet<LeadImportRun[]>(urls.eventsLeadImportRuns, await getAccessToken()),
    staleTime: 10 * 1000,
    refetchOnWindowFocus: true,
    retry: httpRetry,
  });
}

export function useLeadImportRun(id: string | null) {
  const { getAccessToken, ready } = useBase();
  return useQuery<LeadImportDetail>({
    queryKey: KEY.run(id ?? ""),
    enabled: ready && Boolean(id),
    queryFn: async () =>
      authedGet<LeadImportDetail>(urls.eventsLeadImportRun(id!), await getAccessToken()),
    // Only while it converts: a refetch during a confirm/undo could answer after the
    // rebuild and put the older detail back.
    refetchOnWindowFocus: (query) => query.state.data?.run.status === "processing",
    retry: httpRetry,
  });
}

export function useUploadLeadFile() {
  const { getAccessToken } = useBase();
  const qc = useQueryClient();
  return useMutation({
    // The sheet type reaches Claude as a routing hint (which tab the leads belong on).
    mutationFn: async ({ file, sheetType }: { file: File; sheetType: SheetType }) => {
      const url = urls.eventsLeadImportUpload(file.name, sheetType);
      // The file is the raw request body, not multipart: the server reads the bytes as they are.
      const res = await fetchWithReauth(
        url,
        { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: file },
        await getAccessToken(),
      );
      if (!res.ok) throw new HttpError(url, res.status, await res.text().catch(() => ""));
      return (await res.json()) as { id: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY.runs }),
  });
}

/** Delete a run and all its files on the server now, instead of waiting for it to expire.
 *  Refused (409) while the file is still converting. */
export function useDeleteLeadImport() {
  const { getAccessToken } = useBase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await authedDelete(urls.eventsLeadImportRun(id), await getAccessToken());
    },
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: KEY.run(id) });
      qc.removeQueries({ queryKey: KEY.sheet(id) });
      return qc.invalidateQueries({ queryKey: KEY.runs });
    },
  });
}

/** The converted workbook as the server reads it back — what the download holds. Only
 *  for a ready run; it changes only when a confirm/undo or an edit rebuilds the workbook. */
export function useLeadImportSheet(id: string, enabled: boolean) {
  const { getAccessToken, ready } = useBase();
  return useQuery<LeadSheet>({
    queryKey: KEY.sheet(id),
    enabled: ready && enabled,
    queryFn: async () =>
      authedGet<LeadSheet>(urls.eventsLeadImportSheet(id), await getAccessToken()),
    staleTime: Infinity,
    retry: httpRetry,
  });
}

/** After a rebuild: the returned detail replaces the cached one, and the sheet is
 *  refetched. Awaited, so the caller's edit stays on screen until the new sheet is in. */
function useAfterRebuild() {
  const qc = useQueryClient();
  return async (detail: LeadImportDetail | null, id: string) => {
    if (detail) qc.setQueryData(KEY.run(id), detail);
    void qc.invalidateQueries({ queryKey: KEY.runs });
    await qc.invalidateQueries({ queryKey: KEY.sheet(id) });
  };
}

/** True while a confirm/undo or a cell edit is rebuilding the workbook. The page allows
 *  one rebuild at a time: two in flight could answer out of order, and the older detail
 *  would replace the newer one. */
export function useLeadImportRebuilding(): boolean {
  return useIsMutating({ mutationKey: KEY.rebuild }) > 0;
}

/** Confirm or undo changes (or user edits) by id. The server replays the saved plan (no
 *  Claude call, a few seconds) and returns the new detail. */
export function useApplyLeadChanges() {
  const { getAccessToken } = useBase();
  const afterRebuild = useAfterRebuild();
  return useMutation({
    mutationKey: KEY.rebuild,
    mutationFn: async ({ id, confirm, undo }: { id: string; confirm: string[]; undo: string[] }) =>
      authedPost<LeadImportDetail>(urls.eventsLeadImportApply(id), await getAccessToken(), {
        confirm,
        undo,
      }),
    onSuccess: (detail, { id }) => afterRebuild(detail, id),
  });
}

/** Save cell edits. The server records them in the plan and rebuilds the workbook, so
 *  the download always matches the sheet; every edit is undoable. */
export function useSaveLeadEdits() {
  const { getAccessToken } = useBase();
  const afterRebuild = useAfterRebuild();
  return useMutation({
    mutationKey: KEY.rebuild,
    mutationFn: async ({ id, cells }: { id: string; cells: CellEdit[] }) =>
      authedPost<LeadImportDetail>(urls.eventsLeadImportEdits(id), await getAccessToken(), {
        cells,
      }),
    onSuccess: (detail, { id }) => afterRebuild(detail, id),
  });
}

export function useFinishLeadImport() {
  const { getAccessToken } = useBase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      authedPost<LeadImportDetail>(urls.eventsLeadImportFinish(id), await getAccessToken(), {}),
    onSuccess: (detail, id) => {
      if (detail) qc.setQueryData(KEY.run(id), detail);
      void qc.invalidateQueries({ queryKey: KEY.runs });
    },
  });
}

export function useDownloadLeadFile() {
  const { getAccessToken } = useBase();
  return useMutation({
    mutationFn: async ({
      id,
      kind,
      filename,
    }: {
      id: string;
      kind: LeadImportFileKind;
      filename: string;
    }) => downloadAuthed(urls.eventsLeadImportFile(id, kind), await getAccessToken(), filename),
  });
}

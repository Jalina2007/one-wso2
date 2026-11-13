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

// Writes to amplify-api.
//
// No Idempotency-Key header: the Choreo API proxy's CORS allow-list doesn't
// include it, so a browser POST carrying it passes the preflight and is then
// blocked. amplify-api treats the header as optional. Controls are disabled
// while their mutation is pending, which stops most double clicks, and a share
// is one per campaign per employee on the server. No React Query `retry`: a 4xx
// here is a final answer.

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { authedDelete, authedPatch, authedPost } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { amplifyServiceUrls } from "@config/apiConfig";
import { useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { amplifyKey } from "./useAmplifyData";
import type {
  Campaign,
  CampaignDraft,
  CampaignPatch,
  CampaignRegistration,
  DashboardOperations,
  ConnectAuthorization,
  LinkedInConnection,
  Share,
  ShareKind,
} from "./amplifyTypes";

// Marks the key stale and refetches it now, including lists no page is showing. The app's QueryClient sets
// `refetchOnMount: false`, so a stale list that isn't on screen would otherwise never reload: save a post on
// New Post and Current Posts kept its old list until a full refresh. Awaited, so a caller that navigates
// afterwards lands on fresh data.
function refreshNow(qc: QueryClient, queryKey: unknown[]): Promise<void> {
  return qc.invalidateQueries({ queryKey, refetchType: "all" });
}

// Shows the announcement as Queued before the server snapshot rebuilds; the prefix match covers every `sub`.
function markAnnouncementQueued(qc: QueryClient, campaignId: string): void {
  qc.setQueriesData<DashboardOperations>({ queryKey: ["amplify", "dashboard-operations"] }, (old) =>
    old
      ? {
          ...old,
          campaigns: old.campaigns.map((c) =>
            c.campaignId === campaignId ? { ...c, announcement: { status: "QUEUED", attempts: 0 } } : c,
          ),
        }
      : old,
  );
  void qc.invalidateQueries({ queryKey: ["amplify", "dashboard-operations"], refetchType: "all" });
}

function useAmplifySub(): string | undefined {
  const { state } = useAsgardeoSub();
  return state.status === "ready" ? state.sub : undefined;
}

/** POST /campaigns (PO and Marketing; the backend 403s anyone else). */
export function useRegisterCampaign() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  const sub = useAmplifySub();
  return useMutation<CampaignRegistration | null, Error, { draft: CampaignDraft; shareNow: boolean }>({
    mutationFn: async (vars) =>
      authedPost<CampaignRegistration>(
        `${amplifyServiceUrls.campaigns}?shareNow=${vars.shareNow}`,
        await getAccessToken(),
        vars.draft,
      ),
    onSuccess: async () => {
      await refreshNow(qc, amplifyKey("campaigns", sub));
    },
  });
}

/** PATCH /campaigns/{id} with the version that was read (PO and Marketing). */
export function useEditCampaign() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  const sub = useAmplifySub();
  return useMutation<Campaign | null, Error, { id: string; patch: CampaignPatch }>({
    mutationFn: async ({ id, patch }) =>
      authedPatch<Campaign>(amplifyServiceUrls.campaign(id), await getAccessToken(), patch),
    onSuccess: async () => {
      await refreshNow(qc, amplifyKey("campaigns", sub));
    },
  });
}

/** POST /campaigns/{id}/shares: "Amplify, share this for me". Queued (202), published by the next Run. */
export function useRequestShare() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  const sub = useAmplifySub();
  return useMutation<Share | null, Error, { campaignId: string; kind: ShareKind; commentary?: string }>({
    mutationFn: async (vars) =>
      authedPost<Share>(
        amplifyServiceUrls.shares(vars.campaignId),
        await getAccessToken(),
        vars.commentary === undefined ? { kind: vars.kind } : { kind: vars.kind, commentary: vars.commentary },
      ),
    onSuccess: async () => {
      await refreshNow(qc, amplifyKey("my-shares", sub));
    },
  });
}

/**
 * POST /admin/announcements/{campaignId}/retry: puts a FAILED Novera announcement back in the queue (CAN_ADMIN).
 * The board's chip then reads Queued once the dashboards reload.
 */
export function useRetryAnnouncement() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<unknown, Error, { campaignId: string }>({
    mutationFn: async (vars) =>
      authedPost<unknown>(
        amplifyServiceUrls.adminAnnouncementRetry(vars.campaignId),
        await getAccessToken(),
        {},
      ),
    onSuccess: (_data, vars) => markAnnouncementQueued(qc, vars.campaignId),
  });
}

/**
 * POST /admin/announcements/{campaignId}/send: queues the Novera announcement for a post that was never announced
 * (CAN_ADMIN). The board's chip then reads Queued once the dashboards reload.
 */
export function useSendAnnouncement() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<unknown, Error, { campaignId: string }>({
    mutationFn: async (vars) =>
      authedPost<unknown>(amplifyServiceUrls.adminAnnouncementSend(vars.campaignId), await getAccessToken(), {}),
    onSuccess: (_data, vars) => markAnnouncementQueued(qc, vars.campaignId),
  });
}

/** POST /connections/linkedin/start. The caller sends the browser to `authorizationUrl`. */
export function useStartLinkedInConnect() {
  const getAccessToken = useAccessToken();
  return useMutation<ConnectAuthorization | null, Error, { returnTo: string; pendingCampaignId?: string }>({
    mutationFn: async (body) =>
      authedPost<ConnectAuthorization>(
        amplifyServiceUrls.connectStart,
        await getAccessToken(),
        body,
      ),
  });
}

/** POST /connections/linkedin/decline with the LinkedIn profile URL of an employee who doesn't consent to link. */
export function useDeclineLinkedInConsent() {
  const getAccessToken = useAccessToken();
  return useMutation<null, Error, { profileUrl?: string }>({
    mutationFn: async (body) => {
      await authedPost<unknown>(amplifyServiceUrls.connectDecline, await getAccessToken(), body);
      return null;
    },
  });
}

/** DELETE /campaigns/{id} (PO and Marketing): archives the post, then refetches the campaigns lists. */
export function useArchiveCampaign() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  const sub = useAmplifySub();
  return useMutation<null, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      await authedDelete(amplifyServiceUrls.campaign(id), await getAccessToken());
      return null;
    },
    onSuccess: async () => {
      await refreshNow(qc, amplifyKey("campaigns", sub));
    },
  });
}

/** DELETE /connections/linkedin: Amplify revokes the caller's token at LinkedIn, then drops its saved link. */
export function useRemoveLinkedInConnection() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  const sub = useAmplifySub();
  return useMutation<null, Error, void>({
    mutationFn: async () => {
      await authedDelete(amplifyServiceUrls.connectRemove, await getAccessToken());
      return null;
    },
    onSuccess: async () => {
      await refreshNow(qc, amplifyKey("me", sub));
    },
  });
}

/** POST /connections/linkedin/complete with the code and state LinkedIn sent back. */
export function useCompleteLinkedInConnect() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  const sub = useAmplifySub();
  return useMutation<LinkedInConnection | null, Error, { code: string; state: string; redirectUri: string }>({
    mutationFn: async (body) =>
      authedPost<LinkedInConnection>(
        amplifyServiceUrls.connectComplete,
        await getAccessToken(),
        body,
      ),
    onSuccess: async () => {
      await refreshNow(qc, amplifyKey("me", sub));
    },
  });
}

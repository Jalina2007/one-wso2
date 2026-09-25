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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authedDelete, authedPost } from "@api/http";
import { umtServiceUrls } from "@config/apiConfig";
import { useAccessToken } from "@hooks/useAccessToken";
import type { UmtCreateReleaseChunkRequest, UmtReleaseChunk } from "./umtReleaseChunks";

// POST /update/releaseChunk — body is the raw array of update ids, not an
// object.
//
// Creating a chunk locks its updates into it, so the lifecycle-state lists the
// chunk was assembled from no longer hold: without invalidating the updates
// they came from, returning to the create screen offers the same updates again
// and a second chunk can be built from updates already spoken for.
export function useUmtCreateReleaseChunk() {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation<UmtReleaseChunk[] | null, Error, UmtCreateReleaseChunkRequest>({
    mutationFn: async (updateIds) => {
      const accessToken = await getAccessToken();
      return authedPost<UmtReleaseChunk[]>(umtServiceUrls.releaseChunks, accessToken, updateIds);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["umt-release-chunks"] }),
        queryClient.invalidateQueries({ queryKey: ["umt-updates"] }),
      ]);
    },
  });
}

export interface UmtTriggerProductBuildArgs {
  productName: string;
  productVersion: string;
  channel: string;
}

export function useUmtTriggerProductBuild(chunkId: number) {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation<void, Error, UmtTriggerProductBuildArgs>({
    mutationFn: async ({ productName, productVersion, channel }) => {
      const accessToken = await getAccessToken();
      await authedPost(
        umtServiceUrls.releaseChunkTriggerProductBuild(chunkId, productName, productVersion, channel),
        accessToken,
        null,
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["umt-release-chunk-build-status"] });
    },
  });
}

export function useUmtTriggerTgBuild(chunkId: number) {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation<void, Error, UmtTriggerProductBuildArgs>({
    mutationFn: async ({ productName, productVersion, channel }) => {
      const accessToken = await getAccessToken();
      await authedPost(
        umtServiceUrls.releaseChunkTriggerTgBuild(chunkId, productName, productVersion, channel),
        accessToken,
        null,
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["umt-release-chunk-build-status"] });
    },
  });
}

// "Run test builds" — triggers every product/TG build for the whole chunk.
export function useUmtTriggerReleaseChunkBuilds(chunkId: number) {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const accessToken = await getAccessToken();
      await authedPost(umtServiceUrls.releaseChunkTriggerBuilds(chunkId), accessToken, null);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["umt-release-chunk-build-status"] }),
        queryClient.invalidateQueries({ queryKey: ["umt-release-chunk-status"] }),
      ]);
    },
  });
}

export function useUmtTriggerCstBuild(chunkId: number) {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const accessToken = await getAccessToken();
      await authedPost(umtServiceUrls.releaseChunkTriggerCstBuild(chunkId), accessToken, null);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["umt-release-chunk-build-status"] });
    },
  });
}

// Retriggers a chunk's failed docker builds. The chunk's own status moves
// with it, so both it and the docker statuses are refetched afterwards.
export function useUmtRetriggerDockerBuild(chunkId: number) {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const accessToken = await getAccessToken();
      await authedPost(umtServiceUrls.releaseChunkRetriggerDockerBuild(chunkId), accessToken, null);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["umt-release-chunk-docker-build-status"] }),
        queryClient.invalidateQueries({ queryKey: ["umt-release-chunk-status"] }),
      ]);
    },
  });
}

// The note recorded against every release, shown afterwards in the Release
// Message column on Released Chunks. It is fixed rather than typed per
// release: the endpoint requires the field to be non-blank, and nothing in
// this flow asks anyone for a per-release note.
const UMT_RELEASE_MESSAGE = "Releasing chunk";

export function useUmtReleaseChunk(chunkId: number) {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const accessToken = await getAccessToken();
      await authedPost(umtServiceUrls.releaseChunkRelease(chunkId), accessToken, {
        "release-message": UMT_RELEASE_MESSAGE,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["umt-release-chunks"] }),
        queryClient.invalidateQueries({ queryKey: ["umt-release-chunk-status"] }),
        queryClient.invalidateQueries({ queryKey: ["umt-released-chunks"] }),
      ]);
    },
  });
}

export function useUmtSendReleaseChunkEmail(chunkId: number) {
  const getAccessToken = useAccessToken();

  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const accessToken = await getAccessToken();
      await authedPost(umtServiceUrls.releaseChunkEmail(chunkId), accessToken, null);
    },
  });
}

// The "Unlock update level" action: removes the chunk and demotes its
// underlying updates back out of the chunk, so both the chunk list and the
// affected updates need invalidating.
export function useUmtRemoveReleaseChunk(chunkId: number) {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const accessToken = await getAccessToken();
      await authedDelete(umtServiceUrls.releaseChunk(chunkId), accessToken);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["umt-release-chunks"] }),
        queryClient.invalidateQueries({ queryKey: ["umt-updates"] }),
        queryClient.invalidateQueries({ queryKey: ["umt-update"] }),
      ]);
    },
  });
}

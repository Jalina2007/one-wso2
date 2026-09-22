// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));

const authedPost = vi.fn(() => Promise.resolve(null));
const authedDelete = vi.fn(() => Promise.resolve());
vi.mock("@api/http", async () => {
  const actual = await vi.importActual<typeof import("@api/http")>("@api/http");
  return {
    ...actual,
    authedPost: (...args: unknown[]) => authedPost(...(args as [])),
    authedDelete: (...args: unknown[]) => authedDelete(...(args as [])),
  };
});

const {
  useUmtCreateReleaseChunk,
  useUmtTriggerProductBuild,
  useUmtTriggerTgBuild,
  useUmtTriggerReleaseChunkBuilds,
  useUmtTriggerCstBuild,
  useUmtRetriggerDockerBuild,
  useUmtReleaseChunk,
  useUmtSendReleaseChunkEmail,
  useUmtRemoveReleaseChunk,
} = await import("./useUmtReleaseChunkActions");
const { umtServiceUrls } = await import("@config/apiConfig");

function renderMutation<T>(useHook: () => T) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidateQueries = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(useHook, { wrapper });
  return { result, invalidateQueries };
}

function invalidatedKeys(invalidateQueries: ReturnType<typeof vi.spyOn>) {
  return invalidateQueries.mock.calls.map(
    (call: unknown[]) => (call[0] as { queryKey?: unknown[] })?.queryKey?.[0],
  );
}

beforeEach(() => {
  authedPost.mockClear();
  authedDelete.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useUmtCreateReleaseChunk", () => {
  it("POSTs the raw updateIds array and invalidates the pending list", async () => {
    const { result, invalidateQueries } = renderMutation(() => useUmtCreateReleaseChunk());

    await act(async () => {
      await result.current.mutateAsync([1, 2, 3]);
    });

    expect(authedPost).toHaveBeenCalledWith(umtServiceUrls.releaseChunks, "token", [1, 2, 3]);
    // The chunk's updates are locked into it now, so the lifecycle-state
    // lists it was built from must not keep offering them.
    expect(invalidatedKeys(invalidateQueries)).toEqual(
      expect.arrayContaining(["umt-release-chunks", "umt-updates"]),
    );
  });
});

describe("useUmtTriggerProductBuild", () => {
  it("POSTs to the product/version/channel build endpoint and invalidates build status", async () => {
    const { result, invalidateQueries } = renderMutation(() => useUmtTriggerProductBuild(7));

    await act(async () => {
      await result.current.mutateAsync({ productName: "apim", productVersion: "4.2.0", channel: "full" });
    });

    expect(authedPost).toHaveBeenCalledWith(
      umtServiceUrls.releaseChunkTriggerProductBuild(7, "apim", "4.2.0", "full"),
      "token",
      null,
    );
    expect(invalidatedKeys(invalidateQueries)).toEqual(["umt-release-chunk-build-status"]);
  });
});

describe("useUmtTriggerTgBuild", () => {
  it("POSTs to the TG build endpoint", async () => {
    const { result } = renderMutation(() => useUmtTriggerTgBuild(7));

    await act(async () => {
      await result.current.mutateAsync({ productName: "apim", productVersion: "4.2.0", channel: "full" });
    });

    expect(authedPost).toHaveBeenCalledWith(
      umtServiceUrls.releaseChunkTriggerTgBuild(7, "apim", "4.2.0", "full"),
      "token",
      null,
    );
  });
});

describe("useUmtTriggerReleaseChunkBuilds", () => {
  it("POSTs triggerBuilds and invalidates both build and chunk status", async () => {
    const { result, invalidateQueries } = renderMutation(() => useUmtTriggerReleaseChunkBuilds(7));

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(authedPost).toHaveBeenCalledWith(umtServiceUrls.releaseChunkTriggerBuilds(7), "token", null);
    expect(invalidatedKeys(invalidateQueries)).toEqual(
      expect.arrayContaining(["umt-release-chunk-build-status", "umt-release-chunk-status"]),
    );
  });
});

describe("useUmtTriggerCstBuild", () => {
  it("POSTs triggerCSTBuild and invalidates build status", async () => {
    const { result, invalidateQueries } = renderMutation(() => useUmtTriggerCstBuild(7));

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(authedPost).toHaveBeenCalledWith(umtServiceUrls.releaseChunkTriggerCstBuild(7), "token", null);
    expect(invalidatedKeys(invalidateQueries)).toEqual(["umt-release-chunk-build-status"]);
  });
});

describe("useUmtRetriggerDockerBuild", () => {
  it("POSTs retriggerDockerBuild and invalidates docker and chunk status", async () => {
    const { result, invalidateQueries } = renderMutation(() => useUmtRetriggerDockerBuild(7));

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(authedPost).toHaveBeenCalledWith(umtServiceUrls.releaseChunkRetriggerDockerBuild(7), "token", null);
    expect(invalidatedKeys(invalidateQueries)).toEqual(
      expect.arrayContaining(["umt-release-chunk-docker-build-status", "umt-release-chunk-status"]),
    );
  });
});

describe("useUmtReleaseChunk", () => {
  // The endpoint requires a non-blank message and nothing asks anyone for one,
  // so the string is fixed here rather than passed in by the caller.
  it("POSTs the fixed release message and invalidates pending/status/released", async () => {
    const { result, invalidateQueries } = renderMutation(() => useUmtReleaseChunk(7));

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(authedPost).toHaveBeenCalledWith(umtServiceUrls.releaseChunkRelease(7), "token", {
      "release-message": "Releasing chunk",
    });
    expect(invalidatedKeys(invalidateQueries)).toEqual(
      expect.arrayContaining(["umt-release-chunks", "umt-release-chunk-status", "umt-released-chunks"]),
    );
  });
});

describe("useUmtSendReleaseChunkEmail", () => {
  it("POSTs the email endpoint with no body", async () => {
    const { result } = renderMutation(() => useUmtSendReleaseChunkEmail(7));

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(authedPost).toHaveBeenCalledWith(umtServiceUrls.releaseChunkEmail(7), "token", null);
  });
});

describe("useUmtRemoveReleaseChunk", () => {
  it("DELETEs the chunk and invalidates chunks, updates list, and update detail", async () => {
    const { result, invalidateQueries } = renderMutation(() => useUmtRemoveReleaseChunk(7));

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(authedDelete).toHaveBeenCalledWith(umtServiceUrls.releaseChunk(7), "token");
    expect(invalidatedKeys(invalidateQueries)).toEqual(
      expect.arrayContaining(["umt-release-chunks", "umt-updates", "umt-update"]),
    );
  });
});

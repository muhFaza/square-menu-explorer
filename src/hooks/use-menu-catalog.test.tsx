import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useMenuCatalog } from "./use-menu-catalog";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useMenuCatalog", () => {
  it("aborts the stalled endpoint sibling after a fast HTTP failure", async () => {
    let stalledSignal: AbortSignal | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes("/categories")) {
          stalledSignal = init?.signal ?? null;
          return new Promise<Response>((_resolve, reject) => {
            stalledSignal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          });
        }
        return Promise.resolve(new Response(null, { status: 503 }));
      }),
    );

    const { result } = renderHook(() => useMenuCatalog("LOCATION1"));

    await waitFor(() => expect(result.current.status).toBe("error"));
    const capturedSignal = stalledSignal as AbortSignal | null;
    expect(capturedSignal?.aborted).toBe(true);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { captureUploadRequestScope, platformApi } from "./platform-api";
import { supabase } from "./supabase/client";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const session = {
  access_token: "test-only-owner-token",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: "owner-user-id", email: "creator@example.com" },
};

describe("owner diagnostic request scope", () => {
  it("sends only a manual authenticated POST in the captured workspace", async () => {
    vi.stubGlobal("sessionStorage", { getItem: () => null });
    vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: { session },
      error: null,
    } as never);
    const result = {
      checkedAt: "2026-10-09T00:00:00.000Z",
      ai: { status: "authenticated", note: "Key accepted" },
      soundEffects: { configured: false, missing: [], note: "Setup needed" },
      generationTested: false,
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(result));
    vi.stubGlobal("fetch", fetcher);
    const scope = await captureUploadRequestScope();
    const controller = new AbortController();
    await expect(
      platformApi.serviceDiagnostics({ scope, signal: controller.signal })
    ).resolves.toEqual(result);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/operations/services",
      expect.objectContaining({
        method: "POST",
        signal: controller.signal,
        headers: expect.objectContaining({
          Authorization: "Bearer test-only-owner-token",
          "X-Reelassati-Brand": "default",
        }),
      })
    );
  });

  it("does not send a diagnostic check under a different account after capture", async () => {
    vi.stubGlobal("sessionStorage", { getItem: () => null });
    const getSession = vi
      .spyOn(supabase.auth, "getSession")
      .mockResolvedValue({ data: { session }, error: null } as never);
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetcher);
    const scope = await captureUploadRequestScope();
    getSession.mockResolvedValue({
      data: {
        session: {
          ...session,
          user: { id: "different-user", email: "member@example.com" },
        },
      },
      error: null,
    } as never);
    await expect(platformApi.serviceDiagnostics({ scope })).rejects.toThrow(
      "Your account or brand changed"
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects a completed response when the account changed during the check", async () => {
    vi.stubGlobal("sessionStorage", { getItem: () => null });
    const getSession = vi
      .spyOn(supabase.auth, "getSession")
      .mockResolvedValue({ data: { session }, error: null } as never);
    const scope = await captureUploadRequestScope();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
      getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      } as never);
      return Response.json({ ai: { status: "authenticated" } });
    });
    vi.stubGlobal("fetch", fetcher);
    await expect(platformApi.serviceDiagnostics({ scope })).rejects.toThrow(
      "Sign in before importing media"
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  platformApi,
  PlatformApiError,
  captureUploadRequestScope,
} from "./platform-api";
import { supabase } from "@/lib/supabase/client";
import { ANALYZER_STREAM_TYPE } from "@contracts/analyzer-transport";
const planCapabilities = () =>
  Response.json({
    capabilities: {
      editPlanTransportVersion: "foreground-v1",
      editingModel: "moonshotai/kimi-k3",
    },
  });

beforeEach(() => {
  vi.stubGlobal("sessionStorage", { getItem: () => null });
  vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
    data: {
      session: {
        access_token: "test-owner-token",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: "owner", email: "creator@example.com" },
      },
    },
    error: null,
  } as never);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("platform API transport", () => {
  it.each([
    ["missing-story-assessment", true, "missing-story-assessment"],
    ["PRIVATE_UNTRUSTED_PROVIDER_DETAIL", true, undefined],
    ["constructor", true, undefined],
    ["missing-channels", false, undefined],
  ])(
    "keeps only a known analyzer validation code (%s)",
    async (reason, analysisIncomplete, expected) => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          Response.json(
            {
              error: "Incomplete report",
              reason,
              analysisIncomplete,
              reference: "safe-review-123",
            },
            { status: 422 }
          )
        );
      vi.stubGlobal("fetch", fetchMock);
      await expect(
        platformApi.analyzeVideo({ assetId: "owned", platform: "tiktok" })
      ).rejects.toMatchObject({
        status: 422,
        reason: expected,
        reference: "safe-review-123",
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  );
  it.each([200, 400, 504])(
    "uses the streamed analyzer's terminal HTTP %s without repeating its paid request",
    async status => {
      const body =
        status === 200
          ? { summary: "Validated report" }
          : { error: "Incomplete report", reference: "analysis-ref-123" };
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ type: "pending" }) +
            "\n" +
            JSON.stringify({
              type: "result",
              status,
              body: JSON.stringify(body),
            }) +
            "\n",
          { headers: { "Content-Type": ANALYZER_STREAM_TYPE } }
        )
      );
      vi.stubGlobal("fetch", fetchMock);
      const result = platformApi.analyzeVideo({
        assetId: "owned",
        platform: "tiktok",
      });
      if (status === 200) await expect(result).resolves.toMatchObject(body);
      else
        await expect(result).rejects.toMatchObject({
          status,
          reference: "analysis-ref-123",
        });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
        Accept: ANALYZER_STREAM_TYPE,
      });
    }
  );
  it("refuses a truncated analyzer stream and never reruns the paid request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('{"type":"pending"}\n', {
          headers: { "Content-Type": ANALYZER_STREAM_TYPE },
        })
      )
      .mockResolvedValueOnce(Response.json({ canceled: true }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      platformApi.analyzeVideo({ assetId: "owned", platform: "tiktok" })
    ).rejects.toMatchObject({
      status: 502,
      reference: expect.stringMatching(/^[a-f0-9-]{36}$/),
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain(
      "/api/ai/analyze/cancel"
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).requestId).toBe(
      JSON.parse(fetchMock.mock.calls[0][1].body).requestId
    );
  });
  it("retains a bounded support reference and HTTP status for a failed auto-edit step without retrying it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(planCapabilities())
      .mockResolvedValueOnce(
        Response.json(
          {
            error: "The AI service could not complete this request.",
            reference: "provider-failure-123",
          },
          { status: 400 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      platformApi.generateEditPlan({
        project: {} as never,
        command: "Edit the owned footage",
        selectedClipIds: [],
      })
    ).rejects.toMatchObject({ status: 400, reference: "provider-failure-123" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain("/api/ai/edit-plan");
  });
  it.each([
    {},
    {
      editPlanTransportVersion: "foreground-v1",
      editingModel: "moonshotai/kimi-k2.5",
    },
  ])(
    "does not submit a paid plan when backend transport or K3 selection is missing",
    async capabilities => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(Response.json({ capabilities }));
      vi.stubGlobal("fetch", fetchMock);
      await expect(
        platformApi.generateEditPlan({
          project: {} as never,
          command: "Edit",
          selectedClipIds: [],
        })
      ).rejects.toMatchObject({ status: 409 });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(String(fetchMock.mock.calls[0][0])).toContain("/api/capabilities");
    }
  );
  it("consumes a streamed plan exactly once", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(planCapabilities())
      .mockResolvedValueOnce(
        new Response(
          '{"type":"pending"}\n' +
            JSON.stringify({
              type: "result",
              status: 200,
              body: JSON.stringify({ summary: "Complete plan", changes: [] }),
            }) +
            "\n",
          { headers: { "Content-Type": ANALYZER_STREAM_TYPE } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      platformApi.generateEditPlan({
        project: {} as never,
        command: "Edit",
        selectedClipIds: [],
      })
    ).resolves.toMatchObject({ summary: "Complete plan", changes: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers).toMatchObject({
      Accept: ANALYZER_STREAM_TYPE,
    });
  });
  it("cancels a truncated paid plan using the same request ID, without resubmitting it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(planCapabilities())
      .mockResolvedValueOnce(
        new Response('{"type":"pending"}\n', {
          headers: { "Content-Type": ANALYZER_STREAM_TYPE },
        })
      )
      .mockResolvedValueOnce(Response.json({ canceled: true }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      platformApi.generateEditPlan({
        project: {} as never,
        command: "Edit",
        selectedClipIds: [],
      })
    ).rejects.toMatchObject({
      status: 502,
      reference: expect.stringMatching(/^[a-f0-9-]{36}$/),
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[2][0])).toContain(
      "/api/ai/edit-plan/cancel"
    );
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).requestId).toBe(
      JSON.parse(fetchMock.mock.calls[1][1].body).requestId
    );
  });
  it("pins speech retries to the reviewed request and workspace after a lost response", async () => {
    const scope = await captureUploadRequestScope();
    const input = {
      requestId: "speech-recovery-20261014",
      acceptedCredits: 1,
      text: "An original short voice test.",
      voice: "sarah",
      rightsConfirmed: true as const,
    };
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        Response.json({ asset: { id: "saved-voice", kind: "audio" } })
      );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      platformApi.synthesizeSpeech(input, { scope })
    ).rejects.toThrow("Failed to fetch");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(
      platformApi.synthesizeSpeech(input, { scope })
    ).resolves.toMatchObject({ id: "saved-voice" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(call => JSON.parse(call[1].body))).toEqual([
      input,
      input,
    ]);
    for (const call of fetchMock.mock.calls)
      expect(call[1].headers).toMatchObject({
        Authorization: "Bearer test-owner-token",
        "X-Reelassati-Brand": "default",
      });
  });

  it.each(["owner", "brand"])(
    "discards a speech result when the %s changes during generation",
    async changed => {
      const scope = await captureUploadRequestScope();
      let finish!: (value: Response) => void;
      const fetchMock = vi.fn(
        () =>
          new Promise<Response>(resolve => {
            finish = resolve;
          })
      );
      vi.stubGlobal("fetch", fetchMock);
      const task = platformApi.synthesizeSpeech(
        {
          requestId: "speech-scoped-20261014",
          text: "Owned original copy",
          voice: "sarah",
          rightsConfirmed: true,
        },
        { scope }
      );
      const rejected = expect(task).rejects.toMatchObject({ status: 409 });
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      if (changed === "owner")
        vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
          data: {
            session: {
              access_token: "other-token",
              user: { id: "other", email: "other@example.com" },
            },
          },
          error: null,
        } as never);
      else vi.stubGlobal("sessionStorage", { getItem: () => "other-brand" });
      finish(Response.json({ asset: { id: "original-owner-voice" } }));
      await rejected;
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  );

  it("refreshes a rejected browser session once and retries with the new token", async () => {
    vi.stubGlobal("sessionStorage", { getItem: () => null });
    const user = { email: "creator@example.com" };
    const staleSession = {
      access_token: "stale-token",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user,
    };
    const freshSession = {
      access_token: "fresh-token",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user,
    };
    vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: { session: staleSession },
      error: null,
    } as never);
    const refresh = vi
      .spyOn(supabase.auth, "refreshSession")
      .mockResolvedValue({
        data: { session: freshSession, user },
        error: null,
      } as never);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          { error: "Sign in to access this workspace" },
          { status: 401 }
        )
      )
      .mockResolvedValueOnce(
        Response.json({
          user: {
            id: "creator@example.com",
            email: "creator@example.com",
            name: "Creator",
            role: "member",
          },
          capabilities: {},
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(platformApi.session()).resolves.toMatchObject({
      user: { email: "creator@example.com" },
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: "Bearer stale-token",
    });
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({
      Authorization: "Bearer fresh-token",
    });
  });

  it("keeps public-domain support requests on the Vercel function", async () => {
    vi.stubGlobal("window", {
      location: { hostname: "www.reelassati.app" },
    });
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        ticket: {
          id: "RA-1",
          emailStatus: "sent",
          supportEmail: "reelassati@gmail.com",
        },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await platformApi.createSupportTicket({
      category: "other",
      priority: "normal",
      subject: "Need human help",
      description: "This request needs a human response.",
      email: "customer@example.com",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/support",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("turns an HTML SPA fallback into a clear controlled error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<!doctype html><title>REELassati</title>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        })
      )
    );

    await expect(platformApi.session()).rejects.toMatchObject({
      name: "PlatformApiError",
      message:
        "The server returned an unexpected response. Reload the page and try again.",
    });
  });

  it("preserves server error details without exposing an invalid body", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: "Provider setup is incomplete", missing: ["MODEL"] },
            { status: 503 }
          )
        )
    );

    const failure = await platformApi.session().catch(cause => cause);
    expect(failure).toBeInstanceOf(PlatformApiError);
    expect(failure).toMatchObject({
      status: 503,
      missing: ["MODEL"],
      message: "Provider setup is incomplete",
    });
  });

  it("reports real browser upload progress and returns the server asset", async () => {
    class FakeUploadRequest {
      upload: { onprogress: ((event: ProgressEvent) => void) | null } = {
        onprogress: null,
      };
      onabort: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onload: (() => void) | null = null;
      responseText = JSON.stringify({
        asset: { id: "asset-1", url: "/api/assets/asset-1" },
      });
      responseType = "";
      status = 201;
      withCredentials = false;

      open() {}
      setRequestHeader() {}

      getResponseHeader(name: string) {
        return name.toLowerCase() === "content-type"
          ? "application/json"
          : null;
      }

      send() {
        this.upload.onprogress?.({
          lengthComputable: true,
          loaded: 4,
          total: 10,
        } as ProgressEvent);
        this.onload?.();
      }
    }

    vi.stubGlobal("XMLHttpRequest", FakeUploadRequest);
    const progress: number[] = [];
    const asset = await platformApi.uploadAsset(
      new File(["video"], "clip.mp4", { type: "video/mp4" }),
      "video",
      percent => progress.push(percent)
    );

    expect(asset.id).toBe("asset-1");
    expect(progress).toEqual([0, 40, 100]);
  });

  it("uploads long-form media in multipart chunks", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          { assetId: "large-asset", partSize: 16 * 1024 * 1024 },
          { status: 201 }
        )
      )
      .mockResolvedValueOnce(Response.json({ partNumber: 1, etag: "one" }))
      .mockResolvedValueOnce(Response.json({ partNumber: 2, etag: "two" }))
      .mockResolvedValueOnce(Response.json({ partNumber: 3, etag: "three" }))
      .mockResolvedValueOnce(
        Response.json(
          {
            asset: {
              id: "large-asset",
              url: "/api/media/large-asset?expires=1&token=test",
            },
          },
          { status: 201 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);
    const progress: number[] = [];
    const asset = await platformApi.uploadAsset(
      new File([new Uint8Array(33 * 1024 * 1024)], "long-form.mp4", {
        type: "video/mp4",
      }),
      "video",
      percent => progress.push(percent)
    );

    expect(asset.id).toBe("large-asset");
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(progress.at(-1)).toBe(100);
  });

  it("pins workspace writes and rejects an account changed while requestSession is awaiting", async () => {
    const scope = await captureUploadRequestScope();
    vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: {
        session: {
          access_token: "other-token",
          user: { id: "other", email: "other@example.com" },
        },
      },
      error: null,
    } as never);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      platformApi.saveWorkspace({} as never, scope)
    ).rejects.toMatchObject({ status: 409 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a brand switch before sending any media bytes", async () => {
    const scope = await captureUploadRequestScope();
    vi.stubGlobal("sessionStorage", { getItem: () => "other-brand" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      platformApi.uploadAsset(
        new File([new Uint8Array(33 * 1024 * 1024)], "video.mp4"),
        "video",
        undefined,
        undefined,
        { scope }
      )
    ).rejects.toMatchObject({ status: 409 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never completes multipart uploads in a new account after parts return", async () => {
    const scope = await captureUploadRequestScope();
    let changed = false;
    vi.spyOn(supabase.auth, "getSession").mockImplementation(
      async () =>
        ({
          data: {
            session: {
              access_token: changed ? "other-token" : "test-owner-token",
              user: {
                id: changed ? "other" : "owner",
                email: changed ? "other@example.com" : "creator@example.com",
              },
            },
          },
          error: null,
        }) as never
    );
    const fetchMock = vi
      .fn()
      .mockImplementation(async (url: string, init: RequestInit) => {
        if (url.endsWith("/api/assets/uploads"))
          return Response.json({
            assetId: "partial",
            partSize: 16 * 1024 * 1024,
          });
        expect(init.headers).toMatchObject({
          "X-Reelassati-Brand": "default",
          Authorization: "Bearer test-owner-token",
        });
        changed = true;
        return Response.json({ partNumber: 1, etag: "part" });
      });
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      platformApi.uploadAsset(
        new File([new Uint8Array(33 * 1024 * 1024)], "video.mp4"),
        "video",
        undefined,
        undefined,
        { scope }
      )
    ).rejects.toMatchObject({ status: 409 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).endsWith("/complete"))
    ).toBe(false);
  });

  it("does not retry paid analysis under an account recovered after a rejected token", async () => {
    const scope = await captureUploadRequestScope();
    vi.spyOn(supabase.auth, "refreshSession").mockResolvedValue({
      data: {
        session: {
          access_token: "other-token",
          user: { id: "other", email: "other@example.com" },
        },
      },
      error: null,
    } as never);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(Response.json({ error: "Expired" }, { status: 401 }))
    );
    await expect(
      platformApi.analyzeVideo(
        { assetId: "owned", platform: "tiktok", sourceRightsConfirmed: true },
        undefined,
        scope
      )
    ).rejects.toMatchObject({ status: 409 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("bounds actual downloaded bytes even when the server's size header is wrong", async () => {
    const scope = await captureUploadRequestScope();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(new Uint8Array(9), {
          headers: { "content-length": "1", "content-type": "image/png" },
        })
      )
    );
    await expect(
      platformApi.downloadAssetBlob("image", undefined, { scope, maxBytes: 8 })
    ).rejects.toThrow("supported download size");
  });

  it("never sends an upload after cancellation", async () => {
    const scope = await captureUploadRequestScope();
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      platformApi.uploadAsset(
        new File(["x"], "x.mp4"),
        "video",
        undefined,
        undefined,
        { scope, signal: controller.signal }
      )
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an account switched while the response body is being read", async () => {
    const scope = await captureUploadRequestScope();
    let changed = false;
    vi.spyOn(supabase.auth, "getSession").mockImplementation(
      async () =>
        ({
          data: {
            session: {
              access_token: changed ? "other-token" : "test-owner-token",
              user: {
                id: changed ? "other" : "owner",
                email: changed ? "other@example.com" : "creator@example.com",
              },
            },
          },
          error: null,
        }) as never
    );
    const response = Response.json({ workspace: { revision: 100 } });
    vi.spyOn(response, "text").mockImplementation(async () => {
      changed = true;
      return JSON.stringify({ workspace: { revision: 100 } });
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(
      platformApi.saveWorkspace({} as never, scope)
    ).rejects.toMatchObject({ status: 409 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not return a completed paid response after cancellation during body reading", async () => {
    const scope = await captureUploadRequestScope();
    const controller = new AbortController();
    const response = Response.json({ summary: "Provider completed" });
    vi.spyOn(response, "text").mockImplementation(async () => {
      controller.abort();
      return JSON.stringify({ summary: "Provider completed" });
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(
      platformApi.analyzeVideo(
        { assetId: "owned", platform: "tiktok", sourceRightsConfirmed: true },
        controller.signal,
        scope
      )
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toContain(
      "/api/ai/analyze/cancel"
    );
  });

  it("pins script generation before a delayed requestSession can resolve as another owner", async () => {
    const scope = await captureUploadRequestScope();
    let resolveSession!: (value: unknown) => void;
    vi.spyOn(supabase.auth, "getSession").mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveSession = resolve;
        }) as never
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const task = platformApi.generateScript(
      {
        topic: "Original owner's brief",
        platform: "tiktok",
        tone: "professional",
        duration: 30,
        language: "en",
      },
      { scope }
    );
    const result = expect(task).rejects.toMatchObject({ status: 409 });
    resolveSession({
      data: {
        session: {
          access_token: "other-token",
          user: { id: "other", email: "other@example.com" },
        },
      },
      error: null,
    });
    await result;
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["owner", "brand"])(
    "rejects a script response if the %s switches while the provider request is pending",
    async changed => {
      const scope = await captureUploadRequestScope();
      let finish!: (value: Response) => void;
      const fetchMock = vi.fn(
        () =>
          new Promise<Response>(resolve => {
            finish = resolve;
          })
      );
      vi.stubGlobal("fetch", fetchMock);
      const task = platformApi.generateScript(
        {
          topic: "An owned brief",
          platform: "instagram",
          tone: "professional",
          duration: 30,
          language: "en",
        },
        { scope }
      );
      const result = expect(task).rejects.toMatchObject({ status: 409 });
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      expect(fetchMock.mock.calls[0]).toEqual([
        "/api/ai/script",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-owner-token",
            "X-Reelassati-Brand": "default",
          }),
        }),
      ]);
      if (changed === "owner")
        vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
          data: {
            session: {
              access_token: "other-token",
              user: { id: "other", email: "other@example.com" },
            },
          },
          error: null,
        } as never);
      else vi.stubGlobal("sessionStorage", { getItem: () => "other-brand" });
      finish(
        Response.json({
          script: { fullScript: "Completed under the original owner" },
        })
      );
      await result;
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  );

  it("does not retry paid script generation as an owner recovered after a rejected token", async () => {
    const scope = await captureUploadRequestScope();
    vi.spyOn(supabase.auth, "refreshSession").mockResolvedValue({
      data: {
        session: {
          access_token: "other-token",
          user: { id: "other", email: "other@example.com" },
        },
      },
      error: null,
    } as never);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ error: "Expired" }, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      platformApi.generateScript(
        {
          topic: "An owned brief",
          platform: "tiktok",
          tone: "professional",
          duration: 30,
          language: "en",
        },
        { scope }
      )
    ).rejects.toMatchObject({ status: 409 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not return a paid script after component cancellation during response reading", async () => {
    const scope = await captureUploadRequestScope();
    const controller = new AbortController();
    const response = Response.json({
      script: { fullScript: "Completed script" },
    });
    vi.spyOn(response, "text").mockImplementation(async () => {
      controller.abort();
      return JSON.stringify({ script: { fullScript: "Completed script" } });
    });
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      platformApi.generateScript(
        {
          topic: "An owned brief",
          platform: "tiktok",
          tone: "professional",
          duration: 30,
          language: "en",
        },
        { scope, signal: controller.signal }
      )
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

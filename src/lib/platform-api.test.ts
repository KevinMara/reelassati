import { afterEach, describe, expect, it, vi } from "vitest";
import { platformApi, PlatformApiError } from "./platform-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("platform API transport", () => {
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
      responseText = JSON.stringify({ asset: { id: "asset-1" } });
      responseType = "";
      status = 201;
      withCredentials = false;

      open() {}

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
});

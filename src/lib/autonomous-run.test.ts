import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertAutonomousRunCurrent } from "./autonomous-run";
import {
  captureUploadRequestScope,
  platformApi,
  type UploadRequestOptions,
} from "./platform-api";
import { supabase } from "@/lib/supabase/client";

const original = {
  ownerEmail: "creator@example.com",
  brandId: "default",
  projectId: "project-1",
};
const ownerSession = {
  access_token: "test-owner-token",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: "owner", email: original.ownerEmail },
};
const otherSession = {
  ...ownerSession,
  access_token: "other-token",
  user: { id: "other", email: "other@example.com" },
};
const sessionResult = (session: typeof ownerSession | null) => ({
  data: { session },
  error: null,
});
const media = {
  assetName: "Supporting shot",
  prompt: "A product on a desk",
  aspectRatio: "9:16" as const,
  rightsConfirmed: true as const,
  referenceContainsRealPerson: false,
  realPersonConsentConfirmed: false,
};
const requests = [
  {
    name: "planning",
    run: (options: UploadRequestOptions) =>
      platformApi.generateEditPlan(
        { project: {} as never, command: "Edit", selectedClipIds: [] },
        options
      ),
  },
  {
    name: "image generation",
    run: (options: UploadRequestOptions) =>
      platformApi.generateImage({ ...media, resolution: "1K" }, options),
  },
  {
    name: "video generation",
    run: (options: UploadRequestOptions) =>
      platformApi.createVideo(
        {
          ...media,
          requestId: "run-1",
          duration: 5,
          resolution: "720p",
          generateAudio: false,
          projectId: original.projectId,
        },
        options
      ),
  },
  {
    name: "transcription",
    run: (options: UploadRequestOptions) =>
      platformApi.transcribe(
        "source",
        "en",
        original.projectId,
        ["speech-copy"],
        options
      ),
  },
  {
    name: "video result polling",
    run: (options: UploadRequestOptions) =>
      platformApi.videoJob("job-1", options),
  },
];

beforeEach(() => {
  vi.stubGlobal("sessionStorage", { getItem: () => null });
  vi.spyOn(supabase.auth, "getSession").mockResolvedValue(
    sessionResult(ownerSession) as never
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("autonomous run destination", () => {
  it("accepts the original owner, brand, and existing project", () => {
    expect(() =>
      assertAutonomousRunCurrent(
        original,
        { ...original, projectExists: true },
        new AbortController().signal
      )
    ).not.toThrow();
  });
  it.each([
    { ...original, ownerEmail: "other@example.com", projectExists: true },
    { ...original, brandId: "other-brand", projectExists: true },
    { ...original, projectId: "project-2", projectExists: true },
    { ...original, projectExists: false },
  ])("rejects a changed destination before the next work step", current => {
    const nextPaidStep = vi.fn();
    expect(() => {
      assertAutonomousRunCurrent(
        original,
        current,
        new AbortController().signal
      );
      nextPaidStep();
    }).toThrow("account, brand, or project changed");
    expect(nextPaidStep).not.toHaveBeenCalled();
  });
  it("rejects cancellation before the next provider step or timeline update", () => {
    const controller = new AbortController();
    controller.abort();
    expect(() =>
      assertAutonomousRunCurrent(
        original,
        { ...original, projectExists: true },
        controller.signal
      )
    ).toThrow();
  });
});

describe("autonomous paid request transport", () => {
  it.each(requests)(
    "pins $name while a delayed session changes accounts",
    async ({ run }) => {
      const scope = await captureUploadRequestScope();
      let resolveSession!: (value: ReturnType<typeof sessionResult>) => void;
      const pending = new Promise<ReturnType<typeof sessionResult>>(resolve => {
        resolveSession = resolve;
      });
      vi.mocked(supabase.auth.getSession).mockImplementation(
        () => pending as never
      );
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const result = run({ scope });
      resolveSession(sessionResult(otherSession));
      await expect(result).rejects.toMatchObject({ status: 409 });
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );
  it.each(requests)(
    "blocks $name after cancellation without sending a request",
    async ({ run }) => {
      const scope = await captureUploadRequestScope();
      const controller = new AbortController();
      controller.abort();
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      await expect(
        run({ scope, signal: controller.signal })
      ).rejects.toMatchObject({ name: "AbortError" });
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );
  it.each(requests)(
    "blocks $name in a switched brand without sending a request",
    async ({ run }) => {
      const scope = await captureUploadRequestScope();
      vi.stubGlobal("sessionStorage", { getItem: () => "other-brand" });
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      await expect(run({ scope })).rejects.toMatchObject({ status: 409 });
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );
  it("does not start a supporting generation after cancellation while planning returns", async () => {
    const scope = await captureUploadRequestScope();
    const controller = new AbortController();
    let resolveResponse!: (value: Response) => void;
    const pending = new Promise<Response>(resolve => {
      resolveResponse = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pending);
    vi.stubGlobal("fetch", fetchMock);
    const task = (async () => {
      await platformApi.generateEditPlan(
        { project: {} as never, command: "Edit", selectedClipIds: [] },
        { scope, signal: controller.signal }
      );
      await platformApi.generateImage(
        { ...media, resolution: "1K" },
        { scope, signal: controller.signal }
      );
    })();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    controller.abort();
    resolveResponse(Response.json({ changes: [], summary: "Ready" }));
    await expect(task).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      Authorization: "Bearer test-owner-token",
      "X-Reelassati-Brand": "default",
    });
  });
  it("never retries an expired planning token under a different recovered account", async () => {
    const scope = await captureUploadRequestScope();
    vi.spyOn(supabase.auth, "refreshSession").mockResolvedValue(
      sessionResult(otherSession) as never
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ error: "Expired" }, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      platformApi.generateEditPlan(
        { project: {} as never, command: "Edit", selectedClipIds: [] },
        { scope }
      )
    ).rejects.toMatchObject({ status: 409 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

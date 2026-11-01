import { describe, expect, it, vi } from "vitest";
import {
  allowedSocialMediaUrl,
  fetchSocialVideo,
  socialMediaCandidates,
} from "./social-video";
import { socialVideoSource } from "../contracts/social-video";

describe("public social video imports", () => {
  const media =
    "https://scontent.cdninstagram.com/video.mp4?token=sample&expires=1";
  it("reads public Instagram embed data without executing JavaScript", () => {
    const data = JSON.stringify(
      JSON.stringify({ shortcode_media: { video_url: media } })
    );
    expect(
      socialMediaCandidates(
        `<script>window.__additionalDataLoaded('post',${data}); throw 'do not run';</script>`,
        "instagram"
      )
    ).toEqual([media]);
  });
  it("reads OpenGraph and public TikTok sources", () => {
    expect(
      socialMediaCandidates(
        `<meta content="${media.replace("&", "&amp;")}" property="og:video:secure_url">`,
        "instagram"
      )
    ).toEqual([media]);
    expect(
      socialMediaCandidates(
        '<script type="application/json">{"video":{"playAddr":"https://v.tiktokcdn.com/clip.mp4"}}</script>',
        "tiktok"
      )
    ).toEqual(["https://v.tiktokcdn.com/clip.mp4"]);
  });
  it.each([
    "https://localhost/a",
    "https://instagram.com.evil.org/reel/test/",
    "https://user:pass@instagram.com/reel/test/",
    "http://instagram.com/reel/test/",
    "https://instagram.com/accounts/login/",
    "https://instagram.com/profile/",
  ])("rejects non-post or unsafe URLs %s", value =>
    expect(socialVideoSource(value)).toBeUndefined()
  );
  it.each([
    "https://cdninstagram.com.evil.org/a",
    "https://127.0.0.1/a",
    "https://cdninstagram.com:8443/a",
    "https://user:pass@cdninstagram.com/a",
  ])("does not proxy untrusted media hosts %s", value =>
    expect(allowedSocialMediaUrl(value, "instagram")).toBe(false)
  );
  it("streams only validated CDN media with no authentication forwarded", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(`<meta property="og:video" content="${media}">`)
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), {
          headers: { "content-type": "video/mp4" },
        })
      );
    const response = await fetchSocialVideo(
      "https://www.instagram.com/reel/ABC123/?igsh=tracking",
      new AbortController().signal,
      fetcher
    );
    expect(fetcher.mock.calls[0][0]).toBe(
      "https://www.instagram.com/reel/ABC123/embed/"
    );
    expect(fetcher.mock.calls[1][1].headers).toBeUndefined();
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([
      1, 2, 3,
    ]);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("never follows a CDN redirect into the private network", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(`<meta property="og:video" content="${media}">`)
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "https://127.0.0.1/private" },
        })
      );
    await expect(
      fetchSocialVideo(
        "https://instagram.com/reel/ABC/",
        new AbortController().signal,
        fetcher
      )
    ).rejects.toThrow("isn't available");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("stops at login walls and cancellation without launching another service", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "https://www.instagram.com/accounts/login/" },
      })
    );
    await expect(
      fetchSocialVideo(
        "https://instagram.com/reel/ABC/",
        new AbortController().signal,
        fetcher
      )
    ).rejects.toThrow("isn't available");
    expect(fetcher).toHaveBeenCalledTimes(1);
    const abort = new AbortController();
    abort.abort();
    await expect(
      fetchSocialVideo("https://instagram.com/reel/ABC/", abort.signal, fetcher)
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

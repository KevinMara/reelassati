import { describe, expect, it } from "vitest";
import { modelUserContent } from "./model-content";

describe("native provider multimodal content", () => {
  it("sends actual video and image parts as content arrays instead of quoted JSON", () => {
    const content = [
      { type: "text", text: "Inspect the supplied video" },
      { type: "video_url", video_url: { url: "data:video/mp4;base64,AAAA" } },
      { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } },
    ];
    const providerBody = JSON.parse(
      JSON.stringify({
        messages: [{ role: "user", content: modelUserContent(content) }],
      })
    );
    expect(providerBody.messages[0].content).toEqual(content);
    expect(Array.isArray(providerBody.messages[0].content)).toBe(true);
  });
  it("keeps ordinary structured data textual, while rejecting malformed media", () => {
    expect(modelUserContent({ command: "Edit", duration: 20 })).toBe(
      '{"command":"Edit","duration":20}'
    );
    expect(() =>
      modelUserContent([{ type: "video_url", video_url: {} }])
    ).toThrow("Unsupported");
    expect(() =>
      modelUserContent([{ type: "tool", command: "fetch private files" }])
    ).toThrow("Unsupported");
  });
});

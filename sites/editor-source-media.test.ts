import { expect, it, vi } from "vitest";
import type { TimelineClip } from "../contracts/workspace";
import { editorSourceMedia } from "./editor-source-media";
import { MAX_AI_MEDIA_BYTES } from "../contracts/uploads";

const clip = (id: string, assetId = id, patch: Partial<TimelineClip> = {}) =>
  ({
    id,
    assetId,
    track: "video",
    label: id,
    start: 3,
    duration: 2,
    inPoint: 5,
    outPoint: 9,
    speed: 2,
    locked: false,
    color: "#ffffff",
    ...patch,
  }) as TimelineClip;
const bytes = new Uint8Array([0, 1, 250, 255]);
function access() {
  return {
    owned: vi.fn(async (id: string) =>
      id === "foreign"
        ? null
        : { content_type: "video/mp4", bytes: 4, r2_key: id }
    ),
    read: vi.fn(async () => ({
      size: 4,
      arrayBuffer: async () => bytes.buffer,
    })),
  };
}
it("sends owned native media once with real source-clock mappings and excludes hidden/nonvisual clips", async () => {
  const io = access();
  const result = await editorSourceMedia(
    {
      clips: [
        clip("a", "source"),
        clip("b", "source", { start: 8 }),
        clip("hidden", "hidden", { hidden: true }),
        clip("audio", "audio", { track: "audio" }),
      ],
    },
    io,
    new AbortController().signal
  );
  expect(io.owned.mock.calls).toEqual([["source"]]);
  expect(result).toHaveLength(2);
  expect(result[0]).toMatchObject({
    type: "text",
    text: expect.stringContaining('"sourceIn":5,"speed":2'),
  });
  expect(result[0]).toMatchObject({
    text: expect.stringContaining('"timelineStart":8'),
  });
  expect(result[1]).toEqual({
    type: "video_url",
    video_url: { url: "data:video/mp4;base64,AAH6/w==" },
  });
});
it("does not read another owner, malformed size, unsupported or excessive sources", async () => {
  const io = access();
  io.owned.mockImplementation(async id =>
    id === "foreign"
      ? null
      : {
          content_type:
            id === "unsupported" ? "application/octet-stream" : "video/mp4",
          bytes:
            id === "large" ? MAX_AI_MEDIA_BYTES + 1 : id === "bad" ? -1 : 4,
          r2_key: id,
        }
  );
  const result = await editorSourceMedia(
    { clips: ["foreign", "large", "bad", "unsupported"].map(id => clip(id)) },
    io,
    new AbortController().signal
  );
  expect(io.read).not.toHaveBeenCalled();
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({
    type: "text",
    text: expect.stringContaining("Do not claim to have watched"),
  });
});
it("prioritizes selected clips and reports omitted sources without hiding the coverage gap", async () => {
  const io = access();
  const result = await editorSourceMedia(
    { clips: ["a", "b", "c", "d", "e"].map(id => clip(id)) },
    io,
    new AbortController().signal,
    ["e"]
  );
  expect(io.owned.mock.calls.map(([id]) => id)).toEqual(["e", "a", "b", "c"]);
  expect(result.at(-1)).toMatchObject({
    text: expect.stringContaining('"assetId":"d"'),
  });
});
it("uses the selected time interval, validates storage bytes and respects cancellation", async () => {
  const io = access();
  const cancel = vi.fn(async () => undefined);
  io.read.mockResolvedValue({
    size: 3,
    arrayBuffer: async () => bytes.buffer,
    body: { cancel },
  } as never);
  const result = await editorSourceMedia(
    { clips: [clip("outside", "outside", { start: 0 }), clip("inside")] },
    io,
    new AbortController().signal,
    [],
    { start: 3, end: 5 }
  );
  expect(io.owned.mock.calls).toEqual([["inside"]]);
  expect(cancel).toHaveBeenCalledOnce();
  expect(result).toEqual([
    {
      type: "text",
      text: expect.stringContaining("byte-size verification failed"),
    },
  ]);
  const controller = new AbortController();
  controller.abort();
  io.owned.mockClear();
  await expect(
    editorSourceMedia({ clips: [clip("a")] }, io, controller.signal)
  ).rejects.toThrow();
  expect(io.owned).not.toHaveBeenCalled();
});

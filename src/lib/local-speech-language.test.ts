import { describe, expect, it, vi } from "vitest";
import {
  detectLocalSpeechLanguage,
  selectWhisperLanguage,
} from "./local-speech-language";

// This unit exercises the injected Tensor boundary, not an ONNX inference session.
// Importing Transformers' Node entry point loads a native addon that cannot be
// re-registered across CI worker threads; the application uses its browser build.
class TensorFixture {
  dispose = vi.fn();
  readonly type: string;
  readonly data: ArrayLike<number | bigint>;
  readonly dims: number[];
  constructor(
    type: string,
    data: ArrayLike<number | bigint>,
    dims: number[]
  ) {
    this.type = type;
    this.data = data;
    this.dims = dims;
  }
}
const Tensor = TensorFixture as unknown as Parameters<
  typeof detectLocalSpeechLanguage
>[1];

describe("source language detection", () => {
  it("selects the strongest language token, ignoring higher non-language logits", () => {
    expect(
      selectWhisperLanguage([100, 1, 4, 2], {
        "<|en|>": 1,
        "<|it|>": 2,
        "<|fr|>": 3,
      })
    ).toBe("it");
  });
  it("never defaults to English when usable language scores are absent", () => {
    expect(() =>
      selectWhisperLanguage([NaN, Infinity], { "<|en|>": 0, "<|it|>": 1 })
    ).toThrow("could not detect");
    expect(() => selectWhisperLanguage([4, 3], {})).toThrow("could not detect");
  });
  it("uses one start-of-transcript token and at most 30 seconds, then releases tensors", async () => {
    const features = new TensorFixture("float32", [0], [1, 1, 1]);
    const logits = new TensorFixture("float32", [100, 1, 4, 2], [1, 1, 4]);
    let prompt: TensorFixture | undefined;
    const processor = vi.fn<(audio: Float32Array) => Promise<{ input_features: TensorFixture }>>().mockResolvedValue({ input_features: features });
    const forward = vi.fn(async (input: Record<string, unknown>) => {
      prompt = input.decoder_input_ids as TensorFixture;
      return { logits };
    });
    const model = {
      generation_config: {
        decoder_start_token_id: 50258,
        lang_to_id: { "<|en|>": 1, "<|it|>": 2 },
      },
      forward,
    };
    expect(
      await detectLocalSpeechLanguage(
        { processor, model },
        Tensor,
        new Float32Array(16_000 * 45)
      )
    ).toBe("it");
    expect(processor.mock.calls[0][0]).toHaveLength(16_000 * 30);
    expect(prompt).toBeInstanceOf(TensorFixture);
    expect(prompt?.type).toBe("int64");
    expect(prompt?.dims).toEqual([1, 1]);
    expect(Array.from(prompt?.data ?? [])).toEqual([50258n]);
    expect(forward).toHaveBeenCalledOnce();
    expect(prompt?.dispose).toHaveBeenCalledOnce();
    expect(features.dispose).toHaveBeenCalledOnce();
    expect(logits.dispose).toHaveBeenCalledOnce();
  });
});

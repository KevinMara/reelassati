import { describe, expect, it, vi } from "vitest";
import { Tensor } from "@huggingface/transformers";
import {
  detectLocalSpeechLanguage,
  selectWhisperLanguage,
} from "./local-speech-language";

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
    const features = new Tensor("float32", [0], [1, 1, 1]);
    const logits = new Tensor("float32", [100, 1, 4, 2], [1, 1, 4]);
    const featureDispose = vi.spyOn(features, "dispose");
    const logitDispose = vi.spyOn(logits, "dispose");
    let prompt: unknown;
    const processor = vi.fn<(audio: Float32Array) => Promise<{ input_features: Tensor }>>().mockResolvedValue({ input_features: features });
    const forward = vi.fn(async (input: Record<string, unknown>) => {
      prompt = (input.decoder_input_ids as Tensor).tolist();
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
    expect(prompt).toEqual([[50258n]]);
    expect(forward).toHaveBeenCalledOnce();
    expect(featureDispose).toHaveBeenCalledOnce();
    expect(logitDispose).toHaveBeenCalledOnce();
  });
});

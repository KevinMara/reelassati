import type { Tensor as TransformerTensor } from "@huggingface/transformers";
import { LOCAL_SPEECH_MODEL } from "@contracts/local-speech-model";

/** Whisper detects language by ranking only language tokens after <|startoftranscript|>.
 * Transformers.js 3 currently defaults to English when no language is supplied. */
export function selectWhisperLanguage(
  scores: ArrayLike<number>,
  languageTokens: Record<string, number>
): string {
  let language: string | undefined;
  let highest = -Infinity;
  for (const [token, id] of Object.entries(languageTokens)) {
    const code = /^<\|([a-z]{2,3})\|>$/.exec(token)?.[1];
    const score = scores[id];
    if (
      code &&
      Number.isInteger(id) &&
      id >= 0 &&
      Number.isFinite(score) &&
      score > highest
    ) {
      highest = score;
      language = code;
    }
  }
  if (!language)
    throw new Error(
      "The local speech model could not detect the source language. Choose the source language explicitly."
    );
  return language;
}

/** One bounded local forward pass, following Whisper's detect_language algorithm.
 * No transcription text, UI locale, account language, or English fallback is used. */
export async function detectLocalSpeechLanguage(
  transcriber: {
    model: {
      generation_config: unknown;
      forward(
        inputs: Record<string, unknown>
      ): Promise<Record<string, unknown>>;
    };
    processor(audio: Float32Array): Promise<Record<string, unknown>>;
  },
  Tensor: typeof TransformerTensor,
  audio: Float32Array
): Promise<string> {
  const config = transcriber.model.generation_config as {
    decoder_start_token_id?: number;
    lang_to_id?: Record<string, number>;
  } | null;
  if (!config?.lang_to_id || !Number.isInteger(config.decoder_start_token_id))
    throw new Error(
      "The local speech model has no language-detection configuration."
    );
  const decoderInput = new Tensor(
    "int64",
    [BigInt(config.decoder_start_token_id!)],
    [1, 1]
  );
  let inputs: Record<string, unknown> = {};
  let outputs: Record<string, unknown> = {};
  try {
    inputs = await transcriber.processor(
      audio.subarray(0, LOCAL_SPEECH_MODEL.sampleRate * 30)
    );
    outputs = await transcriber.model.forward({
      ...inputs,
      decoder_input_ids: decoderInput,
    });
    const logits = outputs.logits;
    if (
      !(logits instanceof Tensor) ||
      logits.dims.length !== 3 ||
      logits.dims[0] !== 1 ||
      logits.dims[1] !== 1
    )
      throw new Error(
        "The local speech model returned invalid language scores."
      );
    const scores = new Float64Array(logits.data.length);
    for (let index = 0; index < scores.length; index++)
      scores[index] = Number(logits.data[index]);
    return selectWhisperLanguage(scores, config.lang_to_id);
  } finally {
    for (const value of new Set([
      decoderInput,
      ...Object.values(inputs),
      ...Object.values(outputs),
    ]))
      if (value instanceof Tensor) value.dispose();
  }
}

/** Public ONNX conversion of Whisper base. This timestamped export contains
 * cross_attentions.0–5 in the q8 decoder as well as the alignment heads. */
export const LOCAL_SPEECH_MODEL = {
  id: "onnx-community/whisper-base_timestamped",
  revision: "608c49e61301901684bc36cac8f74b95ff6b5a8e",
  sampleRate: 16000,
  maxSeconds: 600,
} as const;

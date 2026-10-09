import { loadLocalTransformers } from "../lib/local-transformers";
import {
  cosineSimilarity,
  SEMANTIC_SEARCH_LIMITS,
  type SemanticSearchRequest,
  type SemanticSearchResponse,
} from "../lib/semantic-search-protocol";

const worker = self as unknown as {
  onmessage: ((event: MessageEvent<SemanticSearchRequest>) => void) | null;
  postMessage: (message: SemanticSearchResponse) => void;
};
type LocalExtractor = (
  texts: string[],
  options: { pooling: "mean"; normalize: boolean }
) => Promise<{ dims: number[]; data: ArrayLike<number> }>;
// Narrow the public pipeline overload to this task only; this avoids building
// Transformers' enormous union of every supported task in application types.
type CreateExtractor = (
  task: "feature-extraction",
  model: string,
  options: { dtype: "q8"; device: "wasm"; local_files_only: boolean }
) => Promise<LocalExtractor>;
let extractor: Promise<LocalExtractor> | undefined;
let storedFingerprint: string | undefined;
let vectors: Float32Array[] = [];
let busy = false;
const send = (message: SemanticSearchResponse) => worker.postMessage(message);

worker.onmessage = async event => {
  const request = event.data;
  if (request.type !== "search" || busy) return;
  busy = true;
  const { id } = request;
  try {
    if (
      !Number.isSafeInteger(id) ||
      typeof request.fingerprint !== "string" ||
      typeof request.query !== "string" ||
      !request.query.trim() ||
      request.query.length > 500 ||
      !Array.isArray(request.excerpts) ||
      !request.excerpts.length ||
      request.excerpts.length > SEMANTIC_SEARCH_LIMITS.excerpts ||
      request.excerpts.some(
        text =>
          typeof text !== "string" ||
          !text.trim() ||
          text.length > SEMANTIC_SEARCH_LIMITS.excerptCharacters
      )
    )
      throw new Error("Invalid search evidence");
    if (!extractor) {
      send({
        type: "progress",
        id,
        message: "Loading the local English search model…",
      });
      // All resources are pinned same-origin static files. Excerpts and vectors
      // stay in this disposable worker and are never persisted or uploaded.
      const { env, pipeline } = await loadLocalTransformers();
      env.allowRemoteModels = false;
      env.allowLocalModels = true;
      env.localModelPath = "/vendor/search/";
      env.useBrowserCache = false;
      env.useFSCache = false;
      const wasm = env.backends.onnx.wasm!;
      wasm.wasmPaths = "/vendor/search/ort/";
      wasm.numThreads = 1;
      wasm.proxy = false;
      const createExtractor = pipeline as unknown as CreateExtractor;
      extractor = createExtractor(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
        { dtype: "q8", device: "wasm", local_files_only: true }
      );
    }
    const model = await extractor;
    const encode = async (texts: string[]) => {
      const output = await model(texts, { pooling: "mean", normalize: true });
      if (
        output.dims.length !== 2 ||
        output.dims[0] !== texts.length ||
        output.dims[1] !== SEMANTIC_SEARCH_LIMITS.dimension
      )
        throw new Error("Invalid embedding shape");
      const values = output.data;
      return texts.map((_text, index) =>
        Float32Array.from(
          Array.prototype.slice.call(
            values,
            index * SEMANTIC_SEARCH_LIMITS.dimension,
            (index + 1) * SEMANTIC_SEARCH_LIMITS.dimension
          ) as number[]
        )
      );
    };
    if (request.fingerprint !== storedFingerprint) {
      const next: Float32Array[] = [];
      for (
        let index = 0;
        index < request.excerpts.length;
        index += SEMANTIC_SEARCH_LIMITS.batchSize
      ) {
        send({
          type: "progress",
          id,
          message: `Reading local evidence ${Math.min(index + SEMANTIC_SEARCH_LIMITS.batchSize, request.excerpts.length)} of ${request.excerpts.length}…`,
        });
        next.push(
          ...(await encode(
            request.excerpts.slice(
              index,
              index + SEMANTIC_SEARCH_LIMITS.batchSize
            )
          ))
        );
      }
      vectors = next;
      storedFingerprint = request.fingerprint;
    }
    const [query] = await encode([request.query]);
    send({
      type: "result",
      id,
      similarities: vectors.map(vector => cosineSimilarity(query, vector)),
    });
  } catch {
    // Model/download errors can contain URLs; return only a useful fixed message.
    extractor = undefined;
    storedFingerprint = undefined;
    vectors = [];
    send({
      type: "error",
      id,
      message:
        "Local meaning search could not finish. Try literal search or reload this page.",
    });
  } finally {
    busy = false;
  }
};

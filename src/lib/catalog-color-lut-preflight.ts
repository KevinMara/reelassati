import type { EditOperation } from "@contracts/workspace";
import { loadColorLut } from "./color-lut";

/** Match manual selection: validate real immutable bytes before recording a
 * completed edit. This is a cancellable catalog read, never a provider call. */
export async function preflightEditColorLuts(
  operations: readonly Pick<EditOperation, "type" | "parameters">[],
  signal: AbortSignal
) {
  const verified = new Set<string>();
  signal.throwIfAborted();
  for (const operation of operations) {
    const reference =
      operation.type === "style" ? operation.parameters?.colorLut : undefined;
    if (!reference || verified.has(reference.sha256)) continue;
    await loadColorLut(reference, signal);
    signal.throwIfAborted();
    verified.add(reference.sha256);
  }
  signal.throwIfAborted();
}

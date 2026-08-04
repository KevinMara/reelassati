import {
  appendTextProvenanceMarker,
  type ContentProvenance,
} from "@contracts/compliance";

/** EU-AI-06 — Copy final generated text with its machine-readable token. */
export async function copyTextWithProvenance(
  text: string,
  provenance?: ContentProvenance
): Promise<void> {
  const verifiedToken =
    provenance?.marking.status === "verified"
      ? provenance.marking.publicToken
      : undefined;
  await navigator.clipboard.writeText(
    appendTextProvenanceMarker(text, verifiedToken)
  );
}

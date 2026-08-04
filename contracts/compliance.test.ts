import { describe, expect, it } from "vitest";
import {
  AI_TEXT_MARKER_PREFIX,
  appendTextProvenanceMarker,
  extractTextProvenanceToken,
  requiredDisclosureText,
  withoutTextProvenanceMarker,
} from "./compliance";

describe("AI compliance contract", () => {
  it("round-trips a signed text token without changing the visible copy", () => {
    const visible = "A polished creator script.";
    const token = "0123456789abcdef_signed_record";
    const marked = appendTextProvenanceMarker(visible, token);

    expect(marked).toContain(AI_TEXT_MARKER_PREFIX);
    expect(extractTextProvenanceToken(marked)).toBe(token);
    expect(withoutTextProvenanceMarker(marked)).toBe(visible);
    expect(appendTextProvenanceMarker(marked, token)).toBe(marked);
  });

  it("rejects malformed public tokens instead of treating them as provenance", () => {
    const malformed = `${AI_TEXT_MARKER_PREFIX}<script>alert(1)</script>\u2063`;
    expect(extractTextProvenanceToken(malformed)).toBeNull();
  });

  it("keeps required publication disclosure compact and contextual", () => {
    expect(
      requiredDisclosureText({
        containsRealisticSyntheticMedia: true,
        publicInterestText: false,
      })
    ).toBe("AI-generated or AI-manipulated media.");
    expect(
      requiredDisclosureText({
        containsRealisticSyntheticMedia: false,
        publicInterestText: true,
      })
    ).toBe("Public-interest text created or materially edited with AI.");
    expect(
      requiredDisclosureText({
        containsRealisticSyntheticMedia: true,
        publicInterestText: true,
      })
    ).toBe(
      "AI-generated or AI-manipulated media. Public-interest text created or materially edited with AI."
    );
    expect(
      requiredDisclosureText(
        {
          containsRealisticSyntheticMedia: true,
          publicInterestText: true,
        },
        "it"
      )
    ).toBe(
      "Contenuto multimediale generato o manipolato con l’IA. Testo di interesse pubblico creato o modificato in modo sostanziale con IA."
    );
    expect(
      requiredDisclosureText({
        containsRealisticSyntheticMedia: false,
        publicInterestText: false,
      })
    ).toBeNull();
  });
});

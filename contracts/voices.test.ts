import { describe, expect, it } from "vitest";
import {
  filterVoices,
  findVoice,
  VOICE_CATALOG,
  VOICE_LANGUAGES,
  VOICE_PREVIEWS,
} from "./voices";

describe("documented voice catalog", () => {
  it("keeps provider identifiers, language-specific samples and legacy cached previews valid", () => {
    expect(VOICE_CATALOG.length).toBe(332);
    expect(new Set(VOICE_CATALOG.map(voice => voice.id)).size).toBe(
      VOICE_CATALOG.length
    );
    expect(VOICE_LANGUAGES.length).toBe(24);
    for (const voice of VOICE_CATALOG) {
      expect(voice.name.length).toBeGreaterThan(0);
      expect(VOICE_PREVIEWS[voice.id]?.length).toBeGreaterThan(20);
      expect(VOICE_PREVIEWS[voice.id]?.length).toBeLessThan(200);
      expect(voice.tags.length).toBeGreaterThan(0);
      expect(voice.tags.length).toBeLessThanOrEqual(3);
    }
    expect(VOICE_PREVIEWS.Italian_Narrator).toBe(
      "Una piccola idea può diventare una storia da condividere. Rendiamo la tua chiara, autentica e memorabile."
    );
    expect(VOICE_PREVIEWS.English_Graceful_Lady).toBe(
      "A small idea can become a story worth sharing. Let us make yours clear, confident, and memorable."
    );
    expect(findVoice("Cantonese_ProfessionalHost (F)")?.language).toBe(
      "Cantonese"
    );
    expect(findVoice("greek_male_1a_v1")?.language).toBe("Greek");
    expect(findVoice("not-a-system-voice")).toBeUndefined();
    expect(VOICE_PREVIEWS["not-a-system-voice"]).toBeUndefined();
  });

  it("combines search words, language and descriptive tags without excluding saved voices", () => {
    expect(filterVoices("narration", "Italian").map(voice => voice.id)).toEqual(
      ["Italian_Narrator"]
    );
    expect(filterVoices("  WARM   ENGLISH ").length).toBeGreaterThan(0);
    expect(
      filterVoices("", "Spanish", "calm").every(
        voice => voice.language === "Spanish" && voice.tags.includes("calm")
      )
    ).toBe(true);
    expect(filterVoices("not-a-language", "Italian")).toEqual([]);
    expect(filterVoices().length).toBe(VOICE_CATALOG.length);
    for (const id of [
      "English_Graceful_Lady",
      "English_CalmWoman",
      "English_Trustworth_Man",
      "English_Diligent_Man",
      "Italian_Narrator",
      "Italian_BraveHeroine",
      "French_MaleNarrator",
      "German_FriendlyMan",
    ]) {
      expect(findVoice(id)).toBeDefined();
    }
  });
});

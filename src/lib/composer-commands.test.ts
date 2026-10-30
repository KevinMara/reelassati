import { describe, it, expect } from "vitest";
import { composerToken, rankComposerCommands } from "./composer-commands";
describe("composer command tokens", () => {
  it("opens at a word boundary and closes on whitespace, without mistaking emails or arithmetic", () => {
    expect(composerToken("Please @capt", 12)).toMatchObject({
      trigger: "@",
      query: "capt",
      start: 7,
      end: 12,
    });
    expect(composerToken("@capt ")).toBeUndefined();
    expect(composerToken("hello@example.com")).toBeUndefined();
    expect(composerToken("1+2")).toBeUndefined();
    expect(composerToken("+reference\n")).toBeUndefined();
    expect(composerToken("+ref tail", 4)).toMatchObject({
      query: "ref",
      start: 0,
      end: 4,
    });
  });
  it("ranks exact names ahead of partial and typo matches", () => {
    const commands = [
      { label: "Caption styles" },
      { label: "Graphics" },
      { label: "Captions" },
    ];
    expect(rankComposerCommands(commands, "Captions")[0].label).toBe(
      "Captions"
    );
    expect(rankComposerCommands(commands, "grapics")[0].label).toBe("Graphics");
    expect(rankComposerCommands(commands, "")).toEqual(commands);
  });
});

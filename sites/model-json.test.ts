import { describe, expect, it } from "vitest";
import { ModelJsonError, parseModelObject, parseProviderFrame } from "./model-json";

describe("provider JSON boundary", () => {
  it("preserves complete objects, Unicode and quoted delimiters exactly", () => {
    const value = {summary: 'Caffè 🎬 ",}"', changes: [{parameters: {text: 'text\\"},]'}}]};
    expect(parseModelObject(JSON.stringify(value))).toEqual(value);
    expect(parseModelObject('```json\n' + JSON.stringify(value) + '\n```')).toEqual(value);
  });
  it("recovers trailing commas without altering any values", () => {
    expect(parseModelObject('{"changes":[{"type":"style","parameters":{"fadeOut":0.2,},},],"text":",}",}'))
      .toEqual({changes: [{type: "style", parameters: {fadeOut: 0.2}}], text: ",}"});
  });
  it.each([
    ['{"changes":[{"type":"trim"}', "unclosed-container"],
    ['{"text":"unfinished', "unterminated-string"],
    ['{"changes":]}', "mismatched-container"],
    ['{"changes":[,]}', "invalid-syntax"],
    ['{,}', "invalid-syntax"],
    ['{"start":1,,"end":2}', "invalid-syntax"],
    ['{"start":,}', "invalid-syntax"],
    ['{"start":1} unrelated', "invalid-syntax"],
    ['[{"type":"trim"}]', "not-object"],
    ['null', "not-object"],
    ['', "empty"],
  ])("rejects ambiguous or incomplete output %s", (text, reason) => {
    expect(() => parseModelObject(text)).toThrow(ModelJsonError);
    try { parseModelObject(text); } catch (e) {
      expect((e as ModelJsonError).diagnostic).toMatchObject({stage: "model-output", reason});
    }
  });
  it("never keeps private input or parser excerpts in its error", () => {
    let error: unknown;
    try { parseModelObject('{"secret":"private@example.com token=secret https://private.invalid/'); } catch(e) {error=e;}
    expect(JSON.stringify(error) + String(error)).not.toMatch(/private|token|example|https/);
    expect(error).toMatchObject({diagnostic: {reason: "unterminated-string"}});
  });
  it("keeps wire frames strict and distinguishes them from model content", () => {
    expect(parseProviderFrame('{"choices":[]}')).toEqual({choices: []});
    for (const text of ['{"choices":[],}', 'data corrupted', '[]']) {
      try { parseProviderFrame(text); throw new Error("accepted"); } catch (e) {
        expect(e).toMatchObject({diagnostic: {stage: "stream-frame"}});
      }
    }
  });
});

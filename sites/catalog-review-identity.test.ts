import { expect, it } from "vitest";
import { catalogReviewIdentity } from "./catalog-review-identity";

it("binds observations to exact assets even when the returned order differs", () => {
  const value = catalogReviewIdentity("sound", ["hash-a", "hash-b"], [
    {type: "text", text: JSON.stringify({id: "hash-a", duration: 3})},
    {type: "input_audio", input_audio: {data: "AAAA", format: "mp3"}},
    {type: "text", text: JSON.stringify({id: "hash-b", duration: 5})},
  ]);
  expect(value.ids).toEqual(["asset-1", "asset-2"]);
  expect(value.parts[0]).toEqual({type: "text", text: '{"id":"asset-1","duration":3}'});
  expect(value.parts[1]).toEqual({type: "input_audio", input_audio: {data: "AAAA", format: "mp3"}});
  expect(value.bind({sounds: [{id: "asset-2", character: "Hum"}, {id: "asset-1", character: "Click"}]})).toEqual({
    sounds: [{id: "hash-b", character: "Hum"}, {id: "hash-a", character: "Click"}],
  });
});
it.each([
  {sounds: [{id: "asset-1"}, {id: "asset-1"}]},
  {sounds: [{id: "asset-1"}, {id: "asset-3"}]},
  {sounds: [{id: "asset-1"}]},
  {sounds: [{id: "asset-1"}, {id: "hash-b"}]},
])("rejects missing, repeated and invented request identities", response => {
  expect(() => catalogReviewIdentity("sound", ["hash-a", "hash-b"], []).bind(response)).toThrow("identities do not match");
});

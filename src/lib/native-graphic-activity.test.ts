import { expect, it } from "vitest";
import {
  beginNativeGraphicExport,
  nativeGraphicExportActive,
  subscribeNativeGraphicActivity,
} from "./native-graphic-activity";

it("keeps previews suspended until every export releases, including duplicate cleanup", () => {
  const states: boolean[] = [];
  const unsubscribe = subscribeNativeGraphicActivity(() =>
    states.push(nativeGraphicExportActive())
  );
  const releaseFirst = beginNativeGraphicExport();
  const releaseSecond = beginNativeGraphicExport();
  releaseFirst();
  releaseFirst();
  expect(nativeGraphicExportActive()).toBe(true);
  releaseSecond();
  expect(nativeGraphicExportActive()).toBe(false);
  expect(states).toEqual([true, true, true, false]);
  unsubscribe();
});

import { describe, expect, it } from "vitest";
import { WorkspaceSaveLifecycle } from "./workspace-save-lifecycle";

describe("queued saves across workspace reloads", () => {
  it("ignores an old success after another workspace has loaded", async () => {
    const lifecycle = new WorkspaceSaveLifecycle();
    let release!: () => void;
    const response = new Promise<void>(resolve => { release = resolve; });
    let revision = 5;
    const oldSave = lifecycle.begin();
    const acknowledgement = response.then(() => {
      if (lifecycle.current(oldSave)) revision = 100;
    });
    lifecycle.reset();
    revision = 2;
    release();
    await acknowledgement;
    expect(revision).toBe(2);
  });

  it("cannot turn a reloaded workspace into a conflict from an old rejection", async () => {
    const lifecycle = new WorkspaceSaveLifecycle();
    const oldSave = lifecycle.begin();
    lifecycle.reset();
    let conflict = false;
    await Promise.reject(new Error("old 409")).catch(() => {
      if (lifecycle.current(oldSave)) conflict = true;
    });
    expect(conflict).toBe(false);
  });

  it("an old queue completion cannot clear a new workspace's saving indicator", () => {
    const lifecycle = new WorkspaceSaveLifecycle();
    const oldFirst = lifecycle.begin(), oldSecond = lifecycle.begin();
    lifecycle.reset();
    const newFirst = lifecycle.begin(), newSecond = lifecycle.begin();
    expect(lifecycle.finish(oldFirst)).toBeNull();
    expect(lifecycle.finish(newFirst)).toBe(false);
    expect(lifecycle.finish(oldSecond)).toBeNull();
    expect(lifecycle.finish(newSecond)).toBe(true);
  });

  it("invalidates pending work when adopting a refreshed copy of the same account", () => {
    const lifecycle = new WorkspaceSaveLifecycle();
    const oldSave = lifecycle.begin();
    const refreshed = lifecycle.reset();
    expect(lifecycle.current(oldSave)).toBe(false);
    expect(lifecycle.current(refreshed)).toBe(true);
  });
});

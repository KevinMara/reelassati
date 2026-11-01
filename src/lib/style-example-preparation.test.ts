import { describe, expect, it } from "vitest";
import {
  createEmptyWorkspace,
  type Asset,
  type EditProject,
} from "@contracts/workspace";
import {
  normalizeEditStyleTemplate,
  editTemplateDirection,
  resolveEditStyleOperations,
} from "@contracts/edit-style-template";
import { normalizeGraphic } from "@contracts/motion-graphics";
import {
  addStyleExample,
  assetStyleExample,
  projectStyleExample,
  newWorkspaceStyle,
  saveWorkspaceStyle,
  selectProjectEditingStyle,
  workspaceStyles,
  filterWorkspaceStyles,
} from "@/components/styles/style-workspace";
import {
  pendingStyleExampleAssets,
  saveStyleExampleReview,
} from "./style-example-preparation";

const asset = (id: string): Asset => ({
  id,
  kind: "video",
  name: `${id}.mp4`,
  contentType: "video/mp4",
  duration: 20,
  size: 100,
  status: "ready",
  url: `/media/${id}`,
  createdAt: "",
});
const project = (id: string): EditProject =>
  ({
    id,
    title: `Private ${id}`,
    template: "blank",
    status: "editing",
    platform: "instagram",
    playhead: 0,
    createdAt: "",
    updatedAt: "",
    proposedChanges: [],
    qualitySignals: [],
    revisions: [],
    aspectRatio: "9:16",
    duration: 20,
    transcript: [],
    captionStyle: "classic",
    clips: [
      {
        id: "footage",
        assetId: "original-asset",
        label: "SOURCE SUBJECT",
        track: "video",
        start: 0,
        duration: 20,
        inPoint: 0,
        outPoint: 20,
        locked: false,
        color: "#000000",
      },
      {
        id: "graphic",
        label: "Source claim",
        track: "overlay",
        start: 2,
        duration: 5,
        inPoint: 0,
        outPoint: 5,
        locked: false,
        color: "#123456",
        graphic: normalizeGraphic({
          kind: "text",
          text: "SOURCE SECRET WORDS",
          color: "#123456",
          animation: "slide",
        }),
      },
    ],
  }) as EditProject;
function fixture() {
  const draft = newWorkspaceStyle("editing", "style");
  if (draft.kind !== "editing") throw new Error("Wrong fixture");
  draft.value.name = "My style";
  draft.value.folder = "Education";
  draft.value.contentType = "Explainer";
  draft.value.language = "Italian";
  draft.value.blueprint = projectStyleExample(
    project("base"),
    "base"
  ).blueprint;
  draft.value = addStyleExample(
    draft.value,
    assetStyleExample(asset("first"), "example-1")
  );
  draft.value = addStyleExample(
    draft.value,
    assetStyleExample(asset("second"), "example-2")
  );
  draft.value = addStyleExample(
    draft.value,
    projectStyleExample(project("third"), "example-3")
  );
  let workspace = saveWorkspaceStyle(
    createEmptyWorkspace("styles@example.com"),
    draft,
    "create"
  );
  workspace.assets = [asset("first"), asset("second")];
  workspace.projects = [project("target")];
  workspace = selectProjectEditingStyle(workspace, "style", "target");
  return { workspace, template: workspace.projects[0].editStyleTemplate! };
}

describe("styles with multiple examples", () => {
  it("round-trips all examples and organization, retaining the full original and example archives", () => {
    const { workspace, template } = fixture();
    const restored = workspaceStyles(JSON.parse(JSON.stringify(workspace)))[0];
    expect(restored.value).toEqual(template);
    expect(template.blueprint?.clips[1].graphic?.text).toBe(
      "SOURCE SECRET WORDS"
    );
    expect(template.examples?.[2].blueprint?.clips[1].graphic?.text).toBe(
      "SOURCE SECRET WORDS"
    );
    expect(template.examples?.[2].blueprint).not.toBe(template.blueprint);
    const updated = {
      ...template,
      examples: template.examples!.filter(
        example => example.id !== "example-1"
      ),
    };
    const saved = saveWorkspaceStyle(
      workspace,
      { kind: "editing", value: updated },
      "update"
    );
    expect(workspaceStyles(JSON.parse(JSON.stringify(saved)))[0].value).toEqual(
      updated
    );
    expect(template.examples).toHaveLength(3);
    expect(
      filterWorkspaceStyles([restored], {
        folder: "Education",
        contentType: "Explainer",
        language: "Italian",
        kind: "editing",
        query: "third",
      })
    ).toEqual([restored]);
    expect(
      filterWorkspaceStyles([restored], { folder: "__unfiled__" })
    ).toEqual([]);
  });

  it("validates every unreviewed video before purchases and checkpoints each review for reuse", () => {
    const { workspace, template } = fixture();
    expect(
      pendingStyleExampleAssets(template, workspace.assets).map(
        item => item.asset.id
      )
    ).toEqual(["first", "second"]);
    expect(() => pendingStyleExampleAssets(template, [asset("first")])).toThrow(
      "unavailable"
    );
    expect(() =>
      pendingStyleExampleAssets(template, [
        asset("first"),
        { ...asset("second"), duration: undefined },
      ])
    ).toThrow("duration");
    const observed = {
      ...template.profile,
      traits: { ...template.profile.traits, pacing: "brisk" },
    };
    const first = saveStyleExampleReview(
      workspace,
      "target",
      template,
      "example-1",
      observed
    );
    const next = first.projects[0].editStyleTemplate!;
    expect(
      pendingStyleExampleAssets(next, first.assets).map(item => item.asset.id)
    ).toEqual(["second"]);
    expect(first.editStyleTemplates?.[0].examples?.[0].profile).toEqual(
      next.examples?.[0].profile
    );
    expect(() =>
      saveStyleExampleReview(first, "target", template, "example-2", observed)
    ).toThrow("changed");
    const final = saveStyleExampleReview(first, "target", next, "example-2", {
      ...observed,
      traits: { ...observed.traits, pacing: "measured" },
    });
    const restored = normalizeEditStyleTemplate(
      JSON.parse(JSON.stringify(final.projects[0].editStyleTemplate))
    )!;
    expect(pendingStyleExampleAssets(restored, [])).toEqual([]);
    const direction = editTemplateDirection(restored);
    for (const value of [
      "example-1",
      "example-2",
      "example-3",
      "brisk",
      "measured",
      "#123456",
      "ALL observed examples",
      "NEW footage",
    ])
      expect(direction).toContain(value);
    for (const secret of [
      "SOURCE SECRET WORDS",
      "SOURCE SUBJECT",
      "original-asset",
      "Private third",
    ])
      expect(direction).not.toContain(secret);
  });

  it("resolves exact design from the selected example while using only new target words", () => {
    const { template } = fixture();
    const result = resolveEditStyleOperations(
      [
        {
          type: "graphic",
          parameters: {
            templateExampleId: "example-3",
            templateClipId: "layer-1",
            graphic: { text: "NEW TARGET WORDS" },
          },
        },
      ],
      template
    ) as Array<{ parameters: { graphic: { text: string; color: string } } }>;
    expect(result[0].parameters.graphic).toMatchObject({
      text: "NEW TARGET WORDS",
      color: "#123456",
      animation: "slide",
    });
    expect(JSON.stringify(result)).not.toContain("SOURCE SECRET WORDS");
  });

  it("keeps old styles backward compatible and rejects duplicate or malformed examples", () => {
    const { template } = fixture();
    const legacy = { ...template };
    delete legacy.examples;
    expect(normalizeEditStyleTemplate(legacy)).toEqual(legacy);
    expect(() =>
      addStyleExample(template, assetStyleExample(asset("first"), "duplicate"))
    ).toThrow("already");
    expect(
      normalizeEditStyleTemplate({
        ...legacy,
        examples: [
          {
            id: "bad",
            source: "edit",
            name: "Broken",
            profile: legacy.profile,
          },
        ],
      })?.examples
    ).toEqual([]);
  });
});

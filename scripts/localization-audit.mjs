import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import ts from "typescript";

const root = process.cwd();
const temporary = await fs.mkdtemp(
  path.join(os.tmpdir(), "reelassati-locales-")
);
let catalogs;
try {
  const outfile = path.join(temporary, "catalog.mjs");
  await build({
    stdin: {
      contents:
        'export {uiLocales} from "./src/lib/i18n/locales/ui"; export {INTERFACE_LANGUAGE_CODES} from "./contracts/interface-language"; export {westernUi} from "./src/lib/i18n/locales/ui-critical-west";',
      resolveDir: root,
      loader: "ts",
    },
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
  });
  catalogs = await import(pathToFileURL(outfile).href);
} finally {
  await fs.rm(temporary, { recursive: true, force: true });
}

const files = [];
async function walk(directory) {
  for (const item of await fs.readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, item.name);
    if (item.isDirectory()) await walk(filename);
    else if (filename.endsWith(".tsx") && !/\.test\.tsx$/.test(filename))
      files.push(filename);
  }
}
await walk(path.join(root, "src/pages"));
await walk(path.join(root, "src/components"));

const keys = new Set();
const rawInterfaceCopy = [];
const dynamicBindingsForReview = [];
const neutral = new Set([
  "REEL",
  "assati",
  "REELassati",
  "Reelassati",
  "REELassati AI",
  "REELassati ·",
  "Studio",
  "Geist",
  "USD",
  "USD /",
  "cr",
  "MB",
  "GB",
  "Zoom",
  "% · Zoom",
  "Alt",
  "Option",
  "Email",
  "Cookies",
  "Italiano",
  "&copy;",
  "REEL-XXXXXXXX",
  "#productdesign #creatortips",
  "TikTok",
  "TikTok + Instagram Reels",
  "Instagram",
  "Instagram Reels",
  "YouTube",
  "YouTube Shorts",
  "Facebook",
  "Facebook Reels",
  "X / Twitter",
  "LinkedIn",
  "Pinterest",
  "Threads",
  "UGC",
  "MP4",
  "WebM",
]);
function shouldTranslate(text) {
  return (
    /[A-Za-z]{2}/.test(text) &&
    !neutral.has(text) &&
    !/^https?:\/\//.test(text) &&
    !/^[^\s@]+@[^\s@]+$/.test(text) &&
    !/^[a-z]{2}-[A-Z]{2}$/.test(text)
  );
}
function isDisplayConditional(node, source) {
  const parent = node.parent;
  if (
    !ts.isConditionalExpression(parent) ||
    (parent.whenTrue !== node && parent.whenFalse !== node)
  )
    return false;
  for (let ancestor = parent.parent; ancestor; ancestor = ancestor.parent) {
    if (
      ts.isCallExpression(ancestor) &&
      ["ui", "translateUi"].includes(ancestor.expression.getText(source))
    )
      return false;
    if (ts.isJsxExpression(ancestor)) {
      return (
        !ts.isJsxAttribute(ancestor.parent) ||
        [
          "aria-label",
          "title",
          "placeholder",
          "label",
          "description",
          "alt",
        ].includes(ancestor.parent.name.getText(source))
      );
    }
    if (ts.isFunctionLike(ancestor) || ts.isVariableDeclaration(ancestor))
      return false;
  }
  return false;
}
for (const filename of files) {
  const sourceText = await fs.readFile(filename, "utf8");
  const source = ts.createSourceFile(
    filename,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const descriptorFields = new Set();
  const displayedLiteralLists = new Set();
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ["ui", "translateUi"].includes(node.expression.getText(source))
    ) {
      if (node.arguments[0] && ts.isStringLiteral(node.arguments[0]))
        keys.add(node.arguments[0].text);
      else if (
        node.arguments[0] &&
        ts.isConditionalExpression(node.arguments[0])
      ) {
        function choices(choice) {
          if (ts.isStringLiteral(choice)) keys.add(choice.text);
          else if (ts.isConditionalExpression(choice)) {
            choices(choice.whenTrue);
            choices(choice.whenFalse);
          }
        }
        choices(node.arguments[0]);
      } else if (
        node.arguments[0] &&
        ts.isPropertyAccessExpression(node.arguments[0])
      )
        descriptorFields.add(node.arguments[0].name.text);
      else if (node.arguments[0] && ts.isIdentifier(node.arguments[0])) {
        const displayed = node.arguments[0].text;
        for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
          if (
            ts.isArrowFunction(ancestor) &&
            ancestor.parameters.some(
              parameter => parameter.name.getText(source) === displayed
            ) &&
            ts.isCallExpression(ancestor.parent) &&
            ts.isPropertyAccessExpression(ancestor.parent.expression) &&
            ancestor.parent.expression.name.text === "map"
          ) {
            displayedLiteralLists.add(
              ancestor.parent.expression.expression.getText(source)
            );
            break;
          }
        }
      }
    }
    let text;
    let kind;
    if (
      ts.isJsxExpression(node) &&
      node.expression &&
      ts.isPropertyAccessExpression(node.expression) &&
      ["label", "name", "title", "description", "intent"].includes(
        node.expression.name.text
      )
    ) {
      const { line } = source.getLineAndCharacterOfPosition(
        node.getStart(source)
      );
      dynamicBindingsForReview.push({
        file: path.relative(root, filename).replaceAll("\\", "/"),
        line: line + 1,
        expression: node.expression.getText(source),
        note: "May be user/generated content or an imported interface catalog; review origin before translating.",
      });
    }
    if (ts.isJsxText(node)) {
      text = node.text.replace(/\s+/g, " ").trim();
      kind = "text";
    }
    if (
      ts.isJsxAttribute(node) &&
      [
        "placeholder",
        "aria-label",
        "title",
        "label",
        "description",
        "alt",
      ].includes(node.name.getText(source)) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer)
    ) {
      text = node.initializer.text;
      kind = "attribute";
    }
    if (ts.isStringLiteral(node) && isDisplayConditional(node, source)) {
      text = node.text;
      kind = "conditional";
    }
    if (text && shouldTranslate(text)) {
      const { line } = source.getLineAndCharacterOfPosition(
        node.getStart(source)
      );
      rawInterfaceCopy.push({
        file: path.relative(root, filename).replaceAll("\\", "/"),
        line: line + 1,
        kind,
        text,
      });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (displayedLiteralLists.size) {
    function literalLists(node) {
      if (
        ts.isVariableDeclaration(node) &&
        displayedLiteralLists.has(node.name.getText(source)) &&
        node.initializer
      ) {
        let value = node.initializer;
        while (
          ts.isAsExpression(value) ||
          ts.isSatisfiesExpression(value) ||
          ts.isParenthesizedExpression(value)
        )
          value = value.expression;
        if (ts.isArrayLiteralExpression(value)) {
          for (const item of value.elements)
            if (ts.isStringLiteral(item) && shouldTranslate(item.text))
              keys.add(item.text);
        }
      }
      ts.forEachChild(node, literalLists);
    }
    literalLists(source);
  }
  if (descriptorFields.size) {
    function descriptors(node) {
      if (
        ts.isPropertyAssignment(node) &&
        descriptorFields.has(node.name.getText(source)) &&
        ts.isStringLiteral(node.initializer) &&
        shouldTranslate(node.initializer.text)
      )
        keys.add(node.initializer.text);
      ts.forEachChild(node, descriptors);
    }
    descriptors(source);
  }
}
const critical = Object.keys(catalogs.westernUi.es);
const usedKeys = [...keys].sort();
const locales = Object.fromEntries(
  catalogs.INTERFACE_LANGUAGE_CODES.map(code => {
    const dictionary = catalogs.uiLocales[code] || {};
    const missing =
      code === "en" ? [] : usedKeys.filter(key => !dictionary[key]);
    const criticalMissing =
      code === "en" ? [] : critical.filter(key => !dictionary[key]);
    return [
      code,
      {
        translatedKeys: Object.keys(dictionary).length,
        usedKeys: usedKeys.length,
        missing,
        criticalMissing,
      },
    ];
  })
);
const report = {
  generatedAt: new Date().toISOString(),
  scope:
    "Static React interface copy; user/generated content is excluded. Dynamic descriptors are conservatively included by displayed field. Raw templates, external library catalogs, and API errors need separate review.",
  criticalKeys: critical,
  usedKeys,
  rawInterfaceCopy,
  dynamicBindingsForReview,
  locales,
};
const outputIndex = process.argv.indexOf("--output");
if (outputIndex >= 0 && process.argv[outputIndex + 1])
  await fs.writeFile(
    process.argv[outputIndex + 1],
    JSON.stringify(report, null, 2)
  );
console.log(
  JSON.stringify(
    {
      sourceKeys: usedKeys.length,
      rawInterfaceCopy: rawInterfaceCopy.length,
      dynamicBindingsForReview: dynamicBindingsForReview.length,
      criticalKeys: critical.length,
      locales: Object.fromEntries(
        Object.entries(locales).map(([code, value]) => [
          code,
          {
            translated: value.translatedKeys,
            missingUsed: value.missing.length,
            missingCritical: value.criticalMissing.length,
          },
        ])
      ),
    },
    null,
    2
  )
);
if (
  process.argv.includes("--strict") &&
  (rawInterfaceCopy.length ||
    Object.values(locales).some(locale => locale.missing.length))
)
  process.exitCode = 1;

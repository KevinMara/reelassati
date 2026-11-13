export type ModelJsonDiagnostic = {
  stage: "model-output" | "stream-frame";
  reason: "empty" | "not-object" | "unterminated-string" | "unclosed-container" | "mismatched-container" | "invalid-syntax";
  characters: number;
  openContainers: number;
};

/** Only fixed categories and counts survive. Never retain input or parser text. */
export class ModelJsonError extends SyntaxError {
  readonly diagnostic: ModelJsonDiagnostic;
  constructor(diagnostic: ModelJsonDiagnostic) {
    super("The model returned invalid JSON");
    this.name = "ModelJsonError";
    this.diagnostic = diagnostic;
  }
}

function syntaxDiagnostic(text: string, stage: ModelJsonDiagnostic["stage"]): ModelJsonDiagnostic {
  const stack: string[] = [];
  let quoted = false, escaped = false, mismatch = false;
  for (const c of text) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === "{" || c === "[") stack.push(c);
    else if (c === "}" || c === "]") {
      if (stack.pop() !== (c === "}" ? "{" : "[")) mismatch = true;
    }
  }
  return {stage, characters: text.length, openContainers: stack.length,
    reason: !text.trim() ? "empty" : quoted ? "unterminated-string" : mismatch ? "mismatched-container" : stack.length ? "unclosed-container" : "invalid-syntax"};
}

/** Remove only commas immediately before a closing delimiter, outside strings.
 * Never add values, keys, quotes or brackets, or reinterpret source content. */
function withoutTrailingCommas(text: string): string {
  let quoted = false, escaped = false, result = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      let next = i + 1;
      while (/\s/.test(text[next] ?? "") && next < text.length) next++;
      let previous = i - 1;
      while (previous >= 0 && /\s/.test(text[previous])) previous--;
      if (previous >= 0 && !"{[,:".includes(text[previous]) && (text[next] === "}" || text[next] === "]")) continue;
    }
    result += c;
  }
  return result;
}

export function parseModelObject(text: string): Record<string, unknown> {
  let content = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(content);
  if (fence) content = fence[1];
  let result: unknown;
  try { result = JSON.parse(content); }
  catch {
    const normalized = withoutTrailingCommas(content);
    if (normalized === content) throw new ModelJsonError(syntaxDiagnostic(content, "model-output"));
    try { result = JSON.parse(normalized); }
    catch { throw new ModelJsonError(syntaxDiagnostic(content, "model-output")); }
  }
  if (!result || typeof result !== "object" || Array.isArray(result))
    throw new ModelJsonError({stage: "model-output", reason: "not-object", characters: content.length, openContainers: 0});
  return result as Record<string, unknown>;
}

export function parseProviderFrame(text: string): Record<string, unknown> {
  let result: unknown;
  try { result = JSON.parse(text); }
  catch { throw new ModelJsonError(syntaxDiagnostic(text, "stream-frame")); }
  if (!result || typeof result !== "object" || Array.isArray(result))
    throw new ModelJsonError({stage: "stream-frame", reason: "not-object", characters: text.length, openContainers: 0});
  return result as Record<string, unknown>;
}

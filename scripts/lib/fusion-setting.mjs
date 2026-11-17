/** Read Fusion's serialized data grammar without executing Lua or expressions. */
export function parseFusionSetting(source) {
  if (typeof source !== "string" || source.length > 8_000_000)
    throw new Error("Fusion setting exceeds the data size limit");
  let at = source.charCodeAt(0) === 0xfeff ? 1 : 0;
  let count = 0;
  const fail = message => {
    throw new Error(`${message} at offset ${at}`);
  };
  const longString = () => {
    const match = /^\[(=*)\[/.exec(source.slice(at));
    if (!match) return undefined;
    const close = `]${match[1]}]`;
    const start = at + match[0].length;
    const end = source.indexOf(close, start);
    if (end < 0) fail("Unterminated long string");
    at = end + close.length;
    return source.slice(start, end).replace(/^\r?\n/, "");
  };
  const skip = () => {
    while (at < source.length) {
      if (/\s/.test(source[at])) {
        at++;
        continue;
      }
      if (source.slice(at, at + 2) !== "--") break;
      at += 2;
      if (longString() === undefined) {
        const end = source.indexOf("\n", at);
        at = end < 0 ? source.length : end + 1;
      }
    }
  };
  const take = char => {
    skip();
    if (source[at] !== char) fail(`Expected ${char}`);
    at++;
  };
  const quoted = () => {
    const quote = source[at++];
    let out = "";
    while (at < source.length) {
      const char = source[at++];
      if (char === quote) return out;
      if (char !== "\\") {
        out += char;
        continue;
      }
      const escape = source[at++];
      const known = {
        a: "\x07",
        b: "\b",
        f: "\f",
        n: "\n",
        r: "\r",
        t: "\t",
        v: "\v",
        "\\": "\\",
        '"': '"',
        "'": "'",
      };
      if (Object.hasOwn(known, escape)) out += known[escape];
      else if (/[0-9]/.test(escape ?? "")) {
        const digits = escape + (/^\d{0,2}/.exec(source.slice(at))?.[0] ?? "");
        at += digits.length - 1;
        if (Number(digits) > 255) fail("Invalid byte escape");
        out += String.fromCharCode(Number(digits));
      } else if (escape === "x" && /^[0-9a-f]{2}/i.test(source.slice(at))) {
        out += String.fromCharCode(parseInt(source.slice(at, at + 2), 16));
        at += 2;
      } else if (escape === "\n") out += "\n";
      else fail("Unsupported string escape");
    }
    fail("Unterminated string");
  };
  const identifier = () => {
    skip();
    const match = /^[A-Za-z_][A-Za-z_0-9]*/.exec(source.slice(at));
    if (!match) return undefined;
    at += match[0].length;
    return match[0];
  };
  const table = (tag, depth) => {
    take("{");
    const entries = Object.create(null);
    let sequence = 1;
    while (true) {
      skip();
      if (source[at] === "}") {
        at++;
        return { tag, entries };
      }
      const start = at;
      let key;
      if (source[at] === "[" && !/^\[(=*)\[/.test(source.slice(at))) {
        at++;
        key = value(depth + 1);
        take("]");
        take("=");
        if (typeof key !== "string" && typeof key !== "number")
          fail("Invalid table key");
      } else {
        const name = identifier();
        skip();
        if (name !== undefined && source[at] === "=") {
          key = name;
          at++;
        } else {
          at = start;
          key = sequence++;
        }
      }
      if (Object.hasOwn(entries, String(key)))
        fail(`Duplicate table key ${key}`);
      entries[String(key)] = value(depth + 1);
      skip();
      if (source[at] === "," || source[at] === ";") at++;
      else if (source[at] !== "}") fail("Expected field separator");
    }
  };
  const value = depth => {
    if (depth > 128 || ++count > 500_000)
      fail("Fusion setting exceeds the structural limit");
    skip();
    if (source[at] === "{") return table(null, depth);
    if (source[at] === '"' || source[at] === "'") return quoted();
    const long = longString();
    if (long !== undefined) return long;
    const numeric =
      /^[+-]?(?:0x[\da-f]+|(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)/i.exec(
        source.slice(at)
      );
    if (numeric) {
      at += numeric[0].length;
      const number = Number(numeric[0]);
      if (!Number.isFinite(number)) fail("Non-finite number");
      return number;
    }
    let name = identifier();
    if (name === "true") return true;
    if (name === "false") return false;
    if (name === "nil") return null;
    if (!name) fail("Expected a serialized data value");
    // Plug-in registry IDs are dotted constructor names, still only data.
    while (source[at] === ".") {
      at++;
      const part = identifier();
      if (!part) fail("Invalid registry ID");
      name += `.${part}`;
    }
    skip();
    if (name === "ordered" && source[at] === "(") {
      at++;
      take(")");
      skip();
    }
    if (source[at] !== "{") fail(`Executable or unresolved value ${name}`);
    return table(name, depth);
  };
  const root = value(0);
  skip();
  if (at !== source.length) fail("Trailing executable content");
  return root;
}

export const fields = value =>
  value && typeof value === "object" && value.entries
    ? value.entries
    : Object.create(null);

/** Names are private provenance. A compiler assigns public neutral identities. */
export function fusionTools(root) {
  const tools = new Map();
  const visit = entries => {
    for (const [name, node] of Object.entries(fields(entries))) {
      if (tools.has(name))
        throw new Error(`Ambiguous Fusion tool identity: ${name}`);
      tools.set(name, node);
      if (fields(node).Tools) visit(fields(node).Tools);
    }
  };
  visit(fields(root).Tools);
  return tools;
}

export function composerToken(text: string, caret = text.length) {
  const match = text.slice(0, caret).match(/(?:^|\s)([+@])([^\s+@]*)$/u);
  if (!match) return undefined;
  return {
    trigger: match[1] as "+" | "@",
    query: match[2],
    start: caret - match[2].length - 1,
    end: caret,
  };
}
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
function distance(a: string, b: string) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next.push(
        Math.min(
          next[j - 1] + 1,
          row[j] + 1,
          row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        )
      );
    row = next;
  }
  return row[b.length];
}
export function rankComposerCommands<T extends { label: string; id?: string }>(
  commands: T[],
  query: string
): T[] {
  const q = normalize(query);
  const score = (label: string) => {
    const n = normalize(label);
    if (!q) return 0;
    if (n === q) return -3;
    if (n.startsWith(q)) return -2;
    if (n.includes(q)) return -1;
    return Math.min(...n.split(/\s+/).map(word => distance(q, word)));
  };
  const ranked = commands
    .map((command, index) => ({
      command,
      index,
      score: Math.min(
        score(command.label),
        command.id ? score(command.id) : Infinity
      ),
    }))
    .sort((a, b) => a.score - b.score || a.index - b.index);
  const matches = ranked.filter(
    c => c.score <= Math.max(2, Math.floor(q.length / 3))
  );
  return (matches.length ? matches : ranked.slice(0, 1)).map(c => c.command);
}

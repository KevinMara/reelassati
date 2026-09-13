import type { TimelineClip } from "@contracts/workspace";
import { graphicFrame, normalizeGraphic } from "@contracts/motion-graphics";
export function assTime(seconds: number) {
  const cs = Math.round(Math.max(0, seconds) * 100);
  return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2, "0")}:${String(Math.floor(cs / 100) % 60).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
}
export const escapeAss = (s: string) =>
  s.replace(/[{}\\]/g, "").replace(/\r?\n/g, "\\N");
const assColor = (hex: string) =>
  `&H${hex.slice(5, 7)}${hex.slice(3, 5)}${hex.slice(1, 3)}&`;
/** Compile the same deterministic graphic frames shown in the editor into libass. */
export function graphicAssEvents(
  clips: TimelineClip[],
  width: number,
  height: number,
  duration: number
) {
  const events: string[] = [];
  for (const clip of clips) {
    const g = normalizeGraphic(clip.graphic);
    if (!g || clip.start >= duration || clip.duration <= 0) continue;
    const end = Math.min(duration, clip.start + clip.duration);
    let previous = "",
      since = clip.start;
    const emit = (until: number) => {
      if (previous && until > since)
        events.push(
          `Dialogue: 2,${assTime(since)},${assTime(until)},${g.kind === "callout" ? "Callout" : "Default"},,0,0,0,,${previous}`
        );
    };
    for (let frame = 0; frame < Math.ceil((end - clip.start) * 30); frame++) {
      const t = clip.start + frame / 30;
      const f = graphicFrame(g, frame / 30, clip.duration);
      const alpha = Math.round((1 - f.opacity) * 255)
        .toString(16)
        .padStart(2, "0");
      let tags = `\\an5\\pos(${Math.round((g.x * width) / 100)},${Math.round((f.y * height) / 100)})\\fs${Math.round((width * g.size) / 100)}\\fscx${Math.round(f.scale * 100)}\\fscy${Math.round(f.scale * 100)}\\1c${assColor(g.color)}\\alpha&H${alpha}&\\shad0`;
      let text = escapeAss(f.text);
      if (g.kind === "highlight") {
        const w = Math.round(width * 0.4),
          h = Math.round(height * 0.15),
          b = Math.max(2, Math.round(width / 240));
        tags += "\\bord0\\p1";
        text = `m 0 0 l ${w} 0 ${w} ${b} 0 ${b} m 0 ${h - b} l ${w} ${h - b} ${w} ${h} 0 ${h} m 0 ${b} l ${b} ${b} ${b} ${h - b} 0 ${h - b} m ${w - b} ${b} l ${w} ${b} ${w} ${h - b} ${w - b} ${h - b}`;
      } else if (g.kind === "arrow") {
        const w = Math.round(width * 0.25),
          h = Math.round(width * 0.12);
        tags += "\\bord0\\p1";
        text = `m 0 ${Math.round(h * 0.4)} l ${Math.round(w * 0.65)} ${Math.round(h * 0.4)} ${Math.round(w * 0.65)} 0 ${w} ${Math.round(h * 0.5)} ${Math.round(w * 0.65)} ${h} ${Math.round(w * 0.65)} ${Math.round(h * 0.6)} 0 ${Math.round(h * 0.6)}`;
      } else if (g.kind === "callout")
        tags += `\\bord${Math.round(width * 0.015)}\\3c${assColor(g.background)}\\3a&H${alpha}&\\shad0`;
      const payload = `{${tags}}${text}`;
      if (payload !== previous) {
        emit(t);
        previous = payload;
        since = t;
      }
    }
    emit(end);
  }
  return events.join("\n");
}

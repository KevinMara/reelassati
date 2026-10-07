import type { Asset, EditProject, TimelineClip } from "@contracts/workspace";
import type { SourceReview } from "@contracts/source-review";
import { effectiveTimelineClips } from "@contracts/timeline-mixer";

export const PROJECT_FOOTAGE_SEARCH_LIMITS = {
  queryCharacters: 500,
  sourceClips: 1000,
  evidenceRows: 1000,
  candidateMatches: 1000,
  results: 50,
} as const;

export type FootageSearchEvidence =
  "transcript" | "observed-scene" | "clip-name";
export interface ProjectFootageMatch {
  id: string;
  clipId: string;
  assetId: string;
  clipLabel: string;
  assetName: string;
  start: number;
  end: number;
  sourceStart: number;
  sourceEnd: number;
  snippet: string;
  evidence: FootageSearchEvidence;
  score: number;
  hidden: boolean;
  muted: boolean;
}

type Source = {
  clip: TimelineClip;
  asset: Asset;
  start: number;
  end: number;
  sourceStart: number;
  sourceEnd: number;
  speed: number;
};
const supported = new Set<Asset["kind"]>(["video", "audio", "image", "export"]);
const cleanText = (value: string, maximum = 2000) =>
  value
    .slice(0, maximum)
    .normalize("NFKC")
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maximum);
const tokens = (text: string) =>
  Array.from(text.matchAll(/[\p{L}\p{M}\p{N}]+/gu), match => ({
    word: match[0].toLocaleLowerCase("en"),
    index: match.index,
  }));
const clock = (value: number) => String(Number(value.toFixed(6)));
function hash(text: string) {
  let value = 2166136261;
  for (const point of text)
    value = Math.imul(value ^ point.codePointAt(0)!, 16777619);
  return (value >>> 0).toString(36);
}

function sourceFor(
  clip: TimelineClip,
  asset: Asset | undefined,
  projectEnd: number
): Source | undefined {
  const speed = clip.speed ?? 1;
  if (
    !asset ||
    asset.status !== "ready" ||
    !supported.has(asset.kind) ||
    clip.graphic ||
    ![clip.start, clip.duration, clip.inPoint, clip.outPoint, speed].every(
      Number.isFinite
    ) ||
    clip.start < 0 ||
    clip.duration <= 0 ||
    clip.inPoint < 0 ||
    clip.outPoint <= clip.inPoint ||
    speed <= 0
  )
    return;
  const start = clip.start;
  let end = Math.min(clip.start + clip.duration, projectEnd);
  const sourceStart = clip.inPoint;
  let sourceEnd = Math.min(clip.outPoint, sourceStart + (end - start) * speed);
  if (Number.isFinite(asset.duration) && asset.duration! > 0) {
    sourceEnd = Math.min(sourceEnd, asset.duration!);
  }
  end = start + (sourceEnd - sourceStart) / speed;
  if (end <= start || sourceEnd <= sourceStart) return;
  return { clip, asset, start, end, sourceStart, sourceEnd, speed };
}

/** Literal words/phrases only. Scene descriptions must already exist; this never
 * starts analysis, invents visual observations, or infers caption ownership. */
export function searchProjectFootage(
  project: EditProject,
  assets: readonly Asset[],
  query: string
): ProjectFootageMatch[] {
  const queryText = cleanText(
    query,
    PROJECT_FOOTAGE_SEARCH_LIMITS.queryCharacters
  );
  const queryWords = tokens(queryText).map(token => token.word);
  if (
    !queryWords.length ||
    !Number.isFinite(project.duration) ||
    project.duration <= 0
  )
    return [];
  const distinctWords = [...new Set(queryWords)];
  const assetsById = new Map(assets.map(asset => [asset.id, asset]));
  const sources = effectiveTimelineClips(project)
    .slice(0, PROJECT_FOOTAGE_SEARCH_LIMITS.sourceClips)
    .flatMap(clip => {
      const source = sourceFor(
        clip,
        assetsById.get(clip.assetId ?? ""),
        project.duration
      );
      return source ? [source] : [];
    });
  const sourcesById = new Map(sources.map(source => [source.clip.id, source]));
  const sourcesByAsset = new Map<string, Source[]>();
  for (const source of sources) {
    const members = sourcesByAsset.get(source.asset.id) ?? [];
    members.push(source);
    sourcesByAsset.set(source.asset.id, members);
  }
  const matches = new Map<string, ProjectFootageMatch>();
  const scoreText = (raw: string) => {
    const text = cleanText(raw);
    const wordTokens = tokens(text);
    const words = wordTokens.map(token => token.word);
    const present = new Set(words);
    if (!distinctWords.every(word => present.has(word))) return;
    const phraseAt = words.findIndex((_word, index) =>
      queryWords.every((word, offset) => words[index + offset] === word)
    );
    const matched = words.flatMap((word, index) =>
      distinctWords.includes(word) ? [index] : []
    );
    const firstAt = phraseAt >= 0 ? phraseAt : matched[0];
    const lastAt =
      phraseAt >= 0 ? phraseAt + queryWords.length - 1 : matched.at(-1)!;
    const index = wordTokens[firstAt]?.index ?? 0;
    const from = Math.max(0, index - 70);
    const snippet = `${from > 0 ? "…" : ""}${text.slice(from, from + 280)}${text.length > from + 280 ? "…" : ""}`;
    return {
      text,
      snippet,
      firstAt,
      lastAt,
      score:
        (phraseAt >= 0 ? 50 : 0) +
        Math.round((30 * distinctWords.length) / Math.max(1, present.size)),
    };
  };
  const add = (
    source: Source,
    evidence: FootageSearchEvidence,
    start: number,
    end: number,
    found: NonNullable<ReturnType<typeof scoreText>>
  ) => {
    if (
      matches.size >= PROJECT_FOOTAGE_SEARCH_LIMITS.candidateMatches ||
      end <= start
    )
      return;
    const sourceStart =
      source.sourceStart + (start - source.start) * source.speed;
    const sourceEnd = source.sourceStart + (end - source.start) * source.speed;
    const id = `${evidence}:${encodeURIComponent(source.clip.id)}:${clock(start)}:${clock(end)}:${hash(
      tokens(found.text)
        .map(token => token.word)
        .join(" ")
    )}`;
    if (matches.has(id)) return;
    matches.set(id, {
      id,
      clipId: source.clip.id,
      assetId: source.asset.id,
      clipLabel: source.clip.label,
      assetName: source.asset.name,
      start,
      end,
      sourceStart,
      sourceEnd,
      snippet: found.snippet,
      evidence,
      score:
        { transcript: 300, "observed-scene": 200, "clip-name": 50 }[evidence] +
        found.score,
      hidden: Boolean(source.clip.hidden),
      muted: Boolean(source.clip.muted),
    });
  };

  for (const cue of project.transcript.slice(
    0,
    PROJECT_FOOTAGE_SEARCH_LIMITS.evidenceRows
  )) {
    // Exact persisted owner only: overlapping primary footage is not proof of origin.
    const source = cue.sourceClipId
      ? sourcesById.get(cue.sourceClipId)
      : undefined;
    if (
      !source ||
      !["audio", "video", "export"].includes(source.asset.kind) ||
      ![cue.start, cue.end].every(Number.isFinite) ||
      cue.end <= cue.start
    )
      continue;
    const start = Math.max(source.start, cue.start),
      end = Math.min(source.end, cue.end);
    if (end <= start) continue;
    if (cue.words?.length) {
      // Word timings use the project clock. Search only retained words, and seek
      // to the matched phrase rather than an earlier portion of a long cue.
      const words = cue.words
        .slice(0, 500)
        .filter(
          word =>
            [word.start, word.end].every(Number.isFinite) &&
            word.end > word.start &&
            word.end > start &&
            word.start < end
        )
        .flatMap(word =>
          tokens(cleanText(word.text)).map(token => ({
            ...word,
            token: token.word,
          }))
        );
      const found = scoreText(words.map(word => word.token).join(" "));
      if (found && words[found.firstAt] && words[found.lastAt])
        add(
          source,
          "transcript",
          Math.max(start, words[found.firstAt].start),
          Math.min(end, words[found.lastAt].end),
          found
        );
    } else {
      const found = scoreText(cue.text);
      if (found) add(source, "transcript", start, end, found);
    }
  }

  // Keep the latest review for an asset; older runs should not duplicate evidence.
  const latestReviews = new Map<string, SourceReview>();
  for (const review of (project.sourceReviews ?? []).slice(
    0,
    PROJECT_FOOTAGE_SEARCH_LIMITS.evidenceRows
  )) {
    if (!sourcesByAsset.has(review.assetId)) continue;
    const existing = latestReviews.get(review.assetId);
    if (
      !existing ||
      !Number.isFinite(Date.parse(existing.reviewedAt)) ||
      Date.parse(review.reviewedAt) >= Date.parse(existing.reviewedAt)
    )
      latestReviews.set(review.assetId, review);
  }
  let reviewedMoments = 0;
  for (const review of latestReviews.values()) {
    const members = sourcesByAsset.get(review.assetId)!;
    const asset = members[0].asset;
    if (
      !["video", "export"].includes(asset.kind) ||
      !Number.isFinite(asset.duration) ||
      asset.duration! <= 0
    )
      continue;
    const createdAt = Date.parse(asset.createdAt),
      reviewedAt = Date.parse(review.reviewedAt);
    if (
      Number.isFinite(createdAt) &&
      Number.isFinite(reviewedAt) &&
      reviewedAt < createdAt
    )
      continue;
    for (const moment of review.moments) {
      if (++reviewedMoments > PROJECT_FOOTAGE_SEARCH_LIMITS.evidenceRows) break;
      if (
        ![moment.start, moment.end].every(Number.isFinite) ||
        moment.start < 0 ||
        moment.end <= moment.start ||
        moment.end > asset.duration! + 0.000001
      )
        continue;
      const found = scoreText(moment.note);
      if (!found) continue;
      for (const source of members) {
        const from = Math.max(source.sourceStart, moment.start),
          to = Math.min(source.sourceEnd, moment.end);
        if (to <= from) continue;
        add(
          source,
          "observed-scene",
          source.start + (from - source.sourceStart) / source.speed,
          source.start + (to - source.sourceStart) / source.speed,
          found
        );
      }
    }
    if (reviewedMoments >= PROJECT_FOOTAGE_SEARCH_LIMITS.evidenceRows) break;
  }
  for (const source of sources) {
    const label = scoreText(source.clip.label),
      name = scoreText(source.asset.name);
    const found = !label
      ? name
      : !name || label.score >= name.score
        ? label
        : name;
    if (found) add(source, "clip-name", source.start, source.end, found);
  }
  return [...matches.values()]
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.start - b.start ||
        a.clipId.localeCompare(b.clipId) ||
        a.id.localeCompare(b.id)
    )
    .slice(0, PROJECT_FOOTAGE_SEARCH_LIMITS.results);
}

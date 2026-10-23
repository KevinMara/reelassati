export type EditDurationTarget =
  | { mode: "none" }
  | { mode: "range"; minimumSeconds: number; maximumSeconds: number };

function positiveSeconds(value: string | number): number | null {
  if (typeof value === "string" && !value.trim()) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

/** A duration preference never changes the source clock or authorizes padding. */
export function resolveEditDurationTarget(
  mode: EditDurationTarget["mode"],
  minimum: string | number,
  maximum: string | number
): EditDurationTarget | null {
  if (mode === "none") return { mode: "none" };
  const minimumSeconds = positiveSeconds(minimum);
  const maximumSeconds = positiveSeconds(maximum);
  if (
    mode !== "range" ||
    minimumSeconds === null ||
    maximumSeconds === null ||
    minimumSeconds >= maximumSeconds
  )
    return null;
  return { mode, minimumSeconds, maximumSeconds };
}

export function editDurationDirection(
  target: EditDurationTarget,
  detectMeaningfulEnding: boolean
): string {
  if (
    target.mode === "range" &&
    !resolveEditDurationTarget(
      target.mode,
      target.minimumSeconds,
      target.maximumSeconds
    )
  )
    throw new Error("Invalid edit duration preference.");
  const preference =
    target.mode === "range"
      ? `Preferred finished duration range: ${target.minimumSeconds}–${target.maximumSeconds} seconds. This is a soft, content-aware preference, not an exact target or a hard cutoff. Aim inside the range when the available footage and story support it. If the range cannot be reached without harming meaning or inventing material, preserve the content and explain the tradeoff.`
      : "No requested duration constraint. Choose the finished length from the available footage, brief, genre and story; do not impose a hidden exact target or derive one from the source or timeline duration.";
  const ending = detectMeaningfulEnding
    ? "Detect the last meaningful ending from source evidence and finish on a complete thought, action or payoff."
    : "Automatic meaningful-ending detection is off. Preserve the intended ending unless a specific edit is justified by the brief and source evidence.";
  return `${preference} ${ending} Never pad, repeat or stretch footage to fill time, cut speech mid-word, remove necessary context, or force every style into a faster edit. Preserve intentional pauses, complete speech, locked clips and source meaning.`;
}

/** Reviewed source layouts. These are structural observations, not a claim
 * that any title belongs on footage whose protected regions are unknown. */
export function nativeGraphicDesign(name, platform) {
  const shared = {
    avoid:
      "Do not repeat burned-in captions, cover a face/product, or use as decoration. Use short source-grounded copy and leave a readable hold.",
  };
  const titles = {
    "Stacked outline": {
      layout:
        "One bold filled word above three outlined copies of that same word; centered four-row stack.",
      motion:
        "The four word rows separate vertically into the stack, hold, then collapse away.",
      bestFor:
        "A single-word emphasis or short chapter label with a large clear area.",
    },
    "Split stack": {
      layout:
        "Two heavy filled text lines tilted together diagonally, with repeated letterforms; broad poster-like composition.",
      motion:
        "Authored text entrance and exit around a static diagonal reading hold.",
      bestFor:
        "Two short related words on a clean background or a dedicated title card.",
    },
    "Scrolling outline": {
      layout: "A tall, tilted column of many alternating filled and outlined copies of the same word.",
      motion:
        "Repeated word rows animate into and out of a diagonal stacked reading hold.",
      bestFor:
        "A deliberate full-title visual beat, not a small subtitle or lower third.",
    },
    "Rising word": {
      layout: "One filled word across the center with outlined copies fanning in curved trails above its left side and below its right side.",
      motion: "The repeated outlined word trails reveal around the central filled word and retract on exit.",
      bestFor:
        "A short emphatic word on a dedicated card or a large empty background, not a compact lower third.",
    },
    "Split two-line": {
      layout:
        "Two filled bold lines with independently editable text and colors and multiple outlined echoes stepping diagonally behind both words.",
      motion:
        "The filled words and outlined echoes animate into and out of a stepped two-line hold.",
      bestFor:
        "A bold two-word title card, with meaningful copy on both lines and ample clear space around the echoes.",
    },
    "Two-line reveal": {
      layout:
        "Two bold lines split into left and right halves, surrounded by outlined copies fanning diagonally; a large decorative title composition.",
      motion:
        "The filled halves and outlined echoes spread into a diagonal stack, hold, then retract.",
      bestFor:
        "A concise two-line title on a dedicated card or a large empty area, with two or more characters per line.",
    },
  };
  return platform
    ? {
        layout: `${platform} icon with a horizontal colored handle bar; icon on the ${name.endsWith("left") ? "left" : "right"}.`,
        motion:
          "The bar extends, the icon and handle reveal, hold together, then retract.",
        bestFor: `Only an actual user-supplied ${platform} handle or an explicit ${platform} promotion request.`,
        avoid:
          "Never invent an account or apply a platform badge as unrelated decoration. Keep the bar away from faces and captions.",
      }
    : { ...titles[name], ...shared };
}

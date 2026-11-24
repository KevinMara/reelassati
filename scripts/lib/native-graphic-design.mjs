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
      layout:
        "A tall, tilted column of many alternating filled and outlined copies of the same word.",
      motion:
        "Repeated word rows animate into and out of a diagonal stacked reading hold.",
      bestFor:
        "A deliberate full-title visual beat, not a small subtitle or lower third.",
    },
    "Rising word": {
      layout:
        "One filled word across the center with outlined copies fanning in curved trails above its left side and below its right side.",
      motion:
        "The repeated outlined word trails reveal around the central filled word and retract on exit.",
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
    "Three-line cascade": {
      layout:
        "A script word above two bold stacked lines, with independently editable copy and colors.",
      motion:
        "Authored elastic script movement followed by the bold-line reveals, a reading hold, then the reverse exit.",
      bestFor:
        "Three short related lines on a deliberate title card with clear space; keep every line meaningful.",
    },
  };
  if (/^(Message card|Reminder card|Phone alert) ·/.test(name)) {
    const [family, variant] = name.split(" · ");
    const app = {
      "01": "Messages",
      "04": "WhatsApp",
      "07": "YouTube",
      "08": "YouTube",
      "10": "Facebook",
      "13": "Instagram",
    }[variant];
    const banner = family === "Message card" && app;
    const phoneLayout =
      ["05", "06", "07"].includes(variant)
        ? "Two action labels sit side by side below the alert text."
        : ["08", "09", "10"].includes(variant)
          ? "Three action rows are stacked below the alert text."
          : "A single action row sits below the alert text.";
    return {
      layout: banner
        ? `Wide rounded notification banner with a ${app} icon on the left, a text block and a time field.`
        : family === "Phone alert"
          ? `Centered rounded phone dialog. ${phoneLayout}`
          : variant === "01"
            ? "Rounded speech bubble with a bell and an editable numeric badge beside the reminder text."
            : "Wide calendar notification with an editable weekday and date on the left and reminder text beside it.",
      motion:
        "The panel and its text reveal in sequence, hold, then leave using the source animation.",
      bestFor: banner
        ? `A requested ${app} notification demonstration with supplied copy. The icon identifies this app.`
        : "An explicitly requested message or interface demonstration using the user's supplied copy.",
      avoid:
        "Never invent a message, reaction, date, count, sender, or system alert. Do not use a notification as unrelated decoration or place it over source faces or captions.",
    };
  }
  return platform
    ? {
        layout: `${platform} icon with ${name.includes(" profile ") ? "two independently editable lines for a short call to action and a handle" : "a horizontal colored handle bar"}; icon on the ${name.endsWith("left") ? "left" : "right"}.`,
        motion:
          "The bar extends, the icon and handle reveal, hold together, then retract.",
        bestFor: `Only an actual user-supplied ${platform} handle or an explicit ${platform} promotion request.${name.includes(" profile ") ? " Supply both the requested call to action and the actual handle." : ""}`,
        avoid:
          "Never invent an account or apply a platform badge as unrelated decoration. Keep the bar away from faces and captions.",
      }
    : { ...titles[name], ...shared };
}

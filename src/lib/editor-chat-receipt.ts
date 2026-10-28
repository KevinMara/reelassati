import type { EditorChatMessage } from "@contracts/editor-chat";

/** Execution state owns the headline; planning prose stays in the details. */
export function editorChatReceipt(
  message: EditorChatMessage,
  ui: (text: string) => string
): string | undefined {
  if (message.activity || !message.plan?.actions.length) return;
  const actions = message.plan.actions;
  const done = actions.filter(action => action.status === "completed");
  if (done.length) {
    const categories = done.map(action => {
      if (action.kind === "edit") {
        if (action.operation.type === "graphic")
          return ui("Updated the graphics.");
        if (action.operation.type === "caption")
          return ui("Updated the captions.");
        if (["sound", "audio"].includes(action.operation.type))
          return ui("Updated the sound.");
        if (action.operation.type === "broll")
          return ui("Added supporting shots.");
        if (action.operation.type === "style")
          return ui("Updated the visual treatment.");
        return ui("Refined the pacing and cuts.");
      }
      if (action.kind === "generate")
        return action.insert
          ? ui("Added supporting shots.")
          : ui("Saved to Library");
      if (action.kind === "catalog-audio")
        return action.insert
          ? ui("Updated the sound.")
          : ui("Saved to Library");
      if (action.kind === "transcribe") return ui("I transcribed the footage.");
      if (action.kind === "analyze") return ui("I reviewed the footage.");
      if (action.kind === "seek") return ui("I moved the playhead.");
      if (action.kind === "story-beats")
        return ui("I organized the story sections.");
      return ui("Edit saved.");
    });
    const summary = [...new Set(categories)].slice(0, 2).join(" ");
    if (
      actions.some(action =>
        ["failed", "blocked", "interrupted"].includes(action.status)
      )
    )
      return `${summary} ${ui("Some steps could not finish; see the details below.")}`;
    if (actions.some(action => action.status === "awaiting-approval"))
      return `${summary} ${ui("Would you like me to add the suggested extras too?")}`;
    return summary;
  }
  if (actions.some(action => action.status === "running"))
    return ui("I'm working on your edit…");
  if (message.status === "failed" || message.status === "stopped")
    return ui(
      "I couldn't complete this edit. Your saved work is still available."
    );
  if (message.request?.executionMode === "plan" && !message.planApproved)
    return ui("Here's my plan. Apply it when you're ready.");
  return ui("I've prepared the steps for your edit.");
}

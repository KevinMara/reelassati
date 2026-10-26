/** Synchronous, page-local lock shared by Reel and Auto-edit. Never schedules work. */
export const activeEditorProjects = new Set<string>();
export const editorRunKey = (owner: string, brand: string, projectId: string) =>
  JSON.stringify([owner.toLowerCase(), brand, projectId]);

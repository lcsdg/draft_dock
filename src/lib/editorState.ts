// Global editor position memory — survives component lifecycle
// Keyed by document UUID
export const editorPositions = new Map<string, { scrollTop: number; head: number }>();

import { invoke } from "@tauri-apps/api/core";
import type { Project, Document, SearchResult, ExportData } from "@/types";

export function ping(): Promise<string> {
  return invoke("ping");
}

// Projects
export function createProject(name: string): Promise<Project> {
  return invoke("create_project", { name });
}

export function listProjects(): Promise<Project[]> {
  return invoke("list_projects");
}

export function updateProject(id: string, name: string): Promise<void> {
  return invoke("update_project", { id, name });
}

export function deleteProject(id: string): Promise<void> {
  return invoke("delete_project", { id });
}

export function reorderProjects(orderedIds: string[]): Promise<void> {
  return invoke("reorder_projects", { orderedIds });
}

// Documents
export function createDocument(projectId: string, name: string): Promise<Document> {
  return invoke("create_document", { projectId, name });
}

export function listDocuments(projectId: string): Promise<Document[]> {
  return invoke("list_documents", { projectId });
}

export function updateDocument(
  id: string,
  name?: string,
  content?: string,
): Promise<void> {
  return invoke("update_document", { id, name, content });
}

export function setDocumentFontSize(id: string, size: number): Promise<void> {
  return invoke("set_font_size", { id, size });
}

export function deleteDocument(id: string): Promise<void> {
  return invoke("delete_document", { id });
}

export function reorderDocuments(orderedIds: string[]): Promise<void> {
  return invoke("reorder_documents", { orderedIds });
}

// Search
export function search(query: string): Promise<SearchResult[]> {
  return invoke("search", { query });
}

// Import/Export
export function exportData(): Promise<ExportData> {
  return invoke("export_data");
}

export function importData(json: string, mode: string): Promise<void> {
  return invoke("import_data", { json, mode });
}

// Settings
export function getSetting(key: string): Promise<string | null> {
  return invoke("get_setting", { key });
}

export function setSetting(key: string, value: string): Promise<void> {
  return invoke("set_setting", { key, value });
}

// File export
export function saveToFile(path: string, content: string): Promise<void> {
  return invoke("save_to_file", { path, content });
}

export interface Project {
  id: string;
  name: string;
  sort_order: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  project_id: string;
  name: string;
  content: string;
  font_size: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SearchResult {
  project_id: string;
  project_name: string;
  document_id: string;
  document_name: string;
  snippet: string;
}

export interface ExportData {
  projects: Project[];
  documents: Document[];
}

export interface Variable {
  name: string;
  defaultValue: string;
  firstIndex: number;
}

export type SaveStatus = "saved" | "saving" | "error";

export type ImportMode = "merge" | "replace";

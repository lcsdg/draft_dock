import type { ExportData } from "@/types";

/**
 * Validate that JSON data conforms to the ExportData structure.
 * Returns an array of error messages, or empty array if valid.
 */
export function validateExportData(data: unknown): string[] {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return ["数据格式错误：不是有效的 JSON 对象"];
  }

  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj.projects)) {
    errors.push('缺少 "projects" 字段或不是数组');
  } else {
    for (let i = 0; i < obj.projects.length; i++) {
      const p = obj.projects[i] as Record<string, unknown>;
      if (!p.id || typeof p.id !== "string") {
        errors.push(`projects[${i}]: 缺少或无效的 id`);
      }
      if (!p.name || typeof p.name !== "string") {
        errors.push(`projects[${i}]: 缺少或无效的 name`);
      }
    }
  }

  if (!Array.isArray(obj.documents)) {
    errors.push('缺少 "documents" 字段或不是数组');
  } else {
    for (let i = 0; i < obj.documents.length; i++) {
      const d = obj.documents[i] as Record<string, unknown>;
      if (!d.id || typeof d.id !== "string") {
        errors.push(`documents[${i}]: 缺少或无效的 id`);
      }
      if (!d.project_id || typeof d.project_id !== "string") {
        errors.push(`documents[${i}]: 缺少或无效的 project_id`);
      }
      if (!d.name || typeof d.name !== "string") {
        errors.push(`documents[${i}]: 缺少或无效的 name`);
      }
    }
  }

  return errors;
}

/**
 * Serialize ExportData to a JSON string for file download.
 */
export function serializeForExport(data: ExportData): string {
  return JSON.stringify(data, null, 2);
}

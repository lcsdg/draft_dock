import type { Variable } from "@/types";

const VARIABLE_RE = /\$\{([^}:]+)(?::([^}]*))?\}/g;

/**
 * Extract unique variables from content, ordered by first appearance.
 * Handles ${varName} and ${varName:defaultValue} formats.
 */
export function extractVariables(content: string): Variable[] {
  const seen = new Map<string, Variable>();
  let match: RegExpExecArray | null;

  // Reset regex state
  VARIABLE_RE.lastIndex = 0;

  while ((match = VARIABLE_RE.exec(content)) !== null) {
    const name = match[1].trim();
    const defaultValue = match[2] ?? "";

    if (!name) continue;

    if (!seen.has(name)) {
      seen.set(name, {
        name,
        defaultValue,
        firstIndex: match.index,
      });
    }
  }

  return Array.from(seen.values()).sort((a, b) => a.firstIndex - b.firstIndex);
}

/**
 * Check if content contains any template variables.
 */
export function hasVariables(content: string): boolean {
  VARIABLE_RE.lastIndex = 0;
  return VARIABLE_RE.test(content);
}

/**
 * Replace all variable occurrences in content with provided values.
 * Variables not in the values map keep their original ${...} form.
 */
export function replaceVariables(
  content: string,
  values: Record<string, string>,
): string {
  VARIABLE_RE.lastIndex = 0;
  return content.replace(VARIABLE_RE, (_fullMatch, name: string) => {
    const trimmed = name.trim();
    if (trimmed in values) {
      return values[trimmed];
    }
    // Keep original if no value provided
    return _fullMatch;
  });
}

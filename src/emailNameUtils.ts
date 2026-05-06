/**
 * Utility functions for handling email-to-name mappings in tables
 */

export function getDisplayName(value: string, nameMap: Map<string, string>): string {
  if (!value) return '';
  if (value.includes('@')) {
    return nameMap.get(value.toLowerCase()) || value;
  }
  return value;
}

export function isEmail(value: string): boolean {
  return typeof value === 'string' && value.includes('@');
}

/**
 * Validates if a string is a valid Git source URL.
 * Accepts HTTPS/HTTP URLs or SSH git@ format.
 */
export function isValidGitSource(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  return /^https?:\/\//i.test(t) || t.startsWith("git@");
}

/**
 * Validates if a string is a valid HTTP/HTTPS URL.
 */
export function isValidHttpUrl(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  return /^https?:\/\//i.test(t);
}

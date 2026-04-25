/**
 * Parse JSON string of environment variables into a record.
 * Returns empty object on null or invalid JSON.
 */
export function parseEnvVars(envVarsJson: string | null): Record<string, string> {
  if (!envVarsJson) return {};
  try {
    return JSON.parse(envVarsJson) as Record<string, string>;
  } catch {
    return {};
  }
}

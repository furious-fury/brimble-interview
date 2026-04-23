/**
 * Brimble app URL host: <slug from name>-<id first 8>.<base domain> (e.g. my-app-a1b2c3d4.localhost).
 * Kept in one place for Caddy snippet filenames, stored URLs, and teardown.
 */
export function deploymentAppHostname(deploymentName: string, deploymentId: string): string {
  const domain = (process.env.BRIMBLE_APPS_BASE_DOMAIN ?? "localhost").replace(/^\./, "").replace(/\/$/, "");
  const safe =
    deploymentName
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "app";
  const short = deploymentId.slice(0, 8);
  return `${safe}-${short}.${domain}`;
}

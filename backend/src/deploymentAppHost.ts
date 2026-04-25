import { logger } from "./config/logger.js";
import { URL_CONSTANTS } from "./config/constants.js";

/**
 * Brimble app URL host: <slug from name>-<id first 8>.<base domain> (e.g. my-app-a1b2c3d4.localhost).
 * Kept in one place for Caddy snippet filenames, stored URLs, and teardown.
 */
export function deploymentAppHostname(deploymentName: string, deploymentId: string): string {
  const rawDomain = process.env.BRIMBLE_APPS_BASE_DOMAIN ?? "localhost";
  const domain = rawDomain.replace(/^\./, "").replace(/\/$/, "");
  const safe =
    deploymentName
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, URL_CONSTANTS.MAX_NAME_LENGTH) || "app";
  const short = deploymentId.slice(0, URL_CONSTANTS.ID_TRUNCATE_LENGTH);
  const hostname = `${safe}-${short}.${domain}`;
  logger.info({ deploymentName, deploymentId, rawDomain, domain, hostname }, "Generated deployment hostname");
  return hostname;
}

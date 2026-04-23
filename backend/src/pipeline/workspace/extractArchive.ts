import { createReadStream, promises as fsp } from "node:fs";
import path from "node:path";
import { extract } from "tar";
import unzipper from "unzipper";
import { getExtractedSourceDir, ensureDirSync } from "./paths.js";

const ZIP_EXT = [".zip"];
const TGZ_EXT = [".tar.gz", ".tgz"];

export function isAllowedArchive(filename: string): boolean {
  const lower = filename.toLowerCase();
  return TGZ_EXT.some((s) => lower.endsWith(s)) || ZIP_EXT.some((s) => lower.endsWith(s));
}

/**
 * Detect if the extracted directory has a single top-level folder
 * (common when users zip a folder instead of its contents).
 * If so, return that folder's name to use as the project root.
 */
async function detectSingleTopLevelDir(dir: string): Promise<string | null> {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());
  // Exactly one directory and no files at root = nested project
  if (dirs.length === 1 && entries.length === 1) {
    return dirs[0]!.name;
  }
  return null;
}

export async function extractArchiveToSource(
  archivePath: string,
  originalName: string,
  deploymentId: string
): Promise<void> {
  const dest = getExtractedSourceDir(deploymentId);
  const workRoot = path.dirname(dest);
  ensureDirSync(workRoot);
  await fsp.rm(dest, { recursive: true, force: true });
  await fsp.mkdir(dest, { recursive: true });

  const lower = originalName.toLowerCase();
  if (TGZ_EXT.some((s) => lower.endsWith(s))) {
    await extract({ file: archivePath, cwd: dest, strip: 0 });
    // Handle nested single-folder archives (e.g., tar.gz created from a folder)
    const nested = await detectSingleTopLevelDir(dest);
    if (nested) {
      const nestedPath = path.join(dest, nested);
      const tempPath = path.join(workRoot, `__nested_${deploymentId}`);
      await fsp.rename(nestedPath, tempPath);
      await fsp.rm(dest, { recursive: true, force: true });
      await fsp.rename(tempPath, dest);
    }
    return;
  }
  if (ZIP_EXT.some((s) => lower.endsWith(s))) {
    await new Promise<void>((resolve, reject) => {
      createReadStream(archivePath)
        .pipe(unzipper.Extract({ path: dest }))
        .on("error", reject)
        .on("close", () => resolve());
    });
    // Handle nested single-folder archives (common when zipping a folder on macOS/Windows)
    const nested = await detectSingleTopLevelDir(dest);
    if (nested) {
      const nestedPath = path.join(dest, nested);
      const tempPath = path.join(workRoot, `__nested_${deploymentId}`);
      await fsp.rename(nestedPath, tempPath);
      await fsp.rm(dest, { recursive: true, force: true });
      await fsp.rename(tempPath, dest);
    }
    return;
  }
  throw new Error("Unsupported archive type (use .zip or .tar.gz / .tgz)");
}

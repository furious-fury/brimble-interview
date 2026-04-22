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
    return;
  }
  if (ZIP_EXT.some((s) => lower.endsWith(s))) {
    await new Promise<void>((resolve, reject) => {
      createReadStream(archivePath)
        .pipe(unzipper.Extract({ path: dest }))
        .on("error", reject)
        .on("close", () => resolve());
    });
    return;
  }
  throw new Error("Unsupported archive type (use .zip or .tar.gz / .tgz)");
}

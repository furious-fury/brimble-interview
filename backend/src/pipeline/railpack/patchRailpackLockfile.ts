import { readFile, writeFile } from "node:fs/promises";
import { appendLog } from "../../services/logService.js";

/**
 * Railpack's Node/Bun build uses `bun install --frozen-lockfile` (reproducible).
 * Bun can still error with "lockfile had changes" when package.json/lock are slightly out
 * of sync; relaxing to `bun install` in the build fixes most apps without repo changes.
 */
const LOCKFILE_RELAX_DISABLED = process.env.BRIMBLE_RAILPACK_DISABLE_LOCKFILE_RELAX === "1";

function patchStringsInValue(node: unknown, depth: number): { node: unknown; count: number } {
  if (depth > 80) {
    return { node, count: 0 };
  }
  if (typeof node === "string") {
    const original = node;
    let s = original;
    let c = 0;
    if (s.includes("bun install --frozen-lockfile")) {
      s = s.replaceAll("bun install --frozen-lockfile", "bun install");
      c++;
    }
    return { node: s, count: c };
  }
  if (Array.isArray(node)) {
    let total = 0;
    const out: unknown[] = [];
    for (const x of node) {
      const { node: n, count } = patchStringsInValue(x, depth + 1);
      out.push(n);
      total += count;
    }
    return { node: out, count: total };
  }
  if (node !== null && typeof node === "object") {
    let total = 0;
    const o = node as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o)) {
      const { node: n, count } = patchStringsInValue(o[k], depth + 1);
      out[k] = n;
      total += count;
    }
    return { node: out, count: total };
  }
  return { node, count: 0 };
}

export async function patchRailpackPlanRelaxedLockfile(
  planPath: string,
  deploymentId: string
): Promise<void> {
  if (LOCKFILE_RELAX_DISABLED) {
    return;
  }
  const raw = await readFile(planPath, "utf8");
  let plan: unknown;
  try {
    plan = JSON.parse(raw) as unknown;
  } catch {
    return;
  }
  const { node: next, count } = patchStringsInValue(plan, 0);
  if (count < 1) {
    return;
  }
  await writeFile(planPath, JSON.stringify(next), "utf8");
  void appendLog(deploymentId, {
    stage: "build",
    level: "info",
    message:
      "Adjusted Railpack plan: use `bun install` without `--frozen-lockfile` (avoids spurious lockfile drift in BuildKit). Set BRIMBLE_RAILPACK_DISABLE_LOCKFILE_RELAX=1 to keep frozen installs.",
  });
}

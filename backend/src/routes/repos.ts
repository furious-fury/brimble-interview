import { Router } from "express";
import { spawn } from "node:child_process";
import { GIT_CONSTANTS } from "../config/constants.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { badRequestError } from "../middleware/errorHandler.js";

const router = Router();

interface LsRemoteResult {
  defaultBranch: string | null;
  branches: string[];
}

function runGitLsRemote(args: string[], url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", ["ls-remote", ...args, url], {
      timeout: GIT_CONSTANTS.LS_REMOTE_TIMEOUT_MS,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (d) => {
      stdout += d;
    });
    child.stderr.on("data", (d) => {
      stderr += d;
    });
    child.on("error", (err) => {
      reject(err);
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `git ls-remote exited with ${code}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

async function fetchBranches(url: string): Promise<LsRemoteResult> {
  const [symrefOut, headsOut] = await Promise.allSettled([
    runGitLsRemote(["--symref"], url),
    runGitLsRemote(["--heads"], url),
  ]);

  let defaultBranch: string | null = null;

  if (symrefOut.status === "fulfilled") {
    // Parse: ref: refs/heads/main\tHEAD\n...
    for (const line of symrefOut.value.split("\n")) {
      const match = line.match(/^ref:\s+(refs\/heads\/\S+)\s+HEAD$/);
      if (match) {
        defaultBranch = match[1]!.replace("refs/heads/", "");
        break;
      }
    }
  }

  const branches: string[] = [];

  if (headsOut.status === "fulfilled") {
    // Parse: <sha>\trefs/heads/<name>
    for (const line of headsOut.value.split("\n")) {
      const tab = line.indexOf("\t");
      if (tab === -1) continue;
      const ref = line.slice(tab + 1).trim();
      if (ref.startsWith("refs/heads/")) {
        const name = ref.replace("refs/heads/", "");
        if (name && !branches.includes(name)) {
          branches.push(name);
        }
      }
    }
  }

  branches.sort((a, b) => {
    // Prioritize default branch and common names
    const score = (s: string) => {
      if (s === defaultBranch) return -3;
      if (s === "main") return -2;
      if (s === "master") return -1;
      return 0;
    };
    return score(b) - score(a) || a.localeCompare(b);
  });

  return { defaultBranch, branches };
}

router.get(
  "/branches",
  asyncHandler(async (req, res) => {
    const url = typeof req.query.url === "string" ? req.query.url.trim() : "";
    if (!url) {
      throw badRequestError("Missing query param: url");
    }
    if (!/^https?:\/\//i.test(url) && !url.startsWith("git@")) {
      throw badRequestError("url must be an http(s) or git@ URL");
    }
    const result = await fetchBranches(url);
    res.json({ data: result });
  })
);

export { router as reposRouter };

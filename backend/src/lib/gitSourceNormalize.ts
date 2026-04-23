/**
 * Normalize a Git "browser" or clone URL: strip /tree, /blob, and infer ref when not overridden.
 * Duplicate under frontend/src/lib/gitSourceNormalize.ts (Dockerfile build has no access to ../backend).
 */

function stripQueryHash(s: string): string {
  return s.split("?")[0]!.split("#")[0]!;
}

/**
 * Strips /tree, /blob, and GitLab /-/tree/... from a browser URL. Returns a clone-friendly https URL
 * and an optional ref when the path clearly names a branch or tag.
 */
export function parseHttpsGitSource(raw: string): { baseUrl: string; inferredRef?: string } {
  const trimmed = stripQueryHash(raw).trim();
  if (!trimmed) {
    return { baseUrl: trimmed };
  }
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return { baseUrl: trimmed };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    return { baseUrl: trimmed };
  }

  const path = u.pathname.replace(/\/+$/, "");
  const parts = path.split("/").filter((p) => p.length > 0);
  const origin = u.origin;

  // GitLab, Gitea, etc.: <group>/.../<project>/-/tree/<ref>/...
  for (let i = 0; i < parts.length - 2; i++) {
    if (parts[i] === "-" && parts[i + 1] === "tree" && parts[i + 2] != null) {
      const ref = decodeURIComponent(parts[i + 2]!);
      const basePath = parts.slice(0, i).join("/");
      return { baseUrl: `${origin}/${basePath}`.replace(/\/$/, ""), inferredRef: ref };
    }
  }

  if (u.hostname === "github.com" && parts.length >= 2) {
    const org = parts[0]!;
    const reponame = parts[1]!.replace(/\.git$/i, "");
    const base = `https://github.com/${org}/${reponame}`;
    if (parts[2] === "tree" && parts[3] != null) {
      return { baseUrl: base, inferredRef: decodeURIComponent(parts[3]!) };
    }
    if (parts[2] === "blob" && parts[3] != null) {
      return { baseUrl: base, inferredRef: decodeURIComponent(parts[3]!) };
    }
    return { baseUrl: base };
  }

  // Bitbucket Cloud: /user/repo/src/<ref>/...
  if (parts[2] === "src" && parts[3] != null) {
    const ref = decodeURIComponent(parts[3]!);
    const org = parts[0]!;
    const reponame = parts[1]!.replace(/\.git$/i, "");
    return { baseUrl: `${origin}/${org}/${reponame}`.replace(/\/$/, ""), inferredRef: ref };
  }

  if (parts.length === 0) {
    return { baseUrl: origin };
  }
  return { baseUrl: `${origin}${path}`.replace(/\/$/, "") };
}

/**
 * Strips a browser URL to a clone target. A **non-empty** `ref` from the client (branch/tag) wins
 * over a `tree` / `/- tree` ref from the path; if neither is set, use `main`.
 */
export function normalizeGitSourceForCreate(input: {
  source: string;
  ref?: string | null;
}): { source: string; ref: string } {
  const sourceIn = input.source.trim();
  const refExplicit = input.ref?.trim() ?? "";
  if (!sourceIn) {
    return { source: sourceIn, ref: refExplicit || "main" };
  }

  if (sourceIn.startsWith("git@")) {
    return {
      source: sourceIn,
      ref: refExplicit || "main",
    };
  }

  if (/^https?:\/\//i.test(sourceIn)) {
    const { baseUrl, inferredRef } = parseHttpsGitSource(sourceIn);
    if (refExplicit) {
      return { source: baseUrl, ref: refExplicit };
    }
    return { source: baseUrl, ref: inferredRef || "main" };
  }

  return {
    source: sourceIn,
    ref: refExplicit || "main",
  };
}

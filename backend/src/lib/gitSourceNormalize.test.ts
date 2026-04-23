import { describe, expect, it } from "vitest";
import { normalizeGitSourceForCreate, parseHttpsGitSource } from "./gitSourceNormalize.js";

describe("parseHttpsGitSource", () => {
  it("normalizes GitHub tree URL and infers ref", () => {
    const p = parseHttpsGitSource(
      "https://github.com/furious-fury/four.io/tree/develop/src"
    );
    expect(p.baseUrl).toBe("https://github.com/furious-fury/four.io");
    expect(p.inferredRef).toBe("develop");
  });

  it("normalizes GitHub blob URL", () => {
    const p = parseHttpsGitSource(
      "https://github.com/octo/Hello-World/blob/main/README.md"
    );
    expect(p.baseUrl).toBe("https://github.com/octo/Hello-World");
    expect(p.inferredRef).toBe("main");
  });

  it("strips .git from GitHub repo segment", () => {
    const p = parseHttpsGitSource("https://github.com/o/r.git/tree/v1");
    expect(p.baseUrl).toBe("https://github.com/o/r");
    expect(p.inferredRef).toBe("v1");
  });

  it("parses GitLab style /-/tree/", () => {
    const p = parseHttpsGitSource(
      "https://gitlab.com/muniftanjim/avatar/-/tree/v2/src"
    );
    expect(p.baseUrl).toBe("https://gitlab.com/muniftanjim/avatar");
    expect(p.inferredRef).toBe("v2");
  });

  it("returns plain repo URL for GitHub root", () => {
    const p = parseHttpsGitSource("https://github.com/o/r");
    expect(p.baseUrl).toBe("https://github.com/o/r");
    expect(p.inferredRef).toBeUndefined();
  });
});

describe("normalizeGitSourceForCreate", () => {
  it("uses explicit ref over URL-embedded ref", () => {
    const n = normalizeGitSourceForCreate({
      source: "https://github.com/a/b/tree/aaa",
      ref: "bbb",
    });
    expect(n.source).toBe("https://github.com/a/b");
    expect(n.ref).toBe("bbb");
  });

  it("uses explicit main over tree URL ref", () => {
    const n = normalizeGitSourceForCreate({
      source: "https://github.com/a/b/tree/staging",
      ref: "main",
    });
    expect(n.ref).toBe("main");
  });

  it("defaults to main for plain https repo", () => {
    const n = normalizeGitSourceForCreate({ source: "https://github.com/a/b" });
    expect(n.ref).toBe("main");
  });

  it("uses embedded ref when ref omitted", () => {
    const n = normalizeGitSourceForCreate({ source: "https://github.com/a/b/tree/staging" });
    expect(n.ref).toBe("staging");
  });
});

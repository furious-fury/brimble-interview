import { describe, expect, it } from "vitest";
import { createDeploymentBodySchema } from "./deployments.js";

describe("createDeploymentBodySchema", () => {
  it("accepts https URL and name", () => {
    const r = createDeploymentBodySchema.parse({
      name: "app",
      source: "https://github.com/o/r.git",
    });
    expect(r.name).toBe("app");
    expect(r.ref).toBeUndefined();
  });

  it("accepts git@ source", () => {
    const r = createDeploymentBodySchema.parse({
      name: "app",
      source: "git@github.com:o/r.git",
    });
    expect(r.source).toContain("git@");
  });

  it("rejects invalid source", () => {
    const out = createDeploymentBodySchema.safeParse({
      name: "app",
      source: "nope",
    });
    expect(out.success).toBe(false);
  });

  it("trims and permits optional ref", () => {
    const r = createDeploymentBodySchema.parse({
      name: "  my  ",
      source: "https://a.com/b.git",
      ref: "v1.0.0",
    });
    expect(r.name).toBe("my");
    expect(r.ref).toBe("v1.0.0");
  });
});

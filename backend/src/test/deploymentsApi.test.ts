import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { buildApp } from "../app.js";

const enqueueMock = vi.fn();
const destroyMock = vi.fn().mockResolvedValue(undefined);

vi.mock("../pipeline/queue.js", () => ({
  enqueueDeployment: (id: string) => enqueueMock(id),
}));

vi.mock("../services/deploymentRuntime.js", () => ({
  destroyDeploymentRuntime: (id: string) => destroyMock(id),
}));

describe("HTTP API (deployments + health)", () => {
  const app = buildApp();

  beforeEach(() => {
    enqueueMock.mockClear();
    destroyMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/health returns ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("GET /api/deployments returns empty list", async () => {
    const res = await request(app).get("/api/deployments");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("POST /api/deployments validation error for bad source", async () => {
    const res = await request(app)
      .post("/api/deployments")
      .send({ name: "n", source: "not-a-url" });
    expect(res.status).toBe(400);
  });

  it("POST /api/deployments creates record and enqueues", async () => {
    const res = await request(app)
      .post("/api/deployments")
      .send({ name: "test-app", source: "https://github.com/o/r.git" });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: "test-app",
      source: "https://github.com/o/r.git",
    });
    expect(res.body.data.id).toBeTruthy();
    expect(enqueueMock).toHaveBeenCalledWith(res.body.data.id);
  });

  it("GET /api/deployments/:id returns 404 for unknown", async () => {
    const res = await request(app).get(
      "/api/deployments/clemg4q6l0000t0n8p5q0q0q0"
    );
    expect(res.status).toBe(404);
  });

  it("DELETE /api/deployments/:id removes row and calls destroy", async () => {
    const create = await request(app)
      .post("/api/deployments")
      .send({ name: "del", source: "https://a.com/b.git" });
    const id = create.body.data.id as string;

    const res = await request(app).delete(`/api/deployments/${id}`);
    expect(res.status).toBe(204);
    expect(destroyMock).toHaveBeenCalledWith(id);

    const get = await request(app).get(`/api/deployments/${id}`);
    expect(get.status).toBe(404);
  });
});

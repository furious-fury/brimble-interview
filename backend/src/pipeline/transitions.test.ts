import { describe, expect, it } from "vitest";
import {
  assertCanTransition,
  canTransition,
  InvalidTransitionError,
  isTerminalStatus,
} from "./transitions.js";

describe("transitions", () => {
  it("idempotent: same from and to is allowed", () => {
    expect(canTransition("pending", "pending")).toBe(true);
    expect(() => assertCanTransition("building", "building")).not.toThrow();
  });

  it("allowed forward path: pending -> building -> deploying -> running", () => {
    expect(canTransition("pending", "building")).toBe(true);
    expect(canTransition("building", "deploying")).toBe(true);
    expect(canTransition("deploying", "running")).toBe(true);
  });

  it("disallows invalid jumps e.g. pending -> running", () => {
    expect(canTransition("pending", "running")).toBe(false);
    expect(() => assertCanTransition("pending", "running")).toThrow(
      InvalidTransitionError
    );
  });

  it("failed is terminal: no further transitions", () => {
    expect(isTerminalStatus("failed")).toBe(true);
    expect(isTerminalStatus("running")).toBe(true);
    expect(isTerminalStatus("pending")).toBe(false);
    expect(canTransition("failed", "pending")).toBe(false);
  });

  it("running may only go to failed", () => {
    expect(canTransition("running", "failed")).toBe(true);
    expect(canTransition("running", "pending")).toBe(false);
  });
});

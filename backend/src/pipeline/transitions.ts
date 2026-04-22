import type { DeploymentStatus } from "../generated/prisma/client.js";

/** Edges the pipeline may use (terminals: running, failed) */
const ALLOWED: Record<DeploymentStatus, DeploymentStatus[]> = {
  pending: ["building", "failed"],
  building: ["deploying", "failed"],
  deploying: ["running", "failed"],
  running: [],
  failed: [],
};

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: DeploymentStatus,
    public readonly to: DeploymentStatus
  ) {
    super(`Invalid status transition: ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function canTransition(from: DeploymentStatus, to: DeploymentStatus): boolean {
  if (from === to) return true;
  return (ALLOWED[from] ?? []).includes(to);
}

export function assertCanTransition(from: DeploymentStatus, to: DeploymentStatus): void {
  if (from === to) return;
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
}

export function isTerminalStatus(s: DeploymentStatus): boolean {
  return s === "running" || s === "failed";
}

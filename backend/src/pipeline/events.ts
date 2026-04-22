import { EventEmitter } from "node:events";
import type { DeploymentStatus } from "../generated/prisma/client.js";

export type PipelineTransitionEvent = {
  deploymentId: string;
  from: DeploymentStatus;
  to: DeploymentStatus;
};

export type PipelineFailedEvent = {
  deploymentId: string;
  message: string;
};

export type PipelineCompletedEvent = {
  deploymentId: string;
};

class PipelineEventBus extends EventEmitter {
  emitTransition(payload: PipelineTransitionEvent): boolean {
    return this.emit("transition", payload);
  }

  emitFailed(payload: PipelineFailedEvent): boolean {
    return this.emit("failed", payload);
  }

  emitCompleted(payload: PipelineCompletedEvent): boolean {
    return this.emit("completed", payload);
  }
}

export const pipelineEvents = new PipelineEventBus();

import { logger } from "../config/logger.js";
import { runPipeline } from "./engine.js";

const jobQueue: string[] = [];
let workerRunning = false;

/**
 * Enqueue a deployment for background processing (FIFO, single worker by default for SQLite).
 */
export function enqueueDeployment(deploymentId: string): void {
  jobQueue.push(deploymentId);
  void runWorker();
}

async function runWorker(): Promise<void> {
  if (workerRunning) return;
  workerRunning = true;
  try {
    while (jobQueue.length > 0) {
      const id = jobQueue.shift()!;
      try {
        await runPipeline(id);
      } catch (e) {
        logger.error({ deploymentId: id, err: e }, "Pipeline execution failed");
      }
    }
  } finally {
    workerRunning = false;
    if (jobQueue.length > 0) {
      void runWorker();
    }
  }
}

export function __pipelineQueueStateForTests(): { pending: number } {
  return { pending: jobQueue.length };
}

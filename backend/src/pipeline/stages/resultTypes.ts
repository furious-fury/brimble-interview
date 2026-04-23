import type { DeploymentDTO } from "../../services/deploymentService.js";

export type BuildResult = {
  imageTag: string;
  containerPort: number;
};

export type DeployResult = {
  port: number;
  containerId: string;
};

export type RunResult = {
  url: string;
};

export type StageContext = {
  deployment: DeploymentDTO;
  /** If set, Railpack is killed when this is aborted (e.g. build stage timeout). */
  abortSignal?: AbortSignal;
};

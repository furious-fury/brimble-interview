import type { DeploymentDTO } from "../../services/deploymentService.js";

export type BuildResult = {
  imageTag: string;
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
};

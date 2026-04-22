export type DeploymentStatus =
  | "pending"
  | "building"
  | "deploying"
  | "running"
  | "failed";

export type SourceType = "git" | "upload";

export interface Deployment {
  id: string;
  name: string;
  sourceType: SourceType;
  source: string;
  sourceRef: string | null;
  status: DeploymentStatus;
  imageTag: string | null;
  containerId: string | null;
  url: string | null;
  port: number | null;
  createdAt: string;
  updatedAt: string;
}

export type LogStageName = "build" | "deploy" | "runtime";
export type LogLevelName = "info" | "warn" | "error" | "debug";

export interface LogEntry {
  id: string;
  deploymentId: string;
  stage: LogStageName;
  level: LogLevelName;
  message: string;
  timestamp: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

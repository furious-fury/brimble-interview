/**
 * Application constants that are not user-configurable.
 * For environment variables, see .env.example
 */

export const API_CONSTANTS = {
  /** Max log entries to replay on SSE connect */
  LOG_REPLAY_MAX: 500,

  /** SSE heartbeat interval in milliseconds */
  HEARTBEAT_MS: 20_000,

  /** Max upload size: 100MB */
  UPLOAD_MAX_BYTES: 100 * 1024 * 1024,

  /** Display text for upload limit */
  UPLOAD_MAX_DISPLAY: "100MB",
} as const;

export const GIT_CONSTANTS = {
  /** Timeout for git ls-remote branch listing */
  LS_REMOTE_TIMEOUT_MS: 15_000,

  /** Max buffer for git commands */
  MAX_BUFFER_SIZE: 10 * 1024 * 1024,
} as const;

export const PIPELINE_CONSTANTS = {
  /** Next.js critical build output files to validate */
  NEXTJS_CRITICAL_FILES: ["BUILD_ID", "server", "static"],

  /** Railpack plan output filename */
  RAILPACK_PLAN_NAME: "railpack-plan.json",

  /** Default source branch for git clones */
  DEFAULT_BRANCH: "main",
} as const;

export const URL_CONSTANTS = {
  /** Max length for deployment name in URLs */
  MAX_NAME_LENGTH: 32,

  /** ID truncation length for URLs */
  ID_TRUNCATE_LENGTH: 8,
} as const;

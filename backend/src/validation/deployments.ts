import { z } from "zod";

const envVarSchema = z.record(z.string().min(1).max(5000)).optional();

/** JSON POST is git-only; uploads use POST /api/deployments/upload */
export const createDeploymentBodySchema = z
  .object({
    name: z.string().min(1).max(200).trim(),
    source: z.string().min(1).max(2000).trim(),
    /** Branch, tag, or commit; defaults to main in createDeployment if omitted */
    ref: z
      .string()
      .max(500)
      .optional()
      .transform((s) => (s == null || s.trim() === "" ? undefined : s.trim())),
    /** Environment variables as key-value pairs */
    envVars: envVarSchema,
  })
  .superRefine((val, ctx) => {
    const ok = /^https?:\/\//i.test(val.source) || val.source.startsWith("git@");
    if (!ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "source must be an http(s) or git@ URL",
        path: ["source"],
      });
    }
  });

export const listDeploymentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
});

/** Redeploy request body (optional env vars override) */
export const redeployBodySchema = z.object({
  envVars: envVarSchema,
});

export type CreateDeploymentBody = z.infer<typeof createDeploymentBodySchema>;
export type RedeployBody = z.infer<typeof redeployBodySchema>;

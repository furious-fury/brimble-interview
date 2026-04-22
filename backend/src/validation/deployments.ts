import { z } from "zod";

export const createDeploymentBodySchema = z
  .object({
    name: z.string().min(1).max(200).trim(),
    sourceType: z.enum(["git", "upload"]),
    source: z.string().min(1).max(2000).trim(),
  })
  .superRefine((val, ctx) => {
    if (val.sourceType === "git") {
      const ok = /^https?:\/\//i.test(val.source) || val.source.startsWith("git@");
      if (!ok) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "source must be an http(s) or git@ URL",
          path: ["source"],
        });
      }
    }
  });

export const listDeploymentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
});

export type CreateDeploymentBody = z.infer<typeof createDeploymentBodySchema>;

import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request",
        details: err.flatten(),
      },
    });
    return;
  }
  const code = (err as { code?: string }).code;
  if (code === "NOT_FOUND") {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: (err as Error).message || "Not found" },
    });
    return;
  }
  console.error(err);
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Internal server error",
    },
  });
};

export function notFoundError(message: string): Error {
  const e = new Error(message);
  (e as { code?: string }).code = "NOT_FOUND";
  return e;
}

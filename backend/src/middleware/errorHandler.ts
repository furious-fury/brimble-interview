import type { ErrorRequestHandler } from "express";
import { MulterError } from "multer";
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
  if (err instanceof MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE" ? "Uploaded file is too large" : err.message;
    res.status(400).json({ error: { code: "UPLOAD_ERROR", message } });
    return;
  }
  const code = (err as { code?: string }).code;
  if (code === "NOT_FOUND") {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: (err as Error).message || "Not found" },
    });
    return;
  }
  if (code === "BAD_REQUEST") {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: (err as Error).message || "Bad request" },
    });
    return;
  }
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

export function badRequestError(message: string): Error {
  const e = new Error(message);
  (e as { code?: string }).code = "BAD_REQUEST";
  return e;
}

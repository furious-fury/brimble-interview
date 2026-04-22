import type { RequestHandler } from "express";

type AsyncRequestHandler = (
  ...args: Parameters<RequestHandler>
) => void | Promise<void>;

export function asyncHandler(fn: AsyncRequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

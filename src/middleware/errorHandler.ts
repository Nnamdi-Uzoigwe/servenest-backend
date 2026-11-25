import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import mongoose from "mongoose";
import { ApiError } from "@/utils/ApiError";
import { env } from "@/config/env";

export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  let status = 500;
  let message = "Internal server error";
  let details: unknown;

  if (err instanceof ApiError) {
    status = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    status = 400;
    message = "Validation failed";
    details = err.flatten().fieldErrors;
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = "Validation failed";
    details = Object.fromEntries(
      Object.entries(err.errors).map(([k, v]) => [k, v.message])
    );
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid ${err.path}: ${String(err.value)}`;
  } else if (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: number }).code === 11000
  ) {
    status = 409;
    const fields = Object.keys((err as { keyValue?: object }).keyValue ?? {});
    message = `Duplicate value for: ${fields.join(", ") || "unique field"}`;
  }

  if (status === 500) console.error(err);

  res.status(status).json({
    success: false,
    message,
    ...(details ? { details } : {}),
    ...(!env.isProd && status === 500 && err instanceof Error
      ? { stack: err.stack }
      : {}),
  });
}
import { type ErrorRequestHandler } from "express";
import { logger } from "../lib/logger";
import { handleDbError } from "../lib/db-errors";

export const jsonErrorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (res.headersSent) return;

  if (handleDbError(err, res, "")) return;

  const status = (err as any)?.status ?? (err as any)?.statusCode ?? 500;
  const message = (err as any)?.message ?? "Erreur interne du serveur";

  logger.error({ err, url: req.originalUrl, method: req.method }, "Unhandled request error");

  res.status(status >= 400 && status < 600 ? status : 500).json({
    error: status === 500 ? "Erreur interne du serveur. Veuillez réessayer." : message,
    code: (err as any)?.code,
  });
};

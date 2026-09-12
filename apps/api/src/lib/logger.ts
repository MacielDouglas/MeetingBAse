import pino from "pino";

// Structured logging for the API.
// Uses pino for high-performance JSON logging.
// In development, uses pretty printing; in production, JSON.

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  ...(isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss" },
        },
      }
    : {}),
});

export function logRequest(method: string, url: string, statusCode: number, ms: number) {
  logger.info({ method, url, statusCode, ms }, "request");
}

export function logError(msg: string, err?: unknown) {
  if (err instanceof Error) {
    logger.error({ err }, msg);
  } else {
    logger.error({ err }, msg);
  }
}

export function logMigration(filename: string, status: "applied" | "skipped") {
  logger.info({ migration: filename, status }, "migration");
}

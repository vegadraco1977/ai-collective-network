import pino from "pino";
import path from "path";

/**
 * Structured logger using Pino
 * Outputs JSON in production, pretty-printed in development
 */

const isDev = process.env.NODE_ENV === "development";

const transport = isDev
  ? {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    }
  : undefined;

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  transport ? pino.transport(transport) : undefined
);

export default logger;

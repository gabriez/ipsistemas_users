import pino from "pino";
import { config } from "../config/index.js";

export const logger = pino({
  level: config.app.env === "test" ? "silent" : (process.env.LOG_LEVEL ?? "info"),
  redact: {
    censor: "[REDACTED]",
    paths: [
      "req.headers['x-api-key']",
      "req.headers.authorization",
      "headers['x-api-key']",
      "headers.authorization",
      "password",
      "*.password",
      "token",
      "*.token",
    ],
  },
  serializers: {
    err: pino.stdSerializers.err,
  },
  transport:
    config.app.env === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            ignore: "pid,hostname",
            translateTime: "SYS:standard",
          },
        }
      : undefined,
});

export default logger;

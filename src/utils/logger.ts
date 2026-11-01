import pino from "pino";
import { config } from "../config/index.js";

export const logger = pino({
  level: config.app.env === "test" ? "silent" : (process.env.LOG_LEVEL ?? "info"),
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

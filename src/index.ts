import "reflect-metadata";
import { createApp } from "./app.js";
import { config } from "./config/index.js";
import AppDataSource from "./database/appDataSource.js";
import { logger } from "./utils/logger.js";

const app = createApp();
const port = config.app.port;

try {
  logger.info(
    {
      database: config.db.database,
      host: config.db.host,
      port: config.db.port,
      type: config.db.type,
    },
    "Initializing database connection...",
  );

  await AppDataSource.initialize();
  logger.info("Database connected successfully");

  const server = app.listen(port, () => {
    logger.info({ env: config.app.env, port }, `Server listening on port ${port}`);
  });

  const handleShutdown = (signal: string) => {
    logger.info({ signal }, "Received shutdown signal. Gracefully closing server...");
    server.close(async () => {
      try {
        if (AppDataSource.isInitialized) {
          await AppDataSource.destroy();
          logger.info("Database connection closed cleanly");
        }
        logger.info("Server shut down successfully");
        process.exit(0);
      } catch (err) {
        logger.error({ err }, "Error during graceful shutdown");
        process.exit(1);
      }
    });
  };

  process.on("SIGINT", () => handleShutdown("SIGINT"));
  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
} catch (error) {
  logger.fatal({ err: error }, "Fatal error initializing application");
  process.exit(1);
}

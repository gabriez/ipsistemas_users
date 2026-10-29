import "reflect-metadata";
import AppDataSource from "#database/appDataSource.js";
import { createApp } from "./app.js";

const app = createApp();
const port = process.env.PORT ?? "3000";

try {
  await AppDataSource.initialize();
  console.log("Database connected successfully (PostgreSQL)");

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
} catch (error) {
  console.error("Error connecting to database:", error);
  process.exit(1);
}

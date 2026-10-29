import express from "express";
import { errorHandler } from "./middlewares/errorHandler.js";
import authRoutes from "./modules/auth/auth.routes.js";
import usersRoutes from "./modules/users/users.routes.js";

export function createApp() {
  const app = express();

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/users", usersRoutes);

  app.use(errorHandler);

  return app;
}

export default createApp;

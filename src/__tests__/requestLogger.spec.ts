import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { requestLogger } from "../middlewares/requestLogger.js";

describe("requestLogger Middleware", () => {
  it("should generate a UUID x-request-id header when none is provided", async () => {
    const app = express();
    app.use(requestLogger);
    app.get("/test", (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const res = await request(app).get("/test");

    expect(res.status).toBe(200);
    expect(res.headers["x-request-id"]).toBeDefined();
    // Valid UUID format regex
    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("should preserve incoming x-request-id header for distributed tracing", async () => {
    const app = express();
    app.use(requestLogger);
    app.get("/test", (req, res) => {
      expect(req.id).toBe("custom-trace-id-1234");
      expect(req.log).toBeDefined();
      res.status(200).json({ reqId: req.id });
    });

    const res = await request(app).get("/test").set("x-request-id", "custom-trace-id-1234");

    expect(res.status).toBe(200);
    expect(res.headers["x-request-id"]).toBe("custom-trace-id-1234");
    expect(res.body.reqId).toBe("custom-trace-id-1234");
  });
});

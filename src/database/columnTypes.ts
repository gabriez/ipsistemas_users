import { config } from "../config/index.js";

export const timestampColumnType = config.app.isTest ? "datetime" : "timestamp";

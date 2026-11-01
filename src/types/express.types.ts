import type { Logger } from "pino";

declare global {
  namespace Express {
    interface Request {
      id?: string;
      log?: Logger;
      rawBody?: string;
    }
  }
}

declare module "node:http" {
  interface IncomingMessage {
    id?: string;
    log?: Logger;
    rawBody?: string;
  }
}

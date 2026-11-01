import { createHmac, randomInt } from "node:crypto";
import { config } from "../config/index.js";

export function generateOtp(length = 6): string {
  if (length === 6) {
    return randomInt(100000, 1000000).toString();
  }
  const min = 10 ** (length - 1);
  const max = 10 ** length;
  return randomInt(min, max).toString();
}

export function hashToken(token: string, secret?: string): string {
  const hmacSecret = secret ?? config.security.otpSecret ?? config.security.internalApiKey;

  return createHmac("sha256", hmacSecret).update(token).digest("hex");
}

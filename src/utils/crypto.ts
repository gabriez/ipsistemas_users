import { createHmac, randomInt } from "node:crypto";

export function generateOtp(length = 6): string {
  if (length === 6) {
    return randomInt(100000, 1000000).toString();
  }
  const min = 10 ** (length - 1);
  const max = 10 ** length;
  return randomInt(min, max).toString();
}

export function hashToken(token: string, secret?: string): string {
  const hmacSecret = secret ?? process.env.OTP_SECRET ?? process.env.INTERNAL_API_KEY ?? "default-internal-otp-secret";

  return createHmac("sha256", hmacSecret).update(token).digest("hex");
}

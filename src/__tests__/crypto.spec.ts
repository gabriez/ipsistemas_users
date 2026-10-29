import { describe, expect, it } from "vitest";
import { generateOtp, hashToken } from "../utils/crypto.js";

describe("Crypto Utils", () => {
  it("should generate a 6-digit OTP as a string", () => {
    const otp = generateOtp(6);
    expect(otp).toHaveLength(6);
    expect(/^\d{6}$/.test(otp)).toBe(true);
  });

  it("should generate deterministic HMAC-SHA256 hash for identical tokens and secret", () => {
    const token = "123456";
    const hash1 = hashToken(token, "test-secret");
    const hash2 = hashToken(token, "test-secret");
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("should generate different hashes for different tokens", () => {
    const hash1 = hashToken("123456", "test-secret");
    const hash2 = hashToken("654321", "test-secret");
    expect(hash1).not.toBe(hash2);
  });

  it("should generate different hashes for the same token with different secrets", () => {
    const hash1 = hashToken("123456", "secret-a");
    const hash2 = hashToken("123456", "secret-b");
    expect(hash1).not.toBe(hash2);
  });
});

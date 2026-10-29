import AppDataSource from "../../database/appDataSource.js";
import { UserEntity, UserStatus } from "../../database/entities/UserEntity.js";
import { VerificationTokenEntity } from "../../database/entities/VerificationTokenEntity.js";
import { generateOtp, hashToken } from "../../utils/crypto.js";
import { BadRequestError, ConflictError, GoneError } from "../../utils/errors.js";
import type { RequestTokenInput, VerifyTokenInput } from "./auth.schema.js";

const TOKEN_TTL_MINUTES = 15;
const MAX_ATTEMPTS = 3;

export class AuthService {
  private userRepository = AppDataSource.getRepository(UserEntity);
  private tokenRepository = AppDataSource.getRepository(VerificationTokenEntity);

  async requestToken(input: RequestTokenInput) {
    const email = input.email.trim().toLowerCase();

    let user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      user = this.userRepository.create({
        email,
        is_verified: false,
        status: UserStatus.PENDING,
        telegram_id: input.telegram_id ?? null,
      });
      await this.userRepository.save(user);
    } else if (input.telegram_id && !user.telegram_id) {
      user.telegram_id = input.telegram_id;
      await this.userRepository.save(user);
    }

    // Invalidate any existing unused tokens for this user
    await this.tokenRepository.update(
      {
        user_id: user.id,
        used_at: undefined,
      },
      {
        used_at: new Date(),
      },
    );

    const otp = generateOtp(6);
    const tokenHash = hashToken(otp);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

    const tokenEntity = this.tokenRepository.create({
      attempts: 0,
      expires_at: expiresAt,
      max_attempts: MAX_ATTEMPTS,
      token_hash: tokenHash,
      user_id: user.id,
    });

    await this.tokenRepository.save(tokenEntity);

    return {
      email: user.email,
      expires_at: expiresAt.toISOString(),
      success: true,
      token: otp,
    };
  }

  async verifyToken(input: VerifyTokenInput) {
    const tokenHash = hashToken(input.token.trim());
    const telegramId = input.telegram_id.trim();

    const tokenEntity = await this.tokenRepository.findOne({
      where: {
        token_hash: tokenHash,
      },
      relations: {
        user: true,
      },
    });

    if (!tokenEntity || tokenEntity.used_at != null) {
      throw new BadRequestError("Invalid or already used token");
    }

    if (tokenEntity.attempts >= tokenEntity.max_attempts) {
      throw new BadRequestError("Maximum token verification attempts exceeded");
    }

    if (new Date() > tokenEntity.expires_at) {
      throw new GoneError("Verification token has expired");
    }

    // Verify if telegram_id is already assigned to a different active user
    const existingActiveWithTelegram = await this.userRepository.findOne({
      where: {
        telegram_id: telegramId,
      },
    });

    if (
      existingActiveWithTelegram &&
      existingActiveWithTelegram.id !== tokenEntity.user_id &&
      existingActiveWithTelegram.status === UserStatus.ACTIVE
    ) {
      throw new ConflictError("Telegram ID is already linked to another active account");
    }

    const user = tokenEntity.user;
    user.telegram_id = telegramId;
    user.status = UserStatus.ACTIVE;
    user.is_verified = true;
    user.verified_at = new Date();

    tokenEntity.used_at = new Date();

    await AppDataSource.transaction(async (manager) => {
      await manager.save(user);
      await manager.save(tokenEntity);
    });

    return {
      success: true,
      user: {
        email: user.email,
        id: user.id,
        is_verified: user.is_verified,
        status: user.status,
        telegram_id: user.telegram_id,
        verified_at: user.verified_at?.toISOString(),
      },
    };
  }
}

export const authService = new AuthService();

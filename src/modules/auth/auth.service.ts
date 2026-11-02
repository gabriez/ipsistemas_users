import type { InviteUserInput, InviteUserResponseDto, RequestTokenInput, VerifyTokenInput } from "../../types/auth.types.js";
import type { IUserRepository, UserRecord } from "../../types/repository.types.js";
import { UserStatus } from "../../types/user.types.js";
import { generateOtp } from "../../utils/crypto.js";
import { BadRequestError, ConflictError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import { outlineClient } from "../outline/outline.client.js";

const TOKEN_TTL_MINUTES = 15;

export interface IAuthService {
  invite(input: InviteUserInput): Promise<InviteUserResponseDto>;
  requestToken(input: RequestTokenInput): Promise<{
    success: boolean;
    email: string;
    token: string;
    expires_at: string;
  }>;
  verifyToken(input: VerifyTokenInput): Promise<{ success: boolean; user: Partial<UserRecord> }>;
}

export class AuthService implements IAuthService {
  constructor(private readonly userRepository: IUserRepository) {}

  /**
   * Primary self-serve invitation flow:
   * 1. Check if telegram_id is already bound to another ACTIVE user (prevent collision/takeover)
   * 2. Find or create local user record in PENDING state
   * 3. Call Outline API (find or invite) to trigger the activation email via Outline
   * 4. Persist outline_id UUID in DB
   */
  async invite(input: InviteUserInput): Promise<InviteUserResponseDto> {
    const email = input.email.trim().toLowerCase();
    const telegramId = input.telegram_id.trim();

    logger.info({ email, telegramId }, "Processing user invite request");

    // Verify if telegram_id is already linked to another active account
    const existingActiveTelegram = await this.userRepository.findByTelegramId(telegramId);

    if (existingActiveTelegram) {
      logger.warn({ existingUserId: existingActiveTelegram.id, telegramId }, "Invite conflict: Telegram ID already linked to active account");
      throw new ConflictError("Telegram ID is already linked to another active account");
    }

    // Call Outline to invite user with member role and suppressEmail: false
    let outlineUser = await outlineClient.findUserByEmail(email);
    let invited = false;
    if (!outlineUser) {
      outlineUser = await outlineClient.inviteUser({
        email,
        name: input.name,
        role: "member",
      });
      invited = true;
    }

    logger.info({ email, outlineId: outlineUser?.id }, "Outline user identity resolved");

    let user = await this.userRepository.findByEmail(email);

    if (!user) {
      user = await this.userRepository.create({
        email,
        is_verified: false,
        outline_id: outlineUser?.id ?? null,
        status: outlineUser
          ? invited
            ? outlineUser.isSuspended
              ? UserStatus.BLOCKED
              : UserStatus.PENDING
            : UserStatus.ACTIVE
          : UserStatus.PENDING,
        telegram_id: telegramId,
      });
      logger.info({ email, outline_id: outlineUser?.id, userId: user.id }, "Created local user and linked Outline ID");
    } else if (user.telegram_id !== telegramId) {
      user = await this.userRepository.update(user.id, {
        telegram_id: telegramId,
      });
      logger.info({ email, telegramId, userId: user.id }, "Updated user telegram_id binding");
    }

    logger.info({ email: user.email, status: user.status, userId: user.id }, "User invite completed successfully");

    return {
      email: user.email,
      id: user.id,
      is_verified: user.is_verified,
      outline_id: user.outline_id ?? null,
      status: user.status,
      telegram_id: user.telegram_id,
    };
  }

  // =========================================================================
  // Legacy OTP Methods (Preserved for backward-compatible domain logic)
  // =========================================================================

  async requestToken(input: RequestTokenInput) {
    const email = input.email.trim().toLowerCase();

    let user = await this.userRepository.findByEmail(email);

    if (!user) {
      user = await this.userRepository.create({
        email,
        is_verified: false,
        status: UserStatus.PENDING,
        telegram_id: input.telegram_id ?? null,
      });
    } else if (input.telegram_id && !user.telegram_id) {
      user = await this.userRepository.update(user.id, {
        telegram_id: input.telegram_id,
      });
    }

    const otp = generateOtp(6);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

    return {
      email: user.email,
      expires_at: expiresAt.toISOString(),
      success: true,
      token: otp,
    };
  }

  async verifyToken(input: VerifyTokenInput) {
    const telegramId = input.telegram_id.trim();

    const existingActiveWithTelegram = await this.userRepository.findByTelegramId(telegramId);
    if (existingActiveWithTelegram && existingActiveWithTelegram.status === UserStatus.ACTIVE) {
      throw new ConflictError("Telegram ID is already linked to another active account");
    }

    const user = await this.userRepository.findByTelegramId(telegramId);
    if (!user) {
      throw new BadRequestError("Invalid or already used token");
    }

    const updated = await this.userRepository.update(user.id, {
      is_verified: true,
      status: UserStatus.ACTIVE,
      telegram_id: telegramId,
      verified_at: new Date(),
    });

    return {
      success: true,
      user: {
        email: updated.email,
        id: updated.id,
        is_verified: updated.is_verified,
        status: updated.status,
        telegram_id: updated.telegram_id,
        verified_at: updated.verified_at ?? undefined,
      },
    };
  }
}

import { typeOrmUserRepository } from "../../database/repositories/typeOrmUserRepository.js";
export const authService = new AuthService(typeOrmUserRepository);

import axios, { type AxiosInstance } from "axios";
import { config } from "../../config/index.js";
import type { OutlineInviteResponse, OutlineUser, OutlineUserInviteItem, OutlineUsersListResponse } from "../../types/outline.types.js";
import { logger } from "../../utils/logger.js";

export class OutlineClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.outline.apiUrl,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.outline.apiKey}`,
      },
      timeout: 10000,
    });
  }

  /**
   * Find a user in Outline by email using POST /api/users.list with filters
   */
  async findUserByEmail(email: string): Promise<OutlineUser | null> {
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const response = await this.client.post<OutlineUsersListResponse>("/api/users.list", {
        offset: 0,
        limit: 1,
        sort: "updatedAt",
        direction: "DESC",
        query: "",
        filters: [
          {
            field: "email",
            operator: "eq",
            value: normalizedEmail,
          },
        ],
      });

      const users = response.data?.data;
      if (Array.isArray(users) && users.length > 0) {
        return users[0];
      }

      return null;
    } catch (error) {
      logger.error({ error, email: normalizedEmail }, "Failed to find user in Outline by email");
      throw error;
    }
  }

  /**
   * Invite a user to Outline using POST /api/users.invite
   * with suppressEmail: false (delegating invitation email to Outline)
   */
  async inviteUser(invite: OutlineUserInviteItem): Promise<OutlineUser | null> {
    const normalizedEmail = invite.email.trim().toLowerCase();

    try {
      const response = await this.client.post<OutlineInviteResponse>("/api/users.invite", {
        invites: [
          {
            name: invite.name?.trim() || "",
            email: normalizedEmail,
            role: invite.role ?? "member",
          },
        ],
        suppressEmail: false,
      });

      logger.info({ email: normalizedEmail, role: invite.role ?? "member" }, "Outline invitation sent successfully");

      const createdUsers = response.data?.data?.users;
      if (Array.isArray(createdUsers) && createdUsers.length > 0) {
        return createdUsers[0];
      }

      // If response does not include the user object directly, fetch it
      return await this.findUserByEmail(normalizedEmail);
    } catch (error: unknown) {
      // If user already exists or was invited, attempt to recover by email lookup
      logger.warn({ error, email: normalizedEmail }, "Outline invite encountered an issue; checking if user already exists in Outline");
      const existingUser = await this.findUserByEmail(normalizedEmail);
      if (existingUser) {
        return existingUser;
      }
      throw error;
    }
  }
}

export const outlineClient = new OutlineClient();

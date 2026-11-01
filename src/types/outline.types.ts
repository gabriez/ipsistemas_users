export interface OutlineUser {
  id: string; // UUID
  name: string;
  email: string;
  role: "admin" | "member" | "viewer";
  avatarUrl?: string | null;
  suspendedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OutlineUserInviteItem {
  email: string;
  name?: string;
  role?: "admin" | "member" | "viewer";
}

export interface OutlineInviteResponse {
  data: {
    users?: OutlineUser[];
    sent?: string[];
  };
}

export interface OutlineUsersListResponse {
  data: OutlineUser[];
  pagination: {
    limit: number;
    offset: number;
    nextPath?: string;
  };
}

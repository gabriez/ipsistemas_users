export interface OutlineWebhookEventPayload {
  id?: string;
  name: string; // e.g. "users.create", "users.activate", "users.suspend", "users.update"
  actorId?: string;
  data?: {
    model?: {
      id?: string; // UUID
      email?: string;
      name?: string;
      role?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  model?: {
    id?: string; // UUID
    email?: string;
    name?: string;
    role?: string;
    isSuspended?: boolean;
    [key: string]: unknown;
  };
  createdAt?: string;
}

export interface WebhookHandleResult {
  handled: boolean;
  action?: string;
  userEmail?: string;
}

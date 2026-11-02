export interface OutlineWebhookEventPayload {
  id?: string;
  actorId: string;
  webhookSubscriptionId?: string;
  createdAt?: string;
  event: string; // e.g. "users.create", "users.activate", "users.suspend", "users.update"
  payload: {
    id: string;
    model?: {
      id?: string; // UUID
      email?: string;
      name?: string;
      role?: string;
      isSuspended?: boolean;
      [key: string]: unknown;
    };
  };
  model?: {
    id?: string; // UUID
    email?: string;
    name?: string;
    role?: string;
    isSuspended?: boolean;
    [key: string]: unknown;
  };
}

export interface WebhookHandleResult {
  handled: boolean;
  action?: string;
  userEmail?: string;
}

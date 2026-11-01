# System Architecture: `ipsistemas_users`

## 1. Overview & Objectives

`ipsistemas_users` is an access control and identity management microservice built with **Express**, **TypeORM**, and **MariaDB**. Its primary objective is to serve as a strict gatekeeper for an enterprise Telegram bot, preventing unauthorized usage and ensuring that only employees/users registered and activated in **Outline** can interact with the bot.

The architecture decouples communication concerns from business rules:
- **Outline** acts as the corporate Identity Provider (IdP) source of truth and manages user invites/onboarding emails.
- **n8n / Telegram** handles bot event orchestration and user communications.
- **`ipsistemas_users`** owns identity binding, Outline user synchronization, webhook event processing, and sub-20ms access gatekeeping.
- **MariaDB** enforces ACID transactional integrity and identity uniqueness.
- **Global Config Singleton**: Environment variables and runtime configurations are centralized, validated via Zod, and exposed as an immutable global singleton in `src/config/index.ts`.
- **Structured Logging**: Structured high-performance logging via **Pino** (`src/utils/logger.ts`).

---

## 2. Topology & Interaction Diagram

```
┌─────────────────┐       Telegram Webhook
│ Telegram Client │ ──────────────────────────┐
└─────────────────┘                           │
                                              ▼
┌─────────────────┐  Invite / List REST  ┌─────────┐                ┌──────────────┐
│   Outline API   │ ◄─────────────────── │   n8n   │                │ User Mailbox │
└─────────────────┘  (Backend via Axios) └─────────┘                └──────────────┘
         │                                    │                            ▲
         │                                    │ Internal HTTP (x-api-key)  │
         │                                    ▼                            │
         │ Webhook       ┌────────────────────────┐                        │
         │ (HMAC Signed) │ Express Backend        │ ──(Outline sends email)┘
         └─────────────► │ (ipsistemas_users)     │
                         └────────────────────────┘
                                      │
                              TypeORM │ (mysql2 pool)
                                      ▼
                         ┌────────────────────────┐
                         │    MariaDB Database    │
                         └────────────────────────┘
```

---

## 3. End-to-End Workflows

### 3.1. Self-Serve Registration & Invitation Flow (`/register <email>`)

```
Telegram User         n8n                  Express Backend            Outline API              User Mailbox
     │                 │                          │                        │                        │
     │ /register email │                          │                        │                        │
     ├────────────────►│                          │                        │                        │
     │                 │ POST /api/v1/auth/invite │                        │                        │
     │                 │ Header: x-api-key        │                        │                        │
     │                 │ Body: { email,           │                        │                        │
     │                 │   telegram_id, name }    │                        │                        │
     │                 ├─────────────────────────►│                        │                        │
     │                 │                          │ 1. Verify telegram_id  │                        │
     │                 │                          │    collision           │                        │
     │                 │                          │ 2. Find or create user │                        │
     │                 │                          │    (status: PENDING)   │                        │
     │                 │                          │ 3. Check /users.list   │                        │
     │                 │                          ├───────────────────────►│                        │
     │                 │                          │◄───────────────────────┤                        │
     │                 │                          │ 4. If not found:       │                        │
     │                 │                          │    POST /users.invite  │                        │
     │                 │                          │    (role: member,      │                        │
     │                 │                          │     suppressEmail: F)  │                        │
     │                 │                          ├───────────────────────►│ 5. Sends invite email  │
     │                 │                          │◄───────────────────────┤───────────────────────►│
     │                 │                          │ 6. Save outline_id     │                        │
     │                 │ 200 OK                   │    in MariaDB          │                        │
     │                 │ { status: "PENDING" }    │                        │                        │
     │                 │◄─────────────────────────┤                        │                        │
     │ "Revisa tu      │                          │                        │                        │
     │ correo para     │                          │                        │                        │
     │ activar cuenta" │                          │                        │                        │
     │◄────────────────┤                          │                        │                        │
```

---

### 3.2. Verification & Activation via Webhook (`users.create`)

When the user opens the email sent by Outline and completes their account creation/activation:

```
User Mailbox       Outline Server                       Express Backend                     MariaDB
     │                   │                                     │                               │
     │ Completes signup  │                                     │                               │
     ├──────────────────►│                                     │                               │
     │                   │ POST /api/v1/webhooks/outline       │                               │
     │                   │ Header: Outline-Signature           │                               │
     │                   │ Body: { name: "users.create",       │                               │
     │                   │         model: { id, email } }      │                               │
     │                   ├────────────────────────────────────►│                               │
     │                   │                                     │ 1. Verify HMAC-SHA-256        │
     │                   │                                     │    signature                  │
     │                   │                                     │ 2. Lookup user by outline_id  │
     │                   │                                     │    or email                   │
     │                   │                                     │ 3. Set status = ACTIVE        │
     │                   │                                     │    is_verified = true         │
     │                   │                                     │    verified_at = NOW()        │
     │                   │                                     ├──────────────────────────────►│
     │                   │ 200 OK { handled: true }            │                               │
     │                   │◄────────────────────────────────────┤                               │
```

Supported Webhook Events:
- `users.create` / `users.activate`: Transitions user to `status: ACTIVE`, `is_verified: true`.
- `users.suspend`: Transitions user to `status: BLOCKED`.
- `users.update`: Synchronizes `outline_id` or profile updates.

---

### 3.3. Recurring Gatekeeping (Every Telegram message)

```
Telegram User         n8n                                        Express Backend            MariaDB
     │                 │                                                │                      │
     │ (Any message)   │                                                │                      │
     ├────────────────►│                                                │                      │
     │                 │ 1. GET /api/v1/users/lookup?telegram_id=...    │                      │
     │                 │    Header: x-api-key                           │                      │
     │                 ├───────────────────────────────────────────────►│ 2. Indexed lookup   │
     │                 │                                                ├─────────────────────►│
     │                 │ 3. 200 OK { status: "ACTIVE", outline_id }     │◄─────────────────────┤
     │                 │◄───────────────────────────────────────────────┤                      │
     │                 │    (If 404 or status != ACTIVE -> Drop flow)   │                      │
     │                 │                                                │                      │
     │                 │ 4. Proceed with normal bot command execution...│                      │
```

---

## 4. Data Domain Model (MariaDB & TypeORM)

```
┌─────────────────────────────────────────┐
│                 users                   │
├─────────────────────────────────────────┤
│ id: VARCHAR(36) [UUID, PK]              │
│ email: VARCHAR(255) [UNIQUE, INDEX]     │
│ telegram_id: BIGINT [UNIQUE, NULLABLE]  │
│ outline_id: VARCHAR(255) [INDEX, NULL]  │
│ status: VARCHAR(20) [DEFAULT 'PENDING'] │
│ is_verified: BOOLEAN [DEFAULT FALSE]    │
│ verified_at: DATETIME / TIMESTAMP       │
│ created_at: DATETIME / TIMESTAMP        │
│ updated_at: DATETIME / TIMESTAMP        │
│ deleted_at: DATETIME / TIMESTAMP [NULL] │
└─────────────────────────────────────────┘
                    │ 1
                    │
                    │ N
┌─────────────────────────────────────────┐
│       verification_tokens (LEGACY)      │
├─────────────────────────────────────────┤
│ id: VARCHAR(36) [UUID, PK]              │
│ user_id: VARCHAR(36) [FK -> users.id]   │
│ token_hash: VARCHAR(64) [INDEX]         │
│ attempts: INT [DEFAULT 0]               │
│ max_attempts: INT [DEFAULT 3]           │
│ expires_at: DATETIME / TIMESTAMP        │
│ used_at: DATETIME / TIMESTAMP [NULL]    │
│ created_at: DATETIME / TIMESTAMP        │
└─────────────────────────────────────────┘
```

> **Note on Legacy Table**: `verification_tokens` and legacy OTP methods are preserved in domain code for zero-regression backward compatibility, while direct HTTP endpoints return `410 Gone`.

---

## 5. API Endpoints

### 1. Self-Serve User Invite

- **Method**: `POST`
- **Path**: `/api/v1/auth/invite`
- **Headers**: `x-api-key: <INTERNAL_API_KEY>`
- **Request Body**:

  ```json
  {
    "email": "user@company.com",
    "telegram_id": "1234567890",
    "name": "User Name"
  }
  ```
- **Response (200 OK)**:

  ```json
  {
    "success": true,
    "data": {
      "id": "c3a9f0e2-1234-5678-90ab-cdef12345678",
      "email": "user@company.com",
      "telegram_id": "1234567890",
      "outline_id": "914764ca-1abf-481b-9262-ea5ba3f3fc68",
      "status": "PENDING",
      "is_verified": false
    },
    "message": "Invitation sent successfully via Outline"
  }
  ```

### 2. Outline Webhook Receiver

- **Method**: `POST`
- **Path**: `/api/v1/webhooks/outline`
- **Headers**: `Outline-Signature: t=<timestamp>,s=<hmac_sha256>` (optional if internal network)
- **Request Body**: Outline webhook payload (`users.create`, `users.activate`, `users.suspend`)
- **Response (200 OK)**:

  ```json
  {
    "success": true,
    "data": {
      "handled": true,
      "action": "ACTIVATED",
      "userEmail": "user@company.com"
    }
  }
  ```

### 3. User Lookup (Fast Gatekeeping)

- **Method**: `GET`
- **Path**: `/api/v1/users/lookup`
- **Query Parameters**:
  - `telegram_id`: `string`
  - `outline_id`: `string` (UUID)
  - `email`: `string`
  - `id`: `string` (UUID)
- **Response (200 OK)**:

  ```json
  {
    "id": "c3a9f0e2-1234-5678-90ab-cdef12345678",
    "email": "user@company.com",
    "telegram_id": "1234567890",
    "outline_id": "914764ca-1abf-481b-9262-ea5ba3f3fc68",
    "status": "ACTIVE",
    "is_verified": true,
    "created_at": "2026-03-30T12:00:00.000Z"
  }
  ```

---

## 6. CI/CD & Production Deployment

- **Containerization**: Multi-stage `Dockerfile` with Node 24 slim, pnpm frozen lockfile, native build dependencies, and minimal production runner layer.
- **CI Workflow (`.github/workflows/ci.yml`)**: Triggered on push/PR to `main`. Executes test suite (`vitest --run`), TypeScript type checking (`tsc --noEmit`), Biome linter, and formatting checks.
- **CD Workflow (`.github/workflows/deploy.yml`)**:
  1. Runs all quality checks.
  2. Builds and pushes multi-architecture Docker image to GitHub Container Registry (`ghcr.io`).
  3. Deploys via SSH to target Proxmox VM, syncs `docker-compose.prod.yml`, injects production `.env`, pulls updated image, and performs zero-downtime rolling restart.

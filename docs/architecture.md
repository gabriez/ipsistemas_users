# System Architecture: `ipsistemas_users`

## 1. Overview & Objectives

`ipsistemas_users` is an access control and identity management microservice built with **Express**, **TypeORM**, and **PostgreSQL**. Its primary objective is to serve as a strict gatekeeper for an enterprise Telegram bot, preventing unauthorized usage and ensuring that only employees/users registered in **Outline** can interact with the bot.

The architecture decouples communication concerns from business rules:
- **Outline** acts as the corporate Identity Provider (IdP) source of truth.
- **n8n** handles bot event orchestration, Outline API checks, and email delivery via SMTP.
- **`ipsistemas_users`** owns identity binding, OTP verification lifecycle, user state transitions, and sub-20ms access gatekeeping.
- **PostgreSQL** enforces ACID transactional integrity and identity uniqueness.

---

## 2. Topology & Interaction Diagram

```
┌─────────────────┐       Telegram Webhook
│ Telegram Client │ ──────────────────────────┐
└─────────────────┘                           │
                                              ▼
┌─────────────────┐  REST API (Bearer)   ┌─────────┐   SMTP (TLS)   ┌──────────────┐
│   Outline API   │ ◄─────────────────── │   n8n   │ ─────────────► │ User Mailbox │
└─────────────────┘                      └─────────┘                └──────────────┘
                                              │
                         Internal HTTP Calls  │ (x-api-key)
                                              ▼
                                 ┌────────────────────────┐
                                 │ Express Backend        │
                                 │ (ipsistemas_users)     │
                                 └────────────────────────┘
                                              │
                                      TypeORM │ (pg pool)
                                              ▼
                                 ┌────────────────────────┐
                                 │  PostgreSQL Database   │
                                 └────────────────────────┘
```

---

## 3. End-to-End Workflows

### 3.1. Registration & Verification Request (`/register <email>`)

```
Telegram User         n8n                  Outline API           Express Backend            Postgres
     │                 │                        │                       │                      │
     │ /register email │                        │                       │                      │
     ├────────────────►│                        │                       │                      │
     │                 │ 1. GET /api/users.info │                       │                      │
     │                 ├───────────────────────►│                       │                      │
     │                 │◄───────────────────────┤                       │                      │
     │                 │   (user exists: true)  │                       │                      │
     │                 │                                                │                      │
     │                 │ 2. POST /api/v1/auth/request-token             │                      │
     │                 │    Header: x-api-key                           │                      │
     │                 │    Body: { email, telegram_id }                │                      │
     │                 ├───────────────────────────────────────────────►│                      │
     │                 │                                                │ 3. Invalidate old    │
     │                 │                                                │    Generate 6-d OTP  │
     │                 │                                                │    Save hash + TTL   │
     │                 │                                                ├─────────────────────►│
     │                 │ 4. 200 OK { token, email }                     │◄─────────────────────┤
     │                 │◄───────────────────────────────────────────────┤                      │
     │                 │                                                                       │
     │                 │ 5. Send Email via SMTP Node [OTP: 489201]                             │
     │                 ├───────────────────────────────────────────────► (User mailbox)        │
     │                 │                                                                       │
     │ 6. "OTP Code    │                                                                       │
     │    Sent"        │                                                                       │
     │◄────────────────┤                                                                       │
```

If the user does **not** exist in Outline, n8n terminates the flow immediately and sends an unauthorized message back to the Telegram client without invoking the backend.

---

### 3.2. Verification & Identity Binding (`/verify <code>`)

```
Telegram User         n8n                                        Express Backend            Postgres
     │                 │                                                │                      │
     │ /verify 489201  │                                                │                      │
     ├────────────────►│                                                │                      │
     │                 │ 1. POST /api/v1/auth/verify-token              │                      │
     │                 │    Header: x-api-key                           │                      │
     │                 │    Body: { token: "489201", telegram_id }      │                      │
     │                 ├───────────────────────────────────────────────►│                      │
     │                 │                                                │ 2. Find active token │
     │                 │                                                │    Check attempts    │
     │                 │                                                │    Check expires_at  │
     │                 │                                                ├─────────────────────►│
     │                 │                                                │◄─────────────────────┤
     │                 │                                                │                      │
     │                 │                                                │ 3. Link telegram_id  │
     │                 │                                                │    Set ACTIVE        │
     │                 │                                                │    Mark token USED   │
     │                 │                                                ├─────────────────────►│
     │                 │ 4. 200 OK { status: "ACTIVE", user }           │                      │
     │                 │◄───────────────────────────────────────────────┤                      │
     │                 │                                                                       │
     │ 5. "Access      │                                                                       │
     │    Granted!"    │                                                                       │
     │◄────────────────┤                                                                       │
```

---

### 3.3. Recurring Gatekeeping (Every Telegram message)

```
Telegram User         n8n                                        Express Backend            Postgres
     │                 │                                                │                      │
     │ (Any message)   │                                                │                      │
     ├────────────────►│                                                │                      │
     │                 │ 1. GET /api/v1/users/lookup?telegram_id=...    │                      │
     │                 │    Header: x-api-key                           │                      │
     │                 ├───────────────────────────────────────────────►│ 2. Indexed lookup   │
     │                 │                                                ├─────────────────────►│
     │                 │ 3. 200 OK { status: "ACTIVE" }                 │◄─────────────────────┤
     │                 │◄───────────────────────────────────────────────┤                      │
     │                 │    (If 404 or status != ACTIVE -> Drop flow)   │                      │
     │                 │                                                │                      │
     │                 │ 4. Proceed with normal bot command execution...│                      │
```

---

## 4. Data Domain Model (PostgreSQL & TypeORM)

```
┌─────────────────────────────────────────┐
│                 users                   │
├─────────────────────────────────────────┤
│ id: UUID [PK]                           │
│ email: VARCHAR(255) [UNIQUE, INDEX]     │
│ telegram_id: BIGINT [UNIQUE, NULLABLE]  │
│ outline_id: VARCHAR(255) [NULLABLE]     │
│ status: VARCHAR(20) [DEFAULT 'PENDING'] │
│ is_verified: BOOLEAN [DEFAULT FALSE]    │
│ verified_at: TIMESTAMP WITH TIME ZONE   │
│ created_at: TIMESTAMP WITH TIME ZONE    │
│ updated_at: TIMESTAMP WITH TIME ZONE    │
│ deleted_at: TIMESTAMP WITH TIME ZONE    │
└─────────────────────────────────────────┘
                    │ 1
                    │
                    │ N
┌─────────────────────────────────────────┐
│          verification_tokens            │
├─────────────────────────────────────────┤
│ id: UUID [PK]                           │
│ user_id: UUID [FK -> users.id]          │
│ token_hash: VARCHAR(64) [INDEX]         │
│ attempts: INT [DEFAULT 0]               │
│ max_attempts: INT [DEFAULT 3]           │
│ expires_at: TIMESTAMP WITH TIME ZONE    │
│ used_at: TIMESTAMP WITH TIME ZONE [NULL]│
│ created_at: TIMESTAMP WITH TIME ZONE    │
└─────────────────────────────────────────┘
```

### Invariants & Database Rules

1. **Telegram ID Safety**: Telegram user IDs are 64-bit integers exceeding JavaScript's `Number.MAX_SAFE_INTEGER` ($2^{53} - 1$). In PostgreSQL, the column is `BIGINT`. In TypeORM/TypeScript, it must use a custom column value transformer to serialize and deserialize as `string`.
2. **Email Normalization**: All emails are normalized to lowercase before validation and persistence.
3. **Cryptographic Token Storage**: OTP tokens are generated as 6-digit cryptographically secure pseudorandom numbers (`crypto.randomInt(100000, 999999)`). The database stores the HMAC-SHA-256 hash of the token (`token_hash`) using `OTP_SECRET` (or `INTERNAL_API_KEY`) rather than plaintext. This guarantees that an external database dump cannot reverse-engineer 6-digit OTPs using rainbow tables without possessing the server's secret key.
4. **Token Expiration & Invalidation**:
   - TTL: 15 minutes (`expires_at = NOW() + INTERVAL '15 minutes'`).
   - Single-use: `used_at` timestamp set upon successful verification.
   - Replay protection: Any new token request automatically marks prior unconsumed tokens for that user as expired or invalid.
   - Brute-force protection: Maximum 3 attempts (`max_attempts = 3`). Exceeding this marks the token unusable.

---

## 5. API Contracts & Security

All external communication with the service requires the `x-api-key` header matching the environment variable `INTERNAL_API_KEY`.

### Security Middleware

```http
x-api-key: <INTERNAL_API_KEY>
```
Requests without this header or with an invalid value return `401 Unauthorized` immediately.

---

### Endpoints

#### 1. Request Verification Token

- **Method**: `POST`
- **Path**: `/api/v1/auth/request-token`
- **Request Body**:

  ```json
  {
    "email": "user@company.com",
    "telegram_id": "1234567890"
  }
  ```
- **Response (200 OK / 201 Created)**:

  ```json
  {
    "success": true,
    "email": "user@company.com",
    "token": "489201",
    "expires_at": "2026-03-30T15:45:00.000Z"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Validation failure.
  - `401 Unauthorized`: Missing or invalid `x-api-key`.

---

#### 2. Verify Token & Bind Identity

- **Method**: `POST`
- **Path**: `/api/v1/auth/verify-token`
- **Request Body**:

  ```json
  {
    "token": "489201",
    "telegram_id": "1234567890"
  }
  ```
- **Response (200 OK)**:

  ```json
  {
    "success": true,
    "user": {
      "id": "c3a9f0e2-1234-5678-90ab-cdef12345678",
      "email": "user@company.com",
      "telegram_id": "1234567890",
      "status": "ACTIVE",
      "is_verified": true
    }
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Invalid token or maximum attempts exceeded.
  - `410 Gone`: Token has expired.
  - `409 Conflict`: `telegram_id` already linked to another active account.

---

#### 3. User Lookup (Fast Gatekeeping)

- **Method**: `GET`
- **Path**: `/api/v1/users/lookup`
- **Query Parameters**:
  - `telegram_id`: `string` (e.g. `?telegram_id=1234567890`)
  - `email`: `string` (e.g. `?email=user@company.com`)
  - `id`: `string` (e.g. `?id=uuid`)
- **Response (200 OK)**:

  ```json
  {
    "id": "c3a9f0e2-1234-5678-90ab-cdef12345678",
    "email": "user@company.com",
    "telegram_id": "1234567890",
    "status": "ACTIVE",
    "is_verified": true,
    "created_at": "2026-03-30T12:00:00.000Z"
  }
  ```
- **Error Responses**:
  - `404 Not Found`: No matching user found.

---

#### 4. Direct User Registration (Admin)

- **Method**: `POST`
- **Path**: `/api/v1/users`
- **Request Body**:

  ```json
  {
    "email": "user@company.com",
    "telegram_id": "1234567890",
    "status": "ACTIVE"
  }
  ```
- **Response (201 Created)**: Returns created user entity.

---

#### 5. List Users (Paginated)

- **Method**: `GET`
- **Path**: `/api/v1/users`
- **Query Parameters**:
  - `page`: `number` (default: `1`)
  - `limit`: `number` (default: `20`, max: `100`)
  - `status`: `PENDING` | `ACTIVE` | `BLOCKED` (optional filter)
- **Response (200 OK)**:

  ```json
  {
    "data": [
      {
        "id": "c3a9f0e2-1234-5678-90ab-cdef12345678",
        "email": "user@company.com",
        "telegram_id": "1234567890",
        "status": "ACTIVE",
        "is_verified": true,
        "created_at": "2026-03-30T12:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 54,
      "page": 1,
      "limit": 20,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
  ```

---

## 6. Project Directory Layout

```
src/
├── database/
│   ├── appDataSource.ts              # TypeORM DataSource with PostgreSQL configuration
│   ├── databaseConfig.ts             # Environment-driven database connection options
│   ├── entities/
│   │   ├── CoreEntity.ts             # Base entity (UUID id, timestamps, soft-delete)
│   │   ├── UserEntity.ts             # User domain entity
│   │   └── VerificationTokenEntity.ts# OTP token entity
│   └── migrations/                   # TypeORM migrations
├── middlewares/
│   ├── apiKeyAuth.ts                 # x-api-key verification middleware
│   ├── errorHandler.ts               # Global HTTP error handler
│   └── validateRequest.ts            # Zod validation middleware for body/query
├── modules/
│   ├── auth/
│   │   ├── auth.controller.ts        # Handlers for request-token and verify-token
│   │   ├── auth.service.ts           # OTP generation, hashing, and token verification logic
│   │   └── auth.schema.ts            # Zod input schemas
│   └── users/
│       ├── users.controller.ts       # Handlers for lookup, create, and list
│       ├── users.service.ts          # User persistence and querying logic
│       └── users.schema.ts           # Zod query/body schemas
├── utils/
│   ├── crypto.ts                     # Secure OTP generator and HMAC-SHA-256 hasher
│   └── errors.ts                     # Domain HTTP error classes
└── index.ts                          # Express application bootstrap and server listen
```

---

## 7. Environment Variables & Configuration

The application requires the following environment variables to run properly across different environments. Reference `.env.example` for local setup.

| Variable           | Type      | Default            | Description                                                                                      |
| :----------------- | :-------- | :----------------- | :----------------------------------------------------------------------------------------------- |
| `PORT`             | `number`  | `3000`             | Port on which the Express HTTP server listens.                                                   |
| `NODE_ENV`         | `string`  | `development`      | Runtime environment (`development`, `production`, `test`).                                       |
| `INTERNAL_API_KEY` | `string`  | _Required_         | Shared secret expected in the `x-api-key` header to authenticate n8n and internal HTTP requests. |
| `OTP_SECRET`       | `string`  | Optional           | Secret key used for HMAC-SHA-256 OTP hashing (falls back to `INTERNAL_API_KEY` if omitted).      |
| `DB_HOST`          | `string`  | `localhost`        | PostgreSQL server hostname or IP address.                                                        |
| `DB_PORT`          | `number`  | `5432`             | PostgreSQL server port.                                                                          |
| `DB_USER`          | `string`  | `postgres`         | Database username.                                                                               |
| `DB_PASSWORD`      | `string`  | `postgres`         | Database password.                                                                               |
| `DB_DATABASE`      | `string`  | `ipsistemas_users` | PostgreSQL database name.                                                                        |
| `DB_SSL`           | `boolean` | `false`            | Enables SSL for PostgreSQL connection (e.g. AWS RDS, Supabase, Neon).                            |
| `DB_LOGGING`       | `boolean` | `false`            | Enables TypeORM SQL query execution logging in console.                                          |
| `DB_SYNCHRONIZE`   | `boolean` | `false`            | Enables TypeORM schema synchronization. Keep `false` in production and use migrations.           |

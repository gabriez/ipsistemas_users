# System Architecture: `ipsistemas_users`

## 1. Overview & Objectives

`ipsistemas_users` is an access control and identity management microservice built with **Express**, **TypeORM**, and **MariaDB**. Its primary objective is to serve as a strict gatekeeper for an enterprise Telegram bot, preventing unauthorized usage and ensuring that only employees/users registered in **Outline** can interact with the bot.

The architecture decouples communication concerns from business rules:
- **Outline** acts as the corporate Identity Provider (IdP) source of truth.
- **n8n** handles bot event orchestration, Outline API checks, and email delivery via SMTP.
- **`ipsistemas_users`** owns identity binding, OTP verification lifecycle, user state transitions, and sub-20ms access gatekeeping.
- **MariaDB** enforces ACID transactional integrity and identity uniqueness.
- **Global Config Singleton**: Environment variables and runtime configurations are centralized, validated via Zod, and exposed as an immutable global singleton in `src/config/index.ts`.

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
                                      TypeORM │ (mysql2 pool)
                                              ▼
                                 ┌────────────────────────┐
                                 │    MariaDB Database    │
                                 └────────────────────────┘
```

---

## 3. End-to-End Workflows

### 3.1. Registration & Verification Request (`/register <email>`)

```
Telegram User         n8n                  Outline API           Express Backend            MariaDB
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
     │                 │                                                │    Save HMAC + TTL   │
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
Telegram User         n8n                                        Express Backend            MariaDB
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
Telegram User         n8n                                        Express Backend            MariaDB
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

## 4. Data Domain Model (MariaDB & TypeORM)

```
┌─────────────────────────────────────────┐
│                 users                   │
├─────────────────────────────────────────┤
│ id: VARCHAR(36) [UUID, PK]              │
│ email: VARCHAR(255) [UNIQUE, INDEX]     │
│ telegram_id: BIGINT [UNIQUE, NULLABLE]  │
│ outline_id: VARCHAR(255) [NULLABLE]     │
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
│          verification_tokens            │
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

### Invariants & Database Rules

1. **Telegram ID Safety**: Telegram user IDs are 64-bit integers exceeding JavaScript's `Number.MAX_SAFE_INTEGER` ($2^{53} - 1$). In MariaDB, the column is `BIGINT`. In TypeORM/TypeScript, it uses a custom column value transformer to serialize and deserialize as `string`.
2. **Email Normalization**: All emails are normalized to lowercase before validation and persistence.
3. **Cryptographic Token Storage**: OTP tokens are generated as 6-digit cryptographically secure pseudorandom numbers (`crypto.randomInt(100000, 999999)`). The database stores the HMAC-SHA-256 hash of the token (`token_hash`) using `config.security.otpSecret` (or `config.security.internalApiKey`) rather than plaintext. This guarantees that an external database dump cannot reverse-engineer 6-digit OTPs using rainbow tables without possessing the server's secret key.
4. **Token Expiration & Invalidation**:
   - TTL: 15 minutes (`expires_at = NOW() + INTERVAL '15 minutes'`).
   - Single-use: `used_at` timestamp set upon successful verification.
   - Replay protection: Any new token request automatically marks prior unconsumed tokens for that user as expired or invalid.
   - Brute-force protection: Maximum 3 attempts (`max_attempts = 3`). Exceeding this marks the token unusable.

---

## 5. API Contracts & Security

All external communication with the service requires the `x-api-key` header matching the environment variable `INTERNAL_API_KEY` (configured through the global config singleton).

### Security Middleware

```http
x-api-key: <INTERNAL_API_KEY>
```
Requests without this header or with an invalid value return `401 Unauthorized` immediately.

---

### Standard Response Envelope (Schema Specification)

Defined in `src/schemas/apiResponse.schema.ts` for schema validation and consumer contract adherence.

#### 1. Single Resource / Action (`createSuccessResponseSchema`)

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional human-readable confirmation"
}
```

#### 2. Paginated Collection (`createPaginatedResponseSchema`)

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

#### 3. Error Response (`errorResponseSchema`)

```json
{
  "success": false,
  "statusCode": 400,
  "error": "Validation failed",
  "details": [
    {
      "field": "email",
      "message": "Invalid email address"
    }
  ]
}
```

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
├── config/
│   └── index.ts                      # Centralized immutable AppConfig singleton (Zod validated)
├── database/
│   ├── appDataSource.ts              # TypeORM DataSource with MariaDB configuration
│   ├── databaseConfig.ts             # MariaDB connection options from config singleton
│   ├── columnTypes.ts                # Cross-dialect column type resolver (MariaDB / SQLite)
│   ├── entities/
│   │   ├── CoreEntity.ts             # Base entity (UUID id, timestamps, soft-delete)
│   │   ├── UserEntity.ts             # User domain entity
│   │   └── VerificationTokenEntity.ts# OTP token entity
│   └── migrations/                   # TypeORM migrations
├── middlewares/
│   ├── apiKeyAuth.ts                 # x-api-key verification middleware using config
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
├── schemas/
│   └── apiResponse.schema.ts         # Standard API envelope schemas (success, paginated, error)
├── utils/
│   ├── crypto.ts                     # Secure OTP generator and HMAC-SHA-256 hasher
│   └── errors.ts                     # Domain HTTP error classes
├── app.ts                            # Express application factory
└── index.ts                          # Express application bootstrap and server listen
```

---

## 7. Environment Variables & Configuration

The application requires the following environment variables, loaded and validated via the `config` singleton in `src/config/index.ts`. Reference `.env.example` for local setup.

| Variable           | Type      | Default               | Description                                                                                      |
| :----------------- | :-------- | :-------------------- | :----------------------------------------------------------------------------------------------- |
| `PORT`             | `number`  | `3000`                | Port on which the Express HTTP server listens.                                                   |
| `NODE_ENV`         | `string`  | `development`         | Runtime environment (`development`, `production`, `test`).                                       |
| `INTERNAL_API_KEY` | `string`  | _Required_            | Shared secret expected in the `x-api-key` header to authenticate n8n and internal HTTP requests. |
| `OTP_SECRET`       | `string`  | Optional              | Secret key used for HMAC-SHA-256 OTP hashing (falls back to `INTERNAL_API_KEY` if omitted).      |
| `DB_HOST`          | `string`  | `localhost`           | MariaDB server hostname or IP address.                                                           |
| `DB_PORT`          | `number`  | `3306`                | MariaDB server port.                                                                             |
| `DB_USER`          | `string`  | `ipsistemas_user`     | MariaDB database username.                                                                       |
| `DB_PASSWORD`      | `string`  | `ipsistemas_password` | MariaDB database password.                                                                       |
| `DB_ROOT_PASSWORD` | `string`  | `root_password`       | MariaDB root password for Docker initialization.                                                 |
| `DB_DATABASE`      | `string`  | `ipsistemas_users`    | MariaDB database name.                                                                           |
| `DB_SSL`           | `boolean` | `false`               | Enables SSL for MariaDB connection.                                                              |
| `DB_LOGGING`       | `boolean` | `false`               | Enables TypeORM SQL query execution logging in console.                                          |
| `DB_SYNCHRONIZE`   | `boolean` | `false`               | Enables TypeORM schema synchronization. Keep `false` in production and use migrations.           |

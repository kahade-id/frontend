# Full Backend–Frontend Integration Audit — 2026-09-09

## Executive summary

This is a source-to-source audit of:

- frontend `kahade-id/frontend` at `d10607be52cc009b580426b3a1e393e8c0533858`, plus the uncommitted phone-change implementation in this workspace;
- backend `kahade-id/backend` at `65f5d0fcc2c1f439e92c80fae67e5f3c58ebc3f8`;
- backend controllers, DTOs, services, guards and tests as ground truth;
- backend committed `openapi.json`, frontend full/mobile OpenAPI copies, generated frontend DTOs, adapters, callers and tests.

No production mutation was sent. The backend was cloned read-only for this audit.

The earlier conclusion “all adapters match OpenAPI” is true but insufficient. It proves only literal method/path membership against a stale document. A deeper source audit found several material contract defects.

### Overall assessment

| Area | Status | Main conclusion |
|---|---|---|
| Literal adapter method/path | Green | Frontend static check reports all adapter calls documented. |
| Backend source vs backend OpenAPI | **Red** | Backend source has phone-change routes and non-empty `TrustDeviceDto`, while committed backend OpenAPI omits/misdescribes them. |
| Phone change | Amber | Correct endpoints and DTO were added in the workspace, but post-confirm session revocation needs explicit UX handling. |
| Sessions vs devices | **Red** | Frontend passes a session ID to device trust endpoints and sends an empty DTO where backend requires a password. Trust/untrust cannot work reliably. |
| Blocked users | **Red** | Chosen settings endpoint returns nested block records; frontend renders them as flattened users. Alternate users endpoint already returns the expected shape. |
| Subscription benefits | Amber/Red | Endpoint exists in source. A 404 means either no active subscription or deployment mismatch; frontend discards both. Benefit `label` is not normalized to UI `title`. |
| Response contracts | **Red systemic** | Only 3 of 357 backend operations document a JSON success schema. Most frontend response types are assumptions. |
| Backend reproducibility | Amber | Backend has no lockfile. `npm ci` cannot run. Build requires Prisma generation and could not be reproduced in this sandbox because Prisma binary download was blocked. |

## Severity-ranked findings

### P0-1 — Session IDs are used as device IDs

**Evidence**

Backend `SessionsService.getActiveSessions()` returns:

```text
id, deviceInfo, ipAddress, lastActiveAt, createdAt, isCurrentSession
```

The `id` is `userSession.id`. It does not return `userDevice.id`.

Frontend `DeviceSession` assumes:

```text
id, deviceName, platform, browser, ip, location, current, trusted, lastActiveAt
```

`app/security-activity.tsx` calls:

```text
api.sessions.trustDevice(session.id)
api.sessions.untrustDevice(session.id)
```

but those endpoints are:

```text
PATCH /v1/users/me/devices/{deviceId}/trust
PATCH /v1/users/me/devices/{deviceId}/untrust
```

Backend resolves `{deviceId}` against the device resource, not the session resource.

**Impact**

- “current session” can be displayed incorrectly because backend uses `isCurrentSession`, frontend reads `current`;
- device name/IP fields are also mismatched;
- trust state is not present in the session response;
- trust/untrust receives the wrong resource ID and should normally return not-found;
- optimistic UI can claim trust changed even though the request cannot target the intended resource.

**Required decision**

Use one of these designs, not a hybrid:

1. Sessions tab: list/revoke sessions only; separate Devices tab sourced from `GET /v1/users/me/devices` for remove/trust/untrust.
2. Backend explicitly joins `userDevice` into session rows and returns a distinct `deviceId` plus normalized trust fields.

Never infer device ID equality from session ID.

### P0-2 — `TrustDeviceDto` is stale and trust UI omits mandatory re-authentication

Backend source DTO requires:

```text
password: string, 1..128
mfaCode?: exactly 6 digits
```

Backend committed OpenAPI describes `TrustDeviceDto` as empty. Generated frontend type is therefore `Record<string, never>`, and the adapter defaults to `{}`. The security screen has no password/MFA prompt.

**Impact:** even with a correct device ID, trust and untrust requests fail validation. This is both a functionality defect and a security UX defect because a sensitive operation must collect re-authentication deliberately.

**Fix:** regenerate backend OpenAPI from current source, regenerate frontend types, and require password plus conditional MFA in a secure action sheet/dialog. Add request contract tests for both endpoints.

### P0-3 — Backend OpenAPI is not source-current

Backend source includes:

```text
POST /v1/auth/phone-change/request
POST /v1/auth/phone-change/confirm
```

Backend committed OpenAPI contains 313 paths / 357 operations / 115 schemas and omits both routes and both DTOs. Frontend workspace OpenAPI now contains 315 paths / 359 operations / 117 schemas only because these contracts were manually reconstructed from source.

The same staleness is proven by `TrustDeviceDto`: source has required properties, OpenAPI says empty.

**Impact:** frontend path checks can be green while validating against a stale contract. Generated TypeScript can be structurally wrong even where method/path matches.

**Fix:** make backend `openapi:generate` a required CI artifact check and publish the exact generated file/version. Frontend should ingest a pinned backend artifact, not hand-maintain corrections indefinitely.

### P1-1 — Blocked-users canonical endpoint currently has the wrong response shape for the frontend

Frontend calls `GET /v1/settings/blocked-users` and expects flattened rows:

```text
{id, username, fullName, avatarUrl, blockedAt}
```

Backend settings service returns paginated raw block records with the user nested under `blocked`:

```text
{data: [{id, createdAt, blocked: {id, userId, username, ...}}], meta: ...}
```

Frontend `readList()` unwraps the list but does not flatten `blocked`, so `username`, `fullName`, and `avatarUrl` are undefined and `id` is a block-record ID. The subsequent unblock call expects a target user identifier, not the block-record ID.

Backend `GET /v1/users/me/blocked` already returns the mobile-friendly shape:

```text
{users: [{userId, username, fullName, avatarUrl, blockedAt, blockId}], total, page, limit}
```

**Decision:** canonicalize mobile on `/v1/users/me/blocked`, normalize `userId → id`, and continue using `/v1/settings/block/{userId}` only if product policy confirms it is the canonical mutation. Add list→unblock ID consistency tests.

### P1-2 — Subscription benefits has two distinct 404 meanings and a field mismatch

Backend source definitely implements `GET /v1/subscriptions/benefits`. It intentionally returns 404 with backend code `NO_ACTIVE_SUBSCRIPTION` when the account lacks an active/current subscription. Therefore a live 404 alone does **not** prove the route is undeployed; the backend code must be inspected.

Frontend does catch `NO_ACTIVE_SUBSCRIPTION` as an empty list, and the screen adds a broader `.catch(() => [])`, making network, auth, deployment and malformed-response failures indistinguishable from “no active subscription.”

Backend benefits use:

```text
{key, label, description}
```

Frontend expects:

```text
{key, title, description}
```

No `label → title` normalizer exists.

**Impact:** active subscribers can see blank benefit titles; operational failures are silently represented as no benefits.

**Fix:** normalize `label` to `title`; treat only `NO_ACTIVE_SUBSCRIPTION` as empty; render a nonfatal but honest warning for route/network/shape failures.

### P1-3 — Phone-change success revokes the current session

Backend confirmation transaction revokes every active session and untrusts every trusted device, then returns success. Frontend currently attempts `profile.refresh()` immediately after confirmation. The refresh can receive 401 and trigger the global session-expired flow before or during success navigation/toast.

**Fix:** model confirmation as `successRequiresLogin`. Clear local credentials/session deterministically after receiving success, show a dedicated success state, then navigate to login. Do not depend on an authenticated profile refresh after backend-wide revocation. If product insists on returning to Security, backend policy must exempt/reissue the current session.

### P1-4 — Response schemas are systemically absent

Of 357 backend OpenAPI operations, only **3** document a JSON success schema. Error response documentation is also sparse. This explains the many frontend `UNVERIFIED` types and permissive normalizers.

Method/path checks cannot detect:

- `isCurrentSession` vs `current`;
- `deviceInfo` vs `deviceName`;
- nested `blocked` vs flattened user;
- benefit `label` vs `title`;
- paginated envelope vs plain array;
- ID aliases (`userId`, `orderId`, `txId`).

**Fix:** prioritize response DTOs for auth, users, sessions/devices, wallet, orders, subscriptions, blocked users and uploads. Generate fixture/contract tests from those schemas.

### P2-1 — Username availability is authenticated and cannot serve pre-auth registration

`GET /v1/users/availability` is protected by the global JWT guard and is currently unused. It is appropriate for authenticated setup/edit flows, not registration before login. Do not add it to pre-auth registration unless backend intentionally makes a rate-limited public variant.

When implemented for authenticated screens: debounce, AbortSignal cancellation, strict local syntax validation, and distinct available/taken/network states are required.

### P2-2 — User search endpoints are intentionally specialized

The current endpoint split is coherent:

- `/v1/search` — global cross-entity search;
- `/v1/users/discover` — discovery/filter;
- `/v1/wallet/transfer/lookup` — transfer recipient lookup;
- `/v1/users/search` — potential user autocomplete, currently without a proven caller.

Do not replace global search or transfer lookup with `/v1/users/search`. Defer until a concrete autocomplete UX exists.

### P2-3 — Export, OG and upload alternatives are not missing-screen defects

- Keep CSV/PDF wallet export because it maps directly to current UX; generic `/v1/wallet/export` would duplicate it.
- Keep user OG metadata out of the native profile dependency chain; it is web/share metadata.
- Direct multipart plus confirm is a valid mobile upload strategy. External object-storage requests must continue omitting app auth/cookies. Presigned response aliases `url` and `uploadUrl` are already normalized.

## Feature/route classification matrix

| Candidate | Classification | Current decision |
|---|---|---|
| Phone change request/confirm | Missing user-facing feature | Implement, then correct post-success session UX. |
| Username availability | Deferred user-facing | Authenticated profile/setup only; not pre-auth registration as currently guarded. |
| `/v1/users/search` | Deferred user-facing | No proven caller; preserve existing specialized endpoints. |
| Sessions list/revoke | User-facing canonical resource | Keep for session operations only. |
| Devices list/remove/trust | Missing/incompletely connected feature | Build from device endpoint; never pass session IDs. |
| `/v1/settings/blocked-users` | Unsuitable alternate for current model | Switch list to flattened users endpoint or add explicit nested normalizer and ID mapping. |
| `/v1/users/me/blocked` | Better mobile canonical endpoint | Recommended. |
| Presigned avatar/header | Intentional alternate | Direct multipart+confirm may remain canonical mobile path. |
| Subscription benefits | User-facing with contract mismatch | Keep nonfatal, fix 404 discrimination and `label` normalization. |
| Generic wallet export | Intentional alternate | Keep format-specific CSV/PDF actions. |
| Public profile OG | Backend/web metadata | No native screen dependency. |
| Webhooks, health, cron checks | Backend-only | Exclude from mobile adapters/spec surface. |
| `/v1/admin/**` | Admin-only | Exclude from mobile generated types and route inventory. |

## Phone-change contract verification

Backend source DTOs were verified directly.

### Request

`POST /v1/auth/phone-change/request`, authenticated:

```text
newPhoneNumber: string, max 20
method: SMS | WHATSAPP
currentPassword: string, 1..256
mfaCode?: 6-digit TOTP or 10–16 alphanumeric backup code
```

No body `deviceId` is accepted. Shared device headers are sufficient for frontend transport metadata.

The endpoint uses a 5 requests / 15 minute user throttle. OTP service also has a 60-second cooldown, but successful controller response exposes only `{message}`. The frontend must not invent a countdown from this implementation detail.

### Confirm

`POST /v1/auth/phone-change/confirm`, authenticated:

```text
newPhoneNumber: string, max 20
code: exactly 6 digits
```

The service validates OTP purpose, user ID and phone hash, consumes once transactionally, prevents phone ownership conflicts, changes the number, revokes all sessions, and untrusts all devices.

Relevant backend codes include `OTP_INVALID` and `TWO_FA_REQUIRED`; HTTP 429 covers throttling/cooldown. Frontend should branch primarily on stable backend codes/status, not English message text.

## Security and transport observations

- Both phone-change mutations correctly require authentication in the workspace adapter.
- OTP/password/MFA remain transient component state; no persistent storage was found in the phone screen.
- Shared client rejects absolute API paths, reducing credential leakage to object storage.
- Presigned upload transport explicitly omits credentials.
- Mutations are not automatically retried by the shared client, which is correct for OTP consumption and financial operations.
- Session revocation is persisted in PostgreSQL and propagated to Redis; backend intentionally treats Redis propagation failure as non-fatal after durable revocation.
- Sensitive trust-device operations require re-authentication in backend source, but frontend currently cannot satisfy it.

## Contract/testing gaps

Required tests, ordered by risk:

1. Device list fixture proving `deviceId`, `sessionId`, `current`, `trusted`, platform/browser and timestamps are separately normalized.
2. Session revoke uses session ID; device remove/trust/untrust uses device ID.
3. Trust/untrust sends required password and optional six-digit MFA.
4. Blocked-user list normalizes `userId → id`; unblock sends that user ID, never `blockId`.
5. Subscription benefit `label → title`; only `NO_ACTIVE_SUBSCRIPTION` maps to empty.
6. Phone wrong/expired OTP (`OTP_INVALID`), 429, `TWO_FA_REQUIRED`, malformed response and post-success forced login.
7. Public response alias fixtures for `userId → id`, `orderId → id`, and `txId → id`.
8. Every response normalizer must reject malformed shapes locally without throwing during React render.

## Verification performed

### Frontend

Before this deeper audit, the workspace passed:

- typecheck;
- lint;
- strict spec/API checks;
- full `npm run check`;
- 25 test files / 276 tests.

Those results remain useful but do not invalidate the source-level findings above.

### Backend

- Repository and commit were verified through GitHub.
- 561 source files and 44 controllers were available for inspection.
- Committed backend OpenAPI: 313 paths, 357 operations, 115 schemas.
- Frontend workspace full OpenAPI: 315 paths, 359 operations, 117 schemas.
- Exact source-only delta identified: the two phone-change operations/DTOs.
- `npm ci` could not run because the backend repository has no lockfile.
- A best-effort `npm install` completed, but build initially lacked generated Prisma types. Prisma generation then failed because the sandbox could not download the Prisma engine binary. Therefore this report does not claim backend build/test success.

## Remediation plan

### Phase 0 — Contract authority

1. Regenerate backend OpenAPI from current source, including phone change and real `TrustDeviceDto`.
2. Add backend CI that fails when committed OpenAPI differs from generated output.
3. Add a lockfile and a clean reproducible build job including `prisma generate`.
4. Pin the backend commit/OpenAPI digest consumed by frontend.

### Phase 1 — Security/resource correctness

1. Split session and device models/adapters/screens.
2. Implement authenticated device listing and correct ID routing.
3. Add password/MFA trust confirmation UX.
4. Change phone-confirm success to deterministic forced-login UX.

### Phase 2 — Data-shape correctness

1. Canonicalize blocked users on `/v1/users/me/blocked` and normalize IDs.
2. Normalize subscription benefits and preserve honest nonfatal errors.
3. Add explicit response DTOs/normalizers for the highest-risk domains.

### Phase 3 — Deferred features

1. Add authenticated username availability where product UX requires it.
2. Add user autocomplete only with a concrete caller.
3. Add OG/share integration only for web/deep-link preview requirements.

## Final conclusion

The integration is not suffering from widespread wrong URL literals. Its primary risk is **semantic contract drift hidden behind a green method/path audit**. The highest-risk examples are session/device identity, the stale trust DTO, blocked-user nesting/IDs, and subscription benefit shape/error collapsing. Correcting OpenAPI authority first is essential; otherwise regenerated frontend types will continue to encode stale backend behavior.

# GurkyNet Mobile App — Audit Report (Pre-Implementation)

Audit performed before any mobile code was written, per the 21-point checklist requested.
Source: full read of `laravel/routes/api.php` (all ~760 lines) plus the relevant
controllers/actions/services, and the existing web frontend (`src/services/api.ts`,
`src/store/auth.store.ts`, `src/services/storage.service.ts`, `src/index.css`).

## 1. Does a mobile app already exist?

**No.** `apps/mobile/README.md` is a Sprint 0 placeholder: *"Folder placeholder saja. Stack
mobile belum dipilih... Jangan mulai implementasi di sini sampai stack dikonfirmasi."* No
`app.json`, `metro.config.js`, `pubspec.yaml`, or `capacitor.config.*` exists anywhere in the
repo. `apps/partner-portal` is a separate, unrelated static site (API-partner docs), not a
mobile app. This is a genuine greenfield build, not a continuation.

## 2. Current mobile structure

None beyond the placeholder README above.

## 3. Framework used/available

None chosen yet — this audit's job includes recommending one (see "Stack decision" below).
The repo root is a **plain npm project, not a workspace monorepo** (`package.json` has no
`workspaces` field) — `apps/*` is a folder convention only, not wired into any build tool.

## 4–17. API surface (full detail; condensed here, see inline route tables)

Every endpoint below is real, already live in `laravel/routes/api.php`, and was verified by
reading the controller/action, not assumed from naming.

**Auth**: `POST /auth/register` (email-OTP, multi-step: register → `/auth/otp/verify` →
`/auth/register/finalize` with PIN) → `POST /auth/login` (password) → `POST
/auth/login/pin` (quick PIN login, device-trust gated) → `POST /auth/logout` → `GET
/auth/me` → `GET /auth/session` → `POST /auth/refresh`. 2FA machinery
(`requires_2fa`/`/auth/login/2fa/verify`) exists and is fully wired, but
`LoginUserAction::TWO_FACTOR_ROLES` is currently an **empty array** ("kosong sesuai
permintaan Owner") — no role triggers it today; build the UI to handle the response shape
defensively, but it won't fire in practice right now.

**Google login**: exists (`GET /auth/google/redirect`, `GET /auth/google/callback`, `POST
/auth/google/complete`) but is a **web-redirect/webview flow that returns the Sanctum token
in a URL query string** on the callback redirect to `FRONTEND_URL` — not a mobile-native
ID-token exchange. **Flagged as a gap, not built in Fase 1** (see "Backend changes
identified but not made" below).

**Wallet**: `GET /wallet` (balance + `recent_transactions`), `GET /wallet/history`
(paginated mutation ledger, filterable), `GET /wallet/payment-config` (Midtrans Snap
bootstrap, safe/public-ish config only), `POST /wallet/topup`, `POST
/wallet/deposit-manual`, `POST /wallet/transfer`, `POST /wallet/withdraw`.

**Top Up (Midtrans)**: `POST /wallet/topup` returns `{transaction, snap_token, redirect_url,
payment, midtrans}`. **Confirmed the web app never trusts Snap's `onSuccess`/`onClose`
callback for settlement** — every callback path calls `POST
/transactions/{id}/sync-payment`, which actively reconciles against Midtrans if the local
status isn't terminal yet, and only that response's `status` field ever flips the UI to
success. The public `POST /webhooks/midtrans` (signature-verified) is the other real
settlement path, processed async via a queued job. Mobile must mirror this exactly — no
client-side "payment succeeded" state ever.

**Transfer**: `POST /wallet/transfer` — recipient identified by **wallet number** (not
phone/username), PIN required, KYC Tier 1 required, idempotency key required.

**Withdraw**: `POST /wallet/withdraw` — **Agent-only** (`user_type==='agent'`), gated by
`WITHDRAW_ENABLED` (absent from `.env` → **disabled by default today**), plus KYC Tier 2
approval + bank-name-matches-KTP-name check. Deprioritized out of Fase 1–7 scope for a
counter-staff consumer app unless the user says otherwise.

**Transactions**: `GET /transactions` (list), `GET /transactions/{id_or_invoice}` (detail),
`POST /transactions` (create — the actual purchase call), `POST
/transactions/{id}/cancel`, `POST /transactions/{id}/sync-payment`, `GET
/transactions/{id}/receipt` (JSON), `GET /transactions/{id}/receipt.pdf` (dompdf,
force-download headers — mobile just treats it as a PDF blob and offers native
share/save). Receipt JSON `transaction_details` has ~35 possible fields covering every
product type (PLN token, voucher digital/internet, game, e-wallet, pajak, langganan) — build
the receipt renderer to only show fields that are actually present, never a hardcoded field
list.

**Notifications**: `GET /notifications`, `PUT /notifications/read-all`, `PUT
/notifications/{id}/read`, `DELETE /notifications/{id}`. Payload has `transactionId` /
`invoiceNumber` for deep-linking, no generic URL field — mobile constructs the target route
itself. **No real-time push delivery today**: device/push-token registration endpoints exist
(`POST /devices/register`, `POST /devices/push-token`) and the backend can call the legacy
FCM HTTP API, but `FCM_SERVER_KEY` is empty in this environment (no-op), there's no APNs
implementation at all, and most notification-creation call sites don't even include `'push'`
in their channel list. **Also confirmed: no WebSocket/Pusher/Reverb exists anywhere** —
`config/broadcasting.php` doesn't exist, no `PUSHER_*`/`REVERB_*` env vars, no
`ShouldBroadcast` event, package not installed. The `event(...) → BroadcastEvent` calls
referenced in logs only `Log::info(...)` — pure scaffolding. **Real-time today = a homegrown
SSE endpoint (`GET /realtime/stream`) plus a polling fallback (`GET /realtime/poll`)**,
auth'd via Bearer token, channel-gated (`wallet.{userId}`, `user.notifications.{userId}`,
`chat.*`). Only wallet-balance-change and chat events are actually published to it — generic
inbox notifications are **not** pushed through this channel. **Mobile decision: use `GET
/realtime/poll` (simpler over a mobile HTTP client than reading an SSE stream) for
wallet-balance nudges, and plain re-fetch/polling of `GET /notifications` and `GET
/transactions/{id}` for status — do not build against a WebSocket that doesn't exist.**

**Product catalog**: fully public (no auth), `GET /products`, `GET /products/{sku_code}`,
`GET /categories`, `GET /providers`, `GET /catalog/*` (taxonomy/search/zones). Same catalog
Web reads — confirmed in the prior product-sync audit this session that Operations and User
read the identical synced `products` table; the mobile app will be a third reader of the
exact same endpoints, nothing provider-specific ever leaks into the response.

**KYC**: `GET /kyc/status`, `GET /kyc/withdraw-eligibility`, `POST
/kyc/tier1/{phone,email}/{request,verify}`, `POST /kyc/tier2/submit` (KTP photo + selfie +
bank account, all required), `GET /kyc/verifications/{id}`, `GET
/kyc/verifications/{id}/documents/{type}`. **`PURCHASE_KYC_REQUIRED=false` confirmed as the
live default** (`config/features.php`, gate call-site in
`CreateTransactionAction`/`IdentityVerificationGate::assertTier1RequiredForPurchase`) — Tier
1 does **not** currently block a purchase. Build the Tier-1 verification screens anyway
(cheap, and protects against Ops flipping the flag on later) but don't treat KYC as a Fase
1–3 blocker for the purchase flow itself.

**PIN management — three parallel, overlapping endpoint sets exist** (`/pin/*` under
`AccountController`, `/account-security/pin/*` under `AccountSecurityController`, and `PUT
/profile/pin`). **Decision made for the mobile app** (not a backend change — purely which
existing endpoints the client calls): use `POST /pin/create` (first-time) and `PUT
/pin/change` (`old_pin`/`pin`/`pin_confirmation`, in-session change) for the common cases,
and the public, truly-unauthenticated `POST /auth/pin/forgot/request` + `POST
/auth/pin/forgot/confirm` (email-OTP based) for genuine "forgot PIN" recovery — this is the
only one of the three PIN systems with a real logged-out recovery path.

**Referral**: `GET /referral` (code + counts + commission totals), `GET
/referral/history`, `GET /referral/downlines`, `PUT /referral/code`. No shareable-link
field exists server-side — mobile builds the share text/link client-side from the code.

**Loyalty/Points**: `GET /loyalty` (balance + tier), `GET /loyalty/history`, `POST
/loyalty/redeem` (→ credits wallet directly, min 100 points, idempotency-keyed). No
user-facing "earn" endpoint — points accrue server-side as a side effect of transactions.

**Subscriptions (auto-reorder)**: full CRUD — `GET/POST /subscriptions`, `PUT
/subscriptions/{id}`, `POST /subscriptions/{id}/{pause,resume,cancel}` — `resume` requires
PIN.

**Account/Profile**: `GET/PUT /profile`, `PUT /profile/password`, `PUT
/profile/notification-preference`, `POST /profile/avatar`, `GET /profile/security`,
session-revoke endpoints (`DELETE /profile/sessions[/{id}]`).

**Support**: `GET/POST /chat/conversation`, message send/read, plus a separate ticket-style
`GET/POST /complaints` flow. Both real, both scoped to the caller's own data.

## 18. What's NOT available (confirmed absent, not guessed)

- Mobile-native Google Sign-In (ID-token exchange) endpoint.
- Any real-time push transport (WebSocket/Pusher/Reverb) or working push notification
  delivery (FCM key unset, no APNs).
- A generic notification deep-link URL field (only `transactionId`/`invoiceNumber`).
- A dedicated `/wallet/mutations` endpoint (it's `/wallet/history`).
- A referral share-link field.
- `WITHDRAW_ENABLED` in `.env` (defaults false; also Agent-only regardless).

## 19. What must be built new (mobile side only — zero backend changes required for Fase 1–8)

Everything is a client. No new Laravel endpoint is required for login, wallet, catalog,
checkout/PIN, transaction lifecycle, receipt, notifications (polling-based), top-up,
transfer, KYC Tier 1, referral, or loyalty — all already exist and were verified above.

## 20. What can be reused from web (patterns, not UI)

- **Auth store shape** (`src/store/auth.store.ts`): `normalizeUserPayload`/`normalizeRole`
  logic, the exact 2FA-challenge object shape, the same `login`/`pinLogin`/`logout`/`fetchUser`
  responsibilities — ported to the mobile Zustand store rather than re-derived.
- **API client pattern** (`src/services/api.ts`): the same `parseApiError()` mapping (never
  raw Laravel/provider errors), the same 401 handling contract (clear stored
  token+user, dispatch an app-level "session expired" event — RN has no `window`, so this
  becomes a tiny in-app event emitter), the same request header set
  (`X-Device-UUID`, `X-Platform`, now `android`/`ios` instead of `'web'`).
- **Storage key names** (`src/services/storage.service.ts`): reused verbatim
  (`gurkynet_auth_token`, `gurkynet_user_data`, `gurkynet_device_uuid`,
  `gurkynet_remembered_identity`, `gurkynet_trusted_device_identities`) — same keys, now
  backed by `expo-secure-store` (Keychain/Keystore) instead of `localStorage`, so a future
  debugging session sees the same names Web engineers already know.
- **Brand tokens** (`src/index.css` `@theme`): the exact primary teal/emerald scale
  (`#edfcf6` → `#0b3d36`) and accent gold scale, plus the "Plus Jakarta Sans" font — ported
  as a TypeScript theme module, not re-invented.
- **Idempotency-key convention**: every balance-mutating POST (transfer, withdraw, topup,
  loyalty redeem, transaction create) requires a client-generated `idempotency_key` — mobile
  generates one per logical action the same way web does (`crypto.randomUUID()`-equivalent,
  `expo-crypto`), reused across PIN retries of the *same* attempt, cleared only after
  success.

## 21. Technical risks to watch

1. **No real-time transport** — every "wait for status to change" screen (payment pending,
   transaction pending, bulk voucher batch) must be built as a poll loop from day one, not
   retrofitted later.
2. **Three PIN endpoint families** — a decision was made above to standardize the mobile
   client on one path per use case; if Ops/backend later consolidates these, only the mobile
   API-service layer needs updating, not the UI.
3. **Google login is not mobile-native** — excluded from Fase 1; needs an explicit decision
   (deep-link interception of the existing webview redirect vs. a new backend endpoint)
   before it's built at all.
4. **`FRONTEND_URL`-based redirects** (Google OAuth today, possibly elsewhere) assume a
   browser context — anything mobile intercepts via deep link needs the redirect target
   registered as an Android App Link / iOS Universal Link for `gurkynet.my.id`, which is an
   infra/domain-config task outside this repo's code.
5. **Push notifications are inert today** — don't promise them in the UI copy; register the
   device/token anyway (harmless, future-proofs) but design the notification experience
   around polling for Fase 1–6.

## Stack decision (delegated by the task; documented, not asked)

**Expo (React Native) + TypeScript, using `expo-router`** for file-based navigation,
**Zustand** for state (identical library to web — same mental model, direct pattern reuse),
**axios** for HTTP (same library, same interceptor shape as web), **expo-secure-store** for
token/session storage (Keychain/Keystore — satisfies the "no insecure credential storage"
rule), and **NativeWind** (Tailwind for React Native) so the exact color/spacing tokens
above can be lifted from `src/index.css` instead of re-derived by eye. `apps/mobile` is a
**standalone project** (its own `package.json`/`node_modules`) — the repo root has no
workspace tooling configured, and React Native's Metro bundler is finicky about hoisted
monorepo dependency trees, so bolting on a workspace layer was judged higher-risk than
worth it for this pass. Where a truly shared, pure-TypeScript type or utility is worth
reusing later (no DOM dependency), Metro's `watchFolders` can be configured to read directly
from `src/types`/`src/utils` without full workspace tooling — left as a Fase 2+ decision
once it's clear which types actually need to stay in sync, rather than wiring it
speculatively now.

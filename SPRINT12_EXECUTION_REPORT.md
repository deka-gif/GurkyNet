# SPRINT 12 EXECUTION REPORT
## Keamanan Tambahan (Bagian 17) + KYC Agen (Bagian 21)

**Status:** READY FOR VERIFICATION  
**Date:** 2026-08-27  
**Mode:** Implementation complete — awaiting user verification  
**SRS:** GurkyNet v2.2 CLEAN — Bagian 8.1, 17, 21 (FR-KYC-01..05), FR-USR07

---

## Locked decisions (honored)

| Decision | Implementation |
|----------|----------------|
| Agent identity via `user_type=agent` + `agent_level` | No `UserRole::AGENT` |
| KYC reviewers = CS + Finance | Shared `KycReviewController` on both admin prefixes |
| Tier 1 enforcement on new transactions only | Login/profile/help unaffected; historical rows untouched |
| Anomaly/fraud | **Deferred** |
| Operations 2FA | **Deferred** |
| `WITHDRAW_ENABLED=false` | Gate remains OFF; eligibility wired for future |

Feature gates remain OFF in production config:
- `PURCHASE_ENABLED=false`
- `WITHDRAW_ENABLED=false`
- `AUTO_TOPUP_ENABLED=false`

---

## SRS requirements covered

### Security (Bagian 8.1 / 17)
- **2FA Finance/Owner** — backend challenge reused; FE LoginPage + `auth.store` handle `requires_2fa` / verify / wrong OTP / expiry
- **Rate limiting** — named limiters: `login`, `otp`, `password-reset`, `financial`, `kyc-upload`
- **Session revoke** — existing SessionAction; revoked token cannot authenticate
- Encrypted secrets / webhook signatures — **left intact** (Sprint 10/11)

### KYC (Bagian 21)
- `kyc_verifications` migration (reversible, additive)
- `phone_verified_at` on users (reversible, additive)
- Tier 1: phone OTP + email OTP endpoints; gate on purchase/transfer
- Tier 2: KTP + selfie + bank fields; pending → approve/reject; resubmit after reject
- FR-KYC-03: local bank account name ↔ KTP name match (no fake external bank API)
- FR-KYC-05: CS & Finance review queues
- Private disk storage (`local` / `storage/app/private`); authorized document download only
- Profile `kycStatus` / `kyc` payload without NIK or public URLs
- ActivityLog: `KYC_SUBMIT`, `KYC_APPROVE`, `KYC_REJECT`
- Withdraw eligibility: agent + Tier 1 + Tier 2 approved + bank match (gate still OFF)

---

## Key files

### Backend
- `laravel/database/migrations/2026_08_27_120001_add_phone_verified_at_to_users_table.php`
- `laravel/database/migrations/2026_08_27_120002_create_kyc_verifications_table.php`
- `laravel/app/Models/KycVerification.php`
- `laravel/app/Services/Kyc/*` (IdentityVerificationGate, KycService, KycDocumentStorage, BankAccountNameMatcher, WithdrawEligibilityService)
- `laravel/app/Http/Controllers/Api/v1/KycController.php`
- `laravel/app/Http/Controllers/Api/v1/Admin/KycReviewController.php`
- `laravel/app/Http/Resources/KycVerificationResource.php`
- Wired: `CreateTransactionAction`, `TransferWalletAction`, `WithdrawWalletAction`
- `AppServiceProvider` RateLimiter configs; `routes/api.php` KYC + named throttles

### Frontend
- `src/pages/auth/LoginPage.tsx` — 2FA challenge UI
- `src/store/auth.store.ts` / `src/services/auth/auth.service.ts`
- `src/pages/dashboard/account/AccountKycPage.tsx`
- `src/pages/dashboard/KycReviewPages.tsx`
- `src/services/kyc/kyc.service.ts`
- Routes: `/dashboard/account/kyc`, `/dashboard/customer-support/kyc`, `/dashboard/finance/kyc`

### Tests
- `laravel/tests/Feature/Sprint12SecurityKycTest.php` (19 tests)
- `TestCase::seedApprovedAgentKyc()` for legacy withdraw regression under new eligibility
- Sprint3 / Sprint4 withdraw tests seeded as approved agents

---

## Tests

| Suite | Result |
|-------|--------|
| `Sprint12SecurityKycTest` | **19 passed** |
| Full `php artisan test` | **724 passed / 1 failed** |
| Known pre-existing failure | `FinanceTest::finance_user_can_list_settlements` (`meta.pagination`) — **not Sprint 12** |
| Sprint3–4 withdraw regression | **PASS** after KYC eligibility seed helper |

Coverage includes: 2FA success/fail/expiry/missing token, login/OTP/financial 429, session revoke, Tier 1 phone/email blocks, KYC upload/MIME/size/private storage, IDOR, CS/Finance review, reject reason, resubmit, bank match, withdraw gate OFF + eligibility.

---

## Regression

| Check | Result | Notes |
|-------|--------|-------|
| Full PHPUnit | 724 pass / 1 fail | Only known Finance settlements pagination |
| `npm run lint` | exit 2 | Pre-existing TS debt (interval literals, finance.store, RealtimeManager, homepage animation) — **no new Sprint 12-specific errors listed** |
| `npm run build` | fail | Pre-existing `RealtimeManager.ts` unresolved `../../api` — **not introduced by Sprint 12** |

---

## Findings

1. **Bank verification** is local string match only (FR-KYC-03). External bank name verification API is a **dependency** for later if product requires it.
2. **KYC photo columns** store private relative paths (not public URLs), despite SRS naming `*_url` — intentional safety.
3. **Test client sticky auth**: after authenticated requests, `auth->forgetGuards()` needed to assert revoked token 401 (test harness quirk; production Sanctum behaves correctly).
4. Legacy withdraw tests now require `seedApprovedAgentKyc()` when exercising real withdraw paths with gates ON in TestCase.

---

## Out of scope (not done)

- Anomaly / fraud engine
- Operations 2FA
- `UserRole::AGENT` enum
- KYC Tier 3
- Purchase / withdraw / auto-topup production go-live
- Legal/tax (Bagian 22)
- Sprint 13+
- DIFF / H2H / provider rewrite
- WebSocket rewrite
- Webhook IP allowlist

---

## Completion gate

### SECURITY
- [x] Finance 2FA
- [x] Owner 2FA
- [x] login rate limit
- [x] OTP rate limit
- [x] sensitive-action rate limit
- [x] session revoke
- [x] encrypted secrets intact
- [x] webhook signatures intact
- [x] IDOR protection

### KYC
- [x] kyc_verifications
- [x] Tier 1 phone
- [x] Tier 1 email
- [x] Tier 2 KTP
- [x] Tier 2 selfie
- [x] pending / approved / rejected
- [x] reviewer CS / Finance
- [x] rejection reason
- [x] resubmit
- [x] private storage / no public document URL
- [x] IDOR protected
- [x] audit log
- [x] bank name match

### WITHDRAW
- [x] KYC eligibility wired
- [x] gate remains OFF
- [x] no production withdraw

### TEST
- [x] Sprint12SecurityKycTest PASS
- [x] Sprint3–11 regression checked (full suite minus known Finance pagination)
- [x] no new Sprint 12 regression

### SCOPE
- [x] no fraud/anomaly
- [x] no Operations 2FA
- [x] no Agent role enum
- [x] no Sprint13+
- [x] no purchase/withdraw go-live

---

## Final

**SPRINT 12 READY FOR VERIFICATION**

STOP — do not start Sprint 13 until user confirms.

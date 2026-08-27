# SRS 24 — Manual Test Kit (Staging Only)

**SRS:** Bagian 24 — Skenario Kritis  
**Sprint:** 19  
**Date:** 2026-08-28  
**Status:** CHECKLIST PREPARED — **no scenarios executed or marked PASS**

---

## Global rules

- **Environment:** Staging only — never production provider keys or production Midtrans
- **Testers:** Tester A + Tester B (2 people / 2 devices where noted)
- **Financial flags:** Default OFF; enable only with Owner written approval in `docs/OWNER_GO_LIVE_DECISIONS.md`
- **Evidence folder:** `docs/evidence/srs24-{YYYYMMDD}/scenario-{N}/`
- **Do not claim PASS** until both testers sign the scenario row

### Staging prerequisites (all scenarios)

- [ ] Staging FE + API URLs documented and reachable
- [ ] `MIDTRANS_IS_PRODUCTION=false`
- [ ] Digiflazz/VIP test credentials configured
- [ ] Test User: saldo known, Tier-2 KYC for withdraw tests
- [ ] DB read access for verification queries
- [ ] Screen recording enabled

---

## Scenario 1 — Double-click purchase

| Field | Detail |
|-------|--------|
| **SRS #** | 24.1 |
| **Staging only** | ✅ |
| **Prerequisite** | `PURCHASE_ENABLED=true` on staging (Owner approval); User saldo ≥ product price; same SKU + target number |
| **Tester A** | Tab/device 1 — logged in as test user |
| **Tester B** | Tab/device 2 — same account |

### Steps

1. Both open same product checkout (pulsa/data, fixed SKU + `target_number`).
2. Coordinate countdown; both press **Beli/Konfirmasi** within 500ms.
3. Record API responses and final UI state on both devices.
4. Query wallet and transactions.

### Expected result

- Saldo debited **once**
- Exactly **one** purchase transaction (excluding unrelated history)
- If same `idempotency_key` replayed: same `data.id`, no second debit

### Evidence to save

- [ ] Screen recording (both devices)
- [ ] `GET /api/v1/wallet` before/after JSON
- [ ] `GET /api/v1/wallet/history` excerpt
- [ ] `GET /api/v1/transactions` filtered by time
- [ ] DB: `SELECT COUNT(*) FROM transactions WHERE user_id=? AND created_at > ?`
- [ ] DB: `SELECT COUNT(*) FROM wallet_mutations WHERE wallet_id=? AND type='hold' AND created_at > ?`

| Pass/Fail | Tester A | Tester B | Date |
|-----------|----------|----------|------|
| ☐ PASS ☐ FAIL | | | |

---

## Scenario 2 — Concurrent withdraw

| Field | Detail |
|-------|--------|
| **SRS #** | 24.2 |
| **Staging only** | ✅ |
| **Prerequisite** | `WITHDRAW_ENABLED=true` on staging (Owner approval); Tier-2 KYC approved; saldo Rp15.000; withdraw Rp12.000 each |
| **Tester A** | Submit withdraw with `idempotency_key` A |
| **Tester B** | Submit withdraw with `idempotency_key` B (different) |

### Steps

1. Both open withdraw form (two tabs/devices).
2. Submit Rp12.000 simultaneously with **different** idempotency keys.
3. Record HTTP status codes and messages.

### Expected result

- Exactly **one** withdraw succeeds (201)
- Second rejected (insufficient balance / conflict)
- At most **one** hold mutation; saldo never negative

### Evidence

- [ ] Both API response bodies
- [ ] Wallet balance before/after
- [ ] `withdraw_requests` count for user
- [ ] `wallet_mutations` type=hold count

| Pass/Fail | Tester A | Tester B | Date |
|-----------|----------|----------|------|
| ☐ PASS ☐ FAIL | | | |

---

## Scenario 3 — Duplicate Midtrans webhook

| Field | Detail |
|-------|--------|
| **SRS #** | 24.3 |
| **Staging only** | ✅ |
| **Prerequisite** | Pending top-up via Midtrans **sandbox**; valid settlement payload |

### Steps

1. Create top-up; complete sandbox payment.
2. Capture webhook payload from logs or Midtrans dashboard.
3. Resend **identical** settlement webhook twice (sandbox retry or controlled curl to staging webhook URL with valid signature).
4. Check wallet balance and mutations.

### Expected result

- Saldo increased **once**
- One `topup` wallet mutation for that order

### Evidence

- [ ] Webhook payload (redact secrets)
- [ ] HTTP response codes (both deliveries)
- [ ] Wallet balance trail
- [ ] `wallet_mutations` for order reference

| Pass/Fail | Tester A | Tester B | Date |
|-----------|----------|----------|------|
| ☐ PASS ☐ FAIL | | | |

---

## Scenario 4 — Digiflazz timeout → VIP failover

| Field | Detail |
|-------|--------|
| **SRS #** | 24.4 |
| **Staging only** | ✅ |
| **Prerequisite** | Product mapped Digiflazz primary + VIP backup; Ops can set Digiflazz offline/timeout on staging |

### Steps

1. Ops: disable or simulate Digiflazz timeout.
2. Tester A: submit one purchase.
3. Review provider dispatch logs / transaction provider fields.

### Expected result

- Failover to VIPayment
- **No** duplicate orders to both providers
- Single transaction record

### Evidence

- [ ] `activity_logs` failover entry
- [ ] Transaction `provider_*` fields
- [ ] Provider request audit (if available)

| Pass/Fail | Tester A | Tester B | Date |
|-----------|----------|----------|------|
| ☐ PASS ☐ FAIL | | | |

---

## Scenario 5 — Both providers down → FAILED + refund

| Field | Detail |
|-------|--------|
| **SRS #** | 24.5 |
| **Staging only** | ✅ |
| **Prerequisite** | Both Digiflazz and VIP set offline on staging |

### Steps

1. Record wallet balance.
2. Submit purchase.
3. Wait for terminal status.

### Expected result

- Transaction **FAILED**
- Saldo restored (refund / hold release per SRS 14.5)

### Evidence

- [ ] Transaction status timeline
- [ ] Wallet balance restored
- [ ] Refund/release mutation rows

| Pass/Fail | Tester A | Tester B | Date |
|-----------|----------|----------|------|
| ☐ PASS ☐ FAIL | | | |

---

## Scenario 6 — Hanging transaction >5 minutes

| Field | Detail |
|-------|--------|
| **SRS #** | 24.6 |
| **Staging only** | ✅ |
| **Prerequisite** | Transaction stuck `SENT_TO_SUPPLIER`; scheduler/worker running on staging |

### Steps

1. Create or identify hanging transaction (staging simulation).
2. Wait **>5 minutes** without manual intervention.
3. Verify reconciliation/timeout job updates status.

### Expected result

- Job reconciles; terminal status matches provider truth
- No indefinite orphan

### Evidence

- [ ] `transactions.status` before/after with timestamps
- [ ] `timeout_at` / reconciliation log entries
- [ ] Worker/scheduler logs

| Pass/Fail | Tester A | Tester B | Date |
|-----------|----------|----------|------|
| ☐ PASS ☐ FAIL | | | |

---

## Scenario 7 — 20 transactions/minute rate limit

| Field | Detail |
|-------|--------|
| **SRS #** | 24.7 |
| **Staging only** | ✅ |
| **Prerequisite** | Authenticated user; `POST /transactions` route (15/min throttle in code) |

### Steps

1. Script or rapid manual: **20** `POST /api/v1/transactions` within 60 seconds.
2. Use unique `idempotency_key` per request.
3. Record all HTTP status codes.

### Expected result

- At least one **429** Too Many Requests
- Clear error message (Indonesian, non-technical)

### Evidence

- [ ] List of 20 HTTP statuses
- [ ] Sample 429 response body
- [ ] Rate limit headers if present

| Pass/Fail | Tester A | Tester B | Date |
|-----------|----------|----------|------|
| ☐ PASS ☐ FAIL | | | |

---

## Scenario 8 — Forged Midtrans signature

| Field | Detail |
|-------|--------|
| **SRS #** | 24.8 |
| **Staging only** | ✅ |
| **Prerequisite** | Pending top-up transaction exists |

### Steps

1. `POST /api/v1/webhooks/midtrans` with valid body but **forged** `signature_key`.
2. Check wallet and security logs.

### Expected result

- **401** rejected
- No saldo increase
- Security incident logged

### Evidence

- [ ] Request/response (redacted)
- [ ] Wallet unchanged
- [ ] `activity_logs` or security log entry

| Pass/Fail | Tester A | Tester B | Date |
|-----------|----------|----------|------|
| ☐ PASS ☐ FAIL | | | |

---

## Master sign-off

| Scenario | Result | Signed A | Signed B | Date |
|----------|--------|----------|----------|------|
| 1 Double-click | ☐ | | | |
| 2 Concurrent withdraw | ☐ | | | |
| 3 Duplicate Midtrans | ☐ | | | |
| 4 Failover | ☐ | | | |
| 5 Both down refund | ☐ | | | |
| 6 Hanging >5m | ☐ | | | |
| 7 Rate limit | ☐ | | | |
| 8 Forged signature | ☐ | | | |

**Overall SRS 24 manual suite:** ☐ NOT STARTED ☐ IN PROGRESS ☐ COMPLETE (all PASS)

> Do not mark COMPLETE until all 8 scenarios PASS with evidence archived.

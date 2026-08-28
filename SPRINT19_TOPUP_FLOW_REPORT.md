# SPRINT 19 — USER TOP UP FLOW REPORT

**Scope:** User-initiated wallet top-up only (FR-USR03 / Bagian 16).  
**Not in scope:** Midtrans engine rewrite, webhook rewrite, ledger rewrite, realtime rewrite, purchase, withdraw, AUTO_TOPUP scheduler, Finance approval, provider Digi/VIP, SRS edits, Sprint 20+.

---

## Root cause of previous error

Screenshot message:

> `Terjadi kesalahan saat memproses permintaan top up.`

**Endpoint:** `POST /api/v1/wallet/topup`  
**Frontend payload (before fix):** `{ amount, paymentMethod, idempotency_key }` (`paymentMethod` camelCase, ignored by backend)  
**Backend catch-all:** `WalletController::topUp` mapped **any** unexpected exception to HTTP 500 with that generic sentence.

Actual causes (layered):

1. **AUTO_TOPUP conflation (wrong gate)**  
   Frontend hid QRIS / VA / retail unless `AUTO_TOPUP_ENABLED=true`. Backend rejected Midtrans top-up with 422 when the flag was false. That is **not** the screenshot 500, but it blocked the real user-initiated flow while AUTO_TOPUP (scheduler/recurring) stayed off.

2. **Snap created without a selected channel**  
   `MidtransService::createSnapTransaction` always sent `credit_card.secure=true` and **no** `enabled_payments`. Merchant accounts without Credit Card (or with only QRIS/VA/cstore) can fail Snap create. Frontend method (QRIS/VA/retail) never reached Midtrans.

3. **Generic 500 mapping**  
   Duplicate in-progress idempotency (`ConflictHttpException`) and Midtrans HTTP errors were swallowed into the same 500 sentence. No `code`, no user-safe reason.

4. **Wiring**  
   FE sent `paymentMethod`; BE expected nothing and always opened a full Snap session.

**Error source:** backend catch-all + Snap payload mismatch + feature-flag mix-up. Not a missing webhook, not ledger, not a second payment engine.

---

## Minimum amount

- Backend: `TopUpRequest` enforces numeric integer **≥ Rp10.000** (422).  
- Frontend: quick amounts **Rp10.000 / 50.000 / 100.000 / 250.000 / 500.000** (none below 10k).  
- Manual input placeholder: Minimal Rp10.000.

---

## Payment methods

Catalog (`MidtransTopUpChannelCatalog`) — Midtrans Snap types only:

| Method | Snap `enabled_payments` | Notes |
| --- | --- | --- |
| QRIS | `other_qris` | No bank step |
| VA | `bca_va`, `bni_va`, `bri_va`, `echannel` (Mandiri) | Bank **required** before create |
| Retail | `alfamart`, `indomaret` | Outlet **required** before create |

Optional env: `MIDTRANS_ENABLED_CHANNELS` (comma-separated). Empty = all catalog channels.  
Channels **not** in this table (Permata, CIMB, GoPay-only, CC) are **not** shown and are rejected if posted.

`GET /api/v1/wallet/payment-config` now returns `min_amount`, `quick_amounts`, and `methods[]` with `enabled` flags. Unavailable methods are hidden/disabled on `/dashboard/wallet`.

---

## VA bank selection

1. User picks **Virtual Account**.  
2. UI shows BCA / BNI / BRI / Mandiri (only if catalog+config enabled).  
3. VA number is **not** shown before bank selection.  
4. After bank + submit: Snap create with that bank’s `enabled_payments`.  
5. VA number is displayed **only if Midtrans Snap callback** returns `va_numbers` / `bill_key`. Snap create itself does not return a VA; we do not invent one.

---

## QRIS

User picks QRIS → create Snap with `other_qris` → `ensureMidtransSnap` + `window.snap.pay`. No custom QR generator.

---

## Retail (Alfa/Indomaret)

User picks Alfa/Indomaret → chooses Alfamart or Indomaret → Snap with that cstore type. Payment code / store / expiry shown **only from Midtrans result fields** (`payment_code`, `store`, `expiry_time`).

---

## Midtrans integration reused

- `MidtransCredentialResolver` (server key server-side; public config = client key + snap.js URL)  
- `MidtransService::createSnapTransaction` (optional `enabled_payments` only)  
- `MidtransPaymentGateway::createCheckout`  
- `ensureMidtransSnap`  
- No second credential loader, no hardcoded keys.

---

## Webhook reused

Unchanged: `POST /api/v1/webhooks/midtrans` → SHA512 → `ProcessMidtransCallback`.

- Settlement/capture-accept → SUCCESS + **one** ledger credit (`WalletLedgerService`, type `topup`)  
- Duplicate webhook → skip  
- Invalid signature → 401, no credit  
- Gross amount mismatch → no credit  
- Failed/deny → FAILED, no credit  
- Pending/challenge → no credit  

---

## Security

- Top-up always for `$request->user()`; client `user_id` ignored.  
- Amount integer-validated on server.  
- Invoice/order generated server-side.  
- Channel must be in catalog + `MIDTRANS_ENABLED_CHANNELS`.  
- Idempotency payload includes `amount`, `admin_fee`, `payment_method`, `channel`. Same key + same payload = replay. Same key + different payload = 422.  
- `ConflictHttpException` (in-progress) no longer becomes a generic 500.  
- Error JSON never includes server key, stack, SQL.

---

## AUTO_TOPUP

`AUTO_TOPUP_ENABLED` default **false**. Comment in `config/features.php` clarified: this flag is the **recurring/scheduler** gate, not user-initiated Snap top-up.

User clicking Top Up is **manual user-initiated** payment. No scheduler, no recurring charge.

Purchase and withdraw gates unchanged (still off by default).

---

## Tests

`laravel/tests/Feature/UserTopUpPaymentFlowTest.php` — cases 1–25 plus payment-config catalog (26–32 backend contract).

Frontend: `src/utils/topupPaymentFlow.test.ts` (min 10k, VA bank step, QRIS no bank, retail fields, error mapping, hide disabled methods).

Sprint 8 / Sprint 11 tests updated so AUTO_TOPUP stays **off** while user-initiated top-up returns **201 pending**.

---

## Regression

| Suite | Result |
| --- | --- |
| `php artisan test` | **850 passed**, **1 failed** |
| Failure | `Tests\Feature\Admin\FinanceTest::finance user can list settlements` — missing `pagination` key |
| Classification | **Pre-existing** (Finance settlements pagination). **Not** caused by this top-up work. |
| `npm run build` | **PASS** |
| `npm run lint` | Pre-existing TypeScript debt (DashboardLayout refresh interval, AccountReferralPage, Finance store, etc.). **No new errors** in WalletPage / top-up files. |

---

## Findings

1. If a channel is **not activated on the Midtrans merchant account**, Snap will fail; we map that to `TOPUP_CHANNEL_UNAVAILABLE` and hide via `MIDTRANS_ENABLED_CHANNELS`. We do **not** fake production capability.  
2. Snap create response is `{ token, redirect_url }` only. VA / payment code appear after Snap UI / notification — UI must tolerate null until Midtrans returns them.  
3. Cross-user reuse of the same `idempotency_key` string is still keyed by `(key, endpoint)` in the existing idempotency table (pre-existing). Not rebuilt.  
4. Manual bank-transfer deposit (FR-FIN-03) remains available alongside Snap methods.

---

## Completion gate

- [x] Minimum topup Rp10.000 backend enforced  
- [x] Quick amounts no <10k  
- [x] QRIS flow  
- [x] VA bank selection flow  
- [x] VA number only after bank selected (and only if Midtrans returns it)  
- [x] Alfa/Indomaret flow  
- [x] Returned Midtrans payment data displayed  
- [x] Payment pending state  
- [x] Webhook success  
- [x] One credit only  
- [x] Duplicate webhook safe  
- [x] Signature validation  
- [x] Amount validation  
- [x] Idempotency  
- [x] wallet mutation  
- [x] wallet history  
- [x] User ownership  
- [x] error handling  
- [x] realtime/fallback existing  
- [x] AUTO_TOPUP_ENABLED remains false  
- [x] no purchase activation  
- [x] no withdraw activation  
- [x] tests pass (top-up + suite except known Finance pagination)  
- [x] build pass  
- [x] no new regression  
- [x] no scope creep  

# SPRINT 14 EXECUTION REPORT
## FR-DIFF-09 Refund Instant + FR-DIFF-01 Poin + FR-DIFF-08 Tier Loyalitas

**Status:** `SPRINT 14 READY FOR VERIFICATION`  
**Date:** 2026-08-27  
**SRS:** GurkyNet v2.2 CLEAN — Bagian 12 (FR-DIFF-01/08/09), 13.4/13.7, 14.3/14.5  

---

## FR-DIFF-09 status

Previously verified: **VERIFIED COMPLETE WITH FINDINGS** (gap-closure on `WalletRefundService`).

Still intact:
- SUCCESS → REFUNDED only (never SUCCESS → FAILED)
- Cancel/unhold via `WalletRefundService`
- Auto-refund supplier/timeout/dual-provider via same service
- `Sprint14Diff09RefundTest` — 11/11 PASS

Loyalty reverse hooks into SUCCESS→REFUNDED inside `WalletRefundService` without creating a second wallet-refund engine.

---

## Business decisions (locked — implemented)

### FR-DIFF-01
| Rule | Value |
|------|-------|
| Min earn | Rp10.000 |
| Rate | floor(amount/10000)*100 ; 1 poin = Rp1 ; 1% |
| Basis | `transaction.amount` |
| Status | SUCCESS product purchase only |
| Top-up / Transfer | 0 poin |
| Refund | full reverse; clawback **hold** if already redeemed (no wallet debit) |
| Redeem | partial OK, min 100, wallet credit only |
| Expiry | 12 months from earn |
| Adjust | Finance (+ Owner only if RBAC allows write; see findings) |
| CS | read-only |
| Users | Customer + Agent |
| Category override | **not** in this sprint (global 1%) |

### FR-DIFF-08
| Rule | Value |
|------|-------|
| Reguler | baseline |
| Silver / Gold / Platinum | GMV ≥ 1jt / 3jt / 5jt |
| Metrik | SUCCESS `amount`, calendar month |
| Upgrade | immediate |
| Downgrade | grace 1 calendar month |
| vs `agent_level` | **separate** — no `product_prices` stacking |
| Benefit | display-only non-cash; earn rate stays 1% all tiers |

---

## Data model

Migrations (additive, reversible):
- `2026_08_27_400001_create_loyalty_tables.php` — `loyalty_tiers`, `loyalty_points`, `loyalty_point_ledgers`, `wallets.points` mirror
- `2026_08_27_400002_add_loyalty_redeem_to_wallet_mutations_type.php` — enum/check allows `loyalty_redeem`

Unique earn protection: `(transaction_id, type)` on ledger — one earn per SUCCESS purchase.

---

## Architecture

| Concern | Implementation |
|---------|----------------|
| Service | `App\Services\Loyalty\LoyaltyPointService` |
| Earn hook | `AwardLoyaltyPoints` on `TransactionSuccess` |
| Reverse hook | `WalletRefundService::refundOnce` when SUCCESS→REFUNDED |
| Redeem wallet | `WalletLedgerService` + `wallet_mutations.type=loyalty_redeem` |
| Expiry job | `loyalty:expire-points` (daily 02:10 Asia/Jakarta) |
| Idempotency | ledger unique keys + HTTP `idempotency_requests` on redeem/adjust |

---

## UI

- User/Agent: `/dashboard/account/loyalty` + sidebar “Poin & Loyalitas”
- Finance: `/dashboard/finance/loyalty` — overview, ledger, manual adjust
- CS: read-only API under `/admin/customer-support/loyalty/*`
- No Ops rate-config UI (global 1% locked)

---

## RBAC

| Role | Access |
|------|--------|
| User/Agent | own summary/history/redeem |
| Finance | overview, ledger, adjust |
| Owner | read finance loyalty; **HTTP adjust blocked** by existing `EnsureOwnerReadOnly` |
| CS | read-only |
| Ops/Marketing | no mutation |

---

## Tests

| Suite | Result |
|-------|--------|
| `Sprint14LoyaltyTest` | **39 passed** |
| `Sprint14Diff09RefundTest` | **11 passed** |
| Sprint 3–12 filter batch | **PASS** (175 in combined filter) |
| Full `php artisan test` | **774 passed**, **1 failed** |

### Pre-existing (not Sprint 14)
- `FinanceTest::finance_user_can_list_settlements` — missing `pagination`
- Frontend TS debt (known)

---

## Findings

1. **Owner HTTP adjust** — locked decision allows Owner override *if RBAC supports*; existing `EnsureOwnerReadOnly` keeps Owner read-only on Finance POSTs. Service-level `actorMayAdjust` includes Owner for programmatic/override paths; Finance staff performs UI adjust.
2. **Tier benefits** — display-only (no new operational services invented).
3. **Dirty multi-sprint git tree** remains; Sprint 14 loyalty delta is additive on top of prior work.

---

## Out of scope (honored)

- FR-DIFF-02 / 03 / 10  
- Referral / downline  
- H2H / white-label / Sprint 15+  
- KYC / provider / agent pricing rewrite  
- Checkout discount redeem  
- Per-category earn override  

---

## Completion gate (self-check)

### FR-DIFF-09
- [x] refund architecture consistent  
- [x] SUCCESS → REFUNDED  
- [x] no duplicate refund  

### POINTS
- [x] 10k→100, floor, SUCCESS purchase only  
- [x] no topup/transfer, idempotent earn, concurrency safe  
- [x] redeem ≥100, 1pt=Rp1, wallet ledger  
- [x] 12-month expiry, refund reverse, clawback hold  
- [x] Finance adjustment + audit  

### TIERS
- [x] Reguler/Silver/Gold/Platinum thresholds  
- [x] calendar month GMV `amount`, SUCCESS only  
- [x] immediate upgrade, 1-month grace downgrade  
- [x] separate from `agent_level` / no pricing stack  

### UI / TESTS / SCOPE
- [x] User + Finance surfaces, RBAC  
- [x] Loyalty + Diff09 suites PASS; Sprint3–12 PASS; no new regression beyond known settlements  
- [x] No FR-DIFF-02/03/10/referral/H2H/Sprint15  

---

**Do not treat as production-complete until user verification.**  
**Status:** `SPRINT 14 READY FOR VERIFICATION`

# SPRINT 16 EXECUTION REPORT
## Referral Berjenjang — SRS Bagian 31 (FR-REF-01..09)

**Status:** `SPRINT 16 READY FOR VERIFICATION`  
**Date:** 2026-08-27  
**SRS:** GurkyNet v2.2 CLEAN — Bagian 31 (+ 13.4/13.7 menus, 14.x wallet foundations)  
**Do not claim COMPLETE** until Owner verification.

---

## SRS references

| ID | Implemented |
|----|-------------|
| FR-REF-01 | Auto + custom unique code |
| FR-REF-02 | Optional code at register → immutable relations |
| FR-REF-03 | Max 2 levels (no L3 commission) |
| FR-REF-04 | SUCCESS → PENDING L1/L2 |
| FR-REF-05 | Pending hold 3 days |
| FR-REF-06 | Release → wallet `referral_commission` |
| FR-REF-07 | User referral UI/API |
| FR-REF-08 | Fraud flag mechanism + NULL thresholds (no auto-block) |
| FR-REF-09 | Daily Rp1jt / monthly Rp10jt on **RELEASED** |

---

## Final business rules (locked)

| Param | Value |
|-------|-------|
| L1 | 1% of `transaction.amount` |
| L2 | 0.5% of `transaction.amount` |
| Trigger | SUCCESS product purchase (wallet), not top-up/transfer |
| Lifecycle | PENDING → RELEASED (or REVERSED) |
| Pending | 3 days |
| Pre-release refund | REVERSED, no wallet credit |
| Post-release refund | `finance_review` + fraud flag; **no auto clawback** |
| Caps | Rp1.000.000/day, Rp10.000.000/month (released only) |
| Cap overflow | **Defer** full commission (leave PENDING) — no partial invent |
| Partner API | Excluded via `provider_response.channel=partner_api` / notes marker |
| Loyalty | Independent listener (AwardReferralCommission ≠ AwardLoyaltyPoints) |

---

## Relationship

- Register optional code → L1 to referrer; if referrer has L1 parent → L2 row.
- Immutable; self/circular rejected; unique `(downline, level)`.
- Max depth 2.

---

## Commission / release / caps

- Listener on `TransactionSuccess`.
- Unique `(source_transaction_id, level)`.
- Job `referral:release-commissions` daily 02:20 Asia/Jakarta.
- Credit via `WalletLedgerService` + `TYPE_REFERRAL_COMMISSION` under `lockForUpdate`.

---

## Refund

Hooked beside loyalty reverse inside `WalletRefundService::refundOnce` (SUCCESS→REFUNDED).

---

## Fraud mechanism

- `config/referral.php` → all numeric thresholds **NULL**.
- `auto_block = false`.
- Structural flags (e.g. self-referral attempt, post-release refund review).
- **No invented default thresholds. No auto-block. No financial mutation from flags alone.**

---

## RBAC

| Role | Access |
|------|--------|
| User | Own code/history/summary |
| Finance | Rules CRUD, ledger, fraud review, finance_review note |
| Owner | Read overview (mutation blocked by EnsureOwnerReadOnly) |
| CS | Read overview + fraud flags |
| Ops/Marketing | No commission mutation |

---

## UI

- User: `/dashboard/account/referral`
- Finance: `/dashboard/finance/referral`

---

## Tests

`Sprint16ReferralTest` — **10 passed / 59 assertions** (covers codes, relations, L1/L2, eligibility, idempotency, release, caps, refund paths, fraud NULL, RBAC, wallet).

### Regression

| Suite | Result |
|-------|--------|
| Full `php artisan test` | **802 PASS / 1 FAIL** |
| Known fail | `Admin\FinanceTest::finance_user_can_list_settlements` pagination (**pre-existing**) |
| Sprint 3–16 filter | **203 PASS** |
| Sprint 16 new regressions | **none** |

Frontend lint/build: pre-existing TS debt / RealtimeManager (unchanged policy — not fixed here).

---

## Findings

1. Fraud numeric thresholds remain **unconfigured (NULL)** by design.  
2. Cap overflow uses **defer-full-amount** (deterministic); no partial release invent.  
3. Partner API exclusion uses available markers only (no H2H build).  
4. `commission_ledger.wallet_mutation_id` without FK (SQLite enum recreate safety).  
5. Multi-sprint dirty working tree — Sprint 16 files coexist with prior sprints.

---

## Out of scope (not done)

- H2H / Bagian 30 implementation  
- Legal SIUPL / tax  
- KYC/provider/recon/loyalty rewrite  
- Purchase / withdraw / auto-topup go-live  
- Invented fraud thresholds / auto-block  
- Sprint 17+  

---

## Completion gate

- [x] unique referral code  
- [x] custom code validation  
- [x] optional referral at register  
- [x] immutable relationship  
- [x] max 2 levels  
- [x] no self/circular referral  
- [x] L1 1% / L2 0.5%  
- [x] SUCCESS → PENDING  
- [x] pending 3 days / release  
- [x] referral_commission mutation  
- [x] daily/monthly caps  
- [x] pre-release → REVERSED  
- [x] post-release → Finance manual / no auto clawback  
- [x] idempotent  
- [x] Partner API excluded  
- [x] fraud FLAGGED / no auto-block / no invented threshold  
- [x] User + Finance UI  
- [x] RBAC + audit  
- [x] tests + regression  
- [x] no scope creep  

---

**Fraud threshold numeric BELUM DISET. No auto-block.**

**SPRINT 16 READY FOR VERIFICATION**

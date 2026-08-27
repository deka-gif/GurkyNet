# SPRINT 7 — EXECUTION REPORT

**Project:** GurkyNet PPOB  
**Label:** Sprint 7 — Zero-Loss Reconciliation  
**Scope definition:** SRS Bagian 20 **Tahap 6** + **Bagian 18** + **FR-FIN-07**  
**Date:** 2026-08-27  
**Verdict:** **SPRINT 7 READY FOR VERIFICATION**

---

## 1. SRS references

| Acuan | Isi |
|-------|-----|
| Bagian 20 Tahap 6 | Rekonsiliasi otomatis & alert — jangan di-skip |
| Bagian 18.1 | Internal hourly, hanging TX, provider daily, Midtrans daily+pending, closing |
| Bagian 18.2 | Freeze withdraw, alert Owner+Finance, `reconciliation_incidents`, purchase rule |
| Bagian 19 | Threshold configurable; default disarankan Rp50.000 |
| Bagian 14.4 | Hanging TX recon (reuse) |
| Bagian 15.6 | Provider deposit vs success TX |
| Bagian 16.4 | Midtrans settlement vs internal; pending poll 10–15 mnt / age >5 mnt |
| FR-FIN-07 | Match bank/PG mutations; mark discrepancy (**Penting**, in-scope by lock) |

---

## 2. Locked decisions applied

| # | Keputusan |
|---|-----------|
| Threshold | Default **Rp50.000**; configurable via `system_settings.finance_recon_threshold_amount` + `config/finance.php` |
| Internal variance | Incident + alert + **per-user withdraw freeze** + **purchase restrict** for affected user; **no auto balance rewrite** |
| Provider/Midtrans variance | Incident + alert + **system-wide withdraw freeze**; purchase tetap |
| Closing | Dashboard snapshot + email Finance/Owner |
| FR-FIN-07 | Gateway queue + **CSV bank import** (no bank API) |
| Hanging TX | Keep `transactions:reconcile-pending` **everyMinute**; age >5m in timeout service |
| Resolve/unfreeze | **Finance** resolves; Owner view/alert only (no two-man approval) |

---

## 3. Exact scope delivered

### A. Internal wallet recon
- Command `finance:reconcile internal` (hourly schedule)
- Compare `wallets.balance` vs Σ signed `wallet_mutations` (excludes Finance-approve `TYPE_WITHDRAW` markers that share HOLD `reference_id`)
- Mismatch → incident + FinanceAlert + withdraw freeze + purchase restrict (affected user)
- **Never** auto-corrects balance

### B. Hanging TX
- Unchanged: `transactions:reconcile-pending` everyMinute + `TransactionTimeoutService`
- Test asserts cron expression `* * * * *`

### C. Provider daily
- Digiflazz + VIP comparison records in `gateway_reconciliation_items`
- Variance > threshold → incident + system-wide withdraw freeze + Finance/Owner alert
- Reuses `integration:sync-balances` outside PHPUnit (no adapter rewrite)

### D. Midtrans
- Daily settlement vs internal credit → `gateway_reconciliation_items` + incident if over threshold
- Pending poll every **15 minutes**; age **>5 minutes**; dispatches existing `ProcessMidtransCallback` (idempotent)

### E. Daily closing
- Table `reconciliation_closings` snapshot (auditable)
- API list for Finance/Owner
- Email via `NotificationService` to Finance + Owner users

### F. Incidents
- Migration reversible: `reconciliation_incidents` (+ bank/gateway/closing tables)
- States: `open` → `resolved`
- Fingerprint dedupe; resolve clears freeze flags; audit via `FinanceAudit`

### G. Withdraw freeze gate
- `WithdrawWalletAction` early reject with clear message
- Does not cancel existing pending/approved withdraws
- Purchase gate only when `restrict_purchase` on open internal incident

### H. FR-FIN-07
- Gateway queue: match / discrepancy + evidence
- Bank CSV import: match / discrepancy + evidence + optional incident
- RBAC: Finance/Owner routes; Marketing 403
- UI: `/dashboard/finance/reconciliation`

---

## 4. Migrations

| File | Purpose |
|------|---------|
| `2026_08_27_300001_create_reconciliation_tables.php` | `reconciliation_incidents`, `reconciliation_closings`, `bank_statement_imports`, `bank_statement_lines`, `gateway_reconciliation_items` — up/down |

---

## 5. Jobs / schedule (`routes/console.php`)

| Job | Schedule |
|-----|----------|
| `transactions:reconcile-pending` | everyMinute (**retained**) |
| `finance:reconcile internal` | hourly |
| `finance:reconcile provider` | daily 01:15 Asia/Jakarta |
| `finance:reconcile midtrans` | daily 01:30 Asia/Jakarta |
| `finance:reconcile midtrans-pending` | everyFifteenMinutes |
| `finance:reconcile closing` | daily 23:59 Asia/Jakarta |

---

## 6. Key files

**Backend:** `app/Services/Finance/Reconciliation/*`, `FinanceReconciliationController`, `RunReconciliationCommand`, gates in `WithdrawWalletAction` / `CreateTransactionAction`, `FinanceAlertService::raiseReconAlert`, `config/finance.php`, SystemSetting allowlist key.

**Frontend:** `FinanceReconciliationPage.tsx`, `finance.service.ts` recon methods, router `/finance/reconciliation`, dashboard link.

**Tests:** `tests/Feature/Sprint7ReconciliationTest.php`

---

## 7. Tests

| Suite | Result |
|-------|--------|
| `Sprint7ReconciliationTest` | **10/10 PASS** |
| Sprint3 Reliability + GapClosure | PASS |
| Sprint4 Finance | PASS |
| Sprint5 Marketing | PASS |
| Sprint6 Customer Support | PASS |
| Combined Sprint 3–7 filter | **53 passed** |
| Full `php artisan test` | **634 passed / 1 failed** |

### Pre-existing failure (unchanged)
`FinanceTest::finance_user_can_list_settlements` — expects `meta.pagination`; Command Center returns nested meta. **Not Sprint 7.**

---

## 8. Frontend lint / build

`npm run lint` (`tsc --noEmit`) fails with **pre-existing** TS errors (refresh intervals, Marketing homepage animation types, Owner meta, finance.store pagination/`updateRefundStatus`, RealtimeManager `../../api` resolution, etc.).  
Build skipped because lint exit ≠ 0. **No new Sprint 7-only blocker identified beyond extending finance.service surface already consumed by store typings that were already loose/failing.**

---

## 9. Out of scope (not done)

- Owner module / FR-OWN05  
- FR-DIFF / loyalty / referral / KYC / H2H rewrite  
- WebSocket baru  
- Midtrans webhook/signature rewrite  
- Bank API integration  
- Finance settlements pagination fix  
- Automatic balance “repair”

---

## 10. Findings / notes for auditor

1. Expected balance formula deliberately excludes approve-withdraw `TYPE_WITHDRAW` rows that share a HOLD reference (ledger marker without second debit) — documented in `ReconciliationIncidentService::expectedBalanceFromMutations`.
2. Provider daily compare uses **provider cached balance vs day SUCCESS volume** as detection signal (SRS 15.6/18.1), not a full provider transaction statement API (not available without adapter expansion).
3. Purchase restriction is **enabled for internal wallet incidents** (locked rule: wallet root cause).
4. Closing email depends on Mail config + Finance/Owner users existing.

---

## 11. Completion gate (self-check)

### INTERNAL RECON
[x] hourly  
[x] wallet vs mutations  
[x] variance detection  
[x] incident  
[x] alert  
[x] freeze  

### HANGING TX
[x] everyMinute retained  
[x] >5m logic (existing)  
[x] no rebuild  

### PROVIDER
[x] Digi + VIP daily comparison records  
[x] threshold  
[x] Finance + Owner alert  

### MIDTRANS
[x] daily settlement compare  
[x] pending >5m poll every 15m  
[x] duplicate-safe via ProcessMidtransCallback  

### CLOSING
[x] daily snapshot  
[x] Finance + Owner API access  
[x] email attempt  

### FR-FIN-07
[x] gateway reconciliation  
[x] bank CSV import  
[x] match / discrepancy / evidence  
[x] Finance RBAC  

### INCIDENT
[x] reversible migration  
[x] OPEN/RESOLVED  
[x] actor/time on resolve  
[x] fingerprint dedupe  
[x] freeze/unfreeze  

### TEST
[x] Sprint7ReconciliationTest pass  
[x] prior sprint suites pass  
[x] full suite checked (1 pre-existing fail)  

---

**Status:** `SPRINT 7 READY FOR VERIFICATION`  
**Do not start Sprint 8 / Tahap 7 DIFF until user verifies and confirms.**

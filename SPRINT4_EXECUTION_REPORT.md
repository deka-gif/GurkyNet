# SPRINT 4 — EXECUTION REPORT

**Project:** GurkyNet PPOB  
**Sprint:** 4 — Modul Finance (Saldo, Deposit, Withdraw, Laporan)  
**Source of truth:** SRS v2.2 CLEAN Bagian 4.3 / 6.1 / 6.5 / 11.1 / 13.4  
**Date:** 2026-08-27  
**Verdict:** **SPRINT 4 READY FOR VERIFICATION**

> Catatan: `SPRINT4_COMPLETION_REPORT.md` (mobile/platform, 2026-08-05) **bukan** laporan modul Finance ini.

---

## 1. Scope terkunci

### Implemented (Wajib MVP)
| ID | Status |
|----|--------|
| FR-FIN-01 Monitoring saldo + mutasi | DONE |
| FR-FIN-02 Penyesuaian manual + alasan + audit | DONE (API Sprint 3 + UI) |
| FR-FIN-03 Deposit manual approve/reject + bukti + credit | DONE |
| FR-FIN-04 Monitoring riwayat Midtrans otomatis | DONE (no Midtrans rebuild) |
| FR-FIN-05 Withdraw hold → antrean Finance | DONE |
| FR-FIN-08 Laporan periodik + Excel/PDF | DONE |

### Out of scope (ditunda)
FR-FIN-06, FR-FIN-07, FR-FIN-09, Bagian 18, WebSocket, Sprint 5+, FR-DIFF.

---

## 2. Implementation summary

### Reuse Sprint 3
- `idempotency_requests` / `HandlesIdempotentRequests`
- `lockForUpdate` + `WalletLedgerService`
- `wallet_mutations` / `wallet_histories`
- Midtrans webhook/signature/amount/dup **unchanged**

### FR-FIN-01
- `GET /admin/finance/wallets` + `GET /admin/finance/wallets/{userId}/mutations`
- UI: `FinanceWalletMonitorPage` (search, list, mutasi)

### FR-FIN-02
- Existing `POST /admin/finance/wallet/adjust` + UI form + confirm + idempotency key
- `FinanceAudit` → `ActivityLog` `FINANCE_WALLET_ADJUST`

### FR-FIN-03
- User: `POST /wallet/deposit-manual` (multipart proof)
- Finance: list/show/approve/reject deposits
- Approve: credit once via ledger TYPE_TOPUP + idempotency
- Reject: no credit + reason + audit
- Proof storage: `public` disk `deposit-proofs/{userId}` (mimes jpg/png/pdf max 4MB — implementation detail)

### FR-FIN-04
- `GET /admin/finance/deposits/automatic` from `midtrans_transactions` (+ transaction credit status)
- UI tab “Riwayat Otomatis”

### FR-FIN-05
- `WithdrawWalletAction` redesigned: **hold** (`TYPE_HOLD`) + `withdraw_requests` pending + tx `LOCKED`
- Finance approve: `TYPE_WITHDRAW` **without second debit**
- Reject: unhold credit + `TYPE_REFUND`
- Hold: status `on_hold`, no balance change
- Legacy immediate-debit rows: **preserved**; new workflow flagged `workflow=hold_queue` (no destructive backfill)

### FR-FIN-08
- Period daily/weekly/monthly on structured reports
- Omzet + L/R kategori + biaya operasional dari data nyata (provider+gateway+refund; tax=null — tidak dikarang)
- Server export Excel (PhpSpreadsheet) + PDF (DomPDF)
- CSV client tetap sebagai compatibility

### Migration
- `2026_08_27_100001_extend_deposit_and_withdraw_requests_for_finance.php` (reversible)

### Dependencies added
- `barryvdh/laravel-dompdf`
- `phpoffice/phpspreadsheet`

---

## 3. Tests

| Suite | Result |
|-------|--------|
| `Sprint4FinanceTest` | **6/6 PASS** |
| `Sprint3ReliabilityTest` | **14/14 PASS** (withdraw assertions → `hold`) |
| `Sprint3GapClosureTest` | **4/4 PASS** |

---

## 4. Regression

### Backend (`php artisan test`)
| Metric | Count |
|--------|-------|
| Passed | **603** |
| Failed | **3** |
| Assertions | 4361 |

Pre-existing failures (bukan Sprint 4 regression):
1. Finance settlements `pagination` envelope  
2. Marketing banner CRUD 500  
3. PublicBannerCms 500  

Filter evidence: Sprint4FinanceTest 6/6 + Sprint3Reliability 14/14 + Sprint3GapClosure 4/4 = **24 PASS**.  
Baseline Sprint 3 was 597 pass / 3 fail → +6 Sprint4 tests, same 3 failures.

### Frontend (`npm run lint`)
Exit ≠ 0 — **pre-existing** TS debt (interval typing, CMS, realtime, finance.store typing). Tidak ada error baru dari halaman Deposit/Withdraw/Saldo yang ditambahkan.

---

## 5. Git scope (expected)

Finance Sprint 4 only: deposit/withdraw models & actions, FinanceOpsController, wallet withdraw redesign, reports export, FE Finance pages/menus, Sprint4 tests, composer deps for export, execution report.

No FR-FIN-06/07/09, no Bagian 18, no WebSocket, no provider rewrite, no SRS edits.

---

## 6. Known findings (non-blocking)

1. Settlements pagination test drift (pre-existing).  
2. Biaya operasional = agregat tersedia (bukan COA opex terpisah) — sesuai data repo.  
3. Legacy withdraw debit-langsung historical tetap ada; antrean baru hanya `hold_queue`.  
4. Proof file constraints = implementation detail (selaras complaint attachments).

---

## 7. Completion gate

| Gate | Status |
|------|--------|
| FR-FIN-01..05, 08 | **PASS** |
| FR-FIN-04 no Midtrans rebuild | **PASS** |
| RBAC Finance/Owner | **PASS** |
| Audit logs balance actions | **PASS** |
| Sprint 3 idempotency/ledger reuse | **PASS** |
| Sprint4 tests | **PASS** |
| Migration reversible | **PASS** |
| No Sprint 5+ / 06/07/09 | **PASS** |

---

## 8. Explicit claim

**SPRINT 4 READY FOR VERIFICATION**

Menunggu audit/konfirmasi eksplisit Anda sebelum Sprint 5.

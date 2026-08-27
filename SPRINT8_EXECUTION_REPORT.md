# SPRINT 8 — EXECUTION REPORT

**Project:** GurkyNet PPOB  
**Label:** Sprint 8 — User/Agen Front-End Web & App Dasar  
**Scope:** FR-USR01…06 (no FR-USR07), responsive web only  
**Date:** 2026-08-27  
**Verdict:** **SPRINT 8 READY FOR VERIFICATION**

---

## 1. SRS references

| Acuan | Isi |
|-------|-----|
| Bagian 4.6 | FR-USR01–06 (USR07 ditahan) |
| Bagian 13.7 | Menu User/Agen (DIFF menus out of scope) |
| Bagian 20 Tahap 3 + `.cursorrules` #8 | Purchase/withdraw tidak go-live publik tanpa konfirmasi |
| Sprint 5 | Banner/announcement public APIs |
| Sprint 6 | Help/chat/complaint CS reuse |
| Sprint 4 | Manual deposit Finance approval |

---

## 2. Locked decisions applied

| # | Keputusan |
|---|-----------|
| Purchase | `PURCHASE_ENABLED=false` (default) — FE + API |
| Withdraw | `WITHDRAW_ENABLED=false` — FE + API; FR-USR07/KYC not started |
| Auto top-up | `AUTO_TOPUP_ENABLED=false` — Midtrans path gated; **manual deposit tetap** |
| Role Agent | Tidak dibuat; tetap `user` |
| Mobile native | Tidak dikerjakan |
| Sprint 7 findings | Diterima non-blocking; recon tidak diubah |

---

## 3. Transaction feature gate

**Config:** `laravel/config/features.php`  
**Service:** `App\Support\Features\TransactionFeatureGate`  
**API:** `GET /api/v1/features`

| Gate | Default | Enforcement |
|------|---------|-------------|
| `purchase_enabled` | `false` | `CreateTransactionAction` early reject (no debit, no TX row, no provider) |
| `withdraw_enabled` | `false` | `WithdrawWalletAction` early reject (no hold/debit) |
| `auto_topup_enabled` | `false` | `WalletController::topUp` reject; `deposit-manual` OK |

**Frontend:** `src/config/features.ts` + `useFeatureFlags` — CheckoutSummary “Segera Hadir”; Wallet withdraw/auto-topup disabled.

**Tests:** PHPUnit enables gates in `TestCase` for Sprint 3–7 regression; `Sprint8UserModuleTest` forces gates OFF.

---

## 4. Delivered by FR

### FR-USR01 Auth
Reuse Sprint 2 (register/login/logout/forgot/OTP/PIN). No rebuild. Covered by existing Auth tests + Sprint8 login/me.

### FR-USR06 Home
`DashboardHomePage` loads public banners + announcements (running text + optional broadcast popup). Purchase notice when gated.

### FR-USR02 Catalog
Browse retained; checkout UI retained; buy path blocked by FE + API gate.

### FR-USR04 History + receipt
Ownership on show already existed. **Real PDF** via DomPDF:  
`GET /api/v1/transactions/{id}/receipt.pdf`  
Riwayat “Unduh PDF” uses blob download. Status on receipt mirrors DB (no fake SUCCESS).

### FR-USR05 Help
`/dashboard/account/help` → redirect `/dashboard/help`. Chat/complaint reuse Sprint 6 APIs.

### FR-USR03 Wallet
Balance/history; manual deposit prepared; Midtrans auto behind gate.

### Profile / notifications
Existing Account Center + NotifikasiPage reused (no new architecture).

---

## 5. Key files

**Backend:** `config/features.php`, `TransactionFeatureGate`, `FeatureFlagController`, gates in `CreateTransactionAction` / `WithdrawWalletAction` / `WalletController`, `TransactionController::receiptPdf`, `resources/views/receipts/transaction.blade.php`, `tests/Feature/Sprint8UserModuleTest.php`, `tests/TestCase.php` (test gate defaults).

**Frontend:** `src/config/features.ts`, `hooks/useFeatureFlags.ts`, `CheckoutSummary.tsx`, `WalletPage.tsx`, `DashboardHomePage.tsx`, `RiwayatPage.tsx`, `transaction.service.ts`, `router/index.tsx` (help unify).

---

## 6. Tests

| Suite | Result |
|-------|--------|
| `Sprint8UserModuleTest` | **13/13 PASS** |
| Sprint 3–7 + 8 filter | **66 passed** |
| Full `php artisan test` | See regression section |

### Sprint8 coverage
Flags OFF · auth · public marketing · catalog · purchase gate · withdraw gate · auto-topup gate · history IDOR · PDF own/other · help/complaint IDOR · wallet+manual deposit · admin 403 · chat open.

---

## 7. Regression / lint

- Sprint 3 Reliability + GapClosure: PASS  
- Sprint 4–7: PASS  
- Pre-existing: `FinanceTest::finance_user_can_list_settlements` (`meta.pagination`) — **unchanged**, not Sprint 8  
- `npm run lint`: pre-existing TS debt + **fixed** Sprint8 `useFeatureFlags` named `apiClient` import  
- Full suite: **647 passed / 1 failed** (`FinanceTest` settlements pagination — pre-existing)

---

## 8. Out of scope (not done)

- FR-USR07 withdraw agen / KYC  
- Native mobile  
- FR-DIFF (poin, referral, auto-reorder)  
- Owner module  
- Live purchase / live withdraw / live Midtrans auto  
- Role `agent`  
- Sprint 7 recon fixes  
- WebSocket/Reverb baru  
- Provider / Midtrans webhook rewrite  

---

## 9. Findings / notes

1. Production defaults keep purchase/withdraw/auto-topup **OFF** via env (`PURCHASE_ENABLED`, `WITHDRAW_ENABLED`, `AUTO_TOPUP_ENABLED`).  
2. Go-live requires explicit env flip **and** your confirmation (`.cursorrules` #8).  
3. PDF uses DomPDF already in `composer.json` — no new package.  
4. Running-text UI is a compact announcement strip (not a separate Marketing CMS feature).

---

## 10. Completion gate (self-check)

### AUTH
[x] register/login/logout/forgot/verification reuse  
[x] no auth rebuild  

### HOME / CATALOG / GATES
[x] Marketing public data  
[x] browse catalog  
[x] purchase DISABLED FE+API  
[x] withdraw DISABLED FE+API  
[x] direct POST rejected · no debit · no hold  

### HISTORY / RECEIPT / HELP / WALLET
[x] own transactions · cross-user denied  
[x] real PDF · ownership · no mutation  
[x] help/chat/complaint CS reuse  
[x] balance/history · manual deposit · Finance approval  

### SCOPE
[x] no KYC · no native mobile · no FR-DIFF · no Owner · no Sprint 9+  

---

**Status:** `SPRINT 8 READY FOR VERIFICATION`  
**Do not start Sprint 9 until user verifies.**

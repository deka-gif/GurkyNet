# SPRINT 18 EXECUTION REPORT — Legal + Pajak + SLA (PARTIAL)

**Date:** 2026-08-28  
**Status:** `SPRINT 18 PARTIAL — READY FOR VERIFICATION`  
**Not COMPLETE.** Not legally binding. No PPN rate. No tax calculation.

---

## Locked decisions (respected)

| Decision | Implementation |
|----------|----------------|
| No PKP/rate → no PPN calc | `TaxScaffoldService` always `ppn_amount=null`, `calculation_applied=false` |
| Legal not binding until lawyer review | `legal_documents.legal_review_status=pending_legal_review` |
| Consent evidence minimal | `policy_acceptances`: user_id, document_type, policy_version, accepted_at (no IP/device) |
| SLA numbers from SRS Bagian 23 only | `config/sla.php` |
| Scope A–E only | CMS align, consent, FR-CS-03, tax scaffold, retention guard |

---

## Implemented (WAJIB)

### A. Legal CMS alignment
- Reuses `LegalDocument` / Legal Center
- `SrsLegalContent` — Privacy, Terms (+ SLA ringkas Bagian 23), Refund from SRS themes
- `LegalCenterService::alignWithSrsContent()`
- Banner: **not legally binding** pending lawyer review

### B. Server-side consent
- Table `policy_acceptances`
- `PolicyAcceptanceService` version-aware; old version ≠ new version
- `RegisterUserAction` + `finalizeRegistration` requires `accept_policies`

### C. FR-CS-03 SLA
- `SlaEvaluationService` + `BusinessHoursService` (config abstraction)
- Targets: chat 5m, tech 24h, funds 48h, deposit 30m/3h, withdraw 24h/48h
- Status: `within_sla` | `nearing_sla` | `breached`
- Exposed on `SupportTicketResource.sla`
- **Finding:** jam kerja calendar still tentative (`09:00–17:00 Asia/Jakarta` Mon–Fri) — Owner confirmation needed

### D. PPN/tax scaffold
- `tax_settings` (pkp_enabled, ppn_rate nullable)
- `transactions.tax_ppn_amount` / `tax_metadata` nullable
- Finance report `tax` object via scaffold — **no calculation**, invoice totals unchanged

### E. Financial retention guard (10y)
- `FinancialRetentionGuard` blocks delete of financial records &lt;10y
- KYC guard: active account → cannot delete; +5y after close when closed_at present
- No historical data deleted

---

## Deferred (PENTING)

- Full retention jobs (webhook 90d, chat 2y, login 1y)
- Subject-rights self-service
- 7-day material-change notifications
- Finance deposit/withdraw SLA timers in Finance UI (service exists; UI wiring deferred)
- Cookie preference UI
- PKP final / PPN rate / tax calculation / legal binding publish

---

## Tests

`Sprint18LegalSlaTest` — **10/10 PASS** (covers policies, consent versioning, SLA kinds, tax scaffold, retention, refund wording).

### Regression

| Bucket | Result |
|--------|--------|
| Sprint 18 | 10/10 PASS |
| Pre-existing | `FinanceTest::finance_user_can_list_settlements` (`pagination`) — unchanged |
| Sprint 18-related fix | `SensitiveSecurityFlowTest` + FE finalize now send `accept_policies` |
| Frontend lint/build | Pre-existing TS debt (not Sprint 18 core) |

Full suite after consent wiring: expect **1 FAIL** (Finance settlements only) once `accept_policies` regression is fixed.

---

## Findings

1. Business hours not defined in SRS — config defaults documented as open decision.
2. `withdraw_large_threshold` default Rp10jt — config; SRS says “nominal besar” without number.
3. Legal CMS publish still possible operationally; `legal_review_status` prevents claiming binding.
4. Register flows that bypass `finalizeRegistration` without `accept_policies` must be audited in FE separately.
5. Multi-sprint dirty working tree may still contain unrelated files.

---

## Explicit non-claims

- ❌ PKP status final  
- ❌ PPN rate  
- ❌ Tax calculation  
- ❌ Legal binding publication  
- ❌ Full retention deletion automation beyond guards  

---

## Verdict line

**SPRINT 18 PARTIAL — READY FOR VERIFICATION**

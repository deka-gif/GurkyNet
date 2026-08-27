# Owner Go-Live Decisions Register

**SRS:** Bagian 20, 23, 25, 27–28; `.cursorrules` #8  
**Date:** 2026-08-28  
**Status:** OUTSTANDING — **do not fill decisions without Owner signature**

Record decisions in the table below. Agent/AI **must not** pre-fill "Approved" values.

---

## Decision log

| # | Decision | Options / notes | Owner decision | Date | Signed by |
|---|----------|-----------------|----------------|------|-----------|
| 1 | **Staging environment approval** | Provision staging per `docs/STAGING_READINESS.md` | ☐ Pending | | |
| 2 | **PURCHASE_ENABLED on staging** | Required for SRS 24 #1,4,5,6,7 — staging only | ☐ Pending | | |
| 3 | **WITHDRAW_ENABLED on staging** | Required for SRS 24 #2 — staging only | ☐ Pending | | |
| 4 | **AUTO_TOPUP_ENABLED on staging** | Optional for SRS 24 #3 (Midtrans sandbox) | ☐ Pending | | |
| 5 | **PARTNER_API on staging** | Prefer sandbox (`PARTNER_API_SANDBOX_ENABLED`); production partner path stays OFF | ☐ Pending | | |
| 6 | **SLA business hours** | Current tentative: Mon–Fri 09:00–17:00 `Asia/Jakarta` (`config/sla.php`) | ☐ Pending | | |
| 7 | **Withdraw large threshold** | Current default: **Rp 10.000.000** (`SLA_WITHDRAW_LARGE_THRESHOLD`) | ☐ Pending | | |
| 8 | **Legal counsel review** | Privacy, Terms, Refund — `legal_review_status` → `approved_binding` | ☐ Pending | | |
| 9 | **PKP / tax decision** | PPN calculation deferred; scaffold only (`TaxScaffoldService`) | ☐ Pending | | |
| 10 | **Release baseline / branch** | Create `release/sprint19-*` from dirty tree per `docs/RELEASE_BASELINE.md` | ☐ Pending | | |
| 11 | **Production financial flags** | `.cursorrules` #8 — explicit approval before `PURCHASE/WITHDRAW/AUTO_TOPUP` on **production** | ☐ Pending | | |
| 12 | **Go-live testing start** | Authorize SRS 24 manual execution on staging | ☐ Pending | | |

---

## `.cursorrules` #8 reminder

> Fitur transaksi (beli produk, withdraw) TIDAK BOLEH diaktifkan ke publik/production sebelum sprint 'Keandalan Transaksi' selesai **dan** Owner beri konfirmasi eksplisit.

Automated tests: Sprint 3 reliability suite PASS. Owner explicit confirmation: **still required** for production.

---

## Legal status (unchanged)

| Document | Slug | `legal_review_status` | Binding? |
|----------|------|------------------------|----------|
| Privacy Policy | `privacy_policy` | `pending_legal_review` | **NO** |
| Terms & Conditions | `terms_conditions` | `pending_legal_review` | **NO** |
| Refund Policy | `refund_policy` | `pending_legal_review` | **NO** |

Server-side consent (`policy_acceptances`) is implemented — separate from legal binding publish.

---

## How to approve

1. Owner reviews linked runbooks and staging plan
2. Fill "Owner decision" column (Approved / Rejected / Deferred + notes)
3. Sign name and date
4. Store scanned PDF or signed commit message reference in `docs/evidence/owner-decisions/`

**No decisions were made during Sprint 19 operational readiness execution.**

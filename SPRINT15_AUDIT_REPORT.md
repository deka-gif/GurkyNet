# SPRINT 15 AUDIT REPORT
## Diferensiator Lanjutan (Tahap 7 — residual FR-DIFF)
**Mode:** READ-ONLY  
**Date:** 2026-08-27  
**SRS:** GurkyNet v2.2 CLEAN — Bagian 12, Bagian 13 (menu), Bagian 20 Tahap 7  
**Baseline:** Sprint 14 VERIFIED COMPLETE WITH FINDINGS (FR-DIFF-09 / 01 / 08)

---

## 1. Scope SRS

### Tahap 7 (Bagian 20)
> Fitur diferensiator (Bagian 12) **satu per satu sesuai prioritas**, dimulai dari FR-DIFF-09 lalu FR-DIFF-01/08.

### Sudah selesai (JANGAN diulang)
| ID | Prioritas SRS | Sprint 14 status |
|----|---------------|------------------|
| FR-DIFF-09 | **Wajib** | PASS (with findings) |
| FR-DIFF-01 | Penting | PASS (with findings) |
| FR-DIFF-08 | Penting | PASS (with findings) |

### Sisa FR-DIFF setelah Sprint 14

| ID | Nama | Prioritas SRS | Sprint 15 classification |
|----|------|---------------|--------------------------|
| FR-DIFF-02 | Auto-Reorder / Langganan Berkala | **Penting** | **PENTING** — kandidat utama Sprint 15 |
| FR-DIFF-03 | Kalkulator Margin Real-Time Agen | **Penting** | **PENTING** — kandidat utama Sprint 15 |
| FR-DIFF-10 | Prediksi Cash Flow Owner | **Penting** | **PENTING** — kandidat utama Sprint 15 |
| FR-DIFF-04 | Referral & Komisi (juga Bagian 31) | Opsional | **OPSIONAL** — defer unless explicitly pulled in |
| FR-DIFF-05 | Smart Reminder Saldo | Opsional | **OPSIONAL** |
| FR-DIFF-06 | Split Bill | Opsional | **OPSIONAL** |
| FR-DIFF-07 | White-Label Agen | Opsional (Fase 2) | **OUT OF SCOPE** Fase 2 |

**Tidak ada FR-DIFF berstatus WAJIB yang tersisa** setelah FR-DIFF-09.

**Sprint 15 literal scope (recommended):** FR-DIFF-02 + FR-DIFF-03 + FR-DIFF-10 only.

---

## 2. Existing implementation

### Shared (post–Sprint 14)
- Loyalty: tables, service, UI, tests — **done** (not Sprint 15).
- Wallet/idempotency/state machine/providers/Midtrans/recon/KYC — exist from prior sprints.
- `PURCHASE_ENABLED` / `WITHDRAW_ENABLED` / `AUTO_TOPUP_ENABLED` — still **OFF** (gates).
- `product_prices` migration exists; **not wired** into live pricing path (still `products.sell_price`).
- Ops “Pricing & Margin” UI exists for **platform** margin — not agent retail calculator.

### Per residual requirement

| Requirement | SRS Reference | Existing | Status | Evidence | Gap |
|-------------|---------------|----------|--------|----------|-----|
| FR-DIFF-02 Auto-Reorder | 12.1, 12.2 `user_subscriptions`, 13.3 Ops “Langganan Otomatis”, 13.7 User menu | **NONE** (do not confuse with catalog “Langganan Digital”) | **MISSING** | no model/migration/job/UI; `console.php` has no subscription scheduler | Full feature gap |
| FR-DIFF-03 Margin Agen | 12.1, 13.3 “Kalkulator Margin Agen”, FR-OPS-04..07 | **PARTIAL** Ops pricing only | **PARTIAL** | `OperationsPricingManagement.tsx`, `PricingService` (single sell_price), `product_prices` schema unused | No agent-facing calculator; no live `agent_level` sell price |
| FR-DIFF-10 Cash-flow Owner | 12.1, 13.6 Prediksi Cash Flow | **PARTIAL** live balances / today cashflow | **MISSING** as prediction | `OwnerDashboard`, `FinanceTreasuryService::cashFlowToday`, `integration:sync-balances` | No projection/horizon/deposit-need forecast |
| FR-DIFF-04 Referral | 12.1 Opsional + Bagian 31 | NONE | **OUT OF SCOPE** (opsional) | — | Full Bagian 31 if ever scheduled |
| FR-DIFF-05 Reminder | 12.1 Opsional | NONE | **OUT OF SCOPE** | — | — |
| FR-DIFF-06 Split Bill | 12.1 Opsional | NONE | **OUT OF SCOPE** | — | — |
| FR-DIFF-07 White-label | 12.1 Fase 2 | NONE | **OUT OF SCOPE** | — | — |
| FR-DIFF-01/08/09 | 12.1 | Implemented | **PASS** | Sprint14 tests/report | Do not re-open |

---

## 3. Gaps (detail)

### FR-DIFF-02 — Auto-Reorder (khusus)

| Concern | SRS says | Repo | Gap / Decision |
|---------|----------|------|----------------|
| Trigger | Beli otomatis tiap tanggal tertentu; notifikasi H-1 | Missing | Need schedule_day, timezone, H-1 channel |
| Stok/availability | Implied via product/provider | No subscription check | When SKU/provider down: skip / pause / notify? |
| Threshold | Not specified | — | **DECISION REQUIRED** (min saldo? max fail?) |
| Retry | Not specified | — | **DECISION REQUIRED** |
| Duplicate prevention | Must follow Bagian 14.1/14.2 | No job | Idempotency key per run (`subscription_id`+date) |
| Approval | Not specified | — | User self-serve only vs Ops approve? |
| Wallet impact | Saldo terpotong otomatis | Gate OFF | Hold/debit via CreateTransactionAction; purchase gate |
| Provider | Same purchase path | Exists | Must reuse ProviderRouter; no parallel buy |
| Ops monitoring | Menu Langganan Otomatis | Missing | List/pause/cancel |
| User UI | Kelola Auto-Reorder | Missing | Create/pause/history |

### FR-DIFF-03 — Margin Agen (khusus)

| Concern | SRS says | Repo | Gap / Decision |
|---------|----------|------|----------------|
| Margin source | Harga modal vs harga jual level agen | `cost`/`base` + single `sell_price` | Wire `product_prices.agent_level` **or** estimate-only UI |
| Agent level | `users.agent_level` | Exists | Must not break loyalty separation (Sprint 14 locked) |
| Pricing interaction | FR-OPS harga bertingkat | `product_prices` unused | **DECISION REQUIRED:** activate tiered sell vs display-only calc |
| Calculation | Real-time before sell | Partial Ops margin | Agent UI: `sell_agent − cost` (and optional retail input?) |
| Settlement | Not in FR-DIFF-03 | N/A | No agent P&L settlement implied — don’t invent |
| Reporting | Ops/Finance existing | Margin in tx meta | Optional agent margin history — confirm |
| Safety | Don’t corrupt prices | — | Additive only; no rewrite of Ops pricing |

### FR-DIFF-10 — Cash-flow Owner (khusus)

| Concern | SRS says | Repo | Gap / Decision |
|---------|----------|------|----------------|
| Data source | Tren penjualan + saldo Digi/VIP | Balances + sales history exist | Define inputs explicitly |
| Projection | Kebutuhan deposit supaya saldo provider tidak habis | NONE | Formula **not in SRS** → **DECISION REQUIRED** |
| Horizon | Not specified | — | days/weeks? **DECISION REQUIRED** |
| Dashboard | Owner Prediksi Cash Flow | Missing menu/page | New Owner surface |
| Permissions | Owner | Owner RBAC exists | Owner-only |
| No fake numbers | — | — | Must use real sales + provider balances only |

---

## 4. Dependencies

| Dependency | FR-DIFF-02 | FR-DIFF-03 | FR-DIFF-10 |
|------------|------------|------------|------------|
| Transaction reliability (Sprint 3) | **Hard** (auto debit) | Soft (read calc) | Soft |
| `PURCHASE_ENABLED` go-live | **Hard** for live auto-buy | Soft | Soft |
| Provider Digi/VIP | **Hard** | Soft (cost price) | **Hard** (balance + sales) |
| Wallet lock + idempotency | **Hard** | No | No |
| Notifications | H-1 required | No | Optional alerts |
| KYC | Soft (agent buy may already gate) | Soft | No |
| Reconciliation | Soft | No | Useful context, not required for v1 formula |
| `product_prices` / agent_level | No | **Decision** | No |
| Loyalty | Independent | Must stay separate from pricing | Independent |

**Cursorrules #8:** purchase/withdraw not public until reliability verified + explicit confirmation — Auto-Reorder that auto-buys is blocked from production activation until that gate opens (can still build behind feature flag).

---

## 5. Test coverage

| Area | Existing tests | Sprint 15 need |
|------|----------------|----------------|
| FR-DIFF-02 | **None** | New suite when executed |
| FR-DIFF-03 | Ops pricing tests partial (if any); **no** agent calculator tests | New |
| FR-DIFF-10 | Owner/treasury tests for balances/today — **no** forecast | New |
| Sprint 3–14 regression | Sprint3–14 suites exist; full run baseline **774 PASS / 1 FAIL** (settlements pagination pre-existing) | Preserve |
| Sprint 14 loyalty/refund | 39 + 11 PASS | Do not regress |

**No new tests created in this audit.**

---

## 6. Decisions Required

### FR-DIFF-02
1. Timezone & `schedule_day` semantics (calendar day vs rolling).  
2. Behavior if saldo kurang / produk maintenance / provider down.  
3. Retry count & spacing.  
4. Whether Ops approval is required or user self-serve only.  
5. Whether Auto-Reorder may run while `PURCHASE_ENABLED=false` (lab only) vs wait for go-live.  
6. Notification channel for H-1 (in-app / push / email).

### FR-DIFF-03
7. Activate live `product_prices` by `agent_level` **or** display-only calculator on current `sell_price`/`cost`.  
8. What “harga jual level mereka” means if agent sets own retail price (input field?) vs platform agent sell price.  
9. Who can see cost price (agent only if authorized?).

### FR-DIFF-10
10. Projection formula (moving average daily COGS to provider? percentile?).  
11. Horizon length.  
12. Alert thresholds for “deposit soon” (must not invent).  
13. Which providers included (Digiflazz + VIPayment both?).

**Jangan mengarang angka** untuk threshold/horizon/retry sampai dikunci.

---

## 7. Recommended execution order (after decisions)

1. **Lock decisions** (section 6).  
2. **FR-DIFF-03** (mostly read-path; lower wallet risk; clarify `product_prices`).  
3. **FR-DIFF-10** (Owner analytics on existing sales + balances; no fake series).  
4. **FR-DIFF-02** last among the three (highest risk: scheduled wallet debit + provider; behind feature flag until purchase go-live confirmed).  
5. Keep **04/05/06/07** out unless product owner expands Sprint 15.

---

## 8. Out of Scope

- Re-implement FR-DIFF-09 / 01 / 08  
- FR-DIFF-04 Referral / Bagian 31 (opsional)  
- FR-DIFF-05 / 06  
- FR-DIFF-07 White-label (Fase 2)  
- Sprint 16+  
- H2H Mitra API (Bagian 30) as Sprint 15  
- Turning on purchase/withdraw/auto-topup without explicit confirmation  
- Inventing forecast/retry/threshold numbers  
- Rewriting agent pricing / loyalty stacking  

---

## 9. Git baseline (audit only — tidak diperbaiki)

- Working tree **multi-sprint dirty** (~114 files changed in tracked diff + many untracked Sprint 3–14 artifacts including loyalty).  
- Sprint 14 loyalty/refund artifacts present as untracked/modified.  
- **No Sprint 15 implementation files** found (no subscription/referral/split/forecast modules).  
- Dirty tree ≠ Sprint 15 regression; do not clean unless asked.

---

## 10. Final Verdict

# **BLOCKED — DECISION REQUIRED**

**Alasan:** Sprint 15 scope yang benar (FR-DIFF-02 / 03 / 10 — prioritas **Penting**) masih **MISSING/PARTIAL**, dan beberapa parameter bisnis **tidak ada di SRS** (auto-reorder failure/retry/approval; margin live vs display; cash-flow formula/horizon/thresholds). Eksekusi tanpa keputusan akan melanggar `.cursorrules` (jangan mengarang).

Setelah keputusan dikunci: status dapat naik ke **READY FOR EXECUTION** untuk urutan 03 → 10 → 02 (berflag).

**STOP** — tidak lanjut Sprint 16; tidak coding.

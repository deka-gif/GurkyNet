# SPRINT 16 AUDIT REPORT
## Referral Berjenjang (SRS Bagian 31 / FR-DIFF-04 / FR-REF-*)
**Mode:** READ-ONLY  
**Date:** 2026-08-27  
**SRS:** GurkyNet v2.2 CLEAN — Bagian 31 (+ cross-refs 12.1 FR-DIFF-04, 13.x menus, 14.5 refund, 28.7 abuse, 30 H2H)  
**Baseline:** Sprint 15 **VERIFIED COMPLETE WITH FINDINGS** (FR-DIFF-02/03/10)

---

## 0. Scope note

Audit hanya referral/downline. Tidak mengaudit ulang Sprint 14–15 DIFFERENTIATOR lain, KYC rewrite, provider, recon, H2H implementation, legal go-live, atau purchase/withdraw activation.

**Repo finding (global):** Tidak ada file/model/migration/service/UI/test bernama referral/downline/commission_ledger di aplikasi Laravel maupun frontend React. Satu-satunya hit “commission” terkait Digiflazz catalog fields — **bukan** referral.

---

## 1. SRS Bagian 31 — literal inventory

### Konsep (31.1)
- Setiap User punya kode referral unik.
- Registrasi dengan kode → downline **Level 1** dari pengundang (upline).
- Jika Level 1 mengajak user baru → user baru = Level 1 dari pengajak **dan** Level 2 dari upline di atasnya.
- Komisi otomatis dari transaksi downline; % berbeda per level.
- Cap hukum: **maksimal 2 level**; komisi dari **transaksi riil** saja (bukan fee join) — affiliate, bukan MLM. Legal consult sebelum publik.

### Functional requirements (31.2)

| ID | Prioritas SRS | Ringkas |
|----|---------------|---------|
| FR-REF-01 | **Wajib** | Generate kode unik saat registrasi; custom terbatas oleh User |
| FR-REF-02 | **Wajib** | Kolom kode referral opsional di form register; valid → relasi tercatat |
| FR-REF-03 | **Wajib** | Tidak hitung/catat Level ≥3 |
| FR-REF-04 | **Wajib** | Setiap SUCCESS downline → komisi L1+L2; % dikonfigurasi Ops/Finance |
| FR-REF-05 | **Wajib** | Komisi pending dulu (contoh 3 hari) sebelum cair |
| FR-REF-06 | **Wajib** | Setelah pending + sumber masih SUCCESS → release ke wallet (`wallet_mutations.type=referral_commission`) |
| FR-REF-07 | **Penting** | Dashboard User: count L1/L2, total komisi, riwayat per TX downline |
| FR-REF-08 | **Wajib** | Deteksi pola curang (banyak akun IP/device sama + kode sama singkat + top-up kecil berulang) → flag |
| FR-REF-09 | **Penting** | Cap komisi harian/bulanan per upline (config Finance) |

### Data model (31.3) — literal tables
`referral_codes`, `referral_relations` (level 1|2, immutable after register), `commission_rules`, `commission_ledger` (pending|released|reversed + release_at), `referral_fraud_flags`.

### Lifecycle (31.4)
Register → relations fixed → SUCCESS purchase → ledger pending → daily job release **or** refund before release → `reversed` (no payout).

### Interactions (31.5)
- **Tidak** dari transaksi API Partner (Bagian 30).
- Independen dari loyalty (FR-DIFF-01); boleh bersamaan.
- Tier + downline count = **opsional** after stable.

### Menus (31.6 + Bagian 13)
- Ops/Finance: Program Referral (rules + fraud review).
- Owner: monitoring total komisi beredar (+ Mitra API — H2H out of Sprint 16 impl).
- User/Agen: Kode Saya, Komisi Terkumpul (13.7); Marketing konten promosi (13.2).

### Cross-priority conflict
- **Bagian 12 FR-DIFF-04** = prioritas **Opsional**.
- **Bagian 31 FR-REF-01..06,08** = prioritas **Wajib**.
- Untuk Sprint 16, treat **Bagian 31 IDs** as the detailed SSOT for behaviour; FR-DIFF-04 as the product label. Priority framing for roadmap: opsional di daftar DIFF, tetapi detail FR-REF berlabel Wajib di Bagian 31 → **keputusan product/scheduling** (lihat §14).

### Classification summary

| Class | Items |
|-------|--------|
| **WAJIB** | FR-REF-01..06, FR-REF-08; schema 31.3; flow 31.4; exclude Partner API TX; max 2 level; relation immutable |
| **PENTING** | FR-REF-07 UI dashboard; FR-REF-09 caps; Finance “Komisi Referral Terutang”; Ops/Finance rules UI |
| **OPSIONAL** | FR-DIFF-04 label as “opsional” in 12.1; loyalty-tier×downline (31.5); Marketing promo content only; limited code customize details |
| **DEPENDENCY** | Sprint 3 wallet lock + idempotency; SUCCESS→REFUNDED (14.5 / Sprint 14); register/auth (Sprint 8); WalletLedgerService; scheduled jobs; notification infra |
| **OUT OF SCOPE** | H2H Mitra API portal (Bagian 30); legal SIUPL go-live; tax (22); KYC rewrite; purchase/withdraw go-live; FR-DIFF 02/03/05–10 rework; Sprint 17+ |

**Angka yang SRS sebut hanya sebagai contoh (bukan locked):** pending “mis. 3 hari”; contoh TX Rp50.000; X%/Y% tidak dinumerikkan.

---

## 2. Existing repository audit

| Artifact | Status |
|----------|--------|
| Tables `referral_*` / `commission_*` | **MISSING** (no migrations) |
| Models / services / jobs / listeners | **MISSING** |
| `users.referral_*` / `referred_by` | **MISSING** |
| Register field `referral_code` | **MISSING** — `RegisterRequest` / `RegisterUserAction` tanpa referral |
| `wallet_mutations.type=referral_commission` | **MISSING** — enum saat ini: topup/purchase/refund/withdraw/adjustment/hold/loyalty_redeem |
| Notification referral | **MISSING** |
| UI User/Ops/Finance/Owner referral | **MISSING** — no menu/route/page |
| Tests referral | **MISSING** |

Reusable foundations (do not rebuild):
- `WalletLedgerService` + row lock + idempotency (Sprint 3)
- `TransactionSuccess` / loyalty listener pattern (Sprint 14) — parallel independent hook for commission
- `WalletRefundService` SUCCESS→REFUNDED (Sprint 14) — reverse pending commissions
- Auth register pipeline (Sprint 8)
- NotificationService
- Feature gates still OFF for purchase (affects live commission until go-live)

---

## 3. Referral relationship (SRS-required behaviour vs repo)

| Rule (SRS) | Required behaviour | Repo |
|------------|-------------------|------|
| Referrer | User with `referral_codes` | Missing |
| Referred | New user with optional code at register | Missing |
| Multi-level | Exactly L1 + L2 rows; no L3+ | Missing |
| Duplicate relationship | One immutable tree at register; no change parent | Missing — no unique/guards |
| Circular A→B→A | Prevented by: relations only at register + max 2 level + cannot re-parent | Missing |
| Self-referral | Must reject own code / self | Missing (FR-REF-08 + 28.7) |
| Changing referrer | **Forbidden** (“dibentuk sekali… tidak berubah”) | Missing |

---

## 4. Reward

| Concern | SRS | Repo | Note |
|---------|-----|------|------|
| Trigger | Transaksi **SUCCESS** downline (native web/app) | Missing | Not top-up alone as commission base; top-up may feed fraud pattern only |
| Formula | % per level from `commission_rules` (Ops/Finance) | **No numeric rate in SRS** | Decision required |
| Levels | L1 and L2 only | Missing | |
| Idempotency | One ledger row per (source_tx, upline, level) implied | Missing | Must use Sprint 3 patterns |
| Concurrency | Wallet credit on release with lockForUpdate | Missing | Reuse WalletLedgerService |
| Ledger | pending → released \| reversed | Missing | |
| Wallet | Credit only on **released** via `referral_commission` | Enum gap | |

Do **not** invent a second wallet engine.

---

## 5. Refund / reversal

| SRS | Implication |
|-----|-------------|
| Refund before `release_at` | Ledger → `reversed`; **tidak dicairkan** |
| Release job | Only if source TX still SUCCESS |
| After release | **SRS 31.4 step 7 only covers pre-release.** Clawback after `released` **tidak didefinisikan** → decision required |
| Negative wallet | Must not overdraft on any reverse | Reuse refund/clawback patterns carefully |
| Double reward | Prevent double pending + double release | Unique constraints + idempotent job |

---

## 6. KYC / eligibility

SRS Bagian 31 **tidak** mensyaratkan KYC verified / phone / Agent-only untuk earn atau become referrer.

Literal: “Setiap User” mendapat kode; komisi dari transaksi SUCCESS downline.

| Possible rule | In Bagian 31? |
|---------------|---------------|
| Phone/email verified | **Tidak disebut** |
| KYC approved | **Tidak disebut** |
| Agent-only referrer | **Tidak** — User/Agen |
| Min transaction | **Tidak** (fraud pattern mentions small top-ups for flags, not earn gate) |

→ Jangan menambah eligibility tanpa keputusan eksplisit.

---

## 7. RBAC (SRS)

| Role | Access (SRS) |
|------|----------------|
| User/Agen | Own code, own downline counts, own commission history (FR-REF-07 / 13.7) |
| Marketing | Promo content tampilan (13.2) — not ledger mutation |
| Operasional / Finance | Kelola `commission_rules`; review `referral_fraud_flags` (31.6); Finance pantau komisi terutang (13.4) |
| CS | Antrean review fraud flags (31.3) — review, not invent payout |
| Owner | Monitoring total komisi beredar (31.6) — read summary |
| Mutation privileges | Rules config Ops/Finance; release via system job; no CS wallet credit for referral |

Repo: **no routes/menus** → all **MISSING**.

---

## 8. Anti-abuse

| Guard | SRS | Repo |
|-------|-----|------|
| Self-referral | FR-REF-08 + S&K 28.7 | Missing |
| Duplicate reward | Ledger uniqueness + idempotency | Missing |
| Concurrent reward | Row locks on wallet release | Missing |
| Fake/multi-account pattern | IP/device + same code burst + small top-ups → `referral_fraud_flags` | Missing |
| Refund farming | Pending hold + reverse on refund | Missing |
| Circular chain | Immutable relations + max 2 levels | Missing |
| Daily/monthly cap | FR-REF-09 (Penting) | Missing + **limits not numeric in SRS** |

Fraud engine: flag + review queue only — not a large ML system.

---

## 9. Data model gap (catat saja)

Minimal missing vs 31.3:
1. `referral_codes`
2. `referral_relations` (+ unique downline_user_id per level / prevent multi-parent)
3. `commission_rules`
4. `commission_ledger`
5. `referral_fraud_flags`
6. Extend `wallet_mutations.type` → `referral_commission`
7. Optional: register IP/device capture for FR-REF-08 (not fully specified)

No migration created (audit-only).

---

## 10. UI gap

| Surface | SRS | Repo |
|---------|-----|------|
| User: Kode Saya / Komisi / downline L1–L2 / history | FR-REF-07, 13.7 | Missing |
| Register: optional referral field | FR-REF-02 | Missing |
| Ops/Finance: rules + fraud flags | 31.6 | Missing |
| Finance: komisi terutang | 13.4 | Missing |
| Owner: monitoring summary | 31.6 | Missing |
| Marketing: promo content | 13.2 | Content CMS may exist generically; **no referral program module** |

---

## 11. Test coverage (existing only — no new tests)

| Requirement | Existing Test | Coverage | Status | Gap |
|-------------|---------------|----------|--------|-----|
| Self referral | — | 0% | **MISSING** | Need reject own code |
| Duplicate relationship | — | 0% | **MISSING** | Immutable + unique parent |
| Reward on SUCCESS | — | 0% | **MISSING** | L1/L2 pending ledger |
| Multi-level (max 2) | — | 0% | **MISSING** | No L3 commission |
| Duplicate reward | — | 0% | **MISSING** | Idempotent ledger |
| Concurrency | — | 0% | **MISSING** | lockForUpdate on release |
| Refund reversal | — | 0% | **MISSING** | pending → reversed |
| Ownership | — | 0% | **MISSING** | IDOR on dashboard |
| RBAC | — | 0% | **MISSING** | Ops/Finance/Owner/User scopes |

Related existing (dependency only): Sprint3Reliability, Sprint14Loyalty/Refund — **not** referral coverage.

---

## 12. Dependencies

| Dependency | Role for Sprint 16 | Status |
|------------|-------------------|--------|
| Sprint 3 wallet/idempotency/lock | Release credit + anti double | **Available** |
| Sprint 8 User/register | Hook code gen + optional code | **Available** (extend) |
| Sprint 12 KYC | **Not required** by Bagian 31 | Available; do not block referral by inventing KYC gate |
| Sprint 14 loyalty | Parallel independent earn; do not merge ledgers | **Available** |
| Sprint 14 refund | Hook reverse pending commissions | **Available** |
| Sprint 15 auto-reorder/margin/cashflow | Orthogonal | Done; do not reopen |
| H2H / Bagian 30 | Exclude Partner TX from commission; portal **out of scope** | Do not implement H2H |
| Legal/tax | SIUPL note; tax invoice | **OUT OF SCOPE** execution; legal consult before public launch |
| Purchase go-live | Live commission needs SUCCESS purchases | Gate still OFF — can implement + test with gate ON in tests only |

---

## 13. Compliance matrix

| SRS Requirement | Existing | Status | Evidence | Gap |
|-----------------|----------|--------|----------|-----|
| FR-REF-01 unique code | None | **MISSING** | No referral_codes / register hook | Full |
| FR-REF-02 register with code | None | **MISSING** | RegisterRequest no field | Full |
| FR-REF-03 max 2 levels | None | **MISSING** | — | Full |
| FR-REF-04 auto commission SUCCESS | None | **MISSING** | No listener/rules | Full + % undecided |
| FR-REF-05 pending hold | None | **MISSING** | — | Full + hold days undecided |
| FR-REF-06 release to wallet | None | **MISSING** | No job; no mutation type | Full |
| FR-REF-07 user dashboard | None | **MISSING** | No UI/API | Full (Penting) |
| FR-REF-08 fraud flags | None | **MISSING** | No IP/device capture rules | Full + thresholds undecided |
| FR-REF-09 daily/monthly caps | None | **MISSING** | — | Full + limits undecided (Penting) |
| Schema 31.3 | None | **MISSING** | No migrations | Full |
| Relation immutable / no re-parent | None | **MISSING** | — | Full |
| Self / circular guards | None | **MISSING** | — | Full |
| Reverse on refund (pre-release) | None | **MISSING** | Refund service has no referral hook | Full |
| Post-release clawback | Not specified | **DEPENDENCY** | — | Decision |
| Exclude Partner API TX | N/A (no H2H TX path for partners yet) | **DEPENDENCY** | Bagian 30 out of scope | Guard when H2H exists |
| Independent of loyalty | Loyalty exists | **PASS** (isolation today) | Separate services | Keep separate |
| Ops/Finance rules UI | None | **MISSING** | — | Full |
| Owner monitoring | None | **MISSING** | — | Full |
| Marketing promo menu | Generic CMS only | **PARTIAL** | Website content exists | No referral-specific program |
| FR-DIFF-04 as product | Label only | **MISSING** | — | = Bagian 31 |
| H2H Mitra portal (31.6 rows) | None | **OUT OF SCOPE** | Bagian 30 | Do not build in Sprint 16 |
| Legal SIUPL | Note only | **OUT OF SCOPE** | 31 preamble | Human/legal |

---

## 14. Decisions required (hanya yang tidak dinumerik/dikunci SRS)

Jangan mengarang. Butuh konfirmasi Owner sebelum execution:

1. **Persentase L1 dan L2** (dan apakah sama untuk semua kategori vs per `product_category` via `commission_rules`).
2. **Masa pending** sebelum release (SRS hanya contoh “mis. 3 hari”).
3. **Basis komisi:** `transaction.amount` vs `total_payment` vs lain — SRS bilang “nilai transaksi” tanpa field teknis.
4. **FR-REF-09 caps:** nominal/persen max harian & bulanan per upline (angka).
5. **FR-REF-08 thresholds:** window waktu, jumlah akun, IP/device identity source, top-up “kecil” threshold, auto-block vs flag-only.
6. **Custom kode (FR-REF-01):** panjang, charset, cooldown, apakah boleh ganti setelah set.
7. **Post-release refund:** apakah komisi yang sudah `released` di-clawback / hold / ignore (SRS hanya reverse pre-release).
8. **Prioritas sprint:** Bagian 12 menyebut FR-DIFF-04 **Opsional**, Bagian 31 label FR-REF **Wajib** — konfirmasi Sprint 16 tetap dieksekusi sekarang.
9. **Siapa boleh edit `commission_rules`:** Ops saja, Finance saja, atau keduanya (31.6 “Operasional/Finance”).
10. **Withdraw of released commission:** ikut gate withdraw existing atau selalu wallet spend only until withdraw go-live (dependency policy, bukan angka).

Bukan decision (sudah jelas SRS): max 2 level; immutable relations; pending then release; no Partner API commission; independent of loyalty; no invent KYC gate.

---

## 15. Recommended execution order (setelah decisions)

1. Lock business params (§14) — **blocker**.  
2. Additive migrations: tables 31.3 + `referral_commission` mutation type (reversible).  
3. Code generation + register bind (FR-REF-01/02) + self/invalid guards.  
4. Relation writer: L1 + optional L2, max 2, immutable.  
5. `commission_rules` + Admin Ops/Finance config API.  
6. SUCCESS listener → pending ledger (idempotent) — parallel to loyalty.  
7. Refund hook → reverse pending (pre-release).  
8. Daily release job + WalletLedgerService credit.  
9. Caps (FR-REF-09) + basic fraud flags (FR-REF-08) once thresholds locked.  
10. User dashboard API/UI (FR-REF-07); Finance/Owner read monitoring.  
11. Tests: self/dup/multi-level/idempotency/concurrency/refund/RBAC.  
12. **Do not** enable purchase/withdraw/H2H/legal launch in this sprint.

---

## 16. Final scope

### WAJIB SPRINT 16 (setelah decision lock)
- FR-REF-01..06, FR-REF-08  
- Schema 31.3 + wallet type `referral_commission`  
- Immutable 2-level relations; SUCCESS→pending→release|reverse  
- Exclude Partner API TX (guard)  
- Anti double / concurrency via Sprint 3 foundations  

### PENTING — dapat satu paket dengan wajib atau segera setelah
- FR-REF-07 User dashboard  
- FR-REF-09 caps  
- Ops/Finance rules + fraud review UI; Finance terutang; Owner summary  

### OPSIONAL — TUNDA
- Loyalty tier × downline count  
- Marketing-only promo polish  
- H2H Mitra menus in 31.6 that belong to Bagian 30  

### DEPENDENCY
- Sprint 3 ledger/idempotency; Sprint 8 register; Sprint 14 SUCCESS/REFUNDED + loyalty isolation  
- Purchase gate for production earn (test-only ON)  

### OUT OF SCOPE
- FR-DIFF-02/03/05–10 reopen; KYC rewrite; provider/recon rewrite  
- H2H implementation; legal SIUPL filing; tax  
- Purchase/withdraw/auto-topup go-live  
- Sprint 17+  

---

## 17. FINAL VERDICT

**BLOCKED — DECISION REQUIRED**

Alasan:
1. Implementasi referral di repo = **0% / MISSING**.  
2. Beberapa parameter bisnis **wajib untuk coding** tidak dinumerikkan di SRS (rate L1/L2, pending days, caps, fraud thresholds, basis amount, post-release clawback, custom-code rules).  
3. Tanpa lock tersebut, eksekusi akan melanggar `.cursorrules` (jangan mengarang).  

Setelah Owner mengunci §14 → status dapat naik ke **READY FOR EXECUTION**.

STOP. Tidak coding. Tidak migration. Tidak test baru. Tidak commit/push/deploy. Tidak lanjut Sprint 17.

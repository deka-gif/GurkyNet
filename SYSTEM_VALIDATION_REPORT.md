# GurkyNet — SYSTEM VALIDATION REPORT
## Release Candidate Final QA

**Role:** Principal QA Engineer  
**Date:** 2026-08-05  
**Scope:** Full platform after Sprint 1–5 (no code changes in this pass)  
**Method:** Static code review, route/middleware inspection, workflow tracing, automated validation suite  
**Assumption:** UI treated as feature-complete; focus is correctness, safety, and go-live fitness

---

## 1. Executive Verdict

**RC STATUS: CONDITIONAL FAIL — do not full go-live without gating Critical issues.**

Core PPOB rails (auth, wallet P2P, catalog checkout for pulsa/data/token/voucher, Digiflazz buy+webhook, Midtrans top-up, admin Finance/Ops/Marketing/CS/Owner, public CMS APIs) are substantially real and covered by automated tests (**136 passed** after `config:clear`).

However, Release Candidate is blocked by **money-safety and customer-facing honesty defects**:

1. Finance refund approve is **not idempotent** (double-credit risk).  
2. Digiflazz job has **no `failed()` refund** after retry exhaustion (funds can stick debit).  
3. Transaction create accepts client **`status` / `admin_fee`** (can bypass intended Digiflazz path).  
4. **Transfer** and **Tagihan** UX present live money flows that are incomplete or invent bill amounts.  
5. Public **Docs SDK** field names disagree with Laravel validation (mobile/integrator FAIL).

Staff CMS modules are largely **PASS**. User PPOB should soft-launch only on **Pulsa / Paket / Token PLN / Voucher / Wallet P2P / Midtrans top-up** with Transfer + Tagihan feature-flagged off until fixed.

---

## 2. Automated Validation Results

| Command | Result | Notes |
|---|---|---|
| `npm run lint` (`tsc --noEmit`) | **PASS** | Clean |
| `npm run build` | **PASS** | Vite production build ~11s |
| `php artisan optimize` | **PASS** | Config/events/routes/views cached |
| `php artisan route:list` | **PASS** | **157** routes registered |
| `php artisan migrate:status` | **PASS** | All migrations Ran through `2026_08_05_000023` |
| `php artisan test` | **PASS** | **136 passed** (853 assertions) when config cache cleared |
| `php artisan test` immediately after `optimize` | **WARNING** | Observed **2 failed / 134 passed** until `config:clear` — CI must clear config cache before PHPUnit |

---

## 3. Module Scorecard

| # | Module | Verdict | Summary |
|---|---|---|---|
| 1 | Authentication | **WARNING** | Sanctum + throttle OK; OTP not delivered (claims sent) |
| 2 | Authorization | **PASS** | Role middleware on admin; profile strips role |
| 3 | User / Profile | **WARNING** | API OK; no in-app PIN change UI |
| 4 | Wallet | **WARNING** | Balance/history/P2P/top-up OK; withdraw has no bank rail |
| 5 | Products | **PASS** | Catalog + detail by SKU real |
| 6 | Categories | **PASS** | Public index/show real |
| 7 | Providers | **PASS** | Public + ops update; status uses Digiflazz config |
| 8 | Digiflazz | **WARNING** | Buy/webhook/sync real; retry-exhaust + refund races |
| 9 | Transactions | **WARNING** | Core create/list/cancel/receipt OK; client `status` hole |
| 10 | Checkout | **FAIL** | Shared checkout OK for SKU flows; Transfer/Tagihan fail RC |
| 11 | Finance | **FAIL** | Dashboards real; refund approve not idempotent |
| 12 | Marketing | **WARNING** | CRUD → public banners OK; no voucher redeem |
| 13 | Operations | **PASS** | Sync/pricing/products/providers wired |
| 14 | Customer Support | **WARNING** | API real, no FE fake seeds; CS can credit wallet |
| 15 | Owner Dashboard | **PASS** | Executive APIs live; no fake Digiflazz balance |
| 16 | Notifications | **WARNING** | In-app OK; SMS always false; FCM External Dependency |
| 17 | Reports | **WARNING** | Finance reports only; no broader export module |
| 18 | CMS | **PASS** | Admin website/media behind roles |
| 19 | Public Website | **WARNING** | APIs real; homepage/section hard fallbacks if empty |
| 20 | Public APIs | **PASS** | Envelope, throttle, health, CMS feeds |
| 21 | Mobile APIs | **FAIL** | Platform/device APIs exist; Docs SDK contract wrong |

**Totals:** PASS **9** · WARNING **9** · FAIL **3**

---

## 4. Checklist Matrix (per module)

Legend: ✓ evidence OK · △ partial / warning · ✗ fail · — N/A

| Module | API | DB | Business | Validation | AuthZ | Errors | Empty | Success | Edge | Integration |
|---|---|---|---|---|---|---|---|---|---|---|
| Authentication | ✓ | ✓ | △ OTP | ✓ | ✓ | ✓ | ✓ | ✓ | △ | △ SMS |
| Authorization | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| User | ✓ | ✓ | △ PIN UI | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Wallet | ✓ | ✓ | △ withdraw | ✓ | ✓ | ✓ | ✓ | ✓ | △ fee | △ bank |
| Products | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Categories | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Providers | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ Digi |
| Digiflazz | ✓ | ✓ | △ fail path | ✓ | ✓ | △ | ✓ | ✓ | ✗ retries | ✓ |
| Transactions | ✓ | ✓ | △ status | △ | ✓ | ✓ | ✓ | ✓ | △ cancel | ✓ |
| Checkout | △ | ✓ | ✗ Transfer/Tagihan | △ | △ | △ | ✓ | ✓ SKU | ✗ | △ |
| Finance | ✓ | ✓ | ✗ refund | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ idem | △ |
| Marketing | ✓ | ✓ | △ redeem | ✓ | ✓ | ✓ | ✓ | ✓ | △ | ✓ banners |
| Operations | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | △ creds | ✓ sync |
| Customer Support | ✓ | ✓ | △ refund SoD | ✓ | ✓ | ✓ | ✓ FE | ✓ | △ | △ wallet |
| Owner Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Notifications | ✓ | ✓ | △ channels | ✓ | ✓ | ✓ | ✓ | ✓ | △ | △ FCM/SMS |
| Reports | △ | ✓ | △ finance-only | ✓ | ✓ | ✓ | ✓ | ✓ | △ | ✓ |
| CMS | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | △ seed | ✓ | ✓ | ✓ |
| Public Website | ✓ | ✓ | △ fallbacks | ✓ | — | ✓ | △ | ✓ | ✓ | ✓ |
| Public APIs | ✓ | ✓ | ✓ | ✓ | ✓ metrics | ✓ | ✓ | ✓ | ✓ | ✓ |
| Mobile APIs | ✓ | ✓ | △ push | ✓ | △ devices | ✓ | ✓ | ✓ | △ | ✗ Docs |

---

## 5. Workflow Simulations

### 5.1 Customer Purchase → Digiflazz → Webhook → Wallet → Finance → Owner → Notification → History → Receipt

| Step | Result | Evidence |
|---|---|---|
| Select product + PIN checkout | **PASS** (SKU flows) | `CheckoutSummary` → `POST /api/v1/transactions` with `sku_code` + `pin` |
| Wallet debit + draft→pending | **PASS** | `CreateTransactionAction` |
| Digiflazz job buy | **PASS** when configured | `ProcessDigiflazzTransaction` + `DigiflazzService::buy` |
| Success webhook / job success | **PASS** | Status + SN path |
| Fail → wallet refund | **PASS** on known fail path | Job + webhook fail handlers |
| Finance sees txn / settlements | **PASS** | Finance repository aggregates |
| Owner KPIs | **PASS** | Executive dashboard |
| Notification (DB) | **PASS** | Event → DB channel |
| Push / SMS | **WARNING** | FCM External Dependency; SMS always `false` |
| History + receipt | **PASS** | Wallet history + receipt endpoint |
| Job retries exhausted | **FAIL** | No `failed()` on Digiflazz job — debit can remain |
| Client `status` injection | **FAIL** | `TransactionController@store` passes `$request->input('status')` |

**Workflow verdict:** **WARNING** for core SKU purchase; **FAIL** under failure/retry and status-injection edges.

### 5.2 Refund → Finance → Wallet → Customer Support → Owner

| Step | Result | Evidence |
|---|---|---|
| CS create/escalate refund (notes) | **PASS** | CS refund APIs |
| Finance approve | **FAIL** | `FinanceRepository::approveRefund` always credits — no prior-credit / status guard |
| CS approve | **WARNING** | Credits wallet with weak notes check (`refund disetujui`) |
| Digiflazz auto-refund + manual approve | **FAIL** | Overlapping credit paths → double-pay risk |
| Owner audit visibility | **PASS** | Activity / executive surfaces |

**Workflow verdict:** **FAIL** — money integrity risk before RC.

### 5.3 Marketing → Banner → Website → Public API

| Step | Result | Evidence |
|---|---|---|
| Admin create banner | **PASS** | `/admin/marketing/banners` |
| Persist `BannerPromotion` | **PASS** | Marketing repository |
| Public `GET /public/banners` | **PASS** | `PublicWebsiteController` |
| Homepage consumes banners | **PASS** | Website store / homepage |

**Workflow verdict:** **PASS**

### 5.4 Operations → Product Sync → Pricing → Checkout

| Step | Result | Evidence |
|---|---|---|
| Ops sync Digiflazz | **PASS** if credentials set | `SyncDigiflazzCatalogAction` + schedule `digiflazz:sync` |
| Pricing update | **PASS** | Operations pricing endpoints |
| Catalog appears in `/products` | **PASS** | Product search/list |
| Checkout uses sell price | **PASS** for SKU pages | PricingService + CheckoutSummary |

**Workflow verdict:** **PASS** (blocked only by External Dependency Digiflazz credentials in empty env)

---

## 6. Issue Register

### Critical

| ID | Area | Finding | Impact |
|---|---|---|---|
| C1 | Finance | `approveRefund` credits wallet every call; no idempotency / already-refunded guard (`FinanceRepository.php` ~436–470) | Double refund / ledger loss |
| C2 | Digiflazz | `ProcessDigiflazzTransaction` has `$tries=3` but **no `failed()`** refund handler | Customer funds locked after permanent provider failure |
| C3 | Transactions | Create accepts client `status` (and `admin_fee`) outside FormRequest rules (`TransactionController.php` ~68–77); action default `$status = 'success'` | Bypass Digiflazz fulfillment / wrong settlement |
| C4 | Checkout / Transfer | Transfer builds checkout **without `skuCode`** → posts empty `sku_code` (`TransferPage.tsx`, `CheckoutSummary.tsx`) | Feature appears live; API always 422 / broken money UX |
| C5 | Checkout / Tagihan | “Cek Tagihan” sets bill amount = catalog product price (`TagihanPage.tsx` ~104–116) | Customer may pay fabricated outstanding |
| C6 | Mobile / Docs | Docs SDK uses `transaction_pin` / `target_wallet_number`; API expects `pin` / `recipient_wallet_number` (`DocsPage.tsx`) | All Doc-driven mobile/integrator calls fail |

### High

| ID | Area | Finding |
|---|---|---|
| H1 | Auth | OTP stored server-side but not delivered; API message implies sent (`AuthController` OTP) — **External Dependency:** SMS provider |
| H2 | Wallet | Withdraw debits to `processing` with no bank payout rail — **External Dependency** |
| H3 | Digiflazz / CS / Finance | Multiple refund credit paths can race (job webhook + finance + CS) |
| H4 | Transactions | Cancel while Digiflazz still in-flight can refund wallet while provider later succeeds |
| H5 | VIP Payment | Config/UI only; zero backend — **External Dependency / Pending** |
| H6 | Profile | No frontend PIN set/change UI despite backend endpoints |
| H7 | Checkout | `pinError` never set in `CheckoutSummary` — weak PIN failure UX |
| H8 | AuthZ FE | Staff can deep-link user PPOB routes (menu hides; router does not restrict) |
| H9 | Platform | Unauthenticated device register/push-token can overwrite/`null` `user_id` |
| H10 | CS | CS role can approve refunds that credit wallet (SoD weakness vs Finance) |

### Medium

| ID | Area | Finding |
|---|---|---|
| M1 | Wallet / TX | Client-controlled `admin_fee` on several money endpoints |
| M2 | Marketing | No voucher redeem / apply-on-checkout API |
| M3 | Marketing | Announcements create Notification rows but do not fan-out to all users’ inbox/push |
| M4 | Public Website | Hardcoded homepage/settings fallbacks when CMS empty |
| M5 | Reports | Only finance reports surface; no dedicated multi-dept reporting |
| M6 | Pulsa FE | Amount/admin fee derived from product name digits (fragile) |
| M7 | FE | `console.log` in transaction store ships in builds |
| M8 | Wallet FE | Top-up without `snap_token` shown as soft success |
| M9 | Ops | CI: PHPUnit flaky after `artisan optimize` without `config:clear` |
| M10 | Auth | Register does not require prior OTP verification |

### Low

| ID | Area | Finding |
|---|---|---|
| L1 | Owner FE | Misleading “DEMO” comment/banner wording on live dashboard |
| L2 | FE | Empty leftover `src/pages/admin/components/` directory |
| L3 | CS FE | Unused quick-action helper |
| L4 | Profile | Soft fields (`whatsappLinked`) may be unset |
| L5 | CMS | Static default seed content on empty tables (ops hygiene) |

---

## 7. External Dependencies (not code defects)

| Dependency | Status | Blocks |
|---|---|---|
| Production Digiflazz credentials | Required | Live purchase / sync / balance |
| Production Midtrans keys | Required | Live top-up |
| SMS / WhatsApp OTP gateway | Missing | Real OTP delivery |
| FCM server key | Optional | Push delivery |
| Apple Push certificates | Missing | iOS push |
| VIP Payment provider | Pending | Second supplier |
| Bank payout rail | Missing | Withdraw settlement |

Mark as **External Dependency**, not fake implementations.

---

## 8. Authorization & Security Spot Checks

| Check | Result |
|---|---|
| Admin routes use `auth:sanctum` + `EnsureRole` | **PASS** |
| Webhooks Digiflazz/Midtrans signature fail-closed | **PASS** (testing bypass when empty) |
| Metrics/status token gate | **PASS** |
| OTP `dummy_sent_code` only local/testing | **PASS** |
| Top-up ignores client settlement status | **PASS** (API forces pending) |
| Create transaction client `status` | **FAIL** (C3) |
| Finance refund idempotency | **FAIL** (C1) |
| Security headers + throttles | **PASS** |

---

## 9. Empty / Success / Error State Notes

| Surface | Empty state | Success | Error |
|---|---|---|---|
| Customer Support FE | **PASS** — no seeded fake tickets/refunds (Sprint 1–5 cleanup held) | Real API | Store errors |
| Owner system health | **PASS** — live Digiflazz/config probes | Real | Degraded statuses |
| Public CMS | **WARNING** — hardcoded fallbacks if DB empty | Real when seeded | — |
| Transfer / Tagihan | **FAIL** — incomplete inquiry presented as usable | N/A | Misleading |
| Notifications | Empty inbox OK | DB notifications OK | Push/SMS silent External Dependency |

---

## 10. RC Go / No-Go Recommendation

### Must fix before unrestricted production (Critical)

1. Idempotent refund ledger (single credit path; Finance-only settle).  
2. Digiflazz job `failed()` → refund + failed status.  
3. Strip client `status` (and constrain `admin_fee`) on create transaction.  
4. Feature-flag **off** Transfer bank flow and Tagihan “inquiry” **or** complete real integrations.  
5. Align Docs / OpenAPI SDK field names with Laravel FormRequests.

### Acceptable for limited soft launch (after Critical fixes or with features disabled)

- Pulsa / Paket Data / Token PLN / Voucher (catalog SKU checkout)  
- Wallet balance, history, P2P transfer, Midtrans top-up  
- Admin Finance (read + careful refund ops), Ops sync, Marketing banners, CS tickets (no wallet approve until SoD fixed), Owner, Public website CMS  

### Do not advertise as live until External Dependencies set

- OTP via SMS, push notifications, withdraw payout, VIP Payment  

---

## 11. Suggested Next QA Cycle (no implementation here)

1. Defect triage sprint targeting C1–C6 only.  
2. Manual E2E on staging with real Digiflazz/Midtrans sandbox.  
3. Abuse tests: double finance approve, concurrent webhook+job fail, create TX with `status=success`.  
4. CI job order: `config:clear` → `php artisan test` (never test against production-optimized config cache).  
5. Re-run this validation checklist; promote to **RC PASS** only when Critical = 0 and Transfer/Tagihan are fixed or removed from nav.

---

## 12. Sign-off

| Item | Value |
|---|---|
| Validation type | Full system RC QA (read-only) |
| Automated suite | 136/136 PASS (with config clear) |
| Build / lint | PASS |
| Migrations | All Ran |
| Module PASS / WARNING / FAIL | 9 / 9 / 3 |
| Critical open | **6** |
| High open | **10** |
| **Final disposition** | **CONDITIONAL FAIL — not ready for unrestricted Release Candidate go-live** |

*No application code was modified during this validation. Report only.*

# SPRINT 15 EXECUTION REPORT
## FR-DIFF-03 Margin Agen + FR-DIFF-10 Cash-Flow Owner + FR-DIFF-02 Auto-Reorder

**Status:** `SPRINT 15 READY FOR VERIFICATION`  
**Date:** 2026-08-27  
**SRS:** GurkyNet v2.2 CLEAN — Bagian 12 (FR-DIFF-02/03/10)  
**Do not claim COMPLETE** until Owner verification.

---

## Business decisions (locked — implemented)

### FR-DIFF-03 Margin Agen
| Rule | Implementation |
|------|----------------|
| Harga | `product_prices` per `agent_level` (reguler/gold/platinum/end_user) |
| Basis margin | `sell_price(level) − provider cost (products.base_price)` |
| Bentuk | Nominal Rp; reuse `PricingService::defaultMargin()` display only |
| Role | Operations (GET calculator + PUT level prices) |
| Mode | **DISPLAY-ONLY** — no checkout / live PricingService mutation |
| Loyalty | Remains separate from `agent_level` (Sprint 14) |

### FR-DIFF-10 Cash-Flow Owner
| Rule | Implementation |
|------|----------------|
| Horizon | 30 days |
| Basis | Real SUCCESS wallet product sales (`transactions`) |
| Method | Moving average over last 30 calendar days |
| Min history | ≥ 7 days with sales; else insufficient-data (no fake numbers) |
| Providers | Digiflazz + VIPayment balances from `product_providers` |
| Alert | `alert_thresholds: null` — dashboard only |
| Access | Owner GET read-only; no mutation route |

### FR-DIFF-02 Auto-Reorder
| Rule | Implementation |
|------|----------------|
| Trigger | `schedule_day` (1–28) + `next_run_at` |
| Insufficient balance | Pause + notification + audit; no partial debit / no auto-topup |
| Approval | User activate/resume with PIN; no per-run manual approval |
| Retry | Max 3; interval 1 hour; idempotent keys per attempt |
| Provider | Existing `CreateTransactionAction` → ProviderRouter / failover |
| Gate | If `PURCHASE_ENABLED=false` → skip purchase; keep subscription |
| Production | Purchase / withdraw / auto-topup / live auto-reorder **not** enabled |

---

## FR-DIFF-03 — Margin calculator

| Item | Detail |
|------|--------|
| Service | `App\Services\Pricing\AgentMarginCalculatorService` |
| Model | `App\Models\ProductPrice` (existing table) |
| API | `GET/PUT /api/v1/admin/operations/agent-margin/{productId}…` |
| UI | `OperationsAgentMarginPage` → `/dashboard/operations/agent-margin` |
| Negative margin | Shown as-is; prices not auto-corrected |
| Checkout | Untouched — calculator does not call live purchase pricing path |

---

## FR-DIFF-10 — Cash-flow projection

| Item | Detail |
|------|--------|
| Service | `App\Services\Finance\CashFlowProjectionService` |
| API | `GET /api/v1/admin/executive/cash-flow-projection` |
| UI | `OwnerCashFlowProjectionPage` → `/dashboard/owner/cash-flow` |
| Output | historical_cashflow, projected_cashflow (30), MA daily, Digi+VIP balances, source, timestamp, disclaimer |
| Aggregation | PHP date grouping (portable SQLite/MySQL) |

---

## FR-DIFF-02 — Auto-Reorder

| Item | Detail |
|------|--------|
| Migration | `2026_08_27_500001_create_user_subscriptions_table.php` (up/down) |
| Model | `App\Models\UserSubscription` |
| Service | `App\Services\Subscriptions\AutoReorderService` |
| Command | `subscriptions:process-auto-reorder` (scheduled every minute) |
| User API | CRUD + pause/resume/cancel under `/api/v1/subscriptions` |
| Ops monitor | Read-only list (`OpsSubscriptionMonitorController`) — no takeover |
| Purchase path | Reuses `CreateTransactionAction` with `trusted_subscription` (PIN skipped only for scheduler) |
| Idempotency | Key `auto-reorder:{id}:{run}:{retry}` |
| Notifications | Reuse `NotificationService` (executed / success / failure / insufficient / paused) |

### Scheduler / gate

1. Active subscription due (or retry due)  
2. If gate OFF → `AUTO_REORDER_SKIPPED_GATE`, advance `next_run_at`, **no** transaction  
3. Else wallet check → pause if insufficient  
4. Else one CreateTransactionAction call (existing lock/idempotency/provider)  
5. Failure → retry up to 3 × 1h, then pause + notify  

---

## Tests

**Suite:** `tests/Feature/Sprint15DifferentiatorTest.php`  
**Result:** **18 passed / 57 assertions**

Coverage mapped to prompt items 1–28 (margin, cash-flow, CRUD, gate, balance, retries, success/no-dup, ownership/IDOR, RBAC).

### Regression (filtered)

`Sprint3*` + `Sprint7*` + `Sprint10*` + `Sprint11*` + `Sprint12*` + `Sprint14*` + `Sprint15*` → **174 passed**.

### Full suite

| Result | Count |
|--------|-------|
| PASS | 792 |
| FAIL | 1 — **pre-existing** `Admin\FinanceTest::finance_user_can_list_settlements` missing `pagination` |
| Sprint 15 new regressions | **none** |

### Frontend

| Check | Result |
|-------|--------|
| `npm run lint` | FAIL — **pre-existing** TS debt (refresh intervals, finance.store, RealtimeManager, marketing animation) — **no Sprint 15 page errors in lint list** |
| `npm run build` | FAIL — **pre-existing** `RealtimeManager.ts` cannot resolve `../../api` |

---

## Completion gate checklist

### FR-DIFF-03
- [x] product_prices per agent_level  
- [x] provider cost  
- [x] sell price  
- [x] margin calculation  
- [x] display-only  
- [x] no checkout pricing mutation  

### FR-DIFF-10
- [x] 30-day projection  
- [x] moving average  
- [x] Digi  
- [x] VIP  
- [x] real data only  
- [x] insufficient-data handling  
- [x] Owner read-only  
- [x] no alert threshold  

### FR-DIFF-02
- [x] subscription CRUD  
- [x] schedule_day  
- [x] feature gate  
- [x] idempotency  
- [x] wallet safety  
- [x] 3 retries  
- [x] 1-hour interval  
- [x] insufficient balance pause  
- [x] provider failover (via existing CreateTransaction / ProviderRouter)  
- [x] checkStatus after dispatch (via existing purchase pipeline; no second engine)  
- [x] no duplicate purchase  
- [x] notification  
- [x] ownership  
- [x] no production activation (`PURCHASE_ENABLED` default false)  

### TEST / SCOPE
- [x] Sprint15 tests PASS  
- [x] Sprint3–14 regression PASS (filtered)  
- [x] no new regression from Sprint 15  
- [x] no FR-DIFF-04..07 / referral / H2H / Sprint 16+  
- [x] no production purchase / withdraw / auto-topup / live auto-reorder enablement  

---

## Findings

1. Auto-reorder **scheduler is wired**, but **execution is gated** — with `PURCHASE_ENABLED=false` it only skips + logs; subscriptions remain stored.  
2. Margin Ops `PUT` upserts `product_prices` for display/config of level sell prices; it does **not** change the live checkout calculator path used by public purchase.  
3. Cash-flow MA uses days in the 30-day window including zero-sale days in the average denominator (full window avg); insufficient if &lt; 7 days have sales.  
4. Dirty multi-sprint working tree — Sprint 15 artifacts coexist with prior sprint files; do not treat entire `git status` as Sprint 15-only.

---

## Out of scope (not done)

- FR-DIFF-04..07  
- Referral / downline / H2H  
- Sprint 16+  
- Loyalty / KYC / provider rewrite  
- Wallet/idempotency rebuild  
- Purchase / withdraw / auto-topup / production auto-reorder go-live  
- Fixing Finance settlements pagination or frontend TS/build debt  

---

## Key files (Sprint 15)

- `laravel/app/Services/Pricing/AgentMarginCalculatorService.php`  
- `laravel/app/Services/Finance/CashFlowProjectionService.php`  
- `laravel/app/Services/Subscriptions/AutoReorderService.php`  
- `laravel/app/Http/Controllers/Api/v1/Admin/AgentMarginController.php`  
- `laravel/app/Http/Controllers/Api/v1/Admin/OwnerCashFlowController.php`  
- `laravel/app/Http/Controllers/Api/v1/SubscriptionController.php`  
- `laravel/app/Console/Commands/ProcessAutoReorderCommand.php`  
- `laravel/database/migrations/2026_08_27_500001_create_user_subscriptions_table.php`  
- `laravel/tests/Feature/Sprint15DifferentiatorTest.php`  
- FE: `OperationsAgentMarginPage`, `OwnerCashFlowProjectionPage`, `AccountSubscriptionsPage`, `src/services/sprint15/`  

---

**SPRINT 15 READY FOR VERIFICATION**

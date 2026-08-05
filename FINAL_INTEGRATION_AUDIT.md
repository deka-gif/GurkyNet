# GurkyNet — FINAL INTEGRATION READINESS AUDIT

**Audit type:** Final Integration Readiness Audit (pre-production-implementation gate)
**Scope:** Full repository — `src/` (React/Vite frontend), `laravel/` (Laravel 11 backend/API), database schema, CMS, Digiflazz/VIP Payment provider layer.
**Method:** Static, read-only inspection of every controller, action, repository, service, model, migration, seeder, route, page, store, and service-layer file. No code was modified. Cross-checked against pre-existing internal QA artifacts (`qa_report.md`, `cms_verification_final.txt`) where available.
**Assumption honored:** UI is treated as functionally complete. This audit focuses exclusively on **integration quality** — is the UI actually wired to a real, single-source-of-truth Laravel backend, and is that backend actually wired to real PPOB suppliers.

---

## 1. Executive Summary

GurkyNet is **architecturally sound but operationally unfinished**. The core scaffolding — Repository/Action/Service pattern, Sanctum auth, a centralized axios client, Zustand stores, role-based routing/middleware — is real and consistently applied. The majority of CRUD-style admin modules (Finance, Marketing, Operations, Owner, Website CMS) **do** read and write through the Laravel API against real Eloquent models, not static mock arrays. This is a materially different (better) state than the older `qa_report.md` / `cms_verification_final.txt` snapshots in the repo suggest — those artifacts are now **stale**; most pages they marked `FAIL`/mocked are, as of this audit, wired to real stores and services.

However, three categories of problems make GurkyNet **not ready for full production implementation**:

1. **The two things a PPOB platform exists to do — buy from a live supplier at a live price, and show truthful operational health — are incomplete.** Digiflazz has a real purchase/webhook path, but product/price/stock sync is dead code (never invoked), the live catalog is a static seeder, and Digiflazz balance/health is a hardcoded string. **VIP Payment does not exist in the backend at all** — only a settings toggle in the UI implies a second live supplier that has zero implementation.
2. **Several "real-looking" screens quietly fall back to fabricated data.** Customer Support (customer profile, ticket detail, transaction investigation, refund center, knowledge base) calls the real API first, but injects hardcoded demo records (named customers, fake ticket timelines, fake refunds) whenever the API returns empty — meaning a fresh production database will silently display fake support data indefinitely. Owner's System Health widget and Marketing's campaign analytics are **100% hardcoded**, not degraded-fallback but fully fake, on every render.
3. **There are functional defects, not just missing polish**, discovered incidentally during this integration review: a duplicate/legacy Admin CMS (`src/pages/admin/*`) still exists in parallel to the real CMS and runs entirely on `localStorage`; `CreateTransactionAction` has unreachable code after an early `return` that appears to prevent the Digiflazz fulfillment job/events from firing on every transaction; `CustomerSupportRepository::approveRefund` is missing required imports and will likely throw a fatal error at runtime; there is **no backend endpoint to create or manage staff accounts** (Finance/Operations/Marketing/CS/Owner users) at all.

None of these are cosmetic. They are the specific things standing between GurkyNet and a genuine production PPOB launch.

---

## 2. Overall Integration Percentage

Scored by evidence-weighted layer, not by page count alone (a page that calls the API but silently substitutes fake data on empty responses is counted as **Partial**, not Real):

| Layer | Integration % | Basis |
|---|---|---|
| Frontend → Laravel API wiring | **~72%** | ~30 pages fully real, ~15 partial (real call + hardcoded fallback/simulated inquiry), ~7 mock (legacy `/admin` CMS cluster, orphan `PlaceholderServicePage`) |
| Backend business logic (DB-backed vs fake) | **~68%** | Majority of endpoints real/partial; several dashboards (system-health, campaign performance, avg response time) fully fabricated |
| Provider integration (Digiflazz + VIP) | **~30%** | Digiflazz buy+webhook real; sync/health fake or dead; VIP Payment 0% implemented |
| CMS content propagation (admin → public) | **~75%** | Banner/Homepage/Settings/Menu/Static Pages/Media share one DB source with no cache delay; Promotion/Announcement have no public read path at all |
| Master data / single source of truth | **~65%** | Users/Wallet/Transactions clean; Products, Categories(dead enum), and 3 overlapping settings tables duplicated |
| Mobile (Android/PWA/iOS) readiness | **~40%** | Sanctum + JSON envelope + pagination exist; APK version check, push tokens, production CORS, rate limiting all missing |

**Weighted Overall Integration: ≈ 60%**

GurkyNet is roughly **six-tenths of the way** from "admin UI + database schema" to "fully integrated production PPOB platform." The remaining 40% is concentrated in provider sync, fake-dashboard removal, CS fallback removal, and mobile/production hardening — not general CRUD wiring, which is mostly done.

---

## 3. Module Integration Matrix

| Module | Status | Why |
|---|:---:|---|
| Authentication | 🟡 Partially Integrated | Register/login/logout/refresh/PIN are real, DB-backed, Sanctum-issued. OTP is persisted server-side but **delivery is a no-op** — the API response itself leaks `dummy_sent_code` (`AuthController.php:149-181`); `two_factor_status` is hardcoded `false` (`ProfileRepository.php:141`); avatar is a placeholder URL (`ProfileResource.php:20,40`). |
| CMS | 🟡 Partially Integrated | Banner/Homepage/Website Settings/Menus/Static Pages/Media: admin and public share the same tables, no cache delay — real propagation. Promotion and Announcement are **admin-only, no public read endpoint exists**. A **fully separate, fully mock legacy CMS** still lives at `src/pages/admin/*` (`dataStore.ts`, `AdminPage.tsx`) driven by `localStorage`, parallel to the real one. |
| Homepage | 🟡 Partially Integrated | Section order/visibility/title/description come from `homepage_sections` via API. Hero, Features, HowItWorks, and FAQ **component internals are hardcoded arrays**, ignoring CMS-managed media/content (`Hero.tsx`, `Features.tsx:6-37`, `HowItWorks.tsx:4-25`, `Faq.tsx:7-40`). |
| Products | 🟡 Partially Integrated | `products` table is the real, queried catalog for public listing, checkout, and Operations admin. But it is manually seeded — `digiflazz_products` (the live-supplier mirror) is **never synced**, so the "live" catalog is static demo data dressed as production data. |
| Categories | 🟢 Fully Integrated | Single table (`product_categories`), consistently used by public catalog, Operations, and Digiflazz sync mapping. (Dead code note: `App\Enums\ServiceCategory` exists but is never referenced.) |
| Providers | 🟡 Partially Integrated | `providers` (brand) table is real and consistently used, but represents brand metadata only — there is no live link between a `Provider` row and actual Digiflazz supplier status/balance/uptime. |
| Digiflazz | 🟡 Partially Integrated | Real HTTP client with MD5 signing, real queued buy job, real HMAC-verified webhook that updates transactions and refunds wallets on failure. **But**: product/price/stock sync method exists and is **never called** by any job/command/scheduler; balance/health is a **hardcoded string** (`Rp 45.321.000`, `OwnerRepository.php:176-186`); a dead-code bug in `CreateTransactionAction` may prevent the fulfillment dispatch from ever running. |
| VIP Payment | ⚫ Not Connected | Env keys and a `services.php` config block exist. `SystemSettingsCenter.tsx` renders a full VIP Payment settings panel including a "provider priority" failover selector. **Zero backend implementation** — no service class, no job, no controller, no route, no HTTP call anywhere in `laravel/app`. Toggling the UI does nothing. |
| Transactions | 🟡 Partially Integrated | Create/list/show/cancel are real, DB-backed, wallet-integrated. Receipt endpoint returns real amounts but a **hardcoded company header and a literal `DUMMY-SN-*` serial number** instead of the real Digiflazz SN already stored on `digiflazz_transactions.sn` (`GetReceiptAction.php:27-44`). |
| Wallet | 🟡 Partially Integrated | Balance, history, transfer, and Midtrans top-up are real and consistently mutate `wallets`/`wallet_histories`. A sandbox branch in `TopUpWalletAction` (`payment_method => 'dummy_gateway'`) can credit a wallet without a real Midtrans transaction when `status=success` is passed directly. |
| Finance | 🟢 Fully Integrated | Dashboard, reports, refunds (approve/reject), and settlements are all real aggregations over `Transaction`/`PaymentHistory`/wallet data on the backend; the frontend dashboard and all four sub-pages are wired through `useFinanceStore` to the real `/admin/finance/*` endpoints. |
| Operations | 🟡 Partially Integrated | Dashboard/product/provider management are real DB-backed CRUD. Monitoring shows a **synthetic response time (`'-'`)** and an uptime figure derived from product-count ratios rather than real supplier telemetry; Pricing falls back to **hardcoded default margins** when `settings` is empty. |
| Marketing | 🟡 Partially Integrated | Banner/Promotion/Voucher/Announcement CRUD is real. The Marketing Dashboard's **campaign performance block (views/clicks/CTR/conversion) is 100% fabricated** (`MarketingService.php:49-55` — literal `12500`, `3200`, `25.6`, `12.8`), on every load, not just when empty. |
| Customer Support | 🟡 Partially Integrated | Dashboard/ticket list/refund CRUD hit real endpoints. But Customer Profile, Ticket Detail, Transaction Investigation, Refund Center, and Knowledge Base **all inject large hardcoded fallback datasets** (named demo customers, fake ticket timelines, seeded refunds `REF-2026-001/002`, static SOP articles) whenever the API returns empty — indistinguishable from real data to an end user. `avg_response_time` is a hardcoded string. |
| Owner Dashboard | 🟡 Partially Integrated | Revenue, user counts, financial overview, and audit logs are real aggregations. **System Health is a fully hardcoded array** including the fake Digiflazz balance; `provider_latency`/department-overview KPIs include hardcoded values; Activity Timeline fabricates events when the log table is empty. |
| Notifications | 🟡 Partially Integrated | In-app notification storage, read/unread state, and the notification inbox page are real, DB-backed (`notifications`/`user_notifications`). Push/SMS delivery in `NotificationService` is a **log-only stub that always returns `true`** — nothing is actually sent to a device. |
| Reports | 🟡 Partially Integrated | Finance's financial report is real. Marketing "reports" (campaign performance) are fabricated. Owner's audit-log/activity-timeline reporting is real when data exists, fabricated when it doesn't. |
| Public Website | 🟡 Partially Integrated | Settings, menus, static pages, and banners are real and correctly propagate from the CMS. Promotions and Announcements, despite being fully manageable in the CMS, **have no public endpoint** and cannot reach the storefront or a future mobile app. FAQ table exists but is not exposed via any route — the public FAQ section is a hardcoded array. |

---

## 4. Complete Dummy Inventory

### 4.1 Dummy / hardcoded data — Frontend

| Type | Evidence |
|---|---|
| Demo users / staff accounts (legacy CMS) | `src/pages/admin/dataStore.ts:7-73` — `initialUsers` (Ahmad Faisal, Siti Aminah, Budi Santoso, …) |
| Demo products (legacy CMS) | `src/pages/admin/dataStore.ts:75-84` — `initialProducts` |
| Demo transactions (legacy CMS) | `src/pages/admin/dataStore.ts:86-139` — `initialTransactions` |
| Fake ledger / audit logs (legacy CMS) | `src/pages/admin/dataStore.ts:141-196` |
| Fake integration keys (legacy CMS) | `src/pages/admin/dataStore.ts:198-213` — fake Digiflazz/Midtrans keys, persisted via `localStorage` keys `admin_cms_*` |
| Fake PPOB inquiry — bill/customer lookup | `TagihanPage.tsx:100-134` (fake customer names + bill amounts), `TokenPlnPage.tsx:47,83-98` (fake PLN customer + `Math.random()` token/SN), `TransferPage.tsx:70-74` (fake recipient names `EKA CHANDRA SAPUTRA`, `DEWI AYU LESTARI`) |
| Placeholder simulation page | `PlaceholderServicePage.tsx:65-71,76` — explicit "not connected to Laravel API" simulation with hardcoded nominal list; currently orphaned/unrouted |
| Fake support/CS fallback data | `CustomerSupportRefundCenter.tsx:53-94` (seed refunds `REF-2026-001/002`), `CustomerSupportKnowledgeBase.tsx:58-85` (seed SOP articles), `CustomerSupportCustomerProfile.tsx:78-229` (fallback profile/transactions/activities for "Siti Rahmawati"), `CustomerSupportTicketDetail.tsx:64-107` (fallback customer + hardcoded timeline), `CustomerSupportTransactionInvestigation.tsx:33-37,51-164` (default `TRX-982104` + fake timeline/system logs) |
| Fake dashboard deltas | `CustomerSupportDashboard.tsx:44-74` — hardcoded change strings (`'+3 dari jam lalu'`, `'14m'`, `'2j 15m'`) |
| Hardcoded homepage content | `components/sections/Features.tsx:6-37`, `HowItWorks.tsx:4-25`, `Faq.tsx:7-40`, `AppPreview.tsx:14-19` (`fallbackPreviews`) |
| Mock UX artifacts | `CheckoutSummary.tsx:173-175` ("PDF (Mock)…"), `CheckoutSummary.tsx:407,443` ("Dummy PIN: 123456") |
| Stale integration checklist | `src/contracts/backendIntegrationChecklist.ts` — marks **every** module `currentStatus: 'Dummy Service'`; contradicted by actual code and should not be trusted as current status |
| `Math.random()` faking values | `admin/dataStore.ts:4`, `AdminPage.tsx:74-75`, `AdminUsers.tsx:99`, `TokenPlnPage.tsx:83`, `DocsPage.tsx:39,49,318-319,382-383` |
| localStorage as business data source | `admin_cms_users/_products/_transactions/_ledger/_audit_logs/_settings` (legacy Admin CMS only — all other pages use API-backed Zustand stores; auth token/user cache in `storage.service.ts` is legitimate) |

### 4.2 Dummy / hardcoded data — Backend

| Type | Evidence |
|---|---|
| Fully fake dashboard payload | `OwnerRepository::getSystemHealth` — entire array literal incl. fake Digiflazz balance `Rp 45.321.000` (`OwnerRepository.php:176-186`) |
| Fake data on empty state | `OwnerRepository::getActivityTimeline` fabricates Budi/Support/Marketing/gateway events when logs are empty (`:264-337`) |
| Fake analytics | `MarketingService::getCampaignPerformance` — literal views/clicks/CTR/conversion (`MarketingService.php:49-55`) |
| Fake reports/SN | `GetReceiptAction` — hardcoded company header + `DUMMY-SN-*` instead of real Digiflazz SN (`:27-44`) |
| Fake response times / SLAs | `CustomerSupportRepository.php:46` (`'avg_response_time' => '4m 12s'`), `OwnerRepository.php:146` (`'provider_latency' => '124ms'`), `OperationsRepository.php:216-228` (synthetic `response_time => '-'`, ratio-derived uptime) |
| Static "knowledge" content | `CustomerSupportRepository.php:464-477` — SOP articles hardcoded, not DB-backed |
| Sandbox/dummy credentials & bypass paths | `MidtransService.php:18-19` (`dummy_server_key`/`dummy_client_key` fallback), `DigiflazzService.php:16-17` (`dummy_username`/`dummy_api_key` fallback), `TransactionController.php:326` (webhook signature `dummy_server_key` fallback), `TopUpWalletAction.php:42-54` (`dummy_gateway` bypass), `AuthController.php:149-181` (`dummy_sent_code` leaked in API response) |
| Placeholder resource fields | `ProfileResource.php:20,40` — `https://via.placeholder.com/150` avatar |
| Hardcoded system status | `SystemSettingAction.php:26-33` — queue/redis/storage status hardcoded Active/Connected/Healthy; `HealthCheckController.php:47,110` — queue always `'UP'`, baseline `1.25` |
| Hardcoded pricing fallback | `OperationsRepository.php:340-349` — default category/provider margins when `settings` empty |
| Demo/self-seeding public content | `PublicWebsiteController.php:58-82,156-169` and `WebsiteSettingRepository.php:69-96` — auto-create hardcoded default settings/banner if table is empty |
| Seeder demo accounts | `DatabaseSeeder.php:577-723` — named personas (`Budi Santoso`, `Siti Nurhaliza`, `Demo User GurkyPay`), weak passwords (`admin123`, `demo123456`), balances of `999999999` |
| Seeder fake engagement counters | `DatabaseSeeder.php:311-396` — fake `used_count` values (14, 128, 45) on promo/voucher seed rows |

### 4.3 Mock Services / Fallback Services

| Type | Evidence |
|---|---|
| Legacy mock admin panel (parallel CMS) | `src/pages/admin/` entire subtree — independent of the real Marketing/Website CMS, runs on seeded `localStorage` state, only logout calls the real API (`AdminPage.tsx`) |
| Fake feature-test harness | `AdminFeatureTests.tsx:33-80` — simulated PASS logs, no real HTTP calls |
| Notification delivery stub | `NotificationService.php` — push/SMS/email "send" methods are log-only stubs that always report success (push: `:104-112`) |
| Dead/never-invoked sync service path | `ProviderRepository::syncWithDigiflazz` (`:26-80`) — fully written Digiflazz→DB upsert logic, never called by any Job/Command/Controller |
| Orphaned Action classes | `Actions\Product\PricingAction.php`, `Actions\Product\AvailabilityAction.php` — never injected anywhere (their underlying services *are* used elsewhere directly) |
| Frontend service targeting nonexistent routes | `src/services/banner/banner.service.ts:20-42` — create/update/delete call plain `/banners`, which **does not exist** in `routes/api.php` (real CRUD lives at `/admin/marketing/banners`) |

---

## 5. API Gap Analysis

### 5.1 Backend endpoints that exist but are effectively unused or under-consumed
- `GET /admin/customer-support/stats` — largely superseded by `dashboard`; confirm frontend actually calls it or remove.
- `GET /admin/customer-support/investigation` vs `GET /admin/customer-support/investigations/{transaction}` — two similarly-named endpoints; only one path is clearly exercised by `CustomerSupportTransactionInvestigation.tsx`.
- `ProviderRepository::syncWithDigiflazz` — fully implemented but **has no route or command to invoke it at all**. This is the single most important "gap" in the entire audit: the code to make the catalog real already exists and is simply never wired to anything callable.

### 5.2 Frontend requests with no matching backend endpoint
- `banner.service.ts` create/update/delete → `POST/PUT/DELETE /banners` — **no such route**. Only `GET /public/banners` (public) and the full CRUD set under `/admin/marketing/banners` (real) exist. This is dead/broken client code that should either be removed or repointed.
- `src/contracts/apiEndpoints.ts` lists generic `/users` CRUD (`GET|POST /users`, `GET|PUT|DELETE /users/:id`) with **no corresponding backend route anywhere**. This mirrors a real functional gap (see 5.3 below), not just documentation drift.

### 5.3 Missing endpoints (confirmed absent from `routes/api.php`)
| Missing capability | Impact |
|---|---|
| **Admin/staff user management** (create, list, update, deactivate Finance/Operations/Marketing/CS/Owner accounts, assign roles) | There is genuinely no way to provision a new staff account except direct DB/seeder access. This blocks real onboarding of internal teams. |
| **APK version / force-update check** (`ApkVersion` model + table exist; no controller/route) | Android app cannot be released with a working update-gate. |
| **Push notification device token registration** | `NotificationService::sendPush` has nothing to send to — no device-token storage or endpoint exists. |
| **Public Promotion / Voucher / Announcement feed** | CMS can create these, but neither the public website nor a future mobile app can read them back. |
| **Public FAQ endpoint** | `faq` table exists and is used only by the internal CS knowledge base; public-facing FAQ is a hardcoded frontend array. |
| **Digiflazz manual/scheduled catalog sync trigger** | The upsert logic exists (`ProviderRepository::syncWithDigiflazz`) but nothing calls it — no artisan command, no scheduled job, no admin "Sync Now" endpoint. |
| **Live provider balance/health check** | No Digiflazz balance-check API call exists; Owner's "system health" is hardcoded instead. |

---

## 6. Database Gap Analysis

Full schema: 33 tables across 19 migrations, one seeder (`DatabaseSeeder.php`), 6 factories.

### 6.1 Duplicate / overlapping sources of truth
| Concept | Tables involved | Verdict |
|---|---|---|
| Products | `products` (canonical, queried everywhere) vs `digiflazz_products` (write-only mirror, no FK, never read back) | **Duplicate, drift risk.** Recommend: either wire the sync end-to-end and treat `digiflazz_products` as authoritative supplier cache feeding `products`, or drop it. |
| Settings / config | `settings` vs `system_settings` vs `website_settings` | **Triple overlap** on concepts like `app_name`/`maintenance_mode`/integration keys. Recommend one KV table for secrets (`system_settings`), one for public branding (`website_settings`), retire `settings` or scope it strictly to pricing margins. |
| CMS pages | `pages` (orphan, zero references) vs `static_pages` (actually used) | **Dead duplicate** — drop `pages`. |
| Categories | `product_categories` (canonical) vs unused `App\Enums\ServiceCategory` | Enum is dead code, not a real duplication risk, but should be reconciled or removed. |

### 6.2 Orphan / unused tables
- `pages` — model exists, zero application references.
- `apk_versions` — model exists, zero application references (no route surfaces it — see §5.3).
- `password_resets` — legacy Laravel table; app's actual password-reset flow uses `otp_codes` instead; config's default `password_reset_tokens` name doesn't even match this migration.
- `sessions` — created but the app authenticates via Sanctum tokens; unused under default `SESSION_DRIVER=file`.

### 6.3 Write-dead tables (schema + read path exist, nothing ever inserts)
- `payment_histories` — read by `FinanceRepository`, never written by any action/job (Midtrans data instead lives in `midtrans_transactions`). Dashboards referencing this table will always show it empty.
- `login_logs` — read by `ProfileRepository` (security page), never written by `LoginUserAction`. The "recent logins" security UI can never show real data.

### 6.4 Data-integrity / naming issues
- `users.role` migration default is `'customer'` (`2026_07_30_000001...php:17`) but the actual `UserRole` enum and all application logic use `'user'` — dormant mismatch that will only bite if a row is ever created without an explicit role.
- `CustomerSupportRepository::approveRefund` is missing required `use` imports (`Auth`, `DB`, `TransactionStatus`, `WalletHistoryType`) — this is very likely a **runtime fatal error waiting to happen** the first time a CS agent approves a refund through that code path (Finance's separate `approveRefund` implementation is fine).
- Seeder ships **known, weak, production-shaped credentials** (`admin123`, `demo123456`) for named staff/demo accounts — unsafe if `db:seed` is ever run against a production-like environment without variation.

---

## 7. Integration Priority

**P0 — Blocks safe production launch (functional/data-integrity defects, not just missing features)**
1. Fix `CustomerSupportRepository::approveRefund` missing imports (will fatal-error in production).
2. Fix/verify `CreateTransactionAction` dead code after `return` — confirm Digiflazz fulfillment dispatch actually fires on every transaction.
3. Remove or gate the legacy `/admin` mock CMS (`src/pages/admin/*`) so it cannot be reached/confused with the real CMS in production.
4. Remove silent CS/Owner/Marketing fake-data fallbacks (Customer Profile, Ticket Detail, Investigation, Refund Center, Knowledge Base, System Health, Campaign Performance) — replace with honest empty/error states.
5. Decide the VIP Payment question: either implement it for real, or remove the UI toggle/priority selector so it stops implying a working second supplier.

**P1 — Required for genuine PPOB production integrity**
6. Wire `ProviderRepository::syncWithDigiflazz` to a scheduled job/artisan command; stop relying on a static product seeder for the "live" catalog.
7. Implement real Digiflazz balance/health check to replace the hardcoded `OwnerRepository::getSystemHealth`.
8. Build admin/staff user management endpoints (currently no way to provision Finance/Operations/Marketing/CS accounts via API).
9. Add public Promotion/Voucher/Announcement/FAQ read endpoints so the storefront and future mobile app can actually consume CMS content that already has an admin UI.
10. Fix `banner.service.ts` to call the real `/admin/marketing/banners` routes instead of the nonexistent `/banners` CRUD.

**P2 — Required before Android/iOS/PWA release**
11. Add APK version/force-update endpoint (model already exists).
12. Add push-notification device token registration + wire `NotificationService::sendPush` to a real provider (FCM/APNs).
13. Expand CORS beyond `localhost:3000` for real web/PWA/mobile origins; add rate limiting/throttling.
14. Make media URLs CDN/absolute-ready instead of relative `/storage/...` paths.

**P3 — Cleanup / hardening**
15. Consolidate `settings` / `system_settings` / `website_settings` overlap; drop dead `pages` table and `ServiceCategory` enum; decide fate of write-dead `payment_histories`/`login_logs`.
16. Stop leaking OTP codes in API responses; replace sandbox `dummy_gateway`/`dummy_server_key` fallbacks with environment-gated (non-production) behavior only.
17. Replace seeded weak staff/demo passwords with a safe production seeding strategy.
18. Update or delete the stale `src/contracts/backendIntegrationChecklist.ts` so it stops contradicting the real, wired codebase.

---

## 8. Recommended Sprint Order

**Sprint 1 — Stop the bleeding (defects & trust)**
- Fix `CustomerSupportRepository::approveRefund` imports.
- Verify/fix `CreateTransactionAction` Digiflazz dispatch reachability.
- Remove CS/Owner/Marketing hardcoded fallback data; replace with real empty states.
- Decommission or clearly quarantine the legacy `/admin` mock CMS.
- Make the VIP Payment go/no-go decision.

**Sprint 2 — Make the supplier layer real**
- Wire Digiflazz product/price/stock sync to a scheduled job.
- Implement real Digiflazz balance/health check; remove hardcoded system-health payload.
- Fix `banner.service.ts` endpoint mismatch.
- Fix receipt serial number to use the real Digiflazz SN.

**Sprint 3 — Close functional/API gaps**
- Admin/staff user management endpoints + UI.
- Public Promotion/Voucher/Announcement/FAQ endpoints, wired into the public site.
- Decide VIP Payment implementation if Sprint 1 chose "build it."

**Sprint 4 — Mobile/production readiness**
- APK version/force-update endpoint.
- Push device-token registration + real push delivery.
- CORS, rate limiting, CDN-ready media URLs.

**Sprint 5 — Data model & security hardening**
- Consolidate settings tables; drop dead tables/enum.
- Remove OTP leakage and sandbox bypass paths from production code paths.
- Replace weak seeded credentials; finalize production seeding strategy.
- Retire stale documentation/checklist artifacts (`backendIntegrationChecklist.ts`, old `qa_report.md`/`cms_verification*.txt`) once superseded by this audit.

---

## 9. Production Readiness Score

| Category | Score /100 | Rationale |
|---|:---:|---|
| Frontend–API Integration | 75 | Most pages genuinely wired; legacy mock admin panel and simulated PPOB inquiries drag it down |
| Backend Business Logic Integrity | 62 | Real CRUD dominant, but multiple fully-fake dashboards and at least one likely fatal runtime bug |
| Database Design / Single Source of Truth | 65 | Wallet/Transactions clean; Products and 3-way settings overlap need consolidation |
| Provider Integration (Digiflazz + VIP) | 32 | Digiflazz transacts but doesn't sync or self-monitor; VIP Payment is entirely absent |
| CMS & Content Propagation | 75 | Core CMS genuinely propagates; Promotion/Announcement stranded from public consumption; legacy mock CMS still present |
| Mobile / API Readiness | 42 | Solid auth/JSON/pagination foundation; version-gate, push, CORS, rate-limiting all missing |
| Security Posture | 50 | OTP leaked in responses, sandbox bypass paths reachable, weak seeded credentials, CORS wide open only to localhost (fine for dev, blocking for prod) |

### **Overall Production Readiness Score: 58 / 100 — "Late Beta / Staging Grade, Not Production-Ready"**

---

## 10. Final Conclusion

GurkyNet has moved well past a prototype: its architecture is deliberate, its role system is coherent, and the majority of its admin surface genuinely talks to a real Laravel API backed by a real database — the earlier "everything is mocked" characterization in the repo's own historical QA files is now largely outdated. That is real progress and should be recognized as such.

But a PPOB platform is judged on the parts that are still incomplete here: **whether the catalog, prices, and stock it sells are actually live**, and **whether the numbers shown to the business (health, analytics, support metrics) can be trusted**. Today, the answer to both is "partially, and sometimes not at all." Digiflazz can process a purchase, but nothing keeps its catalog current, and its own status is a hardcoded string. VIP Payment is a UI promise with no backend behind it. Several dashboards — most visibly Customer Support and Owner's System Health — will show confident-looking fake data forever if their tables happen to be empty, which is exactly the condition a fresh production deployment starts in.

**Recommendation:** Do not proceed to full production implementation until the P0 items in §7 are resolved (they include at least one likely fatal bug and one architecturally confusing duplicate system) and the Digiflazz sync/health gap in P1 is closed. Everything else in this report — mobile readiness, database consolidation, security hardening — is real, necessary work, but it is sequenceable after the platform can honestly claim to sell from a live, self-monitoring supplier catalog.

# Product Provider Sync + Operations Catalog — Execution Report

## Source-of-truth note (flagged, not blocking)

The task named **"SRS GurkyNet v2.2 CLEAN"** as source #1. That exact file does not exist
anywhere in this repository. The only SRS document present is
`docs/archive/SRS_Sistem_PPOB_v1.0_DRAFT.pdf` (55 pages) — but its section numbers
(Bagian 15 = multi-provider H2H integration, Bagian 9.1 = H2H interface, Bagian 5 = RBAC
matrix, Bagian 12 = differentiators) match exactly what `SPRINT10_EXECUTION_REPORT.md`,
`SPRINT15_AUDIT_REPORT.md`, etc. cite as "SRS v2.2 CLEAN — Bagian X". It's almost certainly
the same content under a different label/version that was never checked into the repo. This
report treats the v1.0 DRAFT + `.cursorrules` + the Sprint 2/6/10/15/17 reports as the
working source of truth, consistent with how every prior sprint in this codebase has already
operated. Flagging per the STOP RULE rather than silently assuming — worth confirming with
the user whether a newer SRS revision exists outside the repo.

## Root cause

The pipeline (Digiflazz/VIP → sync → Operations → User) is **far more built-out than the
symptom list implied** — both providers already have real fetch→normalize→upsert Actions,
category mapping is consistently applied, and cost/selling-price are already correctly
separated with margin preservation. The actual gaps were narrower and more specific:

1. **VIPayment never deactivated retired SKUs.** Digiflazz has a full retirement pass
   (`ProviderRepository::deactivateMissingDigiflazzSkus`); VIP's sync action had no
   equivalent — confirmed by a hardcoded `'disabled' => 0` inside its own result-summary
   code in `ProductProviderControlService::syncNow()`. A VIP product that disappeared from
   the provider's catalog would stay "active" and purchasable forever.
2. **No dedicated, queryable sync-run history.** Sync state was scattered across an
   overwrite-only `settings` blob (Digiflazz only, last-run snapshot, no history),
   generic `activity_logs`, and generic `product_provider_logs` — no single table with
   `started_at/completed_at/created/updated/deactivated/error` counts per run.
3. **Unmapped products were invisible.** `ProductMappingService::map()` already computes a
   `source` field (`brand_override` / `provider_category` / `name_keyword` /
   `unmapped_fallback`) on every sync, but it was discarded — never persisted, never
   surfaced to Operations.
4. **VIP had no command/job parity with Digiflazz.** `digiflazz:sync` +
   `SyncDigiflazzCatalogJob` exist; VIP could only be synced via the generic
   Product Provider Control Center endpoint or as a leg of the daily orchestrator.
5. **No per-product sync visibility in `ProductResource`.** Sync metadata lived only at
   the provider level (`product_providers.last_sync_at`), not exposed per product.

Everything else audited (RBAC, price separation, category-priority mapping, "keep last
known good" failure handling for Digiflazz, anti-double-dispatch failover) was **already
correct** and is left untouched, per the "reuse, don't rebuild" directive.

## Architecture (confirmed, unchanged)

```
Digiflazz fetchPriceList()  ─┐
                              ├─→ SyncDigiflazzCatalogAction ─→ ProviderRepository::syncWithDigiflazz()
VIP prepaidServices()/       │                                   (+ digiflazz_products mirror)
  gameServices()            ─┘
                                        │
                          ProductMappingService::map()  (brand_override → provider_category → name_keyword → unmapped_fallback)
                                        │
                                 products / product_provider_skus / product_categories
                                        │
                    ┌───────────────────┴───────────────────┐
              ProductResource                          ProductResource
           (GET /admin/operations/products)          (GET /products)
                 Operations                                User
```

One resource, one query surface, one category-mapping pass — Operations and User read the
identical synced catalog, per Phase 10/24. No second catalog engine was introduced.

## Digiflazz sync — changes

- Added `triggered_by` (`scheduled` | `manual` | `queued`) threading through
  `SyncDigiflazzCatalogAction::execute($options)`, `RunAutomaticCatalogSyncAction` (maps its
  existing `source=scheduler` → `triggered_by=scheduled`), and `SyncDigiflazzCatalogJob`
  (defaults to `queued`).
- Every exit path of `persistSyncMeta()` (success, partial, failed, RC error, config
  missing) now also writes one `ProductSyncRun` row — additive, the existing
  `Setting`/`ActivityLog` mirrors are untouched for backward compatibility with the Control
  Center UI.
- `ProviderRepository::syncWithDigiflazz()` now persists `ProductMappingService`'s
  classification `source` onto `products.category_mapping_source` on both create and
  update.
- Retirement pass (`deactivateMissingDigiflazzSkus`), margin-preserving price sync, and
  RC83/partial-fetch safety were already correct — unchanged.

## VIP sync — changes

- **New retirement pass** (`SyncVipCatalogAction::deactivateMissingVipSkus()`), mirroring
  the Digiflazz pattern: diffs this run's seen provider SKUs against currently-active
  `ProductProviderSku` rows for the VIP provider, soft-disables missing ones
  (`is_active=false`), and only flips `products.status=false` for products VIP itself owns
  (`sku_code LIKE 'VIP-%'` AND `product_provider_id = vip`) — never touches a shared master
  product that a Digiflazz offer might still be able to sell.
- **Partial-fetch safety**: VIP's optional game-feature catalog can fail independently of
  the required prepaid catalog. If it fails, the retirement pass is skipped entirely for
  that run (logged explicitly) rather than treating game-category products as "missing" —
  Phase 16's "only update record yang memang tervalidasi" principle applied to a case the
  existing Digiflazz per-`list_type` scoping didn't need to handle.
- `category_mapping_source` persisted on both the update and create paths (same as
  Digiflazz).
- `ProductSyncRun` recorded on all three exit points: credentials missing, prepaid fetch
  failed, and the success/partial path at the end of `execute()`.
- `ProductProviderControlService::syncNow()`'s hardcoded VIP `'disabled' => 0` now reads the
  real count from the sync result.
- **New `vip:sync` Artisan command** (mirrors `digiflazz:sync`: `--queue` flag, same table
  output shape) and **new `SyncVipCatalogJob`** (mirrors `SyncDigiflazzCatalogJob`) — command
  and queue-dispatch parity with Digiflazz, same pipeline shape, no second conceptually
  different engine.

## Category mapping

No changes beyond what shipped in a prior session (provider-category-outranks-name-keyword
priority fix, already tested in `ProductMappingServiceTest`). This task adds the **visibility**
layer on top: `category_mapping_source` is now a real column, populated by both sync paths,
exposed as `categoryMappingSource` on `ProductResource`, and filterable by Operations via
`GET /admin/operations/products?unmapped=1` (matches `category_mapping_source = 'unmapped_fallback'`).

## Pricing

Verified, not modified: provider sync writes `products.base_price` (cost) and recomputes
`sell_price` by **preserving the existing margin** (`sell_price - base_price - admin_fee`
carried forward), never copying the provider's own price straight into `sell_price`.
`ops_status`, `ProductPrice` (agent tiers), and `PartnerProductPrice` (partner tiers) are
never touched by either sync path — confirmed by grep (zero references) and by a new
regression test (`test_agent_pricing_is_untouched_by_sync`).

## Availability

Verified, not modified. `products.status` (boolean) is written by sync from the provider's
buyer/seller status flags; `ops_status` (Operations-exclusive override) is never touched by
sync. `AvailabilityService::getStatus()` already checks `ops_status` first, then routes
through `ProductRoutingService` for product-centric multi-provider sellability.

## Operations

- `GET /admin/operations/products?unmapped=1` — new filter for uncategorized-fallback
  products (Phase 20).
- `GET /admin/operations/sync-runs` — new endpoint, last N sync runs (Digiflazz + VIP),
  newest first, optional `provider_code` filter. Never includes credentials — verified by a
  dedicated regression test.
- `ProductResource` gained `categoryMappingSource` and `lastSyncedAt` (from the owning
  `product_providers.last_sync_at` — no per-product sync timestamp exists, every product
  sharing a provider shares that provider's last successful run).
- No new frontend UI was built (per Phase 11's "Jangan membuat UI dashboard besar" and
  Phase 24 scope) — the existing Product Management (`OperationsProductManagement.tsx`) and
  Provider Control Center (`OperationsProductProviderControl.tsx`) pages already exist and
  already have a working "Sync Now" button; the new fields/endpoints above are ready for
  those pages to consume as a follow-up, not built in this pass.

## User catalog

Unchanged and reverified: `GET /products` reads the same `products` table through the same
`ProductMappingService`-driven category filter as Operations. No frontend or backend
user-reachable code path calls Digiflazz/VIP directly (confirmed by audit grep — zero hits
outside webhooks and admin-only sync/health-check routes).

## Scheduler

**Left as-is, per "reuse, don't invent an interval."** The SRS specifies a health-check
interval (1–2 min) and a transaction-dispatch timeout (10–15s), but never a catalog-sync
frequency. What's actually implemented — `Schedule::command('ppob:catalog-auto-sync')
->dailyAt(config('ppob.catalog_auto_sync.daily_at', '23:59'))` — is already config-driven
(satisfies Phase 13's "gunakan config-driven value dan dokumentasikan sebagai decision"
requirement on its own). Note for the record: an earlier sprint report describes an *hourly*
schedule as originally implemented, and a separate non-SRS blueprint document proposes
daily(01:00)+6-hourly — these three numbers don't agree with each other or with the current
`routes/console.php` entry. Since none of them come from the SRS itself and the current
value is already config-driven and reversible via `.env`, this was left untouched rather
than "fixed" toward an unconfirmed target — flagging the discrepancy for the user rather
than picking a winner.

## Manual sync (RBAC)

Verified, not modified — already exactly matches the SRS §5 RBAC matrix: `operations` role
has full access to Master Produk & Kategori and Koneksi Supplier (H2H); `owner` is
enforced read-only on this module (`EnsureOwnerReadOnly` middleware blocks any non-GET);
`finance`/`marketing`/`customer_support`/`user` have no access at all. Covered by
`test_manual_sync_rbac_operations_can_trigger_owner_cannot`.

## Failures / safety

- Digiflazz: unchanged, already correct — RC83/rate-limit responses never touch the DB for
  that `list_type`; zero-rows-with-errors throws before any upsert; retirement only runs
  against `list_type`s that were actually fetched this run.
- VIP: **new** — retirement now runs, but only when every requested catalog source
  succeeded this run (see "VIP sync — changes" above). A failed prepaid fetch throws before
  any product write, matching the Digiflazz pattern.
- Every failure/success path (both providers) now also writes a `ProductSyncRun` row with
  `status` ∈ {success, partial, failed} for auditability.

## Migrations

Both additive, both reversible (`up`/`down`):
- `2026_08_28_910001_create_product_sync_runs_table.php` — new table, no existing schema
  touched.
- `2026_08_28_910002_add_category_mapping_source_to_products_table.php` — one nullable
  column added to `products`, no data migration needed (existing rows simply read `null`
  until their next sync).

Neither deletes or drops any existing product, transaction, or wallet data.

## Tests

New: `laravel/tests/Feature/ProductProviderCatalogSyncTest.php` — 21 tests, all real
assertions against the actual changed code paths (no dummy tests):

- Digiflazz: create, update-preserves-margin, deactivate-missing, failure-preserves-catalog,
  category-mapping-source persisted, sync-run recorded with correct counts.
- VIP: create, update, **deactivate-missing (new behavior)**, **partial-fetch-safety (new
  behavior)**, failure-preserves-catalog, sync-run recorded, category-mapping-source
  persisted.
- Cross-cutting: duplicate sync doesn't duplicate products, inactive product hidden from
  user catalog, User and Operations read the identical synced record, agent-tier pricing
  untouched by sync, unmapped product flagged + filterable by Operations, manual-sync RBAC
  (operations can, owner/user cannot), sync-run log never leaks credentials,
  `lastSyncedAt` exposed on the product resource.

A test-authoring bug was caught and fixed during this pass: `Http::fake()` merges stub
callbacks across calls within one test rather than replacing them, so a test needing two
different responses from the same URL (e.g. "sync once, change the catalog, sync again")
must register one closure-backed fake and mutate a property between calls, not call
`Http::fake()` twice. Documented inline in the test file so future tests in this suite don't
repeat it.

## Regression

- `cd laravel && php artisan test` — **880 passed / 1 pre-existing failure**
  (`Tests\Feature\Admin\FinanceTest::finance user can list settlements` — a missing
  `pagination` key in an unrelated Finance settlements endpoint; confirmed identical on a
  clean `git stash` before this task's changes, unrelated to catalog sync).
- `npm run lint` (`tsc --noEmit`) — same 22 pre-existing errors as before this task, all in
  files this task never touched (`DashboardLayout.tsx`, `AccountReferralPage.tsx`,
  `finance.store.ts`, etc.) — zero new errors.
- `npm run build` — succeeds.

No regression was introduced by this task's changes.

## Findings not acted on (explicitly out of scope)

- `SyncVipCatalogAction` still contains extensive `Log::info('VIP SYNC TRACE — ...')` calls
  at every stage — reads like a debugging harness left in production code. Left alone: not a
  functional gap, and touching it would add unrelated diff noise to a file already changed
  for the real fix in this pass.
- The Digiflazz/blueprint/sprint-report sync-interval disagreement noted under "Scheduler"
  above — flagged for the user, not resolved unilaterally.
- No new Operations frontend UI was built for the new `unmapped` filter, `sync-runs`
  endpoint, or `categoryMappingSource`/`lastSyncedAt` fields — per Phase 11's explicit
  "don't build a big new dashboard" and Phase 24 scope discipline. The API surface is ready;
  wiring it into `OperationsProductManagement.tsx` / `OperationsProductProviderControl.tsx`
  is a natural, small follow-up.
- Cross-provider "same product, different SKU" duplicate detection (Phase 6) — the existing
  `findMatchingMasterProduct()` heuristic (same operator + exact case-insensitive name
  match) was left as-is; it's already the deterministic-identity approach the phase asks
  for ("jangan mengarang matching algorithm kompleks"), and extending it wasn't triggered by
  any concrete gap found in the audit.

## Out of scope (untouched, confirmed)

Wallet, idempotency, transaction state machine, refund, Midtrans, KYC, loyalty, referral,
Partner H2H, Voucher Internet feature, Top Up, `ProviderAdapter`/`ProviderRouter` fulfillment
logic (only the catalog-sync layer above it was touched) — none of these files were opened
for writing in this task.
